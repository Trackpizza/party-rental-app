'use client'

import { useState } from 'react'
import QRCode from 'qrcode'

// "Text the customer" helper.
//
// Builds an `sms:<number>?body=<link>` URI and renders it as a QR code, generated
// locally (no third-party service, so the customer's number never leaves the app).
// The owner scans it with his phone and Messages opens with the number + link
// ready to send — no Windows Phone Link setup required.
//
// `onPhone` is for the crew-facing pages, where the person is already holding a
// phone: there a direct sms: link is correct (scanning a QR with the same phone
// you're holding makes no sense), so it renders a plain tap-to-text link instead.
export default function TextCustomer({
  phone,
  url,
  text,
  label = 'Text customer',
  className = 'rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand',
  onPhone = false,
}: {
  phone: string
  url: string
  text?: string
  label?: string
  className?: string
  onPhone?: boolean
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
        /* QR generation failed — nothing to show */
      }
    }
  }

  const hasPhone = !!(phone || '').replace(/[^\d]/g, '')

  // Crew on their own phone — tap to open Messages directly.
  if (onPhone) {
    return (
      <a href={smsHref()} className={className}>
        💬 {label}
      </a>
    )
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button type="button" onClick={toggle} className={className}>
        📱 {open ? 'Hide QR' : `${label} — scan QR`}
      </button>

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
            Scan with your phone — Messages opens with the number and link ready to send.
          </p>
        </div>
      )}
    </span>
  )
}
