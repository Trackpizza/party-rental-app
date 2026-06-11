'use client'

import { useEffect, useState } from 'react'
import { getWaiver, saveWaiver, DEFAULT_WAIVER } from '@/lib/waiver'
import { getBusinessSettings, saveBusinessSettings, StaffMember } from '@/lib/settings'

export default function SettingsPage() {
  const [text, setText] = useState('')
  const [version, setVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [reviewUrl, setReviewUrl] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [purgeDays, setPurgeDays] = useState('')
  const [requireDl, setRequireDl] = useState(true)
  const [producerEmails, setProducerEmails] = useState<string[]>([])
  const [videoRelease, setVideoRelease] = useState('')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [bizSaving, setBizSaving] = useState(false)
  const [bizSaved, setBizSaved] = useState(false)

  useEffect(() => {
    getWaiver().then((w) => {
      setText(w.text)
      setVersion(w.version)
      setLoading(false)
    })
    getBusinessSettings().then((b) => {
      setReviewUrl(b.googleReviewUrl)
      setTaxRate(b.taxRate ? String(b.taxRate) : '')
      setPurgeDays(String(b.dlPurgeDays))
      setRequireDl(b.requireDl)
      setProducerEmails(b.producerEmails)
      setVideoRelease(b.videoReleaseText)
      setStaff(b.staff)
    })
  }, [])

  async function saveBiz() {
    setBizSaving(true)
    setBizSaved(false)
    await saveBusinessSettings({
      googleReviewUrl: reviewUrl.trim(),
      taxRate: parseFloat(taxRate) || 0,
      dlPurgeDays: parseInt(purgeDays) || 30,
      requireDl,
      producerEmails: producerEmails.map((e) => e.trim()).filter(Boolean),
      videoReleaseText: videoRelease,
      staff: staff
        .map((s) => ({ name: s.name.trim(), email: s.email.trim() }))
        .filter((s) => s.name || s.email),
    })
    setBizSaving(false)
    setBizSaved(true)
    setTimeout(() => setBizSaved(false), 2000)
  }

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
        <h2 className="mb-1 font-semibold text-gray-800">Sales tax rate</h2>
        <p className="mb-3 text-sm text-gray-500">
          Tax is auto-calculated on each order from this rate (e.g. 9.5 for
          North Hollywood). You can still override the tax on any single order.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-gray-300 px-3">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="9.5"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-24 py-2 focus:outline-none"
            />
            <span className="text-gray-400">%</span>
          </div>
          <button
            onClick={saveBiz}
            disabled={bizSaving}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {bizSaving ? 'Saving…' : 'Save'}
          </button>
          {bizSaved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Driver&apos;s license</h2>
        <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={requireDl}
            onChange={(e) => setRequireDl(e.target.checked)}
          />
          Require a driver&apos;s license photo before the customer can sign
        </label>
        <p className="mb-3 text-sm text-gray-500">
          License photos are automatically deleted this many days after the
          event date (keeps sensitive ID data from piling up). Applies to new
          orders.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-gray-300 px-3">
            <input
              type="number"
              min="1"
              step="1"
              placeholder="30"
              value={purgeDays}
              onChange={(e) => setPurgeDays(e.target.value)}
              className="w-20 py-2 focus:outline-none"
            />
            <span className="text-gray-400">days</span>
          </div>
          <button
            onClick={saveBiz}
            disabled={bizSaving}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {bizSaving ? 'Saving…' : 'Save'}
          </button>
          {bizSaved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Producer email (content)</h2>
        <p className="mb-3 text-sm text-gray-500">
          Where &ldquo;Send to producer&rdquo; emails go (setup photos + videos
          for editing into social content). Add more than one to send to
          multiple content producers.
        </p>
        <div className="space-y-2">
          {producerEmails.map((email, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setProducerEmails(producerEmails.map((x, j) => (j === i ? e.target.value : x)))
                }
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => setProducerEmails(producerEmails.filter((_, j) => j !== i))}
                className="px-2 text-gray-300 hover:text-red-500"
                aria-label="Remove producer"
              >
                ✕
              </button>
            </div>
          ))}
          {producerEmails.length === 0 && (
            <p className="text-sm text-gray-400">No content producers yet.</p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={() => setProducerEmails([...producerEmails, ''])}
            className="text-sm font-semibold text-brand hover:underline"
          >
            + Add producer
          </button>
          <button
            onClick={saveBiz}
            disabled={bizSaving}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {bizSaving ? 'Saving…' : 'Save'}
          </button>
          {bizSaved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Video release text</h2>
        <p className="mb-3 text-sm text-gray-500">
          The customer checks a box agreeing to this before recording a video
          testimonial (so you can use it on social).
        </p>
        <textarea
          rows={3}
          value={videoRelease}
          onChange={(e) => setVideoRelease(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={saveBiz}
            disabled={bizSaving}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {bizSaving ? 'Saving…' : 'Save'}
          </button>
          {bizSaved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Staff / team</h2>
        <p className="mb-3 text-sm text-gray-500">
          Add your crew so you can email the setup-photo link to a team member
          from a dropdown instead of typing it each time.
        </p>
        <div className="space-y-2">
          {staff.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Name"
                value={s.name}
                onChange={(e) =>
                  setStaff(staff.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                className="w-1/3 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <input
                type="email"
                placeholder="email@example.com"
                value={s.email}
                onChange={(e) =>
                  setStaff(staff.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                }
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => setStaff(staff.filter((_, j) => j !== i))}
                className="px-2 text-gray-300 hover:text-red-500"
                aria-label="Remove staff"
              >
                ✕
              </button>
            </div>
          ))}
          {staff.length === 0 && (
            <p className="text-sm text-gray-400">No team members yet.</p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={() => setStaff([...staff, { name: '', email: '' }])}
            className="text-sm font-semibold text-brand hover:underline"
          >
            + Add staff
          </button>
          <button
            onClick={saveBiz}
            disabled={bizSaving}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {bizSaving ? 'Saving…' : 'Save'}
          </button>
          {bizSaved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Google review link</h2>
        <p className="mb-3 text-sm text-gray-500">
          Paste your Google review URL (from your Business Profile → Ask for
          reviews). It powers the &quot;Leave a review&quot; button on the
          event-photo page sent to customers.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="url"
            placeholder="https://g.page/r/..."
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
          <button
            onClick={saveBiz}
            disabled={bizSaving}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {bizSaving ? 'Saving…' : 'Save'}
          </button>
          {bizSaved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </section>

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
