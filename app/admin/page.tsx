'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Order, STATUS_LABELS, OrderStatus } from '@/lib/types'
import { money } from '@/lib/orders'

const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-indigo-100 text-indigo-700',
  deposit_paid: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  delivered: 'bg-teal-100 text-teal-700',
  picked_up: 'bg-cyan-100 text-cyan-700',
  balance_paid: 'bg-lime-100 text-lime-700',
  completed: 'bg-gray-800 text-white',
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-brand"
            >
              <div>
                <p className="font-semibold">
                  {o.customer.name || 'Unnamed customer'}
                </p>
                <p className="text-sm text-gray-500">
                  Event: {o.event.eventDate || '—'} · {money(o.totals.total)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[o.status]}`}
              >
                {STATUS_LABELS[o.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
