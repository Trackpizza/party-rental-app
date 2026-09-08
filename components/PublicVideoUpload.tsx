'use client'

import { useState } from 'react'

// Uploads a video via a signed URL (works without login — for the customer
// testimonial link and the crew walkthrough link). Checks duration, PUTs the
// file straight to Storage with progress, then records it on the order.
const MAX_BYTES = 200 * 1024 * 1024

export default function PublicVideoUpload({
  orderId,
  type,
  maxSeconds,
  label,
  recordExtra,
}: {
  orderId: string
  type: 'walkthrough' | 'testimonial'
  maxSeconds: number
  label: string
  recordExtra?: Record<string, any>
}) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

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
        setError(`That clip is ${Math.round(dur)}s — the max is ${maxSeconds}s. Please record a shorter one.`)
        return
      }
    } catch {
      /* allow if duration unreadable */
    }

    // The signed upload URL is valid for 15 minutes. A very large clip on a weak
    // connection will not finish in time and dies with an opaque 403, so refuse
    // it up front with something the crew can act on.
    if (file.size > MAX_BYTES) {
      setError(
        `That video is ${Math.round(file.size / 1024 / 1024)}MB — the max is ${Math.round(
          MAX_BYTES / 1024 / 1024,
        )}MB. Record a shorter clip, or lower your camera quality in Settings.`,
      )
      return
    }

    const contentType = file.type || 'video/mp4'
    setProgress(0)
    try {
      const r = await fetch(`/api/orders/${orderId}/video/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, contentType }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not start upload')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', j.uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${xhr.status})`))
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(file)
      })

      const r2 = await fetch(`/api/orders/${orderId}/video/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: j.storagePath, type, ...recordExtra }),
      })
      if (!r2.ok) throw new Error((await r2.json()).error || 'Could not save')
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setProgress(null)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-sm font-semibold text-green-600">✓ Video uploaded — thank you!</p>
        <button
          type="button"
          onClick={() => {
            setDone(false)
            setError('')
          }}
          className="mt-1 text-sm text-gray-500 underline"
        >
          Upload another · Subir otro
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-5 py-3 font-semibold text-white ${progress !== null ? 'bg-brand/60 cursor-not-allowed' : 'bg-brand hover:opacity-90'}`}>
        🎥 {label}
        <input
          type="file"
          accept="video/*"
          capture
          className="hidden"
          disabled={progress !== null}
          onChange={handle}
        />
      </label>
      {progress !== null && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Uploading… please don&apos;t close this page</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-brand transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
