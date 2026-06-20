import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { createPaymentLink, isSquareConfigured, toCents } from '@/lib/square'
import { Order, customerName, itemName } from '@/lib/types'
import { deriveStatus } from '@/lib/orders'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

// Best-effort E.164 for Square's pre-populated phone (skip if we can't be sure).
function toE164(phone: string | undefined): string | undefined {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return undefined
}

// Create (or refresh) the Square deposit payment link for an order, store it on
// the order, and return the URL. Owner-only action (called from the admin).
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

    const deposit = order.totals.deposit
    if (!deposit || deposit <= 0) {
      return NextResponse.json(
        { error: 'Set a deposit amount on the order first.' },
        { status: 400 },
      )
    }

    const name = customerName(order.customer).trim()
    const title = `Deposit — ${business}${name ? ` (${name})` : ''}`
    const items = order.items
      .filter((i) => i.qty || (i.options && i.options.length) || i.description)
      .map((i) => itemName(i))
      .filter(Boolean)
    const description = items.length
      ? `Rental deposit for: ${items.join(', ')}`
      : 'Rental deposit'

    const link = await createPaymentLink({
      name: title,
      amountDollars: deposit,
      description: description.slice(0, 250),
      buyerEmail: order.customer.email?.trim() || undefined,
      buyerPhone: toE164(order.customer.phone),
      // Deterministic per order+amount: re-clicks reuse the same link; a changed
      // deposit makes a fresh one.
      idempotencyKey: `deposit-${order.id}-${toCents(deposit)}`,
    })

    const patch: Partial<Order> = {
      squareDepositLink: link.url,
      squareDepositOrderId: link.orderId,
      squareDepositAmount: deposit,
      // Surface it through the existing signing/receipt plumbing.
      squareLink: link.url,
      paymentMethod: order.paymentMethod || 'square',
      updatedAt: new Date().toISOString(),
    }
    await ref.update({ ...patch, status: deriveStatus({ ...order, ...patch }) })

    return NextResponse.json({ ok: true, url: link.url, amount: deposit })
  } catch (e: any) {
    console.error('square-link error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
