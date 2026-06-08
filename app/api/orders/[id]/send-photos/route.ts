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
    const name = order.customer.name?.trim()
    const enGreet = name ? `Hi ${name},` : 'Hi there,'
    const esGreet = name ? `Hola ${name},` : 'Hola,'
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5;">
      <h1 style="color:#7c2d91;font-size:20px;">${business}</h1>
      <p>${enGreet} &nbsp;/&nbsp; ${esGreet}</p>
      <p>Thank you for choosing us for your event! We took some photos of your setup — view and download them below.</p>
      <p>¡Gracias por elegirnos para su evento! Tomamos algunas fotos de su montaje — véalas y descárguelas abajo.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${galleryUrl}" style="display:inline-block;background:#7c2d91;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;line-height:1.4;">
          📸 View your event photos &nbsp;·&nbsp; Ver sus fotos
        </a>
      </p>
      <p style="color:#555;">A quick review means others can find us — there's a button right on the photo page. Thank you!</p>
      <p style="color:#555;">Una reseña rápida ayuda a que otros nos encuentren — hay un botón en la página de fotos. ¡Gracias!</p>
      <p style="color:#999;font-size:12px;margin-top:20px;">${business}<br/>${process.env.NEXT_PUBLIC_BUSINESS_PHONE || ''}</p>
    </div>`

    await sendMail({
      to,
      subject: `📸 Photos from your event · Fotos de su evento — ${business}`,
      html,
    })
    await ref.update({ photosSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

    return NextResponse.json({ ok: true, emailed: true, to, count, galleryUrl })
  } catch (e: any) {
    console.error('send-photos error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
