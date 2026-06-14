'use client'

import { useState } from 'react'
import PhotoCapture from './PhotoCapture'

// Lets a customer re-upload a clearer driver's-license photo AFTER signing
// (e.g. the first one came out blurry). It only appends a new DL image — the
// signed agreement is untouched. The owner deletes the blurry one in the admin.
export default function CustomerDLRetake({ orderId }: { orderId: string }) {
  const [count, setCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function upload(dataUrl: string) {
    setUploading(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}/dl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl, source: 'customer' }),
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
    <div className="mt-6 border-t border-gray-100 pt-5 text-center">
      <p className="text-sm font-medium text-gray-700">License photo blurry?</p>
      <p className="mt-1 text-xs text-gray-500">
        Retake it below — your signature stays as is. · ¿Borrosa? Tome otra foto.
      </p>
      <div className="mt-3 flex justify-center">
        <PhotoCapture onConfirm={upload} label="Retake license photo" />
      </div>
      {uploading && <p className="mt-3 text-sm text-gray-500">Uploading…</p>}
      {count > 0 && !uploading && (
        <p className="mt-3 text-sm font-medium text-green-600">
          ✓ New photo sent — thank you! · ¡Gracias!
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
