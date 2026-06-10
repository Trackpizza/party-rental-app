import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminStorage } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Owner-only: returns a short-lived signed URL for a locked DL image.
// Requires a valid Firebase ID token (the signed-in owner). The image itself
// is never publicly readable — Storage rules deny anonymous access.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authz = req.headers.get('authorization') || ''
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await adminAuth.verifyIdToken(token) // throws if invalid

    const path = req.nextUrl.searchParams.get('path') || ''
    // Path must belong to this order's DL / setup / video folder — no traversal.
    const allowed =
      path.startsWith(`dl/${params.id}/`) ||
      path.startsWith(`setup/${params.id}/`) ||
      path.startsWith(`video/${params.id}/`)
    if (!allowed) {
      return NextResponse.json({ error: 'Bad path' }, { status: 400 })
    }

    const download = req.nextUrl.searchParams.get('download') === '1'
    const fileName = path.split('/').pop() || 'photo.jpg'
    const [url] = await adminStorage
      .bucket()
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
        ...(download
          ? { responseDisposition: `attachment; filename="${fileName}"` }
          : {}),
      })

    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 })
  }
}
