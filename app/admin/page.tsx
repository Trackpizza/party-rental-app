'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Order, STATUS_LABELS, OrderStatus, customerName } from '@/lib/types'
import { money } from '@/lib/orders'

const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-indigo-100 text-indigo-700',
  deposit_paid: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-amber-100 text-amber-700',
  delivered: 'bg-teal-100 text-teal-700',
  picked_up: 'bg-cyan-100 text-cyan-700',
  balance_paid: 'bg-green-100 text-green-700',
  completed: 'bg-gray-800 text-white',
}

const FILTERS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'sent', label: 'Sent', statuses: ['sent'] },
  { key: 'signed', label: 'Signed', statuses: ['signed'] },
  { key: 'deposit', label: 'Deposit Paid', statuses: ['deposit_paid', 'confirmed'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { key: 'picked_up', label: 'Picked Up', statuses: ['picked_up'] },
  { key: 'balance', label: 'Balance Paid', statuses: ['balance_paid'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'archived', label: 'Archived' },
]

function matchesStatus(o: Order, key: string): boolean {
  if (key === 'all') return true
  const f = FILTERS.find((x) => x.key === key)
  return f?.statuses ? f.statuses.includes(o.status) : true
}

// Flag orders that are committed and heading toward delivery but haven't had
// their paper copy printed yet. Cleared once printed or delivered (moot after
// that). Prevents the "forgot to print before delivery" miss.
function needsPrint(o: Order): boolean {
  if (o.printedAt || o.deliveredAt || o.archived) return false
  return !!(o.signature || o.depositPaid)
}

function matchesSearch(o: Order, ql: string): boolean {
  if (!ql) return true
  const c = o.customer
  const hay = [c.firstName, c.lastName, customerName(c), c.email]
    .map((x) => (x || '').toLowerCase())
  if (hay.some((h) => h.includes(ql))) return true
  const qd = ql.replace(/\D/g, '')
  if (qd && (c.phone || '').replace(/\D/g, '').includes(qd)) return true
  return false
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
    return () => unsub()
  }, [])

  const ql = search.toLowerCase().trim()
  const filtered = orders.filter((o) => {
    if (!matchesSearch(o, ql)) return false
    // The "Archived" chip shows only archived orders; every other view hides them.
    if (statusFilter === 'archived') return !!o.archived
    if (o.archived) return false
    return matchesStatus(o, statusFilter)
  })

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Orders</h1>

      {loading ? (
        <p className="text-gray-400">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500">No orders yet.</p>
          <Link
            href="/admin/orders/new"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            + Create your first order
          </Link>
        </div>
      ) : (
        <>
          <div className="relative mb-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, or email…"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pl-10 focus:border-brand focus:outline-none"
            />
            <span className="pointer-events-none absolute left-3 top-3 text-gray-400">🔍</span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-full px-3 py-1 text-sm ${
                  statusFilter === f.key
                    ? 'bg-brand text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-brand'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-gray-400">
              No orders match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-brand"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {customerName(o.customer) || 'Unnamed customer'}
                      {o.event.eventName && (
                        <span className="font-normal text-gray-500"> · {o.event.eventName}</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-gray-500">
                      {o.customer.phone && <span>{o.customer.phone} · </span>}
                      Event: {o.event.eventDate || '—'} · {money(o.totals.total)}
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                    {needsPrint(o) && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                        ⚠ Not printed
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
