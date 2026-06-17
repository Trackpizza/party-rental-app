'use client'

import { useEffect, useId, useState } from 'react'

// 15-minute options, reordered to start at 8:00 AM (business hours first),
// with midnight–7:45 AM moved to the end so you don't scroll past unused hours.
const SLOTS: { value: string; label: string }[] = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const hr = h % 12 || 12
    SLOTS.push({ value, label: `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` })
  }
}
const START = 8 * 4 // 8:00 AM
const ORDERED = [...SLOTS.slice(START), ...SLOTS.slice(0, START)]

const pad = (n: number) => String(n).padStart(2, '0')

function toLabel(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return hhmm
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}

// Parse free text like "8", "8am", "8:30 pm", "08:00", "1430" -> "HH:MM".
function parseTime(s: string): string | null {
  if (!s) return null
  const t = s.trim().toLowerCase()
  let m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?$/)
  if (m) {
    let h = Number(m[1]) % 12
    if (m[3] === 'p') h += 12
    const min = m[2] ? Number(m[2]) : 0
    if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`
  }
  m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    const h = Number(m[1]), min = Number(m[2])
    if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`
  }
  m = t.match(/^(\d{3,4})$/)
  if (m) {
    const n = m[1].padStart(4, '0')
    const h = Number(n.slice(0, 2)), min = Number(n.slice(2))
    if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`
  }
  return null
}

export default function TimeSelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const listId = useId().replace(/:/g, '')
  const [text, setText] = useState(() => toLabel(value))

  // Reflect external value changes (e.g. pickup time auto-filled from the
  // delivery time) without clobbering what the user is currently typing.
  useEffect(() => {
    setText((prev) => (parseTime(prev) === value ? prev : toLabel(value)))
  }, [value])

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setText(v)
    onChange(parseTime(v) || '')
  }

  function blur() {
    const p = parseTime(text)
    if (p) setText(toLabel(p)) // tidy "8am" -> "8:00 AM"
  }

  return (
    <>
      <input
        list={listId}
        value={text}
        onChange={handle}
        onBlur={blur}
        placeholder="e.g. 8:00 AM"
        className={className}
      />
      <datalist id={listId}>
        {ORDERED.map((o) => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
    </>
  )
}
