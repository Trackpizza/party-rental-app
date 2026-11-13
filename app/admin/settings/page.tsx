'use client'

import { useEffect, useState } from 'react'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { getWaiver, saveWaiver, DEFAULT_WAIVER } from '@/lib/waiver'
import { getBusinessSettings, saveBusinessSettings, StaffMember } from '@/lib/settings'
import MarkdownField from '@/components/MarkdownField'
import { useToast } from '@/components/Toast'

export default function SettingsPage() {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [version, setVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [bizName, setBizName] = useState('')
  const [bizPhone, setBizPhone] = useState('')
  const [bizAddress, setBizAddress] = useState('')
  const [zelleNumber, setZelleNumber] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [calendarSync, setCalendarSync] = useState(false)
  const [calendarTimeZone, setCalendarTimeZone] = useState('America/Los_Angeles')
  const [calStatus, setCalStatus] = useState<any>(null)
  const [reviewUrl, setReviewUrl] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [requireDl, setRequireDl] = useState(true)
  const [squareAutoLinks, setSquareAutoLinks] = useState(false)
  const [producerEmails, setProducerEmails] = useState<string[]>([])
  const [videoRelease, setVideoRelease] = useState('')
  const [consentText, setConsentText] = useState('')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [bizSaving, setBizSaving] = useState(false)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const TABS = ['General', 'Payments', 'Staff & Crew', 'Media & Consent', 'Waiver', 'Account'] as const
  type Tab = typeof TABS[number]
  const [activeTab, setActiveTab] = useState<Tab>('General')

  // Service-account address + whether it can actually reach the saved calendar.
  useEffect(() => {
    ;(async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) return
        const r = await fetch('/api/calendar/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setCalStatus(await r.json())
      } catch {}
    })()
  }, [saving, bizSaving])

  useEffect(() => {
    getWaiver().then((w) => {
      setText(w.text)
      setVersion(w.version)
      setLoading(false)
    })
    getBusinessSettings().then((b) => {
      setBizName(b.businessName)
      setBizPhone(b.businessPhone)
      setBizAddress(b.businessAddress)
      setZelleNumber(b.zelleNumber)
      setCalendarId(b.calendarId)
      setCalendarSync(b.calendarSync)
      setCalendarTimeZone(b.calendarTimeZone)
      setReviewUrl(b.googleReviewUrl)
      setTaxRate(b.taxRate ? String(b.taxRate) : '')
      setRequireDl(b.requireDl)
      setSquareAutoLinks(b.squareAutoLinks)
      setProducerEmails(b.producerEmails)
      setVideoRelease(b.videoReleaseText)
      setConsentText(b.mediaConsentText)
      setStaff(b.staff)
    })
  }, [])

  async function saveBiz() {
    setBizSaving(true)
    await saveBusinessSettings({
      businessName: bizName.trim(),
      businessPhone: bizPhone.trim(),
      businessAddress: bizAddress.trim(),
      zelleNumber: zelleNumber.trim(),
      calendarId: calendarId.trim(),
      calendarSync,
      calendarTimeZone: calendarTimeZone.trim() || 'America/Los_Angeles',
      googleReviewUrl: reviewUrl.trim(),
      taxRate: parseFloat(taxRate) || 0,
      requireDl,
      squareAutoLinks,
      producerEmails: producerEmails.map((e) => e.trim()).filter(Boolean),
      videoReleaseText: videoRelease,
      mediaConsentText: consentText,
      staff: staff
        .map((s) => ({ name: s.name.trim(), email: s.email.trim(), phone: (s.phone || '').trim() }))
        .filter((s) => s.name || s.email || s.phone),
    })
    setBizSaving(false)
    toast('Settings saved')
  }

  async function changePassword() {
    const user = auth.currentUser
    if (!user || !user.email) {
      toast('Not signed in.', 'error')
      return
    }
    if (newPw.length < 6) {
      toast('New password must be at least 6 characters.', 'error')
      return
    }
    if (newPw !== confirmPw) {
      toast('New passwords do not match.', 'error')
      return
    }
    setPwSaving(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, curPw)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, newPw)
      toast('Password changed')
      setCurPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (e: any) {
      const code = e?.code || ''
      toast(
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : 'Could not change password. Try again.',
        'error',
      )
    } finally {
      setPwSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    await saveWaiver(text)
    const w = await getWaiver()
    setVersion(w.version)
    setSaving(false)
    toast('Waiver saved')
  }

  const SaveBar = () => (
    <div className="mt-4">
      <button
        onClick={saveBiz}
        disabled={bizSaving}
        className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {bizSaving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* General */}
      {activeTab === 'General' && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Business info</h2>
            <p className="mb-3 text-sm text-gray-500">
              Printed at the top of every rental agreement, and shown to customers on
              the signing page. The Zelle number appears on the agreement when the
              order is set to pay by Zelle.
            </p>
            <div className="grid max-w-xl gap-3">
              <label className="text-sm font-medium text-gray-700">
                Business name
                <input
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="Party Supplies La Poblanita 2"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Phone
                <input
                  type="tel"
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  placeholder="818.982.5234"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Address
                <input
                  type="text"
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  placeholder="12034 Vanowen Street, North Hollywood, CA 91605"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Zelle number
                <input
                  type="tel"
                  value={zelleNumber}
                  onChange={(e) => setZelleNumber(e.target.value)}
                  placeholder="747.389.8112"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand focus:outline-none"
                />
              </label>
            </div>
            <SaveBar />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Google Calendar</h2>
            <p className="mb-3 text-sm text-gray-500">
              Writes a Delivery and a Pickup event for every order onto one Google
              Calendar, so jobs appear in your normal Calendar app. Give the crew
              view-only access to that calendar and they will see the schedule too.
            </p>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={calendarSync}
                onChange={(e) => setCalendarSync(e.target.checked)}
                className="mt-0.5"
              />
              <span>Keep orders synced to Google Calendar</span>
            </label>

            <div className="mt-3 grid max-w-xl gap-3">
              <label className="text-sm font-medium text-gray-700">
                Calendar ID
                <input
                  type="text"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  placeholder="something@group.calendar.google.com"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand focus:outline-none"
                />
                <span className="mt-1 block text-xs font-normal text-gray-400">
                  In Google Calendar: Settings → your calendar → Integrate calendar → Calendar ID.
                </span>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Time zone
                <input
                  type="text"
                  value={calendarTimeZone}
                  onChange={(e) => setCalendarTimeZone(e.target.value)}
                  placeholder="America/Los_Angeles"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand focus:outline-none"
                />
              </label>
            </div>

            {calStatus?.serviceAccount && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-600">
                  Share your calendar with this address, with{' '}
                  <strong>Make changes to events</strong>:
                </p>
                <p className="mt-1 break-all font-mono text-xs text-gray-800">
                  {calStatus.serviceAccount}
                </p>
                {calStatus.access === 'ok' && (
                  <p className="mt-2 text-xs font-medium text-green-600">
                    {calStatus.role
                      ? '✓ Connected — the app can create events on this calendar.'
                      : '✓ Calendar found. Sync an order to confirm it can create events.'}
                  </p>
                )}
                {calStatus.access === 'readonly' && (
                  <p className="mt-2 text-xs font-medium text-red-600">{calStatus.reason}</p>
                )}
                {calStatus.access === 'error' && (
                  <p className="mt-2 text-xs font-medium text-red-600">{calStatus.reason}</p>
                )}
                {calStatus.access === 'unset' && (
                  <p className="mt-2 text-xs text-gray-400">
                    Add a Calendar ID above and Save to test the connection.
                  </p>
                )}
              </div>
            )}

            <SaveBar />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Sales tax rate</h2>
            <p className="mb-3 text-sm text-gray-500">
              Auto-calculated on each order (e.g. 9.5 for North Hollywood). You can still override per order.
            </p>
            <div className="flex items-center rounded-lg border border-gray-300 px-3 w-fit">
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
            <SaveBar />
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
              License photos are automatically deleted <strong>30 days after the event</strong>.
            </p>
            <SaveBar />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Google review link</h2>
            <p className="mb-3 text-sm text-gray-500">
              Paste your Google review URL (Business Profile → Ask for reviews). Powers the review button on the customer photo page.
            </p>
            <input
              type="url"
              placeholder="https://g.page/r/..."
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
            />
            <SaveBar />
          </section>
        </div>
      )}

      {/* Payments */}
      {activeTab === 'Payments' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">Square payments</h2>
          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={squareAutoLinks}
              onChange={(e) => setSquareAutoLinks(e.target.checked)}
            />
            Auto-generate Square payment links (deposit &amp; balance)
          </label>
          <p className="mb-3 text-sm text-gray-500">
            <strong>Off</strong> (manual): paste your own Square link and mark paid by hand.{' '}
            <strong>On</strong>: the order page gets &ldquo;Create deposit link&rdquo; / &ldquo;Collect&rdquo; buttons that build the link for you and mark it paid automatically. You can switch anytime.
          </p>
          <SaveBar />
        </section>
      )}

      {/* Staff & Crew */}
      {activeTab === 'Staff & Crew' && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Team members</h2>
            <p className="mb-3 text-sm text-gray-500">
              Add crew so you can send job tickets and setup-photo links from a dropdown instead of typing each time.
            </p>
            <div className="space-y-2">
              {staff.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    placeholder="Name"
                    value={s.name}
                    onChange={(e) =>
                      setStaff(staff.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    className="min-w-[110px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={s.email}
                    onChange={(e) =>
                      setStaff(staff.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                    }
                    className="min-w-[160px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (for texting)"
                    value={s.phone || ''}
                    onChange={(e) =>
                      setStaff(staff.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))
                    }
                    className="min-w-[140px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
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
              {staff.length === 0 && <p className="text-sm text-gray-400">No team members yet.</p>}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <button
                onClick={() => setStaff([...staff, { name: '', email: '', phone: '' }])}
                className="text-sm font-semibold text-brand hover:underline"
              >
                + Add staff
              </button>
            </div>
            <SaveBar />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Producer email (content)</h2>
            <p className="mb-3 text-sm text-gray-500">
              Where &ldquo;Send to producer&rdquo; emails go — setup photos + videos for social content editing.
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
              {producerEmails.length === 0 && <p className="text-sm text-gray-400">No content producers yet.</p>}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setProducerEmails([...producerEmails, ''])}
                className="text-sm font-semibold text-brand hover:underline"
              >
                + Add producer
              </button>
            </div>
            <SaveBar />
          </section>
        </div>
      )}

      {/* Media & Consent */}
      {activeTab === 'Media & Consent' && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Video release text</h2>
            <p className="mb-3 text-sm text-gray-500">
              The customer checks a box agreeing to this before recording a video testimonial for social use.
            </p>
            <MarkdownField value={videoRelease} onChange={setVideoRelease} rows={4} />
            <SaveBar />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Photo/video consent (signing)</h2>
            <p className="mb-3 text-sm text-gray-500">
              Optional checkbox shown when the customer signs — permission to take setup photos &amp; a walkthrough video for social media. Doesn&apos;t block signing. Supports Markdown.
            </p>
            <MarkdownField value={consentText} onChange={setConsentText} rows={6} />
            <SaveBar />
          </section>
        </div>
      )}

      {/* Waiver */}
      {activeTab === 'Waiver' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Waiver text</h2>
            <span className="text-xs text-gray-400">version: {version || '—'}</span>
          </div>
          <p className="mb-3 text-sm text-gray-500">
            What customers read and agree to before signing. Editing bumps the version; previously signed orders keep the exact text they agreed to.
          </p>
          {loading ? (
            <p className="text-gray-400">Loading…</p>
          ) : (
            <>
              <MarkdownField value={text} onChange={setText} rows={18} mono />
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
              </div>
            </>
          )}
        </section>
      )}

      {/* Account */}
      {activeTab === 'Account' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">Change password</h2>
          <p className="mb-3 text-sm text-gray-500">
            Update your sign-in password. You&apos;ll need your current password to confirm.
          </p>
          <div className="grid max-w-sm gap-2">
            <input
              type="password"
              autoComplete="current-password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="Current password"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (min 6 characters)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div className="mt-3">
            <button
              onClick={changePassword}
              disabled={pwSaving}
              className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pwSaving ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
