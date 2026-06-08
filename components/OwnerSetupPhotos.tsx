'use client'

import { useEffect, useState } from 'react'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase/client'
import { updateOrder } from '@/lib/orders'
import { getBusinessSettings, StaffMember } from '@/lib/settings'
import PhotoCapture from './PhotoCapture'
import { SetupPhoto } from '@/lib/types'

export default function OwnerSetupPhotos({
  orderId,
  photos,
  customerEmail,
  photosSentAt,
}: {
  orderId: string
  photos: SetupPhoto[]
  customerEmail: string
  photosSentAt: string | null
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [crewTo, setCrewTo] = useState('')
  const [crewBcc, setCrewBcc] = useState('')
  const [sendingCrew, setSendingCrew] = useState(false)
  const [crewMsg, setCrewMsg] = useState('')

  useEffect(() => {
    getBusinessSettings().then((b) => setStaff(b.staff))
  }, [])

  async function sendCrewLink() {
    setSendingCrew(true)
    setCrewMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-crew-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: crewTo, bcc: crewBcc }),
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

  async function toggleSelect(path: string) {
    const next = photos.map((p) =>
      p.storagePath === path ? { ...p, selected: !p.selected } : p,
    )
    await updateOrder(orderId, { setupPhotos: next })
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
    if (!window.confirm('Delete this photo? This cannot be undone.')) return
    try {
      await deleteObject(storageRef(storage, path))
    } catch {
      /* file may already be gone — still remove from the order */
    }
    await updateOrder(orderId, {
      setupPhotos: photos.filter((p) => p.storagePath !== path),
    })
  }

  async function copyCrewLink() {
    const link = `${window.location.origin}/setup/${orderId}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function sendPhotos() {
    setSending(true)
    setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-photos`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMsg(`✓ Sent ${json.count} photo(s) to ${json.to}`)
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSending(false)
    }
  }

  const selectedCount = photos.filter((p) => p.selected).length

  return (
    <div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div
              key={p.storagePath}
              className={`relative overflow-hidden rounded-lg border-2 ${
                p.selected ? 'border-brand' : 'border-gray-200'
              }`}
            >
              <div
                role="button"
                onClick={() => toggleSelect(p.storagePath)}
                className="cursor-pointer"
              >
                {urls[p.storagePath] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[p.storagePath]}
                    alt="setup"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-gray-50 text-xs text-gray-400">
                    …
                  </div>
                )}
                {p.selected && (
                  <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 text-xs text-white">
                    ✓
                  </span>
                )}
              </div>
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
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No setup photos yet.</p>
      )}

      {photos.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Tap photos to select which to send ({selectedCount} selected
          {selectedCount === 0 ? ' — all will be sent' : ''}).
        </p>
      )}

      {/* Photo actions */}
      <div className="no-print mt-3 flex flex-wrap items-center gap-3">
        <PhotoCapture onConfirm={addPhoto} label={uploading ? 'Uploading…' : 'Add photo'} />
        {photos.length > 0 && (
          <button
            onClick={sendPhotos}
            disabled={sending || !customerEmail}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            title={!customerEmail ? 'No customer email on file' : ''}
          >
            {sending ? 'Sending…' : 'Send photos + review request'}
          </button>
        )}
      </div>

      {/* Crew upload link — text it or email a team member */}
      <div className="no-print mt-4 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-700">Crew upload link</p>
        <p className="mb-2 text-xs text-gray-500">
          Text it to your crew, or email it to a team member.
        </p>
        <button
          onClick={copyCrewLink}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand"
        >
          {copied ? 'Copied!' : '📋 Copy link'}
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {staff.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && setCrewTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">Pick team member…</option>
              {staff.map((s, i) => (
                <option key={i} value={s.email}>
                  {s.name || s.email}
                </option>
              ))}
            </select>
          )}
          <input
            type="email"
            value={crewTo}
            onChange={(e) => setCrewTo(e.target.value)}
            placeholder="Send to email"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        <input
          type="text"
          value={crewBcc}
          onChange={(e) => setCrewBcc(e.target.value)}
          placeholder="BCC others (comma-separated, optional)"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
        <button
          onClick={sendCrewLink}
          disabled={!crewTo.trim() || sendingCrew}
          className="mt-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {sendingCrew ? 'Sending…' : '✉️ Email crew link'}
        </button>
        {crewMsg && <p className="mt-2 text-sm text-gray-600">{crewMsg}</p>}
      </div>

      {photosSentAt && (
        <p className="mt-2 text-xs text-gray-400">
          Sent {new Date(photosSentAt).toLocaleString()}
        </p>
      )}
      {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
    </div>
  )
}
