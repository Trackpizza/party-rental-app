'use client'

import { useState } from 'react'
import { updateOrder } from '@/lib/orders'
import MediaGrid from './MediaGrid'
import ShareButton from './ShareButton'
import TextCustomer from './TextCustomer'
import { SetupPhoto, VideoClip } from '@/lib/types'

// Customer-facing: pick the best photos/videos and send the customer their
// gallery link (photos + Google review CTA + optional video-testimonial button).
// Works even with no media — sends a review-only page.
export default function OwnerCustomerPhotos({
  orderId,
  photos,
  videos,
  customerEmail,
  customerPhone,
  photosSentAt,
  requestTestimonial,
}: {
  orderId: string
  photos: SetupPhoto[]
  videos: VideoClip[]
  customerEmail: string
  customerPhone: string
  photosSentAt: string | null
  requestTestimonial: boolean
}) {
  const [photoTo, setPhotoTo] = useState(customerEmail)
  const [photoCc, setPhotoCc] = useState('')
  const [photoBcc, setPhotoBcc] = useState('')
  const [photoNote, setPhotoNote] = useState('')
  const [sending, setSending] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')

  async function toggleTestimonial(next: boolean) {
    await updateOrder(orderId, { requestTestimonial: next })
  }

  async function sendPhotos() {
    setSending(true)
    setPhotoMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: photoTo, cc: photoCc, bcc: photoBcc, note: photoNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setPhotoMsg(
        `✓ Sent to ${json.to}${json.cc ? ` (cc ${json.cc})` : ''}${json.bcc ? ` (bcc ${json.bcc})` : ''}`,
      )
    } catch (e: any) {
      setPhotoMsg(`Error: ${e.message}`)
    } finally {
      setSending(false)
    }
  }

  const walkthroughs = videos.filter((v) => v.type === 'walkthrough')
  const selPhotos = photos.filter((p) => p.selected).length
  const selVids = walkthroughs.filter((v) => v.selected).length
  const hasMedia = photos.length > 0 || walkthroughs.length > 0

  return (
    <div>
      {hasMedia ? (
        <>
          <MediaGrid
            orderId={orderId}
            photos={photos}
            videos={videos}
            videoTypes={['walkthrough']}
            field="selected"
          />
          <p className="mt-2 text-xs text-gray-400">
            Tap items to choose what the customer receives ({selPhotos} photo
            {selPhotos === 1 ? '' : 's'}, {selVids} video{selVids === 1 ? '' : 's'} selected
            {selPhotos === 0 && selVids === 0 ? ' — all will be sent' : ''}).
          </p>
          <p className="mt-1 text-xs text-amber-700">
            ⚠ Download anything you want to keep — photos auto-delete 60 days after upload, videos after 20 days.
          </p>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No photos or videos yet — add them in <strong>Crew Setup Photos/Videos</strong> above.
          You can still send the customer a review request below (no photos, just the thank-you + review link).
        </div>
      )}

      <div className="no-print mt-4 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-700">Send to customer + review request</p>
        <p className="mb-2 text-xs text-gray-500">
          {photosSentAt
            ? `Last sent ${new Date(photosSentAt).toLocaleString()}.`
            : hasMedia
              ? 'Sends the selected photos & videos with the Google review link.'
              : 'Sends a thank-you with the Google review link (no photos attached).'}
        </p>
        <input
          type="email"
          value={photoTo}
          onChange={(e) => setPhotoTo(e.target.value)}
          placeholder="Send to email"
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input type="text" value={photoCc} onChange={(e) => setPhotoCc(e.target.value)} placeholder="CC (optional)" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
          <input type="text" value={photoBcc} onChange={(e) => setPhotoBcc(e.target.value)} placeholder="BCC (optional)" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
        </div>
        <textarea rows={2} value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Add a personal note (optional) — appears in a green box in the email…" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />

        <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={requestTestimonial}
            onChange={(e) => toggleTestimonial(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also invite a <strong>video testimonial</strong> — adds a “Leave a quick video review” button on the customer&apos;s photo page.
          </span>
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={sendPhotos} disabled={!photoTo.trim() || sending} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {sending ? 'Sending…' : '✉️ Send to customer + review'}
          </button>
          <ShareButton
            url={`/gallery/${orderId}`}
            title="Your event photos"
            text="Here are the photos from your event:"
            label="Share link"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:border-brand"
          />
          <TextCustomer
            phone={customerPhone}
            url={`/gallery/${orderId}`}
            text="Here are the photos from your event:"
            label="Text link"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:border-brand"
          />
        </div>
        {photoMsg && <p className="mt-2 text-sm text-gray-600">{photoMsg}</p>}
      </div>
    </div>
  )
}
