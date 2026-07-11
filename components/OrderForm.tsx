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
  DL_RETENTION_DAYS,
} from '@/lib/orders'
import { getBusinessSettings } from '@/lib/settings'
import { getInventory, getBookedQtys } from '@/lib/inventory'
import TimeSelect from '@/components/TimeSelect'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { REFERRAL_SOURCES } from '@/lib/referral-sources'
import {
  ITEM_CATALOG,
  SURFACE_TYPES,
  SurfaceType,
  LineItem,
  PaymentMethod,
} from '@/lib/types'

const inputCls =
  'rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none'

// Payment-note cap. Square's checkout title maxes at 255 incl. the business +
// event prefix, so we limit the note itself so it stays visible, not truncated.
const NOTE_MAX = 175

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

// The day after an ISO date (YYYY-MM-DD), handling month/year rollover. Built
// from local parts so it never shifts a day due to timezone parsing.
function nextDayISO(isoDate: string): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(y, m - 1, d + 1)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

// Readable date from an ISO (YYYY-MM-DD), built from local parts (no TZ shift).
function readableDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// The auto-filled payment note: "For {event} on {date}". Owner can use as-is,
// edit, or clear it.
function defaultPaymentNote(eventName?: string, eventDate?: string): string {
  const name = (eventName || '').trim()
  const date = readableDate((eventDate || '').trim())
  if (name && date) return `For ${name} on ${date}`
  if (name) return `For ${name}`
  if (date) return `For your event on ${date}`
  return ''
}

// Simple US phone digit check. OK at 10 digits, or 11 with a leading 1 (so the
// +1 country code is optional). Returns a warning string, or null if it's fine.
function phoneWarning(phone: string): string | null {
  const d = (phone || '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) return null
  if (d.length === 11 && d.startsWith('1')) return null
  if (d.length < 10) return 'Looks like too few digits — need 10.'
  return 'Looks like too many digits — use 10 (or 11 with a leading 1).'
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
  // Google Places suggestions on the Address field. Off on every new form; the
  // owner flips it on per-order from the toggle above the Address field.
  const [addressAutocomplete, setAddressAutocomplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Pickup defaults to the next day at the same time as delivery. Once the owner
  // edits pickup directly, it stops auto-following (so we never clobber it).
  const [pickupDateTouched, setPickupDateTouched] = useState(!!initial.event.pickupDate)
  const [pickupTimeTouched, setPickupTimeTouched] = useState(!!initial.event.pickupTime)
  // Inventory availability — loaded when event date is set.
  const [invTotals, setInvTotals] = useState<Record<string, number>>({})
  const [invBooked, setInvBooked] = useState<Record<string, number>>({})
  // Payment note auto-fills from the event until the owner edits it.
  const [paymentNoteTouched, setPaymentNoteTouched] = useState(
    mode === 'edit' ? !!initial.paymentNote : false,
  )

  // Load the saved tax rate + DL purge window. For a brand-new order, also apply
  // the auto tax to the (empty) order; for edits, leave the saved totals alone.
  useEffect(() => {
    getBusinessSettings().then((b) => {
      setTaxRate(b.taxRate)
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

  // Keep the payment note in sync with "For {event} on {date}" until the owner
  // edits it (then leave their text alone).
  useEffect(() => {
    if (paymentNoteTouched) return
    const def = defaultPaymentNote(draft.event.eventName, draft.event.eventDate)
    setDraft((d) => (d.paymentNote === def ? d : { ...d, paymentNote: def }))
  }, [draft.event.eventName, draft.event.eventDate, paymentNoteTouched])

  // Load inventory totals + booked counts whenever the event date changes.
  useEffect(() => {
    const date = draft.event.eventDate
    if (!date) { setInvBooked({}); return }
    Promise.all([getInventory(), getBookedQtys(date, orderId)]).then(([totals, booked]) => {
      setInvTotals(totals)
      setInvBooked(booked)
    })
  }, [draft.event.eventDate, orderId])

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

  // Add another row of a catalog item (e.g. a 2nd "Tables" for a different
  // sub-type). Inserted right after the last existing row of that type.
  function addCatalogRow(catalogKey: string) {
    const cat = ITEM_CATALOG.find((c) => c.key === catalogKey)
    if (!cat) return
    const row: LineItem = {
      key: `${catalogKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      catalogKey,
      label: cat.label,
      qty: null,
      options: [],
      amount: null,
      note: '',
    }
    patch((d) => {
      const items = [...d.items]
      let insertAt = items.length
      for (let i = items.length - 1; i >= 0; i--) {
        if ((items[i].catalogKey || items[i].key) === catalogKey) {
          insertAt = i + 1
          break
        }
      }
      items.splice(insertAt, 0, row)
      return { ...d, items }
    })
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
      const willHave = !has
      return {
        ...d,
        event: {
          ...d.event,
          surfaces: has
            ? d.event.surfaces.filter((x) => x !== s)
            : [...d.event.surfaces, s],
          // Checking "Park" implies a public venue — flip Property type to Public.
          propertyType:
            s === 'park' && willHave ? 'public' : d.event.propertyType,
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
          dlPurgeAfter: purgeDateFromEvent(draft.event.eventDate, DL_RETENTION_DAYS),
        })
        router.push(`/admin/orders/${orderId}`)
      } else {
        const id = await createOrder(draft, DL_RETENTION_DAYS)
        router.push(`/admin/orders/${id}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save order.')
      setSaving(false)
    }
  }

  const t = draft.totals
  const editing = mode === 'edit'
  const nonOtherItems = draft.items.filter((i) => !isOtherItem(i))

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
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Today's date">
            <input
              type="date"
              value={draft.todaysDate}
              onChange={(e) => patch((d) => ({ ...d, todaysDate: e.target.value }))}
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Event Name">
            <input
              value={draft.event.eventName ?? ''}
              onChange={(e) =>
                patch((d) => ({ ...d, event: { ...d.event, eventName: e.target.value } }))
              }
              placeholder="e.g. Maria's Quinceañera"
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Event Start Date">
            <input
              type="date"
              value={draft.event.eventDate}
              onChange={(e) => {
                const v = e.target.value
                patch((d) => ({
                  ...d,
                  event: {
                    ...d.event,
                    eventDate: v,
                    // Default pickup to the next day unless the owner set it.
                    pickupDate: pickupDateTouched ? d.event.pickupDate : nextDayISO(v),
                  },
                }))
              }}
              className={`${inputCls} w-full`}
            />
            {draft.event.eventDate &&
              draft.todaysDate &&
              draft.event.eventDate < draft.todaysDate && (
                <p className="mt-1 text-xs font-medium text-red-500">
                  ⚠️ Event date is in the past.
                </p>
              )}
          </Field>
          <Field label="Delivery Time">
            <TimeSelect
              value={draft.event.deliveryTime}
              onChange={(v) =>
                patch((d) => ({
                  ...d,
                  event: {
                    ...d.event,
                    deliveryTime: v,
                    // Default pickup time to the same time unless set.
                    pickupTime: pickupTimeTouched ? d.event.pickupTime : v,
                  },
                }))
              }
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Pickup Date">
            <input
              type="date"
              value={draft.event.pickupDate}
              onChange={(e) => {
                setPickupDateTouched(true)
                patch((d) => ({ ...d, event: { ...d.event, pickupDate: e.target.value } }))
              }}
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Pickup Time">
            <TimeSelect
              value={draft.event.pickupTime}
              onChange={(v) => {
                setPickupTimeTouched(true)
                patch((d) => ({ ...d, event: { ...d.event, pickupTime: v } }))
              }}
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
            {phoneWarning(draft.customer.phone) && (
              <p className="mt-1 text-xs font-medium text-amber-600">
                ⚠️ {phoneWarning(draft.customer.phone)}
              </p>
            )}
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
          <label className="flex items-center gap-2 text-xs font-medium text-gray-500 sm:col-span-2">
            <input
              type="checkbox"
              checked={addressAutocomplete}
              onChange={(e) => setAddressAutocomplete(e.target.checked)}
            />
            Find address as I type (Google suggestions)
          </label>
          <Field label="Address">
            {addressAutocomplete ? (
              <AddressAutocomplete
                value={draft.customer.address}
                onChange={(v) =>
                  patch((d) => ({ ...d, customer: { ...d.customer, address: v } }))
                }
                onSelect={(parts) =>
                  patch((d) => ({
                    ...d,
                    customer: {
                      ...d.customer,
                      address: parts.address || d.customer.address,
                      // Only overwrite city/state/zip when Places returned a value,
                      // so a partial match never blanks out fields the owner typed.
                      city: parts.city || d.customer.city,
                      state: parts.state || d.customer.state,
                      zip: parts.zip || d.customer.zip,
                    },
                  }))
                }
                placeholder="Start typing the street address…"
                className={`${inputCls} w-full`}
              />
            ) : (
              <input
                value={draft.customer.address}
                onChange={(e) =>
                  patch((d) => ({ ...d, customer: { ...d.customer, address: e.target.value } }))
                }
                placeholder="Street address"
                className={`${inputCls} w-full`}
              />
            )}
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

          {/* Marketing / lead source */}
          <div className="sm:col-span-2">
            <Field label="How did you hear about us?">
              <select
                value={draft.referralSource ?? ''}
                onChange={(e) => patch((d) => ({ ...d, referralSource: e.target.value }))}
                className={`${inputCls} w-full`}
              >
                <option value="">Select…</option>
                {REFERRAL_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {draft.referralSource === 'Other' && (
            <div className="sm:col-span-2">
              <Field label="Other — please describe">
                <input
                  value={draft.referralOtherDetail ?? ''}
                  onChange={(e) =>
                    patch((d) => ({ ...d, referralOtherDetail: e.target.value }))
                  }
                  placeholder="How did they find you?"
                  className={`${inputCls} w-full`}
                />
              </Field>
            </div>
          )}
          <div className="sm:col-span-2">
            <Field label="Referral notes (optional)">
              <input
                value={draft.referralComment ?? ''}
                onChange={(e) => patch((d) => ({ ...d, referralComment: e.target.value }))}
                placeholder="e.g. Referred by Jane Smith · saw A-Frame on Main St."
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
          {nonOtherItems.map((item, idx) => {
            const ck = item.catalogKey || item.key
            const catalog = ITEM_CATALOG.find((c) => c.key === ck)
            const isExtra = item.key !== ck
            const isLastOfType = !nonOtherItems
              .slice(idx + 1)
              .some((x) => (x.catalogKey || x.key) === ck)
            // Availability badge: show when date is set and item is inventory-tracked.
            const checkedOpts = item.options?.filter(Boolean) ?? []
            let availBadge: React.ReactNode = null
            if (draft.event.eventDate) {
              let invKey: string | null = null
              if (catalog?.options && checkedOpts.length === 1) {
                invKey = `${ck}:${checkedOpts[0]}`
              } else if (!catalog?.options && ck === 'heaters') {
                invKey = 'heaters'
              }
              if (invKey && invTotals[invKey] != null) {
                const total = invTotals[invKey]
                const booked = invBooked[invKey] ?? 0
                const avail = total - booked
                availBadge = (
                  <span className={`text-xs font-medium ${avail > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {avail > 0 ? `${avail} of ${total} available` : `⚠ 0 of ${total} available`}
                  </span>
                )
              }
            }

            return (
              <div key={item.key} className="border-b border-gray-100 pb-3">
                <div className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-12 flex items-center gap-2 font-medium text-gray-700 sm:col-span-2">
                    <span>{item.label}</span>
                    {isExtra && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="text-gray-300 hover:text-red-500"
                        aria-label={`Remove ${item.label} row`}
                      >
                        ✕
                      </button>
                    )}
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
                  <div className="col-span-9 sm:col-span-5 flex flex-wrap gap-x-3 gap-y-1 items-center">
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
                    {availBadge}
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
                {catalog?.options && isLastOfType && (
                  <button
                    type="button"
                    onClick={() => addCatalogRow(ck)}
                    className="mt-2 text-sm font-semibold text-brand hover:underline"
                  >
                    + Add {catalog.label}
                  </button>
                )}
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

        <p className="mt-4 text-sm font-medium text-gray-700">Property type</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {(['private', 'public'] as const).map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-sm capitalize text-gray-600">
              <input
                type="radio"
                name="propertyType"
                checked={(draft.event.propertyType ?? 'private') === p}
                onChange={() =>
                  patch((d) => ({ ...d, event: { ...d.event, propertyType: p } }))
                }
              />
              {p}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Public (e.g. a park) skips the photo/video consent clause on the contract.
        </p>

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
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <span className="text-sm font-medium text-gray-700">
              Payment note (shows on the Square checkout &amp; for staff)
            </span>
            <div className="flex items-center gap-3">
              {paymentNoteTouched &&
                defaultPaymentNote(draft.event.eventName, draft.event.eventDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentNoteTouched(false)
                      setDraft((d) => ({
                        ...d,
                        paymentNote: defaultPaymentNote(d.event.eventName, d.event.eventDate),
                      }))
                    }}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    ↺ Reset to default
                  </button>
                )}
              <span
                className={`text-xs ${
                  (draft.paymentNote ?? '').length >= NOTE_MAX
                    ? 'font-semibold text-red-500'
                    : (draft.paymentNote ?? '').length >= NOTE_MAX - 25
                      ? 'text-amber-600'
                      : 'text-gray-400'
                }`}
              >
                {(draft.paymentNote ?? '').length}/{NOTE_MAX}
              </span>
            </div>
          </div>
          <input
            placeholder="For {event} on {date}…"
            maxLength={NOTE_MAX}
            value={draft.paymentNote ?? ''}
            onChange={(e) => {
              setPaymentNoteTouched(true)
              setDraft((d) => ({ ...d, paymentNote: e.target.value.slice(0, NOTE_MAX) }))
            }}
            className={`${inputCls} mt-1 w-full`}
          />
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
