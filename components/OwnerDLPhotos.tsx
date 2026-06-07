'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/client'
import CameraCapture from './CameraCapture'
import { DLPhoto } from '@/lib/types'

export default function OwnerDLPhotos({
  orderId,
  photos,
}: {
  orderId: string
  photos: DLPhoto[]
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [showCamera, setShowCamera] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Fetch a short-lived signed URL for each locked photo (owner token required).
  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const next: Record<string, string> = {}
      for (const p of photos) {
        if (urls[p.storagePath]) {
          next[p.storagePath] = urls[p.storagePath]
          continue
        }
        try {
          const res = await fetch(
            `/api/orders/${orderId}/dl/view?path=${encodeURIComponent(p.storagePath)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          const json = await res.json()
          if (res.ok && json.url) next[p.storagePath] = json.url
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setUrls(next)
    }
    if (photos.length) load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, photos.map((p) => p.storagePath).join(',')])

  async function upload(dataUrl: string) {
    setShowCamera(false)
    setUploading(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}/dl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl, source: 'staff' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      // Parent's Firestore snapshot will refresh the photos prop.
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.storagePath} className="text-center">
              {urls[p.storagePath] ? (
                <a href={urls[p.storagePath]} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urls[p.storagePath]}
                    alt="driver's license"
                    className="h-28 rounded-lg border border-gray-200 object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-28 w-44 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-400">
                  Loading…
                </div>
              )}
              <span className="text-[11px] text-gray-400">{p.source}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No license photos yet.</p>
      )}

      <button
        onClick={() => setShowCamera(true)}
        disabled={uploading || photos.length >= 4}
        className="no-print mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : '📷 Add license photo'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showCamera && (
        <CameraCapture
          label="Driver's license"
          onConfirm={upload}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}
