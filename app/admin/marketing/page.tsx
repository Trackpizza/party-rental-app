'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Order, customerName } from '@/lib/types'
import { money } from '@/lib/orders'
import { REFERRAL_SOURCES } from '@/lib/referral-sources'

// yyyy-mm-dd for an offset month/day from today (local calendar).
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

type PresetKey = 'all' | '30d' | 'month' | 'year'

export default function MarketingPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })))
        setLoading(false)
      },
      () => setLoading(false),
    )
    return () => unsub()
  }, [])

  function applyPreset(p: PresetKey) {
    const now = new Date()
    if (p === 'all') {
      setFrom('')
      setTo('')
    } else if (p === '30d') {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      setFrom(isoDate(d))
      setTo(isoDate(now))
    } else if (p === 'month') {
      setFrom(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)))
      setTo(isoDate(now))
    } else if (p === 'year') {
      setFrom(isoDate(new Date(now.getFullYear(), 0, 1)))
      setTo(isoDate(now))
    }
  }

  // Orders within the selected created-date range (archived included — a booking
  // is still a booking for attribution).
  const inRange = useMemo(() => {
    return orders.filter((o) => {
      const d = (o.createdAt || '').slice(0, 10)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
  }, [orders, from, to])

  const total = inRange.length
  const totalRevenue = inRange.reduce((s, o) => s + (o.totals.total || 0), 0)
  const tracked = inRange.filter((o) => o.referralSource)

  // Count + revenue by source.
  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    const revenue: Record<string, number> = {}
    for (const src of REFERRAL_SOURCES) {
      counts[src] = 0
      revenue[src] = 0
    }
    for (const o of tracked) {
      const s = o.referralSource
      counts[s] = (counts[s] ?? 0) + 1
      revenue[s] = (revenue[s] ?? 0) + (o.totals.total || 0)
    }
    return Object.keys(counts)
      .filter((s) => counts[s] > 0)
      .map((s) => ({ source: s, count: counts[s], revenue: revenue[s] }))
      .sort((a, b) => b.count - a.count)
  }, [tracked])

  const maxCount = stats[0]?.count ?? 1
  const untracked = inRange.filter((o) => !o.referralSource)
  const untrackedRevenue = untracked.reduce((s, o) => s + (o.totals.total || 0), 0)

  const noteOrders = inRange.filter((o) => o.referralComment)

  const presets: { key: PresetKey; label: string }[] = [
    { key: 'all', label: 'All time' },
    { key: '30d', label: 'Last 30 days' },
    { key: 'month', label: 'This month' },
    { key: 'year', label: 'This year' },
  ]
  const isAll = !from && !to

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Marketing</h1>
        <p className="text-sm text-gray-400">
          {total} order{total !== 1 ? 's' : ''} · {money(totalRevenue)}
        </p>
      </div>

      {/* Date range filter */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => {
            const active =
              (p.key === 'all' && isAll) ||
              (p.key !== 'all' && !isAll && rangeMatchesPreset(p.key, from, to))
            return (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`rounded-full px-3 py-1 text-sm ${
                  active
                    ? 'bg-brand text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-brand'
                }`}
              >
                {p.label}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1"
            />
            <span>–</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          {/* Referral source breakdown */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-700">Referral Sources</h2>
              <span className="text-xs text-gray-400">
                {tracked.length} of {total} tracked
              </span>
            </div>

            {stats.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No referral data in this range yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.map(({ source, count, revenue }) => {
                  const pct = tracked.length > 0 ? Math.round((count / tracked.length) * 100) : 0
                  const barPct = Math.round((count / maxCount) * 100)
                  return (
                    <div key={source} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-40 shrink-0 text-sm text-gray-700">{source}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <div className="w-28 shrink-0 text-right">
                        <span className="text-sm font-semibold text-gray-900">{count}</span>
                        <span className="ml-1 text-xs text-gray-400">{pct}%</span>
                        <span className="block text-xs text-gray-500">{money(revenue)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {untracked.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
                <span>No source recorded</span>
                <span>
                  {untracked.length} order{untracked.length !== 1 ? 's' : ''} ·{' '}
                  {money(untrackedRevenue)}
                </span>
              </div>
            )}
          </div>

          {/* Referral notes */}
          {noteOrders.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-700">Referral Notes</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {noteOrders.map((o) => (
                  <div key={o.id} className="px-5 py-3 text-sm">
                    <span className="mr-2 font-medium text-gray-700">
                      {customerName(o.customer) || 'Unnamed'}
                    </span>
                    <span className="text-gray-500">{o.referralComment}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// True when from/to exactly match what a preset would set right now — used to
// highlight the active chip after a click (and not after manual date edits).
function rangeMatchesPreset(key: PresetKey, from: string, to: string): boolean {
  const now = new Date()
  const today = isoDate(now)
  if (to !== today) return false
  if (key === '30d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 29)
    return from === isoDate(d)
  }
  if (key === 'month') return from === isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  if (key === 'year') return from === isoDate(new Date(now.getFullYear(), 0, 1))
  return false
}
