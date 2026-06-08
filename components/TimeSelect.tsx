'use client'

// Reliable 15-minute time picker (a plain <select>) — works identically on
// every browser, unlike <input type="time" step=900> whose wheel pickers
// ignore the step. Stores 24h "HH:MM"; shows friendly "h:mm AM/PM".
const OPTIONS: { value: string; label: string }[] = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const ampm = h < 12 ? 'AM' : 'PM'
    const hr = h % 12 || 12
    OPTIONS.push({ value, label: `${hr}:${String(m).padStart(2, '0')} ${ampm}` })
  }
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
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">--:--</option>
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
