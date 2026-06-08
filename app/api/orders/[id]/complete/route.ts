import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { buildReceiptHtml } from '@/lib/receipt'
import { sendMail, isEmailConfigured } from '@/lib/email'
import { Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

// Mark an order completed and email the final receipt to the customer.
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

    // Email the receipt if we have an address and email is configured.
    let emailed = false
    let reason = ''
    const to = order.customer?.email?.trim()
    if (!to) {
      reason = 'no customer email on file'
    } else if (!isEmailConfigured()) {
      reason = 'email not configured'
    } else {
      try {
        await sendMail({
          to,
          subject: `Your receipt — ${business}`,
          html: buildReceiptHtml({ ...order, completedAt: now }, business),
        })
        emailed = true
      } catch (e: any) {
        reason = e?.message || 'send failed'
      }
    }

    return NextResponse.json({ ok: true, emailed, reason, to: to || null })
  } catch (e: any) {
    console.error('complete error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
