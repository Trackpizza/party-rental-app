'use client'

import { useState } from 'react'
import Markdown from './Markdown'

// A textarea with an Edit / Preview toggle so admins can see how their
// markdown will render to customers before saving.
export default function MarkdownField({
  value,
  onChange,
  rows = 4,
  mono = false,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  mono?: boolean
}) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium ${
      active ? 'bg-white text-brand shadow-sm' : 'text-gray-500'
    }`

  return (
    <div>
      <div className="mb-2 inline-flex rounded-lg bg-gray-100 p-0.5">
        <button type="button" onClick={() => setTab('edit')} className={tabCls(tab === 'edit')}>
          Edit
        </button>
        <button type="button" onClick={() => setTab('preview')} className={tabCls(tab === 'preview')}>
          Preview
        </button>
      </div>

      {tab === 'edit' ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand focus:outline-none ${
            mono ? 'font-mono' : ''
          }`}
        />
      ) : (
        <div
          className="w-full overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
          style={{ minHeight: `${Math.max(rows, 3) * 1.6}rem` }}
        >
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="text-gray-400">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
