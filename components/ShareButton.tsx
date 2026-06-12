'use client'

import { useState } from 'react'

// A "Share" button that opens the device's native share sheet — great on
// mobile, where Oscar can text / WhatsApp a link to one customer at a time
// (the OS share sheet is one recipient/app per share, by design). On browsers
// without the Web Share API (most desktops) it falls back to copying the link.
//
// `url` may be absolute or a site-relative path (e.g. "/gallery/abc"); relative
// paths are resolved against the current origin at click time so this stays
// correct on the live host without server-rendering window access.
export default function ShareButton({
  url,
  title,
  text,
  label = 'Share',
  className = 'rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand',
}: {
  url: string
  title?: string
  text?: string
  label?: string
  className?: string
}) {
  const [flash, setFlash] = useState('')

  async function onShare() {
    const full =
      url.startsWith('/') && typeof window !== 'undefined'
        ? `${window.location.origin}${url}`
        : url

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: full })
        return
      } catch (e: any) {
        // User dismissed the share sheet — not an error worth surfacing.
        if (e?.name === 'AbortError') return
      }
    }
    // Fallback: copy the link (with the message text, if any).
    try {
      await navigator.clipboard.writeText(text ? `${text} ${full}` : full)
      setFlash('Link copied!')
      setTimeout(() => setFlash(''), 1500)
    } catch {
      /* clipboard blocked — nothing else to do */
    }
  }

  return (
    <button type="button" onClick={onShare} className={className}>
      {flash || `📲 ${label}`}
    </button>
  )
}
