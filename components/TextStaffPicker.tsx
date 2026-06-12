'use client'

import { useState } from 'react'
import { StaffMember } from '@/lib/settings'
import TextCustomer from './TextCustomer'

// Pick a team member (who has a phone in Settings) and text/QR them a link via
// Phone Link. Renders nothing until at least one staff member has a phone, so
// it stays out of the way until staff phones are filled in.
export default function TextStaffPicker({
  staff,
  url,
  text,
}: {
  staff: StaffMember[]
  url: string
  text?: string
}) {
  const withPhone = staff.filter((s) => (s.phone || '').trim())
  const [idx, setIdx] = useState('')

  if (withPhone.length === 0) return null

  const sel = idx !== '' ? withPhone[Number(idx)] : null

  return (
    <div className="mt-3">
      <select
        value={idx}
        onChange={(e) => setIdx(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
      >
        <option value="">💬 Text a team member…</option>
        {withPhone.map((s, i) => (
          <option key={i} value={i}>{s.name || s.phone}</option>
        ))}
      </select>
      {sel && (
        <div className="mt-2">
          <TextCustomer
            phone={sel.phone}
            url={url}
            text={text}
            label={`Text ${sel.name || 'team member'}`}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:border-brand"
          />
        </div>
      )}
    </div>
  )
}
