import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminStorage } from '@/lib/firebase/admin'
import { Order } from '@/lib/types'
import { deleteEvent } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

// Permanently delete an UNSIGNED order (draft / mistake / test). Signed orders
// are protected — they're the liability record and must be archived, not
// deleted. Also removes any uploaded files (DL photos, setup photos, videos) so
// nothing — especially sensitive ID images — is left orphaned in storage.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    if (order.signature) {
      return NextResponse.json(
        { error: 'Signed orders can’t be deleted. Archive it instead.' },
        { status: 400 },
      )
    }

    // Best-effort storage cleanup — don't fail the delete if a file is missing.
    const paths = [
      ...(order.dlPhotos || []).map((p) => p.storagePath),
      ...(order.setupPhotos || []).map((p) => p.storagePath),
      ...(order.videos || []).map((v) => v.storagePath),
    ].filter(Boolean)

    await Promise.all(
      paths.map((p) =>
        adminStorage
          .bucket()
          .file(p)
          .delete()
          .catch(() => {}),
      ),
    )

    // Best-effort calendar cleanup, same as storage: a stale Google event is
    // worse than a failed delete, but neither should block removing the order.
    const calSnap = await adminDb.collection('settings').doc('business').get()
    const cal: any = calSnap.exists ? calSnap.data() : {}
    const calendarId = (cal.calendarId || '').trim()
    if (calendarId) {
      await Promise.all(
        [order.gcalDeliveryEventId, order.gcalPickupEventId]
          .filter((id): id is string => !!id)
          .map((id) => deleteEvent(calendarId, id).catch(() => {})),
      )
    }

    await ref.delete()

    return NextResponse.json({ ok: true, deleted: order.id, filesRemoved: paths.length })
  } catch (e: any) {
    console.error('delete order error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
