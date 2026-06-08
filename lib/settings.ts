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
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, 'settings', 'business'))
  const d = snap.exists() ? (snap.data() as any) : {}
  return {
    googleReviewUrl: d.googleReviewUrl || '',
    taxRate: typeof d.taxRate === 'number' ? d.taxRate : 0,
    dlPurgeDays: typeof d.dlPurgeDays === 'number' ? d.dlPurgeDays : 30,
    staff: Array.isArray(d.staff) ? d.staff : [],
  }
}

export async function saveBusinessSettings(s: BusinessSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), s, { merge: true })
}
