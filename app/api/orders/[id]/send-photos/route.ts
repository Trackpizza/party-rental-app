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

// Owner action: email the customer a link to their event-photo gallery
// (which carries the Google review CTA).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    const selected = (order.setupPhotos || []).filter((p) => p.selected)
    const count = selected.length || (order.setupPhotos || []).length
    if (count === 0) {
      return NextResponse.json({ error: 'No setup photos to send.' }, { status: 400 })
    }

    const to = order.customer?.email?.trim()
    if (!to) {
      return NextResponse.json({ error: 'No customer email on file.' }, { status: 400 })
    }
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: 'Email not configured.' }, { status: 500 })
    }

    const galleryUrl = `${baseUrl(req)}/gallery/${order.id}`
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
      <h1 style="color:#7c2d91;font-size:20px;">${business}</h1>
      <p>Hi ${order.customer.name || 'there'},</p>
      <p>Thank you for letting us be part of your event! We took some photos of the
      setup — view and download them here:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${galleryUrl}" style="background:#7c2d91;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">
          View your event photos 📸
        </a>
      </p>
      <p style="color:#555;">We hope you had a great time — if you did, a quick Google review
      means the world to a small business like ours. There's a button right on the photo page. 💜</p>
      <p style="color:#999;font-size:12px;margin-top:20px;">${business}<br/>${process.env.NEXT_PUBLIC_BUSINESS_PHONE || ''}</p>
    </div>`

    await sendMail({ to, subject: `📸 Photos from your event — ${business}`, html })
    await ref.update({ photosSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

    return NextResponse.json({ ok: true, emailed: true, to, count, galleryUrl })
  } catch (e: any) {
    console.error('send-photos error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
