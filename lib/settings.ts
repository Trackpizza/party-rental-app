import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase/client'

export interface BusinessSettings {
  googleReviewUrl: string
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, 'settings', 'business'))
  return snap.exists()
    ? { googleReviewUrl: (snap.data() as any).googleReviewUrl || '' }
    : { googleReviewUrl: '' }
}

export async function saveBusinessSettings(s: BusinessSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), s, { merge: true })
}
