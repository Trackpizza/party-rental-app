import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Mark an order completed. The receipt is sent separately from the order
// page (Send final receipt), so the owner controls CC/BCC/note each time.
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

    const now = new Date().toISOString()
    await ref.update({
      completedAt: order.completedAt || now,
      status: 'completed',
      updatedAt: now,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('complete error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
