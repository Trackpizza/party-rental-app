import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { sendMail, isEmailConfigured } from '@/lib/email'
import { Order, customerName } from '@/lib/types'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

function baseUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  return `${proto}://${host}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Email a team member the crew job-ticket link (customer, address, equipment,
// balance to collect) — no driver's license, contract, or signature. The link
// itself needs no login. Optionally BCC other crew + add a note.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { to, bcc, note } = await req.json().catch(() => ({}))
    const toClean = (to || '').trim()
    if (!toClean) {
      return NextResponse.json({ error: 'A recipient email is required.' }, { status: 400 })
    }
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: 'Email not configured.' }, { status: 500 })
    }

    const snap = await adminDb.collection('orders').doc(params.id).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    const jobUrl = `${baseUrl(req)}/job/${order.id}`
    const who = customerName(order.customer) || 'the event'
    const when = order.event?.eventDate ? ` (${order.event.eventDate})` : ''
    const noteBlock = (note || '').trim()
      ? `<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:12px 16px;border-radius:8px;margin-bottom:18px;color:#166534;line-height:1.5;white-space:pre-wrap;">${esc((note || '').trim())}</div>`
      : ''

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5;">
      <h1 style="color:#7c2d91;font-size:20px;">${business}</h1>
      ${noteBlock}
      <p>Delivery job for <strong>${who}</strong>${when}.</p>
      <p>Tap to open the job ticket — address, equipment, and balance to collect:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${jobUrl}" style="display:inline-block;background:#7c2d91;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;line-height:1.4;">
          📋 Open job ticket · Ver hoja de entrega
        </a>
      </p>
      <p style="color:#999;font-size:12px;">${business}</p>
    </div>`

    await sendMail({
      to: toClean,
      bcc: (bcc || '').trim() || undefined,
      subject: `Delivery job — ${who}${when}`,
      html,
    })

    return NextResponse.json({
      ok: true,
      to: toClean,
      bcc: (bcc || '').trim() || null,
      jobUrl,
    })
  } catch (e: any) {
    console.error('send-job error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
