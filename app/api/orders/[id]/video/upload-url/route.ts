import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminStorage } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Returns a short-lived signed PUT URL so the browser can upload a video
// straight to Storage (works for unauthenticated testimonial/crew links).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { type, contentType } = await req.json()
    if (type !== 'walkthrough' && type !== 'testimonial') {
      return NextResponse.json({ error: 'Bad type.' }, { status: 400 })
    }
    if (!contentType || !String(contentType).startsWith('video/')) {
      return NextResponse.json({ error: 'Must be a video.' }, { status: 400 })
    }

    const snap = await adminDb.collection('orders').doc(params.id).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    const sub = (String(contentType).split('/')[1] || 'mp4').toLowerCase()
    const ext = sub === 'quicktime' ? 'mov' : sub.replace(/[^a-z0-9]/g, '') || 'mp4'
    const storagePath = `video/${params.id}/${type}-${Date.now()}.${ext}`

    const [uploadUrl] = await adminStorage
      .bucket()
      .file(storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
      })

    return NextResponse.json({ uploadUrl, storagePath })
  } catch (e: any) {
    console.error('upload-url error', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
