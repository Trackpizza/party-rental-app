'use client'

import { useState } from 'react'
import PhotoCapture from './PhotoCapture'
import PublicVideoUpload from './PublicVideoUpload'

export default function CrewSetupUpload({
  orderId,
}: {
  orderId: string
}) {
  const [count, setCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function upload(dataUrl: string) {
    setUploading(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setCount((c) => c + 1)
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-center font-bold text-brand">Take setup photos</h2>
      <p className="mt-1 text-center text-sm text-gray-500">
        Capture the finished setup on-site · Fotos del montaje terminado
      </p>

      <div className="mt-4 rounded-xl bg-gray-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Shot guide · Guía de fotos
        </p>
        <ol className="space-y-1 text-sm text-gray-600">
          <li>1. Full setup from the front · Vista frontal completa</li>
          <li>2. Close-up of each item · Detalle de cada artículo</li>
          <li>3. Left side · Lado izquierdo</li>
          <li>4. Right side · Lado derecho</li>
          <li>5. House/venue number visible · Número de la casa</li>
        </ol>
      </div>

      <div className="mt-5 flex justify-center">
        <PhotoCapture onConfirm={upload} label="Take setup photo" />
      </div>

      <div className="mt-4 flex justify-center border-t border-gray-100 pt-4">
        <PublicVideoUpload
          orderId={orderId}
          type="walkthrough"
          maxSeconds={60}
          label="Walkthrough video (≤1 min)"
        />
      </div>

      {uploading && <p className="mt-3 text-sm text-gray-500">Uploading…</p>}
      {count > 0 && !uploading && (
        <p className="mt-3 text-sm font-medium text-green-600">
          ✓ {count} photo{count > 1 ? 's' : ''} uploaded — take more or you&apos;re done!
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
