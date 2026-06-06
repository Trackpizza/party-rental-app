import admin from 'firebase-admin'

function getPrivateKey(): string | undefined {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

function getAdminApp() {
  if (admin.apps.length) return admin.apps[0]!

  const privateKey = getPrivateKey()
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

  // During build phase env vars may be absent — skip init gracefully.
  if (!privateKey || !projectId || !clientEmail) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Firebase Admin: missing credentials, skipping init')
    }
    return admin.apps[0] ?? admin.initializeApp()
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
}

const app = getAdminApp()

export const adminAuth = admin.auth(app)
export const adminDb = admin.firestore(app)
export const adminStorage = admin.storage(app)
export default admin
