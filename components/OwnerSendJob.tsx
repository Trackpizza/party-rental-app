'use client'

import { useEffect, useState } from 'react'
import { getBusinessSettings, StaffMember } from '@/lib/settings'
import ShareButton from './ShareButton'

// Owner action: send the crew a job ticket (/job/{id}) — address, equipment,
// and balance to collect, with no ID/contract/signature. Email a team member
// (with the staff picker) or Share the link to text it from a phone.
export default function OwnerSendJob({ orderId }: { orderId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [tos, setTos] = useState<string[]>([''])
  const [bcc, setBcc] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getBusinessSettings().then((b) => setStaff(b.staff))
  }, [])

  function pickStaff(email: string) {
    setTos((prev) => {
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

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/job/${orderId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function send() {
    const to = tos.map((s) => s.trim()).filter(Boolean).join(', ')
    setSending(true)
    setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/send-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, bcc, note }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMsg(`✓ Job sent to ${json.to}${json.bcc ? ` (bcc ${json.bcc})` : ''}`)
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-500">
        Sends the crew a job ticket — address, equipment, and balance to collect.
        No driver&apos;s license, contract, or signature.
      </p>
      <button onClick={copyLink} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
        {copied ? 'Copied!' : '📋 Copy link'}
      </button>
      <div className="mt-3">
        {staff.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && pickStaff(e.target.value)}
            className="mb-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          >
            <option value="">Pick team member…</option>
            {staff.map((s, i) => (
              <option key={i} value={s.email}>{s.name || s.email}</option>
            ))}
          </select>
        )}
        {tos.map((tval, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input
              type="email"
              value={tval}
              onChange={(e) => setTos((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="Send to email"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
            {tos.length > 1 && (
              <button
                onClick={() => setTos((prev) => prev.filter((_, j) => j !== i))}
                className="px-2 text-gray-300 hover:text-red-500"
                aria-label="Remove recipient"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setTos((prev) => [...prev, ''])} className="text-sm font-semibold text-brand hover:underline">
          + Add recipient
        </button>
      </div>
      <input
        type="text"
        value={bcc}
        onChange={(e) => setBcc(e.target.value)}
        placeholder="BCC others (comma-separated, optional)"
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
      />
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional) — appears in a green box…"
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={send}
          disabled={!tos.some((tv) => tv.trim()) || sending}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? 'Sending…' : '✉️ Email job to staff'}
        </button>
        <ShareButton
          url={`/job/${orderId}`}
          title="Delivery job"
          text="Delivery job ticket:"
          label="Share job"
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:border-brand"
        />
      </div>
      {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
    </div>
  )
}
