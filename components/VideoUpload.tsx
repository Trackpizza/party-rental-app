'use client'

import { useState } from 'react'
import { ref as storageRef, uploadBytesResumable } from 'firebase/storage'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { storage, db } from '@/lib/firebase/client'

// Uploads a video straight to Storage (resumable — handles big files),
// after checking it's within the max duration. Records it on the order with
// a 20-day purge date. Owner-authenticated (used on the order page).
export default function VideoUpload({
  orderId,
  type,
  maxSeconds,
  label,
}: {
  orderId: string
  type: 'walkthrough' | 'testimonial'
  maxSeconds: number
  label: string
}) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  function checkDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(v.duration)
      }
      v.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read video'))
      }
      v.src = url
    })
  }

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const dur = await checkDuration(file)
      if (dur > maxSeconds + 1) {
        setError(
          `That clip is ${Math.round(dur)}s — the max is ${maxSeconds}s. Please record a shorter one.`,
        )
        return
      }
    } catch {
      /* if we can't read duration, allow it through */
    }

    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `video/${orderId}/${type}-${Date.now()}.${ext}`
    const task = uploadBytesResumable(storageRef(storage, path), file, {
      contentType: file.type || 'video/mp4',
    })
    setProgress(0)
    task.on(
      'state_changed',
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        setError(err.message)
        setProgress(null)
      },
      async () => {
        const now = new Date().toISOString()
        const purge = new Date()
        purge.setDate(purge.getDate() + 20)
        await updateDoc(doc(db, 'orders', orderId), {
          videos: arrayUnion({
            storagePath: path,
            type,
            uploadedAt: now,
            purgeAfter: purge.toISOString(),
          }),
          updatedAt: now,
        })
        setProgress(null)
      },
    )
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white">
        {progress !== null ? `Uploading… ${progress}%` : `🎥 ${label}`}
        <input
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          disabled={progress !== null}
          onChange={handle}
        />
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
