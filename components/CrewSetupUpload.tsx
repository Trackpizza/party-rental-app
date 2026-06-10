'use client'

import { useState } from 'react'
import PhotoCapture from './PhotoCapture'
import PublicVideoUpload from './PublicVideoUpload'

export default function CrewSetupUpload({
  orderId,
  customerName,
}: {
  orderId: string
  customerName: string
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold text-brand">Setup photos</h1>
        <p className="mt-1 text-sm text-gray-500">
          {customerName ? `Event: ${customerName}` : 'Capture the finished setup'}
        </p>

        <div className="mt-6 flex justify-center">
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
    </main>
  )
}
