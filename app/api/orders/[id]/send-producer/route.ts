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

// Email the producer a link to download this order's setup photos + videos.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { to, cc, bcc, note } = await req.json().catch(() => ({}))
    const toClean = (to || '').trim()
    if (!toClean) {
      return NextResponse.json(
        { error: 'No recipient — set a producer email in Settings or type one in.' },
        { status: 400 },
      )
    }
    const snap = await adminDb.collection('orders').doc(params.id).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    if (!isEmailConfigured()) {
      return NextResponse.json({ error: 'Email not configured.' }, { status: 500 })
    }

    const who = customerName(order.customer) || 'event'
    const when = order.event?.eventDate ? ` (${order.event.eventDate})` : ''
    const producerUrl = `${baseUrl(req)}/producer/${order.id}`
    const nPhotos = (order.setupPhotos || []).length
    const nVideos = (order.videos || []).length

    const noteBlock = (note || '').trim()
      ? `<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:12px 16px;border-radius:8px;margin-bottom:18px;color:#166534;line-height:1.5;white-space:pre-wrap;">${esc((note || '').trim())}</div>`
      : ''
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5;">
      <h1 style="color:#7c2d91;font-size:20px;">${business} — content</h1>
      ${noteBlock}
      <p>Content from <strong>${who}</strong>${when}: ${nPhotos} photo(s), ${nVideos} video(s).</p>
      <p>Download everything here:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${producerUrl}" style="display:inline-block;background:#7c2d91;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;line-height:1.4;">
          ⬇ Download content
        </a>
      </p>
    </div>`

    await sendMail({
      to: toClean,
      cc: (cc || '').trim() || undefined,
      bcc: (bcc || '').trim() || undefined,
      subject: `Content — ${who}${when}`,
      html,
    })

    return NextResponse.json({
      ok: true,
      to: toClean,
      cc: (cc || '').trim() || null,
      bcc: (bcc || '').trim() || null,
    })
  } catch (e: any) {
    console.error('send-producer error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
