'use client'

import { useState } from 'react'

// Copy-link + save-all controls for the customer gallery.
//
// downloadUrls are signed Storage URLs carrying a Content-Disposition attachment
// header, so clicking one saves the file. They can't be fetched into a blob
// first — the bucket has no CORS config — which is why this navigates to each
// URL instead of downloading the bytes itself.
export default function GalleryActions({
  downloadUrls,
}: {
  downloadUrls: string[]
}) {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(0)
  const total = downloadUrls.length

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  async function saveAll() {
    if (!total || saving) return
    setSaving(true)
    setDone(0)
    for (let n = 0; n < total; n++) {
      const a = document.createElement('a')
      a.href = downloadUrls[n]
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setDone(n + 1)
      // Space the clicks out so the browser queues each download instead of
      // treating them as one runaway burst.
      await new Promise((r) => setTimeout(r, 400))
    }
    setSaving(false)
  }

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-3">
      <button
        onClick={copyLink}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-brand hover:text-brand"
      >
        {copied ? '✓ Link copied!' : '🔗 Copy share link'}
      </button>
      {total > 0 && (
        <button
          onClick={saveAll}
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? `Saving ${done} / ${total}…` : `⬇ Save all ${total} photo${total === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  )
}
