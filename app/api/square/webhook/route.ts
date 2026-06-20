import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifyWebhookSignature } from '@/lib/square'
import { Order } from '@/lib/types'
import { deriveStatus } from '@/lib/orders'

export const dynamic = 'force-dynamic'

// Candidate notification URLs to verify the signature against. Square signs with
// the EXACT URL configured in the subscription; behind App Hosting's proxy the
// host header can differ, so we try the explicit configured URL first, then any
// request-derived hosts.
function candidateUrls(req: NextRequest): string[] {
  const path = '/api/square/webhook'
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const urls = new Set<string>()
  if (process.env.SQUARE_WEBHOOK_URL) urls.add(process.env.SQUARE_WEBHOOK_URL)
  const xfh = req.headers.get('x-forwarded-host')
  if (xfh) urls.add(`${proto}://${xfh}${path}`)
  const host = req.headers.get('host')
  if (host) urls.add(`${proto}://${host}${path}`)
  return Array.from(urls)
}

// Square webhook receiver. On a COMPLETED payment, match the Square order id to
// the order whose deposit link produced it, and auto-mark the deposit paid.
export async function POST(req: NextRequest) {
  // Raw body is required for signature verification (must match byte-for-byte).
  const rawBody = await req.text()
  const signature = req.headers.get('x-square-hmacsha256-signature')

  if (!verifyWebhookSignature(rawBody, signature, candidateUrls(req))) {
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

    // The payment's Square order id matches either our deposit link or our
    // balance/amount-owed link. Look up which.
    const byDeposit = await adminDb
      .collection('orders')
      .where('squareDepositOrderId', '==', squareOrderId)
      .limit(1)
      .get()
    const byBalance = byDeposit.empty
      ? await adminDb
          .collection('orders')
          .where('squareBalanceOrderId', '==', squareOrderId)
          .limit(1)
          .get()
      : null

    const doc = !byDeposit.empty ? byDeposit.docs[0] : byBalance && !byBalance.empty ? byBalance.docs[0] : null
    if (!doc) {
      // Not one of our links (or order deleted) — ack so Square stops retrying.
      return NextResponse.json({ ok: true, matched: false })
    }
    const isBalance = byDeposit.empty
    const order = { id: doc.id, ...(doc.data() as Omit<Order, 'id'>) }
    const now = new Date().toISOString()

    let patch: Partial<Order>
    if (isBalance) {
      // The amount-owed link covers everything still outstanding — settle the
      // whole order (also marks the deposit paid if it never was).
      if (order.balancePaid) {
        return NextResponse.json({ ok: true, alreadyPaid: true })
      }
      patch = {
        balancePaid: true,
        balancePaidAt: now,
        balancePaidVia: 'square',
        updatedAt: now,
      }
      if (!order.depositPaid) {
        patch.depositPaid = true
        patch.depositPaidAt = now
        patch.depositPaidVia = 'square'
      }
    } else {
      if (order.depositPaid) {
        return NextResponse.json({ ok: true, alreadyPaid: true })
      }
      patch = {
        depositPaid: true,
        depositPaidAt: now,
        depositPaidVia: 'square',
        updatedAt: now,
      }
    }
    await doc.ref.update({ ...patch, status: deriveStatus({ ...order, ...patch }) })

    return NextResponse.json({ ok: true, marked: order.id, kind: isBalance ? 'balance' : 'deposit' })
  } catch (e: any) {
    console.error('square webhook error', e)
    // 200 so Square doesn't hammer retries on a transient bug; we logged it.
    return NextResponse.json({ ok: false, error: e?.message || 'error' })
  }
}
