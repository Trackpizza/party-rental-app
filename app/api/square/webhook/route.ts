import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifyWebhookSignature } from '@/lib/square'
import { Order } from '@/lib/types'
import { deriveStatus } from '@/lib/orders'

export const dynamic = 'force-dynamic'

function notificationUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  return `${proto}://${host}/api/square/webhook`
}

// Square webhook receiver. On a COMPLETED payment, match the Square order id to
// the order whose deposit link produced it, and auto-mark the deposit paid.
export async function POST(req: NextRequest) {
  // Raw body is required for signature verification (must match byte-for-byte).
  const rawBody = await req.text()
  const signature = req.headers.get('x-square-hmacsha256-signature')

  if (!verifyWebhookSignature(rawBody, signature, notificationUrl(req))) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Bad payload.' }, { status: 400 })
  }

  try {
    const payment = event?.data?.object?.payment
    const squareOrderId = payment?.order_id
    // Only act once money is actually captured.
    if (payment?.status !== 'COMPLETED' || !squareOrderId) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const q = await adminDb
      .collection('orders')
      .where('squareDepositOrderId', '==', squareOrderId)
      .limit(1)
      .get()
    if (q.empty) {
      // Not one of our deposit links (or order deleted) — ack so Square stops retrying.
      return NextResponse.json({ ok: true, matched: false })
    }

    const doc = q.docs[0]
    const order = { id: doc.id, ...(doc.data() as Omit<Order, 'id'>) }
    if (order.depositPaid) {
      return NextResponse.json({ ok: true, alreadyPaid: true })
    }

    const patch: Partial<Order> = {
      depositPaid: true,
      depositPaidAt: new Date().toISOString(),
      depositPaidVia: 'square',
      updatedAt: new Date().toISOString(),
    }
    await doc.ref.update({ ...patch, status: deriveStatus({ ...order, ...patch }) })

    return NextResponse.json({ ok: true, marked: order.id })
  } catch (e: any) {
    console.error('square webhook error', e)
    // 200 so Square doesn't hammer retries on a transient bug; we logged it.
    return NextResponse.json({ ok: false, error: e?.message || 'error' })
  }
}
