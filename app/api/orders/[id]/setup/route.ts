import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb, adminStorage } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

const MAX_PHOTOS = 40
const MAX_BYTES = 8 * 1024 * 1024

// Crew (via the shareable setup link) or owner uploads an event-setup photo.
// Public write-only — can only append a photo to an existing order. Images
// land in owner-locked Storage under setup/{orderId}/. Not purged (marketing).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { imageDataUrl } = await req.json()
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
    if ((order.setupPhotos?.length || 0) >= MAX_PHOTOS) {
      return NextResponse.json({ error: 'Photo limit reached.' }, { status: 409 })
    }

    const ext = contentType.split('/')[1].replace('jpeg', 'jpg')
    const storagePath = `setup/${params.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`

    await adminStorage.bucket().file(storagePath).save(buffer, {
      contentType,
      resumable: false,
    })

    const photo = {
      storagePath,
      uploadedAt: new Date().toISOString(),
      selected: false,
    }
    await ref.update({
      setupPhotos: admin.firestore.FieldValue.arrayUnion(photo),
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, count: (order.setupPhotos?.length || 0) + 1 })
  } catch (e: any) {
    console.error('setup upload error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
