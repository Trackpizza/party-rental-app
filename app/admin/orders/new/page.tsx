'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  OrderDraft,
  buildEmptyOrder,
  recalcTotals,
  createOrder,
  money,
} from '@/lib/orders'
import {
  ITEM_CATALOG,
  SURFACE_TYPES,
  SurfaceType,
  LineItem,
  PaymentMethod,
} from '@/lib/types'

const inputCls =
  'rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col text-sm font-medium text-gray-700">
      {label}
      <span className="mt-1">{children}</span>
    </label>
  )
}

export default function NewOrderPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<OrderDraft>(buildEmptyOrder())
  const [depositManual, setDepositManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Recompute totals, honoring a manual deposit override.
  function withTotals(next: OrderDraft): OrderDraft {
    const totals = recalcTotals(next.items, {
      ...next.totals,
      deposit: depositManual ? next.totals.deposit : null,
    })
    return { ...next, totals }
  }

  function patch(updater: (d: OrderDraft) => OrderDraft) {
    setDraft((d) => withTotals(updater(d)))
  }

  function updateItem(key: string, p: Partial<LineItem>) {
    patch((d) => ({
      ...d,
      items: d.items.map((i) => (i.key === key ? { ...i, ...p } : i)),
    }))
  }

  function toggleOption(key: string, opt: string) {
    patch((d) => ({
      ...d,
      items: d.items.map((i) => {
        if (i.key !== key) return i
        const has = i.options?.includes(opt)
        return {
          ...i,
          options: has
            ? (i.options || []).filter((o) => o !== opt)
            : [...(i.options || []), opt],
        }
      }),
    }))
  }

  function toggleSurface(s: SurfaceType) {
    patch((d) => {
      const has = d.event.surfaces.includes(s)
      return {
        ...d,
        event: {
          ...d.event,
          surfaces: has
            ? d.event.surfaces.filter((x) => x !== s)
            : [...d.event.surfaces, s],
        },
      }
    })
  }

  function num(v: string): number | null {
    if (v === '') return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  async function handleSave() {
    setError('')
    if (!draft.customer.name.trim()) {
      setError('Customer name is required.')
      return
    }
    setSaving(true)
    try {
      const id = await createOrder(draft)
      router.push(`/admin/orders/${id}`)
    } catch (err: any) {
      setError(err?.message || 'Failed to save order.')
      setSaving(false)
    }
  }

  const t = draft.totals

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-xl font-bold">New Order</h1>

      {/* Dates & times */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Dates</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Today's date">
            <input
              type="date"
              value={draft.todaysDate}
              onChange={(e) => patch((d) => ({ ...d, todaysDate: e.target.value }))}
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Event date">
            <input
              type="date"
              value={draft.event.eventDate}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, eventDate: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Delivery time">
            <input
              type="time"
              value={draft.event.deliveryTime}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, deliveryTime: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Pick up time">
            <input
              type="time"
              value={draft.event.pickupTime}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, pickupTime: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>
      </section>

      {/* Customer */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Customer</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name *">
            <input
              value={draft.customer.name}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, name: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={draft.customer.phone}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, phone: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={draft.customer.email}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, email: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Address">
            <input
              value={draft.customer.address}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, address: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="City">
            <input
              value={draft.customer.city}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, city: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="ZIP">
            <input
              value={draft.customer.zip}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, zip: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>
      </section>

      {/* Line items */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Items</h2>
        <div className="space-y-3">
          {draft.items.map((item) => {
            const catalog = ITEM_CATALOG.find((c) => c.key === item.key)!
            return (
              <div
                key={item.key}
                className="grid grid-cols-12 items-center gap-2 border-b border-gray-100 pb-3"
              >
                <div className="col-span-12 sm:col-span-2 font-medium text-gray-700">
                  {item.label}
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={item.qty ?? ''}
                    onChange={(e) => updateItem(item.key, { qty: num(e.target.value) })}
                    className={`${inputCls} w-full`}
                  />
                </div>
                <div className="col-span-9 sm:col-span-5 flex flex-wrap gap-x-3 gap-y-1">
                  {catalog.options?.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-1 text-sm text-gray-600"
                    >
                      <input
                        type="checkbox"
                        checked={item.options?.includes(opt) || false}
                        onChange={() => toggleOption(item.key, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <div className="flex items-center rounded-lg border border-gray-300 px-2">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={item.amount ?? ''}
                      onChange={(e) =>
                        updateItem(item.key, { amount: num(e.target.value) })
                      }
                      className="w-full px-1 py-2 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Delivery & miles */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Delivery fee">
            <input
              type="number"
              min="0"
              step="0.01"
              value={t.deliveryFee ?? ''}
              onChange={(e) =>
                patch((d) => ({ ...d, totals: { ...d.totals, deliveryFee: num(e.target.value) } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Miles">
            <input
              type="number"
              min="0"
              value={t.miles ?? ''}
              onChange={(e) =>
                patch((d) => ({ ...d, totals: { ...d.totals, miles: num(e.target.value) } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>
      </section>

      {/* Surface & notes */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Setup</h2>
        <p className="text-sm font-medium text-gray-700">Surface</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {SURFACE_TYPES.map((s) => (
            <label key={s} className="flex items-center gap-1 text-sm capitalize text-gray-600">
              <input
                type="checkbox"
                checked={draft.event.surfaces.includes(s)}
                onChange={() => toggleSurface(s)}
              />
              {s}
            </label>
          ))}
          <label className="flex items-center gap-1 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={draft.event.stairs}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, stairs: e.target.checked } }))
              }
            />
            Stairs (extra charge)
          </label>
        </div>
        <div className="mt-4">
          <Field label="Notes">
            <textarea
              rows={3}
              value={draft.event.notes}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, notes: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>
      </section>

      {/* Payment */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Payment</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Method">
            <select
              value={draft.paymentMethod ?? ''}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  paymentMethod: (e.target.value || null) as PaymentMethod | null,
                }))
              }
              className={`${inputCls} w-full`}
            >
              <option value="">— select —</option>
              <option value="zelle">Zelle</option>
              <option value="square">Square</option>
              <option value="cash">Cash</option>
            </select>
          </Field>
          {draft.paymentMethod === 'square' && (
            <Field label="Square payment link">
              <input
                placeholder="https://square.link/..."
                value={draft.squareLink ?? ''}
                onChange={(e) =>
                  patch((d) => ({ ...d, squareLink: e.target.value || null }))
                }
                className={`${inputCls} w-full`}
              />
            </Field>
          )}
        </div>
      </section>

      {/* Totals */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Totals</h2>
        <div className="space-y-2 text-sm">
          <Row label="Subtotal" value={money(t.subtotal)} />
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Tax</span>
            <div className="flex items-center rounded-lg border border-gray-300 px-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={t.tax ?? ''}
                onChange={(e) =>
                  patch((d) => ({ ...d, totals: { ...d.totals, tax: num(e.target.value) } }))
                }
                className="w-24 px-1 py-1.5 text-right focus:outline-none"
              />
            </div>
          </div>
          <Row label="Total" value={money(t.total)} bold />
          <div className="flex items-center justify-between">
            <span className="text-gray-600">
              Deposit{' '}
              <span className="text-xs text-gray-400">
                {depositManual ? '(manual)' : '(50% auto)'}
              </span>
            </span>
            <div className="flex items-center rounded-lg border border-gray-300 px-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={t.deposit ?? ''}
                onChange={(e) => {
                  setDepositManual(true)
                  setDraft((d) =>
                    recalcWithManualDeposit(d, num(e.target.value)),
                  )
                }}
                className="w-24 px-1 py-1.5 text-right focus:outline-none"
              />
            </div>
          </div>
          <Row label="Balance" value={money(t.balance)} />
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Save bar */}
      <div className="no-print fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <button
            onClick={() => router.push('/admin')}
            className="rounded-lg px-4 py-2 text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand px-6 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={bold ? 'font-bold' : ''}>{value}</span>
    </div>
  )
}

// Apply a manual deposit and recompute balance only (keeps the override sticky).
function recalcWithManualDeposit(d: OrderDraft, deposit: number | null): OrderDraft {
  const totals = recalcTotals(d.items, { ...d.totals, deposit })
  return { ...d, totals }
}
