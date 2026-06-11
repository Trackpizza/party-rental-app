import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase/admin'
import { sendMail, isEmailConfigured } from '@/lib/email'
import { producerRecipients } from '@/lib/settings'
import { Order, customerName } from '@/lib/types'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

function baseUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  return `${proto}://${host}`
}

// Records an already-uploaded video on the order (20-day purge), and for
// testimonials snapshots the release + notifies the producer.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { storagePath, type, releaseAgreed } = await req.json()
    if (type !== 'walkthrough' && type !== 'testimonial') {
      return NextResponse.json({ error: 'Bad type.' }, { status: 400 })
    }
    if (!storagePath || !String(storagePath).startsWith(`video/${params.id}/`)) {
      return NextResponse.json({ error: 'Bad path.' }, { status: 400 })
    }

    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }

    const now = new Date().toISOString()
    const purge = new Date()
    purge.setDate(purge.getDate() + 20)

    const biz = await adminDb.collection('settings').doc('business').get()
    const bizData: any = biz.exists ? biz.data() : {}

    const clip: any = {
      storagePath,
      type,
      uploadedAt: now,
      purgeAfter: purge.toISOString(),
    }
    if (type === 'testimonial') {
      clip.releaseAgreedAt = releaseAgreed ? now : null
      clip.releaseTextSnapshot = bizData.videoReleaseText || ''
    }

    await ref.update({
      videos: admin.firestore.FieldValue.arrayUnion(clip),
      updatedAt: now,
    })

    // Notify the producer(s) when a testimonial comes in.
    const producers = producerRecipients(bizData)
    if (type === 'testimonial' && producers.length > 0 && isEmailConfigured()) {
      const who = customerName(order.customer) || 'a customer'
      const url = `${baseUrl(req)}/producer/${order.id}`
      await sendMail({
        to: producers.join(', '),
        subject: `🎬 New testimonial — ${who}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;line-height:1.5;">
          <p>New video testimonial from <strong>${who}</strong>.</p>
          <p><a href="${url}" style="display:inline-block;background:#7c2d91;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">⬇ Download content</a></p>
        </div>`,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('video record error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
