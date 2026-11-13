import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { upsertEvent, deleteEvent, CalendarError } from '@/lib/googleCalendar'
import type { Order } from '@/lib/types'
import { customerName, itemName } from '@/lib/types'
import { calendarKey, formatTime } from '@/lib/orders'

export const dynamic = 'force-dynamic'

// Push this order's delivery and pickup onto the business Google Calendar.
// Owner-only: writing to the calendar is a staff action, and unlike the public
// upload routes there is no customer-facing reason to reach this.
//
// Idempotent by design — event ids are stored on the order, so re-running after
// a reschedule moves the existing events rather than adding more. Pass
// { remove: true } to clear this order's events (used before deleting an order).

/** Default block length when the owner hasn't given an end time. */
const DEFAULT_HOURS = 2

function addHours(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const end = new Date(2000, 0, 1, h, m)
  end.setHours(end.getHours() + hours)
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
}

/** "YYYY-MM-DD" + "HH:mm" → the local wall-clock string the API pairs with a zone. */
function localDateTime(date: string, time: string): string {
  return `${date}T${(time || '09:00').padStart(5, '0')}:00`
}

function addressOf(o: Order): string {
  const c = o.customer
  return [c.address, c.address2, c.city, c.state, c.zip].filter(Boolean).join(', ')
}

function describe(o: Order, kind: 'Delivery' | 'Pickup'): string {
  const items = o.items
    .filter((i) => i.qty || i.amount || (i.options && i.options.length) || i.description || i.note)
    .map((i) => `• ${itemName(i)}${i.qty ? ` ×${i.qty}` : ''}`)
  const when =
    kind === 'Delivery'
      ? formatTime(o.event.deliveryTime)
      : formatTime(o.event.pickupTime)
  const lines = [
    `${kind} — ${customerName(o.customer) || 'Customer'}`,
    when ? `${kind} time: ${when}` : '',
    o.customer.phone ? `Phone: ${o.customer.phone}` : '',
    o.event.eventName ? `Event: ${o.event.eventName}` : '',
    '',
    items.length ? 'Items:' : '',
    ...items,
  ]
  if (o.event.stairs || o.event.notes || (o.event.surfaces || []).length) {
    lines.push('', 'Setup notes:')
    if (o.event.stairs) lines.push('• Stairs present')
    if ((o.event.surfaces || []).length) lines.push(`• Surface: ${o.event.surfaces.join(', ')}`)
    if (o.event.notes) lines.push(`• ${o.event.notes}`)
  }
  return lines.filter((l) => l !== undefined).join('\n').trim()
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authz = req.headers.get('authorization') || ''
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await adminAuth.verifyIdToken(token) // throws if invalid

    const remove = (await req.json().catch(() => ({})))?.remove === true

    const bizSnap = await adminDb.collection('settings').doc('business').get()
    const biz: any = bizSnap.exists ? bizSnap.data() : {}
    const calendarId = (biz.calendarId || '').trim()
    const timeZone = (biz.calendarTimeZone || 'America/Los_Angeles').trim()
    if (biz.calendarSync !== true || !calendarId) {
      return NextResponse.json({ ok: true, skipped: 'Calendar sync is off.' })
    }

    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    const existingDelivery = order.gcalDeliveryEventId || null
    const existingPickup = order.gcalPickupEventId || null

    // Clearing: drop both events and forget their ids.
    if (remove) {
      if (existingDelivery) await deleteEvent(calendarId, existingDelivery)
      if (existingPickup) await deleteEvent(calendarId, existingPickup)
      await ref.update({
        gcalDeliveryEventId: null,
        gcalPickupEventId: null,
        gcalSyncedAt: null,
        gcalSyncedKey: null,
        updatedAt: new Date().toISOString(),
      })
      return NextResponse.json({ ok: true, removed: true })
    }

    const who = customerName(order.customer) || 'Customer'
    const location = addressOf(order)
    const now = new Date().toISOString()
    const patch: Record<string, any> = { updatedAt: now }

    // Delivery — anchored to the event date.
    if (order.event.eventDate) {
      const t = order.event.deliveryTime || '09:00'
      patch.gcalDeliveryEventId = await upsertEvent(calendarId, existingDelivery, {
        summary: `Delivery — ${who}`,
        description: describe(order, 'Delivery'),
        location,
        start: localDateTime(order.event.eventDate, t),
        end: localDateTime(order.event.eventDate, addHours(t, DEFAULT_HOURS)),
        timeZone,
      })
    } else if (existingDelivery) {
      // The date was cleared — take the event down rather than leaving it stale.
      await deleteEvent(calendarId, existingDelivery)
      patch.gcalDeliveryEventId = null
    }

    // Pickup — its own date, falling back to the event date.
    const pickupDate = order.event.pickupDate || order.event.eventDate
    if (pickupDate) {
      const t = order.event.pickupTime || '09:00'
      patch.gcalPickupEventId = await upsertEvent(calendarId, existingPickup, {
        summary: `Pickup — ${who}`,
        description: describe(order, 'Pickup'),
        location,
        start: localDateTime(pickupDate, t),
        end: localDateTime(pickupDate, addHours(t, DEFAULT_HOURS)),
        timeZone,
      })
    } else if (existingPickup) {
      await deleteEvent(calendarId, existingPickup)
      patch.gcalPickupEventId = null
    }

    patch.gcalSyncedAt = now
    // Record what was synced, so the order page can tell current from stale.
    patch.gcalSyncedKey = calendarKey(order)
    await ref.update(patch)

    return NextResponse.json({
      ok: true,
      delivery: patch.gcalDeliveryEventId ?? null,
      pickup: patch.gcalPickupEventId ?? null,
    })
  } catch (e: any) {
    if (e instanceof CalendarError) {
      // 404 here almost always means the calendar id is wrong or was never
      // shared with the service account — say so instead of "Server error".
      const hint =
        e.status === 404
          ? 'Calendar not found. Check the Calendar ID and that it is shared with the service account.'
          : e.status === 403
            ? 'The service account does not have "Make changes to events" on that calendar.'
            : `Google Calendar error ${e.status}.`
      console.error('calendar-sync', e.status, e.body)
      return NextResponse.json({ error: hint }, { status: 502 })
    }
    console.error('calendar-sync error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
