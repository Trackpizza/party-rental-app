import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase/client'

export interface StaffMember {
  name: string
  email: string
  phone: string // optional; enables the Text/QR (Phone Link) action for crew
}

export interface BusinessSettings {
  googleReviewUrl: string
  taxRate: number // percent, e.g. 9.5
  staff: StaffMember[]
  requireDl: boolean // require a DL photo before the customer can sign
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

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, 'settings', 'business'))
  const d = snap.exists() ? (snap.data() as any) : {}
  return {
    googleReviewUrl: d.googleReviewUrl || '',
    taxRate: typeof d.taxRate === 'number' ? d.taxRate : 0,
    staff: Array.isArray(d.staff)
      ? d.staff.map((s: any) => ({ name: s.name || '', email: s.email || '', phone: s.phone || '' }))
      : [],
    requireDl: typeof d.requireDl === 'boolean' ? d.requireDl : true,
    producerEmails: producerRecipients(d),
    videoReleaseText: d.videoReleaseText || DEFAULT_VIDEO_RELEASE,
    mediaConsentText: d.mediaConsentText || DEFAULT_MEDIA_CONSENT,
  }
}

export async function saveBusinessSettings(s: BusinessSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), s, { merge: true })
}
