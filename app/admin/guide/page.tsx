'use client'

import Markdown from '@/components/Markdown'
import { GUIDE_MD } from '@/lib/guide'

export default function GuidePage() {
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <h1 className="text-xl font-bold">Guide</h1>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:border-brand"
        >
          🖨 Print
        </button>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Markdown text={GUIDE_MD} />
      </div>
    </div>
  )
}
