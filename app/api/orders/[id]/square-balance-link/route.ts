import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { createPaymentLink, isSquareConfigured, toCents } from '@/lib/square'
import { Order, customerName, itemName } from '@/lib/types'
import { amountOwed, deriveStatus } from '@/lib/orders'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

function toE164(phone: string | undefined): string | undefined {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return undefined
}

// Create (or refresh) a Square link for the amount the customer currently owes
// (full total if nothing's paid, else the balance). Used by staff/delivery on
// site and by the owner from the admin. Public route (crew uses it without auth),
// write-only like the other order routes.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!isSquareConfigured()) {
      return NextResponse.json({ error: 'Square is not configured yet.' }, { status: 500 })
    }
    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    const owed = amountOwed(order)
    if (owed <= 0) {
      return NextResponse.json(
        { error: 'This order is already paid in full.' },
        { status: 400 },
      )
    }

    // Title the customer sees on the Square checkout: business + the event (or
    // customer name) so they recognize what it's for.
    const label = (order.event.eventName || '').trim() || customerName(order.customer).trim()
    const note = (order.paymentNote || '').trim()
    const title = [business, label, 'Balance due', note].filter(Boolean).join(' · ').slice(0, 255)
    const items = order.items
      .filter((i) => i.qty || (i.options && i.options.length) || i.description)
      .map((i) => itemName(i))
      .filter(Boolean)
    const description = items.length
      ? `Balance due for: ${items.join(', ')}`
      : 'Rental balance due'

    const link = await createPaymentLink({
      name: title,
      amountDollars: owed,
      description: description.slice(0, 250),
      buyerEmail: order.customer.email?.trim() || undefined,
      buyerPhone: toE164(order.customer.phone),
      idempotencyKey: `balance-${order.id}-${toCents(owed)}`,
    })

    const patch: Partial<Order> = {
      squareBalanceLink: link.url,
      squareBalanceOrderId: link.orderId,
      squareBalanceAmount: owed,
      paymentMethod: order.paymentMethod || 'square',
      updatedAt: new Date().toISOString(),
    }
    await ref.update({ ...patch, status: deriveStatus({ ...order, ...patch }) })

    return NextResponse.json({ ok: true, url: link.url, amount: owed })
  } catch (e: any) {
    console.error('square-balance-link error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
