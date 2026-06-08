import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { buildReceiptHtml } from '@/lib/receipt'
import { sendMail, isEmailConfigured } from '@/lib/email'
import { Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

// Email the final receipt to a recipient with optional CC/BCC and a note.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { to, cc, bcc, note } = await req.json()
    const toClean = (to || '').trim()
    if (!toClean) {
      return NextResponse.json({ error: 'A recipient email is required.' }, { status: 400 })
    }
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: 'Email not configured.' }, { status: 500 })
    }

    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    await sendMail({
      to: toClean,
      cc: (cc || '').trim() || undefined,
      bcc: (bcc || '').trim() || undefined,
      subject: `Your receipt — ${business}`,
      html: buildReceiptHtml(order, business, note),
    })
    await ref.update({ receiptSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

    return NextResponse.json({
      ok: true,
      emailed: true,
      to: toClean,
      cc: (cc || '').trim() || null,
      bcc: (bcc || '').trim() || null,
    })
  } catch (e: any) {
    console.error('send-receipt error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
