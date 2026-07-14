'use client'

import { useState } from 'react'

// A collapsible card section: a clickable banner (title + optional subtitle) that
// expands to show its children. Defaults to closed to keep the order page tidy.
export default function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="no-print overflow-hidden rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-gray-50"
        aria-expanded={open}
      >
        <span>
          <span className="font-semibold text-gray-800">{title}</span>
          {subtitle && <span className="mt-0.5 block text-sm text-gray-500">{subtitle}</span>}
        </span>
        <span className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && <div className="border-t border-gray-100 p-5">{children}</div>}
    </section>
  )
}
