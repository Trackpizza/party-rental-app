'use client'

import { useState } from 'react'

export default function GalleryActions({
  photoUrls,
}: {
  photoUrls: string[]
}) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dlProgress, setDlProgress] = useState(0)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  async function downloadAll() {
    if (!photoUrls.length || downloading) return
    setDownloading(true)
    setDlProgress(0)
    for (let i = 0; i < photoUrls.length; i++) {
      try {
        const res = await fetch(photoUrls[i])
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `event-photo-${i + 1}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setDlProgress(i + 1)
        // Small pause between files so the browser processes each download.
        await new Promise((r) => setTimeout(r, 350))
      } catch {}
    }
    setDownloading(false)
  }

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-3">
      <button
        onClick={copyLink}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-brand hover:text-brand"
      >
        {copied ? '✓ Link copied!' : '🔗 Copy share link'}
      </button>
      {photoUrls.length > 0 && (
        <button
          onClick={downloadAll}
          disabled={downloading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {downloading
            ? `Saving ${dlProgress} / ${photoUrls.length}…`
            : `⬇ Save all ${photoUrls.length} photo${photoUrls.length === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  )
}
