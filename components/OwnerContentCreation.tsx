'use client'

import { useState } from 'react'
import MediaGrid from './MediaGrid'
import { SetupPhoto, VideoClip } from '@/lib/types'

// Producer-facing: select which photos + videos go to the content creator,
// plus the testimonial recording controls.
export default function OwnerContentCreation({
  orderId,
  photos,
  videos,
}: {
  orderId: string
  photos: SetupPhoto[]
  videos: VideoClip[]
}) {
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [tCopied, setTCopied] = useState(false)

  async function copyTestimonialLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/testimonial/${orderId}`)
    setTCopied(true)
    setTimeout(() => setTCopied(false), 1500)
  }

  async function sendToProducer() {
    setSending(true)
    setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-producer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cc, bcc, note }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMsg(
        `✓ Sent to producer (${json.to})${json.cc ? ` · cc ${json.cc}` : ''}${json.bcc ? ` · bcc ${json.bcc}` : ''}`,
      )
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSending(false)
    }
  }

  const selPhotos = photos.filter((p) => p.producerSelected).length
  const selVids = videos.filter((v) => v.producerSelected).length
  const hasMedia = photos.length > 0 || videos.length > 0

  return (
    <div>
      <MediaGrid
        orderId={orderId}
        photos={photos}
        videos={videos}
        videoTypes={['walkthrough', 'testimonial']}
        field="producerSelected"
      />

      {hasMedia && (
        <p className="mt-2 text-xs text-gray-400">
          Tap items to choose what goes to the content creator ({selPhotos} photo
          {selPhotos === 1 ? '' : 's'}, {selVids} video{selVids === 1 ? '' : 's'} selected
          {selPhotos === 0 && selVids === 0 ? ' — all will be sent' : ''}).
        </p>
      )}

      {hasMedia && (
        <div className="no-print mt-4 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-700">Send to content creator</p>
          <p className="mb-2 text-xs text-gray-500">
            Emails a download link for the selected photos &amp; videos to your
            producer email(s) (set in Settings).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC (optional)" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
            <input type="text" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="BCC (optional)" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional) — appears in a green box…" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
          <button onClick={sendToProducer} disabled={sending} className="mt-2 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {sending ? 'Sending…' : '✉️ Send to content creator'}
          </button>
          {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
        </div>
      )}

      <div className="no-print mt-3 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-700">Testimonial</p>
        <p className="mb-2 text-xs text-gray-500">
          Record on-site at pickup, or text the link to the customer (release +
          ≤3 min). It lands here and notifies you.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`/testimonial/${orderId}`} target="_blank" rel="noreferrer" className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            Open recorder (on-site)
          </a>
          <button onClick={copyTestimonialLink} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
            {tCopied ? 'Copied!' : 'Copy testimonial link'}
          </button>
        </div>
      </div>
    </div>
  )
}
