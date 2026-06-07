'use client'

import { useEffect, useState } from 'react'
import { getWaiver, saveWaiver, DEFAULT_WAIVER } from '@/lib/waiver'

export default function SettingsPage() {
  const [text, setText] = useState('')
  const [version, setVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getWaiver().then((w) => {
      setText(w.text)
      setVersion(w.version)
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await saveWaiver(text)
    const w = await getWaiver()
    setVersion(w.version)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Waiver text</h2>
          <span className="text-xs text-gray-400">version: {version || '—'}</span>
        </div>
        <p className="mb-3 text-sm text-gray-500">
          This is what customers read and agree to before signing. Editing it
          bumps the version; previously signed orders keep the exact text they
          agreed to.
        </p>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : (
          <>
            <textarea
              rows={18}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-brand focus:outline-none"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save waiver'}
              </button>
              <button
                onClick={() => setText(DEFAULT_WAIVER)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Reset to default
              </button>
              {saved && <span className="text-sm text-green-600">✓ Saved</span>}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
