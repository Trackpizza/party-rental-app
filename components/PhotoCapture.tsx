'use client'

import { useState } from 'react'

// Photo capture using the native camera input (capture="environment").
// This is the reliable cross-platform approach — on Android/iOS it opens the
// real camera app and returns the photo to us without saving it to the gallery.
// The image is downscaled before preview/upload to keep payloads small.
export default function PhotoCapture({
  onConfirm,
  label = 'Take photo',
}: {
  onConfirm: (jpegDataUrl: string) => void
  label?: string
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setWorking(true)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxW = 1400
        const scale = Math.min(1, maxW / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        setPreview(canvas.toDataURL('image/jpeg', 0.82))
        setWorking(false)
      }
      img.onerror = () => setWorking(false)
      img.src = reader.result as string
    }
    reader.onerror = () => setWorking(false)
    reader.readAsDataURL(file)
  }

  if (preview) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="preview"
          className="max-h-56 w-full rounded-lg border border-gray-200 object-contain"
        />
        <div className="mt-2 flex gap-3">
          <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-brand">
            Retake
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
          </label>
          <button
            onClick={() => {
              onConfirm(preview)
              setPreview(null)
            }}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Use photo
          </button>
        </div>
      </div>
    )
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand px-4 py-2.5 font-semibold text-brand hover:bg-brand hover:text-white">
      {working ? 'Processing…' : `📷 ${label}`}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
    </label>
  )
}
