'use client'

import { useEffect, useState } from 'react'
import { getBusinessSettings } from '@/lib/settings'
import MediaGrid from './MediaGrid'
import ShareButton from './ShareButton'
import { SetupPhoto, VideoClip } from '@/lib/types'

// Producer-facing: select which photos + videos go to the content creator.
export default function OwnerContentCreation({
  orderId,
  photos,
  videos,
}: {
  orderId: string
  photos: SetupPhoto[]
  videos: VideoClip[]
}) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  // Prefill To with the first producer and BCC with the rest, so multiple
  // producers stay hidden from each other by default. All fields stay editable.
  useEffect(() => {
    getBusinessSettings().then((b) => {
      setTo(b.producerEmails[0] || '')
      setBcc(b.producerEmails.slice(1).join(', '))
    })
  }, [])

  async function sendToProducer() {
    setSending(true)
    setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-producer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc, bcc, note }),
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
            Emails a download link for the selected photos &amp; videos.
            Prefilled with your producer email(s) from Settings.
          </p>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Send to email"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC (optional)" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
            <input type="text" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="BCC (optional)" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional) — appears in a green box…" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={sendToProducer} disabled={!to.trim() || sending} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {sending ? 'Sending…' : '✉️ Send to content creator'}
            </button>
            <ShareButton
              url={`/producer/${orderId}`}
              title="Event content"
              text="Content to download for editing:"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:border-brand"
            />
          </div>
          {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
        </div>
      )}
    </div>
  )
}
