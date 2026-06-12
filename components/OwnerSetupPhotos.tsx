'use client'

import { useEffect, useState } from 'react'
import { getBusinessSettings, StaffMember } from '@/lib/settings'
import PhotoCapture from './PhotoCapture'
import VideoUpload from './VideoUpload'
import MediaGrid from './MediaGrid'
import ShareButton from './ShareButton'
import TextCustomer from './TextCustomer'
import TextStaffPicker from './TextStaffPicker'
import { SetupPhoto, VideoClip } from '@/lib/types'

// Customer-facing: select which photos + walkthrough videos the customer
// receives (with the review request), plus upload + crew link.
export default function OwnerSetupPhotos({
  orderId,
  photos,
  videos,
  customerEmail,
  customerPhone,
  photosSentAt,
}: {
  orderId: string
  photos: SetupPhoto[]
  videos: VideoClip[]
  customerEmail: string
  customerPhone: string
  photosSentAt: string | null
}) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  const [copied, setCopied] = useState(false)
  const [crewTos, setCrewTos] = useState<string[]>([''])
  const [crewBcc, setCrewBcc] = useState('')
  const [crewNote, setCrewNote] = useState('')
  const [sendingCrew, setSendingCrew] = useState(false)
  const [crewMsg, setCrewMsg] = useState('')

  const [photoTo, setPhotoTo] = useState(customerEmail)
  const [photoCc, setPhotoCc] = useState('')
  const [photoBcc, setPhotoBcc] = useState('')
  const [photoNote, setPhotoNote] = useState('')
  const [sending, setSending] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')

  useEffect(() => {
    getBusinessSettings().then((b) => setStaff(b.staff))
  }, [])

  async function addPhoto(dataUrl: string) {
    setUploading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setUploading(false)
    }
  }

  function pickStaff(email: string) {
    setCrewTos((prev) => {
      if (prev.includes(email)) return prev
      const idx = prev.findIndex((x) => !x.trim())
      if (idx >= 0) {
        const c = [...prev]
        c[idx] = email
        return c
      }
      return [...prev, email]
    })
  }

  async function copyCrewLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/setup/${orderId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function sendCrewLink() {
    const to = crewTos.map((s) => s.trim()).filter(Boolean).join(', ')
    setSendingCrew(true)
    setCrewMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-crew-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, bcc: crewBcc, note: crewNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setCrewMsg(`✓ Crew link sent to ${json.to}${json.bcc ? ` (bcc ${json.bcc})` : ''}`)
    } catch (e: any) {
      setCrewMsg(`Error: ${e.message}`)
    } finally {
      setSendingCrew(false)
    }
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
      <MediaGrid
        orderId={orderId}
        photos={photos}
        videos={videos}
        videoTypes={['walkthrough']}
        field="selected"
      />

      {hasMedia && (
        <p className="mt-2 text-xs text-gray-400">
          Tap items to choose what the customer receives ({selPhotos} photo
          {selPhotos === 1 ? '' : 's'}, {selVids} video{selVids === 1 ? '' : 's'} selected
          {selPhotos === 0 && selVids === 0 ? ' — all will be sent' : ''}).
        </p>
      )}

      <div className="no-print mt-3 flex flex-wrap items-center gap-3">
        <PhotoCapture onConfirm={addPhoto} label={uploading ? 'Uploading…' : 'Add photo'} />
        <VideoUpload orderId={orderId} type="walkthrough" maxSeconds={60} label="Add walkthrough (≤1 min)" />
      </div>
      {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}

      {hasMedia && (
        <div className="no-print mt-4 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-700">Send to customer + review request</p>
          <p className="mb-2 text-xs text-gray-500">
            {photosSentAt ? `Last sent ${new Date(photosSentAt).toLocaleString()}.` : 'Sends the selected photos & videos with the review link.'}
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={sendPhotos} disabled={!photoTo.trim() || sending} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {sending ? 'Sending…' : '✉️ Send to customer + review'}
            </button>
            <ShareButton
              url={`/gallery/${orderId}`}
              title="Your event photos"
              text="Here are the photos from your event:"
              label="Share photos"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:border-brand"
            />
            <TextCustomer
              phone={customerPhone}
              url={`/gallery/${orderId}`}
              text="Here are the photos from your event:"
              label="Text photos"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:border-brand"
            />
          </div>
          {photoMsg && <p className="mt-2 text-sm text-gray-600">{photoMsg}</p>}
        </div>
      )}

      {/* Crew upload link */}
      <div className="no-print mt-4 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-700">Crew upload link</p>
        <p className="mb-2 text-xs text-gray-500">Text it to your crew, or email a team member.</p>
        <button onClick={copyCrewLink} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
          {copied ? 'Copied!' : '📋 Copy link'}
        </button>
        <div className="mt-3">
          {staff.length > 0 && (
            <select value="" onChange={(e) => e.target.value && pickStaff(e.target.value)} className="mb-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none">
              <option value="">Pick team member…</option>
              {staff.map((s, i) => (
                <option key={i} value={s.email}>{s.name || s.email}</option>
              ))}
            </select>
          )}
          {crewTos.map((t, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input type="email" value={t} onChange={(e) => setCrewTos((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Send to email" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
              {crewTos.length > 1 && (
                <button onClick={() => setCrewTos((prev) => prev.filter((_, j) => j !== i))} className="px-2 text-gray-300 hover:text-red-500" aria-label="Remove recipient">✕</button>
              )}
            </div>
          ))}
          <button onClick={() => setCrewTos((prev) => [...prev, ''])} className="text-sm font-semibold text-brand hover:underline">+ Add recipient</button>
        </div>
        <input type="text" value={crewBcc} onChange={(e) => setCrewBcc(e.target.value)} placeholder="BCC others (comma-separated, optional)" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <textarea rows={2} value={crewNote} onChange={(e) => setCrewNote(e.target.value)} placeholder="Add a personal note (optional) — appears in a green box in the email…" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={sendCrewLink} disabled={!crewTos.some((t) => t.trim()) || sendingCrew} className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {sendingCrew ? 'Sending…' : '✉️ Email crew link'}
          </button>
          <ShareButton
            url={`/setup/${orderId}`}
            title="Setup photo upload"
            text="Upload the setup photos here:"
            label="Share crew link"
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:border-brand"
          />
        </div>
        <TextStaffPicker staff={staff} url={`/setup/${orderId}`} text="Setup photo upload link:" />
        {crewMsg && <p className="mt-2 text-sm text-gray-600">{crewMsg}</p>}
      </div>
    </div>
  )
}
