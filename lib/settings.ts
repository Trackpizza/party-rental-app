import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase/client'

export interface BusinessSettings {
  googleReviewUrl: string
  taxRate: number // percent, e.g. 9.5
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, 'settings', 'business'))
  const d = snap.exists() ? (snap.data() as any) : {}
  return {
    googleReviewUrl: d.googleReviewUrl || '',
    taxRate: typeof d.taxRate === 'number' ? d.taxRate : 0,
  }
}

export async function saveBusinessSettings(s: BusinessSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), s, { merge: true })
}
