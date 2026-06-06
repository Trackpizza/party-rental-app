import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function getClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

// Initialize services in the browser only. During Next's server prerender
// there's no window, so we skip init (every consumer calls these from event
// handlers / useEffect, which run client-side). This keeps `next build` from
// trying to construct Firebase Auth on the server with no/invalid keys.
const isBrowser = typeof window !== 'undefined'

export const auth: Auth = isBrowser
  ? getAuth(getClientApp())
  : (undefined as unknown as Auth)
export const db: Firestore = isBrowser
  ? getFirestore(getClientApp())
  : (undefined as unknown as Firestore)
export const storage: FirebaseStorage = isBrowser
  ? getStorage(getClientApp())
  : (undefined as unknown as FirebaseStorage)

export default getClientApp
