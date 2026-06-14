import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb, adminStorage } from '@/lib/firebase/admin'
import { DL_RETENTION_DAYS } from '@/lib/orders'

export const dynamic = 'force-dynamic'

const MAX_PHOTOS = 4
const MAX_BYTES = 6 * 1024 * 1024 // ~6MB per image

function purgeDateFromEvent(eventDate: string, days: number): string | null {
  if (!eventDate) return null
  const d = new Date(eventDate)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// Customer (from the signing link) or staff uploads a driver's-license photo.
// Public route by necessity (customer isn't authed), but write-only: it can
// only append an image to an existing order. Images land in owner-locked Storage.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { imageDataUrl, source } = await req.json()
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
    }
    const m = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
    if (!m) {
      return NextResponse.json({ error: 'Invalid image format.' }, { status: 400 })
    }
    const contentType = m[1]
    const buffer = Buffer.from(m[2], 'base64')
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large.' }, { status: 413 })
    }

    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order: any = snap.data()
    if ((order.dlPhotos?.length || 0) >= MAX_PHOTOS) {
      return NextResponse.json({ error: 'Photo limit reached.' }, { status: 409 })
    }

    const ext = contentType.split('/')[1].replace('jpeg', 'jpg')
    const storagePath = `dl/${params.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`

    await adminStorage.bucket().file(storagePath).save(buffer, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0' },
    })

    const photo = {
      storagePath,
      uploadedAt: new Date().toISOString(),
      source: source === 'staff' ? 'staff' : 'customer',
    }

    const patch: any = {
      dlPhotos: admin.firestore.FieldValue.arrayUnion(photo),
      updatedAt: new Date().toISOString(),
    }
    // Ensure the purge clock is set (event date + fixed retention window).
    if (!order.dlPurgeAfter && order.event?.eventDate) {
      patch.dlPurgeAfter = purgeDateFromEvent(order.event.eventDate, DL_RETENTION_DAYS)
    }
    await ref.update(patch)

    return NextResponse.json({ ok: true, count: (order.dlPhotos?.length || 0) + 1 })
  } catch (e: any) {
    console.error('dl upload error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
