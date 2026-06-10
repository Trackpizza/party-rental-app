'use client'

import { useEffect, useState } from 'react'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { updateOrder } from '@/lib/orders'
import VideoUpload from './VideoUpload'
import { VideoClip } from '@/lib/types'

export default function OwnerVideos({
  orderId,
  videos,
}: {
  orderId: string
  videos: VideoClip[]
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [tCopied, setTCopied] = useState(false)

  async function copyTestimonialLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/testimonial/${orderId}`)
    setTCopied(true)
    setTimeout(() => setTCopied(false), 1500)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const next: Record<string, string> = {}
      for (const v of videos) {
        if (urls[v.storagePath]) {
          next[v.storagePath] = urls[v.storagePath]
          continue
        }
        try {
          const res = await fetch(
            `/api/orders/${orderId}/dl/view?path=${encodeURIComponent(v.storagePath)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          const json = await res.json()
          if (res.ok && json.url) next[v.storagePath] = json.url
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setUrls(next)
    }
    if (videos.length) load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, videos.map((v) => v.storagePath).join(',')])

  async function deleteVideo(path: string) {
    if (!window.confirm('Delete this video? This cannot be undone.')) return
    try {
      await deleteObject(storageRef(storage, path))
    } catch {
      /* may already be gone */
    }
    await updateOrder(orderId, { videos: videos.filter((v) => v.storagePath !== path) })
  }

  async function sendToProducer() {
    setSending(true)
    setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-producer`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMsg(`✓ Sent to producer (${json.to})`)
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {videos.length > 0 ? (
        <div className="space-y-3">
          {videos.map((v) => (
            <div key={v.storagePath} className="rounded-lg border border-gray-200 p-2">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                <span className="capitalize">{v.type}</span>
                <span>auto-deletes {new Date(v.purgeAfter).toLocaleDateString()}</span>
              </div>
              {urls[v.storagePath] ? (
                <video
                  src={urls[v.storagePath]}
                  controls
                  className="max-h-64 w-full rounded-md bg-black"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-md bg-gray-50 text-xs text-gray-400">
                  loading…
                </div>
              )}
              <button
                onClick={() => deleteVideo(v.storagePath)}
                className="no-print mt-1 text-xs text-gray-400 underline hover:text-red-500"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No videos yet.</p>
      )}

      <div className="no-print mt-3 flex flex-wrap items-center gap-3">
        <VideoUpload
          orderId={orderId}
          type="walkthrough"
          maxSeconds={60}
          label="Add walkthrough (≤1 min)"
        />
        <button
          onClick={sendToProducer}
          disabled={sending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send content to producer'}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}

      <div className="no-print mt-3 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-700">Testimonial</p>
        <p className="mb-2 text-xs text-gray-500">
          Record on-site at pickup, or text the link to the customer. They check
          the release box, then record (≤3 min).
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/testimonial/${orderId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Open recorder (on-site)
          </a>
          <button
            onClick={copyTestimonialLink}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand"
          >
            {tCopied ? 'Copied!' : 'Copy testimonial link'}
          </button>
        </div>
      </div>
    </div>
  )
}
