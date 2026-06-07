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
    // Path must belong to this order's DL folder — no traversal.
    if (!path.startsWith(`dl/${params.id}/`)) {
      return NextResponse.json({ error: 'Bad path' }, { status: 400 })
    }

    const [url] = await adminStorage
      .bucket()
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      })

    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 })
  }
}
