import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase/client'

export interface StaffMember {
  name: string
  email: string
}

export interface BusinessSettings {
  googleReviewUrl: string
  taxRate: number // percent, e.g. 9.5
  dlPurgeDays: number // days after event to auto-delete DL photos
  staff: StaffMember[]
  requireDl: boolean // require a DL photo before the customer can sign
  producerEmail: string // where "send content to producer" emails go
  videoReleaseText: string // media release the customer agrees to before recording
}

export const DEFAULT_VIDEO_RELEASE =
  'I give permission to use this video and photos from my event for advertising and social media.\n' +
  'Doy permiso para usar este video y las fotos de mi evento para publicidad y redes sociales.'

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, 'settings', 'business'))
  const d = snap.exists() ? (snap.data() as any) : {}
  return {
    googleReviewUrl: d.googleReviewUrl || '',
    taxRate: typeof d.taxRate === 'number' ? d.taxRate : 0,
    dlPurgeDays: typeof d.dlPurgeDays === 'number' ? d.dlPurgeDays : 30,
    staff: Array.isArray(d.staff) ? d.staff : [],
    requireDl: typeof d.requireDl === 'boolean' ? d.requireDl : true,
    producerEmail: d.producerEmail || '',
    videoReleaseText: d.videoReleaseText || DEFAULT_VIDEO_RELEASE,
  }
}

export async function saveBusinessSettings(s: BusinessSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), s, { merge: true })
}
