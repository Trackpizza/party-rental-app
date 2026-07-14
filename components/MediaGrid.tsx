'use client'

import { useEffect, useState } from 'react'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { updateOrder } from '@/lib/orders'
import { SetupPhoto, VideoClip } from '@/lib/types'

type Field = 'selected' | 'producerSelected'

// Shows an order's photos + videos with a checkmark per item that toggles the
// given selection field (customer vs producer), plus download + delete.
export default function MediaGrid({
  orderId,
  photos,
  videos,
  videoTypes,
  field,
  readOnly = false,
}: {
  orderId: string
  photos: SetupPhoto[]
  videos: VideoClip[]
  videoTypes: ('walkthrough' | 'testimonial')[]
  field: Field
  // View-only: show thumbnails with download/delete, but no selection checkmark
  // (used in the crew section where selecting-for-customer isn't the point).
  readOnly?: boolean
}) {
  const shownVideos = videos.filter((v) => videoTypes.includes(v.type))
  const [urls, setUrls] = useState<Record<string, string>>({})

  const allPaths = [
    ...photos.map((p) => p.storagePath),
    ...shownVideos.map((v) => v.storagePath),
  ]

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const next: Record<string, string> = {}
      for (const path of allPaths) {
        if (urls[path]) {
          next[path] = urls[path]
          continue
        }
        try {
          const res = await fetch(
            `/api/orders/${orderId}/dl/view?path=${encodeURIComponent(path)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          const json = await res.json()
          if (res.ok && json.url) next[path] = json.url
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setUrls(next)
    }
    if (allPaths.length) load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, allPaths.join(',')])

  async function togglePhoto(path: string) {
    await updateOrder(orderId, {
      setupPhotos: photos.map((p) =>
        p.storagePath === path ? { ...p, [field]: !(p as any)[field] } : p,
      ),
    })
  }
  async function toggleVideo(path: string) {
    await updateOrder(orderId, {
      videos: videos.map((v) =>
        v.storagePath === path ? { ...v, [field]: !(v as any)[field] } : v,
      ),
    })
  }

  async function download(path: string) {
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
    if (!window.confirm('Delete this photo?')) return
    try {
      await deleteObject(storageRef(storage, path))
    } catch {
      /* gone */
    }
    await updateOrder(orderId, { setupPhotos: photos.filter((p) => p.storagePath !== path) })
  }
  async function deleteVideo(path: string) {
    if (!window.confirm('Delete this video?')) return
    try {
      await deleteObject(storageRef(storage, path))
    } catch {
      /* gone */
    }
    await updateOrder(orderId, { videos: videos.filter((v) => v.storagePath !== path) })
  }

  const Buttons = ({ path, onDel }: { path: string; onDel: () => void }) => (
    <div className="no-print absolute bottom-1 right-1 flex gap-1">
      <button onClick={() => download(path)} title="Download" className="rounded bg-black/55 px-1.5 py-0.5 text-xs text-white hover:bg-black/75">⬇</button>
      <button onClick={onDel} title="Delete" className="rounded bg-black/55 px-1.5 py-0.5 text-xs text-white hover:bg-red-600">🗑</button>
    </div>
  )

  if (photos.length === 0 && shownVideos.length === 0) {
    return <p className="text-sm text-gray-400">Nothing yet.</p>
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => {
            const on = !readOnly && !!(p as any)[field]
            return (
              <div key={p.storagePath} className={`relative overflow-hidden rounded-lg border-2 ${on ? 'border-brand' : 'border-gray-200'}`}>
                <div role={readOnly ? undefined : 'button'} onClick={readOnly ? undefined : () => togglePhoto(p.storagePath)} className={readOnly ? '' : 'cursor-pointer'}>
                  {urls[p.storagePath] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls[p.storagePath]} alt="photo" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-gray-50 text-xs text-gray-400">…</div>
                  )}
                  {on && <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 text-xs text-white">✓</span>}
                </div>
                <Buttons path={p.storagePath} onDel={() => deletePhoto(p.storagePath)} />
              </div>
            )
          })}
        </div>
      )}

      {shownVideos.map((v) => {
        const on = !readOnly && !!(v as any)[field]
        return (
          <div key={v.storagePath} className={`relative rounded-lg border-2 p-2 ${on ? 'border-brand' : 'border-gray-200'}`}>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
              {readOnly ? (
                <span className="font-medium capitalize text-gray-600">{v.type}</span>
              ) : (
                <button onClick={() => toggleVideo(v.storagePath)} className="flex items-center gap-1 font-medium text-gray-600">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${on ? 'bg-brand text-white' : 'border border-gray-300'}`}>{on ? '✓' : ''}</span>
                  <span className="capitalize">{v.type}</span>
                </button>
              )}
              <span>auto-deletes {new Date(v.purgeAfter).toLocaleDateString()}</span>
            </div>
            {urls[v.storagePath] ? (
              <video src={urls[v.storagePath]} controls className="mx-auto block max-h-[55vh] max-w-full rounded-md bg-black" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-md bg-gray-50 text-xs text-gray-400">loading…</div>
            )}
            <Buttons path={v.storagePath} onDel={() => deleteVideo(v.storagePath)} />
          </div>
        )
      })}
    </div>
  )
}
