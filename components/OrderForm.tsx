'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  OrderDraft,
  recalcTotals,
  createOrder,
  updateOrder,
  purgeDateFromEvent,
  money,
  newOtherItem,
  isOtherItem,
} from '@/lib/orders'
import { getBusinessSettings } from '@/lib/settings'
import TimeSelect from '@/components/TimeSelect'
import AddressAutocomplete from '@/components/AddressAutocomplete'
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

// Shared order form, used for both creating a new order and editing an existing
// one. In edit mode it saves back to the same document (preserving signature,
// photos, payment flags, etc. that aren't editable here) and shows a warning if
// the order is already signed.
export default function OrderForm({
  mode,
  initial,
  orderId,
}: {
  mode: 'create' | 'edit'
  initial: OrderDraft
  orderId?: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<OrderDraft>(initial)
  // In edit mode the order already carries computed tax/deposit values, so treat
  // them as manual to avoid clobbering them on the first recalc.
  const [depositManual, setDepositManual] = useState(mode === 'edit')
  const [taxManual, setTaxManual] = useState(mode === 'edit')
  const [taxRate, setTaxRate] = useState(0)
  const [purgeDays, setPurgeDays] = useState(30)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load the saved tax rate + DL purge window. For a brand-new order, also apply
  // the auto tax to the (empty) order; for edits, leave the saved totals alone.
  useEffect(() => {
    getBusinessSettings().then((b) => {
      setTaxRate(b.taxRate)
      setPurgeDays(b.dlPurgeDays)
      if (mode === 'create') {
        setDraft((d) => ({
          ...d,
          totals: recalcTotals(d.items, d.totals, {
            taxRate: b.taxRate,
            taxManual: false,
            depositManual: false,
          }),
        }))
      }
    })
  }, [mode])

  // Recompute totals, honoring manual tax / deposit overrides + tax rate.
  function withTotals(next: OrderDraft): OrderDraft {
    const totals = recalcTotals(next.items, next.totals, {
      taxRate,
      taxManual,
      depositManual,
    })
    return { ...next, totals }
  }

  function patch(updater: (d: OrderDraft) => OrderDraft) {
    setDraft((d) => withTotals(updater(d)))
  }

  function changeTax(v: number | null) {
    setTaxManual(true)
    setDraft((d) => ({
      ...d,
      totals: recalcTotals(
        d.items,
        { ...d.totals, tax: v },
        { taxRate, taxManual: true, depositManual },
      ),
    }))
  }

  function changeDeposit(v: number | null) {
    setDepositManual(true)
    setDraft((d) => ({
      ...d,
      totals: recalcTotals(
        d.items,
        { ...d.totals, deposit: v },
        { taxRate, taxManual, depositManual: true },
      ),
    }))
  }

  function updateItem(key: string, p: Partial<LineItem>) {
    patch((d) => ({
      ...d,
      items: d.items.map((i) => (i.key === key ? { ...i, ...p } : i)),
    }))
  }

  function addOther() {
    patch((d) => ({ ...d, items: [...d.items, newOtherItem()] }))
  }

  function removeItem(key: string) {
    patch((d) => ({ ...d, items: d.items.filter((i) => i.key !== key) }))
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
    if (!draft.customer.firstName.trim() && !draft.customer.lastName.trim()) {
      setError('Customer name is required.')
      return
    }
    setSaving(true)
    try {
      if (mode === 'edit' && orderId) {
        await updateOrder(orderId, {
          ...draft,
          dlPurgeAfter: purgeDateFromEvent(draft.event.eventDate, purgeDays),
        })
        router.push(`/admin/orders/${orderId}`)
      } else {
        const id = await createOrder(draft, purgeDays)
        router.push(`/admin/orders/${id}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save order.')
      setSaving(false)
    }
  }

  const t = draft.totals
  const editing = mode === 'edit'

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-xl font-bold">{editing ? 'Edit Order' : 'New Order'}</h1>

      {editing && initial.signature && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ This order is already signed. Editing items or prices here won&apos;t
          change the agreement the customer signed — that copy is frozen. Use
          edits to fix delivery details, contact info, or logistics.
        </div>
      )}

      {/* Dates & times */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Dates</h2>
        <div className="mb-4 max-w-xs">
          <Field label="Today's date">
            <input
              type="date"
              value={draft.todaysDate}
              onChange={(e) => patch((d) => ({ ...d, todaysDate: e.target.value }))}
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Event Start Date">
            <input
              type="date"
              value={draft.event.eventDate}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, eventDate: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Delivery Time">
            <TimeSelect
              value={draft.event.deliveryTime}
              onChange={(v) =>
                patch((d) => ({ ...d, event: { ...d.event, deliveryTime: v } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Pickup Date">
            <input
              type="date"
              value={draft.event.pickupDate}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, pickupDate: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Pickup Time">
            <TimeSelect
              value={draft.event.pickupTime}
              onChange={(v) =>
                patch((d) => ({ ...d, event: { ...d.event, pickupTime: v } }))
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
          <Field label="First Name *">
            <input
              value={draft.customer.firstName}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, firstName: e.target.value } }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Last Name">
            <input
              value={draft.customer.lastName}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, lastName: e.target.value } }))
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
            <AddressAutocomplete
              value={draft.customer.address}
              onChange={(v) =>
                patch((d) => ({ ...d, customer: { ...d.customer, address: v } }))
              }
              onSelect={(a) =>
                patch((d) => ({
                  ...d,
                  customer: {
                    ...d.customer,
                    address: a.address || d.customer.address,
                    city: a.city || d.customer.city,
                    state: a.state || d.customer.state,
                    zip: a.zip || d.customer.zip,
                  },
                }))
              }
              placeholder="Start typing the address…"
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Apt / Suite / Unit">
            <input
              value={draft.customer.address2}
              onChange={(e) =>
                patch((d) => ({ ...d, customer: { ...d.customer, address2: e.target.value } }))
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <input
                value={draft.customer.state}
                onChange={(e) =>
                  patch((d) => ({ ...d, customer: { ...d.customer, state: e.target.value } }))
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
        </div>
      </section>

      {/* Line items */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Items</h2>
        <div className="space-y-3">
          {draft.items.filter((i) => !isOtherItem(i)).map((item) => {
            const catalog = ITEM_CATALOG.find((c) => c.key === item.key)
            return (
              <div key={item.key} className="border-b border-gray-100 pb-3">
                <div className="grid grid-cols-12 items-center gap-2">
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
                    {catalog?.options?.map((opt) => (
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
                <input
                  placeholder="Notes / details (optional)"
                  value={item.note ?? ''}
                  onChange={(e) => updateItem(item.key, { note: e.target.value })}
                  className={`${inputCls} mt-2 w-full text-sm`}
                />
              </div>
            )
          })}
        </div>

        {/* Other (custom) items */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-gray-700">Other</span>
            <button
              type="button"
              onClick={addOther}
              className="text-sm font-semibold text-brand hover:underline"
            >
              + Add other
            </button>
          </div>
          <div className="space-y-3">
            {draft.items.filter(isOtherItem).map((item) => (
              <div key={item.key}>
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 sm:col-span-6">
                  <input
                    placeholder="Description"
                    value={item.description ?? ''}
                    onChange={(e) => updateItem(item.key, { description: e.target.value })}
                    className={`${inputCls} w-full`}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={item.qty ?? ''}
                    onChange={(e) => updateItem(item.key, { qty: num(e.target.value) })}
                    className={`${inputCls} w-full`}
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <div className="flex items-center rounded-lg border border-gray-300 px-2">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={item.amount ?? ''}
                      onChange={(e) => updateItem(item.key, { amount: num(e.target.value) })}
                      className="w-full px-1 py-2 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="col-span-2 text-right sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-gray-300 hover:text-red-500"
                    aria-label="Remove other item"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <input
                placeholder="Notes / details (optional)"
                value={item.note ?? ''}
                onChange={(e) => updateItem(item.key, { note: e.target.value })}
                className={`${inputCls} mt-2 w-full text-sm`}
              />
              </div>
            ))}
          </div>
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
            <span className="text-gray-600">
              Tax{' '}
              <span className="text-xs text-gray-400">
                {taxManual ? '(manual)' : `(${taxRate}% auto)`}
              </span>
            </span>
            <div className="flex items-center rounded-lg border border-gray-300 px-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={t.tax ?? ''}
                onChange={(e) => changeTax(num(e.target.value))}
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
                onChange={(e) => changeDeposit(num(e.target.value))}
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
            onClick={() => router.push(editing && orderId ? `/admin/orders/${orderId}` : '/admin')}
            className="rounded-lg px-4 py-2 text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand px-6 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save Draft'}
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
