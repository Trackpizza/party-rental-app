'use client'

import { useState } from 'react'
import PublicVideoUpload from './PublicVideoUpload'

export default function TestimonialRecorder({
  orderId,
  customerName,
  releaseText,
  business,
}: {
  orderId: string
  customerName: string
  releaseText: string
  business: string
}) {
  const [agreed, setAgreed] = useState(false)

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-brand">{business}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {customerName ? `${customerName}, we'd ` : "We'd "}love a quick video about
          your event! 🎉 (up to 3 minutes)
        </p>

        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-xs leading-relaxed text-gray-700">
          {releaseText}
        </div>

        <label className="mt-3 flex items-start gap-2 text-left text-sm text-gray-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          I agree to the above.
        </label>

        <div className="mt-5">
          {agreed ? (
            <PublicVideoUpload
              orderId={orderId}
              type="testimonial"
              maxSeconds={180}
              label="Record testimonial"
              recordExtra={{ releaseAgreed: true }}
            />
          ) : (
            <p className="text-sm text-gray-400">Check the box above to record.</p>
          )}
        </div>
      </div>
    </main>
  )
}
