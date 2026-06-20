'use client'

import { useState } from 'react'
import QRCode from 'qrcode'
import TextCustomer from '@/components/TextCustomer'

// Crew-facing "collect a card payment" control on the job ticket. Creates a
// Square link for the amount owed, then lets the crew either text it to the
// customer or show a QR the customer scans to pay on their own phone.
export default function CrewCollect({
  orderId,
  initialLink,
  owed,
  phone,
}: {
  orderId: string
  initialLink: string | null
  owed: number
  phone: string
}) {
  const [link, setLink] = useState<string | null>(initialLink)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [qr, setQr] = useState('')

  const money = (n: number) => `$${n.toFixed(2)}`

  async function createLink() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/square-balance-link`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setLink(json.url)
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleQr() {
    if (qr) {
      setQr('')
      return
    }
    if (!link) return
    try {
      setQr(await QRCode.toDataURL(link, { width: 240, margin: 1 }))
    } catch {
      /* QR failed — the link + Text still work */
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-sm font-medium text-gray-700">Pay by card · Pagar con tarjeta</p>
      {link ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-500">
            Text it to the customer, or show the QR for them to scan &amp; pay ·
            Envíelo o muestre el código QR.
          </p>
          <a href={link} target="_blank" rel="noreferrer" className="block break-all text-sm text-brand underline">
            {link}
          </a>
          <div className="flex flex-wrap items-center gap-3">
            <TextCustomer
              phone={phone}
              url={link}
              text="Here's your payment link:"
              label="Text customer · Enviar"
              className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
            />
            <button type="button" onClick={toggleQr} className="text-sm text-gray-500 underline">
              {qr ? 'Hide QR' : 'Show QR to scan'}
            </button>
          </div>
          {qr && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Scan to pay" width={200} height={200} className="mx-auto" />
              <p className="mt-1 text-xs text-gray-500">Customer scans to pay · Escanee para pagar</p>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={createLink}
          disabled={loading}
          className="mt-2 inline-block rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Creating…' : `💳 Card payment link (${money(owed)})`}
        </button>
      )}
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
    </div>
  )
}
