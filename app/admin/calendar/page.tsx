'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Order, customerName, itemName } from '@/lib/types'
import { money } from '@/lib/orders'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const today = new Date()
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders')), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })))
    })
    return () => unsub()
  }, [])

  const byDate = useMemo(() => {
    const m: Record<string, Order[]> = {}
    for (const o of orders) {
      const d = o.event?.eventDate
      if (d) (m[d] = m[d] || []).push(o)
    }
    return m
  }, [orders])

  const { y, m } = view
  const startDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const selectedOrders = selected ? byDate[selected] || [] : []
  const inventory = useMemo(() => {
    const inv: Record<string, number> = {}
    for (const o of selectedOrders) {
      for (const it of o.items || []) {
        if (it.qty) {
          const n = itemName(it)
          inv[n] = (inv[n] || 0) + it.qty
        }
      }
    }
    return Object.entries(inv).sort((a, b) => a[0].localeCompare(b[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, orders])

  function shift(delta: number) {
    setSelected(null)
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => shift(-1)} className="rounded-lg border border-gray-300 px-3 py-1 hover:border-brand">←</button>
          <span className="w-40 text-center font-medium">{MONTHS[m]} {y}</span>
          <button onClick={() => shift(1)} className="rounded-lg border border-gray-300 px-3 py-1 hover:border-brand">→</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
        {DOW.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${y}-${pad(m + 1)}-${pad(day)}`
          const evs = byDate[dateStr] || []
          const isToday = dateStr === ymd(today)
          const isSel = dateStr === selected
          return (
            <button
              key={i}
              onClick={() => setSelected(isSel ? null : dateStr)}
              className={`min-h-[4.5rem] rounded-lg border p-1 text-left align-top ${
                isSel ? 'border-brand ring-1 ring-brand' : 'border-gray-200'
              } ${evs.length ? 'bg-brand/5' : 'bg-white'}`}
            >
              <div className={`text-xs ${isToday ? 'font-bold text-brand' : 'text-gray-500'}`}>{day}</div>
              {evs.slice(0, 2).map((e) => (
                <div key={e.id} className="truncate text-[10px] text-gray-700">
                  {customerName(e.customer) || '—'}
                </div>
              ))}
              {evs.length > 2 && <div className="text-[10px] text-gray-400">+{evs.length - 2} more</div>}
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800">
            {selected} — {selectedOrders.length} event{selectedOrders.length === 1 ? '' : 's'}
          </h2>

          {inventory.length > 0 && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Inventory committed this day
              </p>
              <p className="mt-1 text-sm">
                {inventory.map(([n, q]) => `${q} ${n}`).join(' · ')}
              </p>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {selectedOrders.length === 0 ? (
              <p className="text-sm text-gray-400">No events this day.</p>
            ) : (
              selectedOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="block rounded-xl border border-gray-200 p-3 hover:border-brand"
                >
                  <p className="font-medium">
                    {customerName(o.customer) || 'Unnamed'}
                    {o.event.eventName && (
                      <span className="font-normal text-gray-500"> · {o.event.eventName}</span>
                    )}
                    {' · '}{money(o.totals.total)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {o.items.filter((i) => i.qty).map((i) => `${i.qty} ${itemName(i)}`).join(', ') ||
                      'No items'}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
