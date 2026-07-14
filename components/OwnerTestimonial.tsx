'use client'

import { useState } from 'react'
import ShareButton from './ShareButton'
import TextCustomer from './TextCustomer'

// Request a short video testimonial from the customer: record on-site at pickup,
// or send them the recorder link (release + ≤3 min). Recordings land on the order.
export default function OwnerTestimonial({
  orderId,
  customerPhone,
}: {
  orderId: string
  customerPhone: string
}) {
  const [tCopied, setTCopied] = useState(false)

  async function copyTestimonialLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/testimonial/${orderId}`)
    setTCopied(true)
    setTimeout(() => setTCopied(false), 1500)
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">
        Record on-site at pickup, or send the customer the link (they agree to a
        release, then record ≤3 min). It lands here and notifies you. Tip: use the
        “Also invite a video testimonial” checkbox in Customer Photos/Videos to add
        this button to their photo page automatically.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={`/testimonial/${orderId}`} target="_blank" rel="noreferrer" className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">
          Open recorder (on-site)
        </a>
        <button onClick={copyTestimonialLink} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
          {tCopied ? 'Copied!' : 'Copy testimonial link'}
        </button>
        <ShareButton
          url={`/testimonial/${orderId}`}
          title="Quick video testimonial"
          text="Would you record a quick video review of your event?"
          label="Share link"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand"
        />
        <TextCustomer
          phone={customerPhone}
          url={`/testimonial/${orderId}`}
          text="Would you record a quick video review of your event?"
          label="Text link"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand"
        />
      </div>
    </div>
  )
}
