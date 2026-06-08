'use client'

import { useState, useRef } from 'react'
import SignaturePad from './SignaturePad'
import PhotoCapture from './PhotoCapture'

export interface SignFlowData {
  orderId: string
  business: string
  customerName: string
  items: {
    label: string
    qty: number | null
    options: string[]
    amount: number | null
    description?: string
  }[]
  totals: { total: number | null; deposit: number | null; balance: number | null }
  event: { eventDate: string; deliveryTime: string; pickupDate: string; pickupTime: string }
  payment: { method: string | null; zelle: string; squareLink: string | null }
  waiverText: string
  waiverVersion: string
}

function money(n: number | null) {
  return n == null ? '—' : `$${n.toFixed(2)}`
}

export default function SignFlow({ data }: { data: SignFlowData }) {
  const [scrolled, setScrolled] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const waiverRef = useRef<HTMLDivElement>(null)

  // Driver's license capture
  const [dlThumb, setDlThumb] = useState<string | null>(null)
  const [dlUploading, setDlUploading] = useState(false)
  const [dlError, setDlError] = useState('')

  async function uploadDl(dataUrl: string) {
    setDlUploading(true)
    setDlError('')
    try {
      const res = await fetch(`/api/orders/${data.orderId}/dl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl, source: 'customer' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setDlThumb(dataUrl)
    } catch (e: any) {
      setDlError(e.message || 'Could not upload photo.')
    } finally {
      setDlUploading(false)
    }
  }

  function onWaiverScroll() {
    const el = waiverRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolled(true)
  }

  async function submit() {
    if (!agreed || !signature) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${data.orderId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureDataUrl: signature,
          waiverScrolled: scrolled,
          waiverAgreed: agreed,
          waiverVersion: data.waiverVersion,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submit failed')
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="text-4xl">✅</div>
          <h1 className="mt-3 text-xl font-bold text-green-700">Thank you!</h1>
          <p className="mt-2 text-gray-600">
            Your order is signed. {data.business} will be in touch about your
            deposit and delivery.
          </p>
        </div>
      </div>
    )
  }

  const activeItems = data.items.filter(
    (i) => i.qty || i.amount || (i.options && i.options.length) || i.description,
  )

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-28">
      <header className="text-center">
        <h1 className="text-lg font-bold text-brand">{data.business}</h1>
        <p className="text-sm text-gray-500">Review &amp; sign your rental order</p>
      </header>

      {/* Order summary */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="font-semibold">{data.customerName}</p>
        <p className="text-sm text-gray-500">
          Event {data.event.eventDate || '—'} {data.event.deliveryTime} → Pickup{' '}
          {data.event.pickupDate || data.event.eventDate || '—'} {data.event.pickupTime}
        </p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {activeItems.map((i, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-1.5">
                  {i.description || i.label}
                  {i.options.length > 0 && (
                    <span className="text-gray-400"> ({i.options.join(', ')})</span>
                  )}
                </td>
                <td className="py-1.5 text-center text-gray-500">{i.qty ?? ''}</td>
                <td className="py-1.5 text-right">{money(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{money(data.totals.total)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Deposit (50%)</span>
            <span>{money(data.totals.deposit)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Balance</span>
            <span>{money(data.totals.balance)}</span>
          </div>
        </div>
        {data.payment.method === 'zelle' && data.payment.zelle && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Deposit by Zelle to <strong>{data.payment.zelle}</strong> ({money(data.totals.deposit)})
          </p>
        )}
        {data.payment.method === 'square' && data.payment.squareLink && (
          <a
            href={data.payment.squareLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-lg bg-brand py-2.5 text-center font-semibold text-white"
          >
            Pay Deposit ({money(data.totals.deposit)})
          </a>
        )}
      </section>

      {/* Driver's license */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Driver&apos;s license</h2>
        <p className="mb-3 text-sm text-gray-500">
          Take a photo of your driver&apos;s license for the rental record. The
          photo uploads directly and is not saved to your phone.
        </p>
        {dlThumb ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dlThumb} alt="license" className="h-16 rounded-lg border border-gray-200" />
            <span className="text-sm font-medium text-green-600">
              {dlUploading ? 'Uploading…' : '✓ Photo added'}
            </span>
            <PhotoCapture onConfirm={uploadDl} label="Replace" />
          </div>
        ) : (
          <PhotoCapture onConfirm={uploadDl} label="Take license photo" />
        )}
        {dlUploading && !dlThumb && <p className="mt-2 text-sm text-gray-500">Uploading…</p>}
        {dlError && <p className="mt-2 text-sm text-red-600">{dlError}</p>}
      </section>

      {/* Waiver */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-semibold text-gray-800">Rental agreement</h2>
        <div
          ref={waiverRef}
          onScroll={onWaiverScroll}
          className="h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700"
        >
          {data.waiverText}
        </div>
        {!scrolled && (
          <p className="mt-2 text-center text-xs text-gray-400">
            ↓ Scroll to the end to continue
          </p>
        )}
        <label
          className={`mt-3 flex items-start gap-2 text-sm ${
            scrolled ? 'text-gray-700' : 'text-gray-300'
          }`}
        >
          <input
            type="checkbox"
            disabled={!scrolled}
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          I have read and agree to the rental agreement above.
        </label>
      </section>

      {/* Signature */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-semibold text-gray-800">Signature</h2>
        <SignaturePad onChange={setSignature} disabled={!agreed} />
      </section>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {/* Submit bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-3">
        <div className="mx-auto max-w-lg">
          <button
            onClick={submit}
            disabled={!agreed || !signature || submitting}
            className="w-full rounded-lg bg-brand py-3 font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Sign & Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
