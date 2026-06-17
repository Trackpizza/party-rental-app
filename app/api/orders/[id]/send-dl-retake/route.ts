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

// Email the customer their order link asking them to retake a blurry driver's
// license photo, with an optional personal note (green box) and optional CC.
// The link lands on the signed screen, which shows the "Retake license photo"
// button — the signature stays frozen.
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
    const retakeUrl = `${baseUrl(req)}/order/${order.id}`
    const name = customerName(order.customer).trim()
    const enGreet = name ? `Hi ${name},` : 'Hi there,'
    const esGreet = name ? `Hola ${name},` : 'Hola,'
    const noteBlock = (note || '').trim()
      ? `<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:12px 16px;border-radius:8px;margin-bottom:18px;color:#166534;line-height:1.5;white-space:pre-wrap;">${esc((note || '').trim())}</div>`
      : ''

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5;">
      <h1 style="color:#7c2d91;font-size:20px;">${business}</h1>
      ${noteBlock}
      <p>${enGreet} &nbsp;/&nbsp; ${esGreet}</p>
      <p>Your driver&apos;s license photo came out too blurry to read. Please open
      the link below and tap &ldquo;Retake license photo&rdquo; — your signature
      stays exactly as it is.</p>
      <p>La foto de su licencia de conducir salió borrosa. Abra el enlace de abajo
      y toque &ldquo;Retake license photo&rdquo; — su firma no cambia.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${retakeUrl}" style="display:inline-block;background:#7c2d91;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;line-height:1.4;">
          📷 Retake license photo &nbsp;·&nbsp; Tomar otra foto
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:20px;">${business}<br/>${process.env.NEXT_PUBLIC_BUSINESS_PHONE || ''}</p>
    </div>`

    await sendMail({
      to,
      cc: ccClean || undefined,
      subject: `Please retake your license photo — ${business}`,
      html,
    })

    await ref.update({ updatedAt: new Date().toISOString() })

    return NextResponse.json({ ok: true, emailed: true, to, cc: ccClean || null, retakeUrl })
  } catch (e: any) {
    console.error('send-dl-retake error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
