import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { DEFAULT_WAIVER } from '@/lib/waiver'
import { DEFAULT_MEDIA_CONSENT } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// Derive lifecycle status from flags (server copy; signature + deposit -> confirmed).
function deriveStatus(o: any): string {
  if (o.completedAt) return 'completed'
  if (o.balancePaid) return 'balance_paid'
  if (o.pickedUpAt) return 'picked_up'
  if (o.deliveredAt) return 'delivered'
  if (o.signature && o.depositPaid) return 'confirmed'
  if (o.depositPaid) return 'deposit_paid'
  if (o.signature) return 'signed'
  if (o.sentAt) return 'sent'
  return 'draft'
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const { signatureDataUrl, waiverScrolled, waiverAgreed, waiverVersion, mediaConsent } = body

    if (!signatureDataUrl || !waiverAgreed) {
      return NextResponse.json(
        { error: 'Signature and waiver agreement are required.' },
        { status: 400 },
      )
    }

    const ref = adminDb.collection('orders').doc(params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }
    const order: any = { id: snap.id, ...snap.data() }
    if (order.signature) {
      return NextResponse.json(
        { error: 'This order has already been signed.' },
        { status: 409 },
      )
    }

    // Snapshot the exact waiver text shown server-side (authoritative).
    const waiverSnap = await adminDb.collection('settings').doc('waiver').get()
    const waiverText = waiverSnap.exists
      ? (waiverSnap.data() as any).text
      : DEFAULT_WAIVER

    // Snapshot the consent text the customer saw (only if they opted in).
    const bizSnap = await adminDb.collection('settings').doc('business').get()
    const mediaConsentText = bizSnap.exists
      ? (bizSnap.data() as any).mediaConsentText || DEFAULT_MEDIA_CONSENT
      : DEFAULT_MEDIA_CONSENT
    const now = new Date().toISOString()

    const signature = {
      signatureDataUrl,
      signedAt: now,
      ipAddress: getClientIp(req),
      waiverScrolled: !!waiverScrolled,
      waiverAgreed: !!waiverAgreed,
      waiverVersion: waiverVersion || 'unknown',
      waiverTextSnapshot: waiverText,
      orderSnapshot: JSON.stringify({ ...order, signature: undefined }),
    }

    const merged = { ...order, signature }
    await ref.update({
      signature,
      mediaConsent: !!mediaConsent,
      mediaConsentAt: mediaConsent ? now : null,
      mediaConsentText: mediaConsent ? mediaConsentText : null,
      status: deriveStatus(merged),
      updatedAt: now,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('sign error', e)
    return NextResponse.json(
      { error: e?.message || 'Server error' },
      { status: 500 },
    )
  }
}
