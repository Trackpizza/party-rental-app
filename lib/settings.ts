import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase/client'

export interface StaffMember {
  name: string
  email: string
  phone: string // optional; enables the Text/QR (Phone Link) action for crew
}

export interface BusinessSettings {
  businessName: string      // printed at the top of the rental agreement
  businessPhone: string     // agreement header + email footers
  businessAddress: string   // agreement header
  zelleNumber: string       // shown to the customer when paying by Zelle
  googleReviewUrl: string
  taxRate: number // percent, e.g. 9.5
  staff: StaffMember[]
  requireDl: boolean // require a DL photo before the customer can sign
  squareAutoLinks: boolean // auto-generate Square deposit/balance links (off = manual paste only)
  producerEmails: string[] // where "send content to producer" emails go (one or more)
  videoReleaseText: string // media release the customer agrees to before recording
  mediaConsentText: string // social-media consent checkbox shown in the signing flow
}

export const DEFAULT_VIDEO_RELEASE =
  'I give permission to use this video and photos from my event for advertising and social media.\n' +
  'Doy permiso para usar este video y las fotos de mi evento para publicidad y redes sociales.'

export const DEFAULT_MEDIA_CONSENT =
  'We can take setup photos and a short walkthrough video of your event before guests arrive to use on social media and advertising — and we’ll send you the photos and video afterward.\n' +
  'Podemos tomar fotos del montaje y un video corto de su evento antes de que lleguen los invitados para usarlos en redes sociales y publicidad, y le enviaremos las fotos y el video después.'

// Resolve the producer recipient list from raw settings data. Prefers the
// `producerEmails` array; falls back to the legacy single `producerEmail`
// field so docs saved before multi-producer support still work. Safe to call
// from both client and admin SDK (operates on a plain data object).
export function producerRecipients(d: any): string[] {
  const list = Array.isArray(d?.producerEmails)
    ? d.producerEmails
    : d?.producerEmail
      ? [d.producerEmail]
      : []
  return list
    .map((e: any) => (typeof e === 'string' ? e.trim() : ''))
    .filter(Boolean)
}

function str(v: any): string {
  return typeof v === 'string' ? v.trim() : ''
}

// Business identity shown on the agreement, the signing page and emails.
// Saved settings win; the NEXT_PUBLIC_* values stay as the fallback so an
// install that has not saved Settings yet keeps working exactly as before.
// Takes a plain data object, so server components reading the doc through the
// admin SDK can use it too.
export function businessInfo(d: any) {
  return {
    businessName:
      str(d?.businessName) || process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals',
    businessPhone: str(d?.businessPhone) || process.env.NEXT_PUBLIC_BUSINESS_PHONE || '',
    businessAddress:
      str(d?.businessAddress) || process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '',
    zelleNumber: str(d?.zelleNumber) || process.env.NEXT_PUBLIC_ZELLE_NUMBER || '',
  }
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, 'settings', 'business'))
  const d = snap.exists() ? (snap.data() as any) : {}
  return {
    ...businessInfo(d),
    googleReviewUrl: d.googleReviewUrl || '',
    taxRate: typeof d.taxRate === 'number' ? d.taxRate : 0,
    staff: Array.isArray(d.staff)
      ? d.staff.map((s: any) => ({ name: s.name || '', email: s.email || '', phone: s.phone || '' }))
      : [],
    requireDl: typeof d.requireDl === 'boolean' ? d.requireDl : true,
    squareAutoLinks: typeof d.squareAutoLinks === 'boolean' ? d.squareAutoLinks : false,
    producerEmails: producerRecipients(d),
    videoReleaseText: d.videoReleaseText || DEFAULT_VIDEO_RELEASE,
    mediaConsentText: d.mediaConsentText || DEFAULT_MEDIA_CONSENT,
  }
}

export async function saveBusinessSettings(s: BusinessSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), s, { merge: true })
}
