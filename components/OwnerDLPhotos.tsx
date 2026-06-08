'use client'

import { useEffect, useState } from 'react'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { updateOrder } from '@/lib/orders'
import PhotoCapture from './PhotoCapture'
import { DLPhoto } from '@/lib/types'

export default function OwnerDLPhotos({
  orderId,
  photos,
}: {
  orderId: string
  photos: DLPhoto[]
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
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

  async function downloadPhoto(path: string) {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    const res = await fetch(
      `/api/orders/${orderId}/dl/view?path=${encodeURIComponent(path)}&download=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const json = await res.json()
    if (res.ok && json.url) window.location.href = json.url
  }

  async function deletePhoto(path: string) {
    if (!window.confirm('Delete this license photo? This cannot be undone.')) return
    try {
      await deleteObject(storageRef(storage, path))
    } catch {
      /* file may already be gone — still remove from the order */
    }
    await updateOrder(orderId, {
      dlPhotos: photos.filter((p) => p.storagePath !== path),
    })
  }

  return (
    <div>
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.storagePath} className="text-center">
              <div className="relative inline-block">
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
                <div className="no-print absolute bottom-1 right-1 flex gap-1">
                  <button
                    onClick={() => downloadPhoto(p.storagePath)}
                    title="Download"
                    className="rounded bg-black/55 px-1.5 py-0.5 text-xs text-white hover:bg-black/75"
                  >
                    ⬇
                  </button>
                  <button
                    onClick={() => deletePhoto(p.storagePath)}
                    title="Delete"
                    className="rounded bg-black/55 px-1.5 py-0.5 text-xs text-white hover:bg-red-600"
                  >
                    🗑
                  </button>
                </div>
              </div>
              <div>
                <span className="text-[11px] text-gray-400">{p.source}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No license photos yet.</p>
      )}

      {photos.length < 4 && (
        <div className="no-print mt-3">
          <PhotoCapture onConfirm={upload} label="Add license photo" />
        </div>
      )}
      {uploading && <p className="mt-2 text-sm text-gray-500">Uploading…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
