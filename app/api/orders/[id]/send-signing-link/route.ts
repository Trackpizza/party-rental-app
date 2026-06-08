import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { sendMail, isEmailConfigured } from '@/lib/email'
import { Order } from '@/lib/types'

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

// Email the customer their signing link, with an optional personal note
// (shown in a green box) and an optional CC.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { note, cc } = await req.json()

    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    const to = order.customer?.email?.trim()
    if (!to) {
      return NextResponse.json({ error: 'No customer email on file.' }, { status: 400 })
    }
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: 'Email not configured.' }, { status: 500 })
    }

    const ccClean = (cc || '').trim()
    const signingUrl = `${baseUrl(req)}/order/${order.id}`
    const name = order.customer.name?.trim()
    const enGreet = name ? `Hi ${name},` : 'Hi there,'
    const esGreet = name ? `Hola ${name},` : 'Hola,'
    const noteBlock = (note || '').trim()
      ? `<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:12px 16px;border-radius:8px;margin-bottom:18px;color:#166534;white-space:pre-wrap;">${esc((note || '').trim())}</div>`
      : ''

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
      <h1 style="color:#7c2d91;font-size:20px;">${business}</h1>
      ${noteBlock}
      <p>${enGreet} &nbsp;/&nbsp; ${esGreet}</p>
      <p>Please review and sign your rental order using the button below.</p>
      <p>Por favor revise y firme su orden de alquiler con el botón de abajo.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${signingUrl}" style="background:#7c2d91;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">
          ✍️ Review &amp; sign · Revisar y firmar
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:20px;">${business}<br/>${process.env.NEXT_PUBLIC_BUSINESS_PHONE || ''}</p>
    </div>`

    await sendMail({
      to,
      cc: ccClean || undefined,
      subject: `Please review & sign your order — ${business}`,
      html,
    })

    const patch: any = {
      sentAt: order.sentAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (order.status === 'draft') patch.status = 'sent'
    await ref.update(patch)

    return NextResponse.json({ ok: true, emailed: true, to, cc: ccClean || null })
  } catch (e: any) {
    console.error('send-signing-link error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
