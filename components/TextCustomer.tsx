'use client'

import { useState } from 'react'
import QRCode from 'qrcode'

// Desktop-friendly "text the customer" helper.
//
// Builds an `sms:<number>?body=<link>` URI. On the owner's Windows PC (with
// Phone Link set up) clicking it opens Phone Link pre-filled with the
// customer's number + the link — he just hits Send. The "Show QR" panel renders
// the same sms: URI as a QR code, generated locally (no third-party service, so
// the customer's number never leaves the app), so he can scan it with his phone
// if Phone Link isn't configured.
export default function TextCustomer({
  phone,
  url,
  text,
  label = 'Text customer',
  className = 'rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand',
}: {
  phone: string
  url: string
  text?: string
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [qr, setQr] = useState('')

  function smsHref(): string {
    const full =
      url.startsWith('/') && typeof window !== 'undefined'
        ? `${window.location.origin}${url}`
        : url
    const clean = (phone || '').replace(/[^\d+]/g, '')
    const body = encodeURIComponent(text ? `${text} ${full}` : full)
    return `sms:${clean}?body=${body}`
  }

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !qr) {
      try {
        setQr(await QRCode.toDataURL(smsHref(), { width: 240, margin: 1 }))
      } catch {
        /* QR generation failed — the Phone Link button still works */
      }
    }
  }

  const hasPhone = !!(phone || '').replace(/[^\d]/g, '')

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <span className="inline-flex items-center gap-2">
        {/* Anchor (not window.location) so the OS handler opens reliably. */}
        <a href={smsHref()} className={className}>
          💬 {label}
        </a>
        <button type="button" onClick={toggle} className="text-sm text-gray-400 underline">
          {open ? 'Hide QR' : 'Show QR'}
        </button>
      </span>

      {open && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          {!hasPhone && (
            <p className="mb-2 max-w-[240px] text-xs text-amber-700">
              No phone on file — add one to the order so the customer&apos;s
              number pre-fills. The link still works.
            </p>
          )}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Scan to text customer" width={180} height={180} className="mx-auto" />
          ) : (
            <p className="text-sm text-gray-400">Generating QR…</p>
          )}
          <p className="mt-2 max-w-[240px] text-xs text-gray-500">
            Scan with your phone to open Messages with the number and link ready.
          </p>
        </div>
      )}
    </span>
  )
}
