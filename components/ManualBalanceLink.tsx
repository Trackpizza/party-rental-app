'use client'

import { useState } from 'react'
import { updateOrder } from '@/lib/orders'
import TextCustomer from '@/components/TextCustomer'
import ShareButton from '@/components/ShareButton'

// Manual-mode balance collection: the owner creates the balance payment link in
// Square, pastes it here, and saves it on the order. Once saved it can be texted
// or shared to the customer, and it also surfaces on the crew job ticket. Mirrors
// the manual deposit-link field on the order form, but for the amount still owed.
export default function ManualBalanceLink({
  orderId,
  initialLink,
  owed,
  phone,
  business,
}: {
  orderId: string
  initialLink: string | null
  owed: number
  phone: string
  business: string
}) {
  const [link, setLink] = useState(initialLink ?? '')
  const [saved, setSaved] = useState(initialLink ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const money = (n: number) => `$${n.toFixed(2)}`

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      const v = link.trim() || null
      await updateOrder(orderId, { squareBalanceLinkManual: v })
      setSaved(v ?? '')
      setMsg(v ? '✓ Saved' : 'Cleared')
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="no-print mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700">
        Collect {money(owed)} — balance payment link
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Create the balance link in Square, paste it here, and Save. Then text it to the customer —
        it also shows on the crew job ticket for collecting on delivery.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://square.link/..."
          className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={save}
          disabled={saving || link.trim() === saved}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saved && (
        <div className="mt-3 space-y-2">
          <a
            href={saved}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-sm text-brand underline"
          >
            {saved}
          </a>
          <div className="flex flex-wrap items-center gap-3">
            <TextCustomer
              phone={phone}
              url={saved}
              text="Here's your payment link for the balance due:"
              label="Text customer"
              className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
            />
            <ShareButton
              url={saved}
              title={`${business} — payment due`}
              text="Here's your payment link for the balance due:"
              className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
            />
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
    </div>
  )
}
