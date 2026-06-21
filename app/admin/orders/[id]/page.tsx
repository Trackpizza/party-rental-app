'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Order, STATUS_LABELS, customerName, itemName } from '@/lib/types'
import { money, applyOrderAction, updateOrder, customerLink, formatTime, fullAddress, mapsHref, amountOwed } from '@/lib/orders'
import OwnerDLPhotos from '@/components/OwnerDLPhotos'
import OwnerSetupPhotos from '@/components/OwnerSetupPhotos'
import OwnerContentCreation from '@/components/OwnerContentCreation'
import ShareButton from '@/components/ShareButton'
import OwnerSendJob from '@/components/OwnerSendJob'
import TextCustomer from '@/components/TextCustomer'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'
const zelle = process.env.NEXT_PUBLIC_ZELLE_NUMBER || ''

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [completeMsg, setCompleteMsg] = useState('')
  const [completing, setCompleting] = useState(false)
  const [note, setNote] = useState('')
  const [cc, setCc] = useState('')
  const [sendingLink, setSendingLink] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [dlNote, setDlNote] = useState('')
  const [dlCc, setDlCc] = useState('')
  const [sendingDl, setSendingDl] = useState(false)
  const [dlMsg, setDlMsg] = useState('')
  const [sqLoading, setSqLoading] = useState(false)
  const [sqMsg, setSqMsg] = useState('')
  const [sqBalLoading, setSqBalLoading] = useState(false)
  const [sqBalMsg, setSqBalMsg] = useState('')
  const [rcptTo, setRcptTo] = useState('')
  const [rcptCc, setRcptCc] = useState('')
  const [rcptBcc, setRcptBcc] = useState('')
  const [rcptNote, setRcptNote] = useState('')
  const [sendingRcpt, setSendingRcpt] = useState(false)
  const [rcptMsg, setRcptMsg] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'orders', id),
      (snap) => {
        setOrder(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }) : null)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return () => unsub()
  }, [id])

  // Prefill the receipt recipient with the customer's email once loaded.
  useEffect(() => {
    if (order?.customer.email && !rcptTo) setRcptTo(order.customer.email)
  }, [order, rcptTo])

  if (loading) return <p className="text-gray-400">Loading order…</p>
  if (!order)
    return (
      <div className="text-center">
        <p className="text-gray-500">Order not found.</p>
        <button onClick={() => router.push('/admin')} className="mt-4 text-brand underline">
          Back to orders
        </button>
      </div>
    )

  const link = customerLink(order.id)
  const address = fullAddress(order.customer)

  async function sendSigningLink() {
    if (!order) return
    setSendingLink(true)
    setSendMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/send-signing-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, cc }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setSendMsg(`✓ Sent to ${json.to}${json.cc ? ` (cc ${json.cc})` : ''}`)
      setNote('')
    } catch (e: any) {
      setSendMsg(`Error: ${e.message}`)
    } finally {
      setSendingLink(false)
    }
  }

  async function sendDlRetake() {
    if (!order) return
    setSendingDl(true)
    setDlMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/send-dl-retake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: dlNote, cc: dlCc }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setDlMsg(`✓ Sent to ${json.to}${json.cc ? ` (cc ${json.cc})` : ''}`)
      setDlNote('')
    } catch (e: any) {
      setDlMsg(`Error: ${e.message}`)
    } finally {
      setSendingDl(false)
    }
  }

  async function createSquareDepositLink() {
    if (!order) return
    setSqLoading(true)
    setSqMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/square-link`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setSqMsg(`✓ Deposit link ready (${money(json.amount)})`)
    } catch (e: any) {
      setSqMsg(`Error: ${e.message}`)
    } finally {
      setSqLoading(false)
    }
  }

  async function createSquareBalanceLink() {
    if (!order) return
    setSqBalLoading(true)
    setSqBalMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/square-balance-link`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setSqBalMsg(`✓ Payment link ready (${money(json.amount)})`)
    } catch (e: any) {
      setSqBalMsg(`Error: ${e.message}`)
    } finally {
      setSqBalLoading(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const act = (patch: Partial<Order>) => order && applyOrderAction(order, patch)

  async function toggleArchive() {
    if (!order) return
    await updateOrder(
      order.id,
      order.archived
        ? { archived: false, archivedAt: null }
        : { archived: true, archivedAt: new Date().toISOString() },
    )
  }

  async function deleteOrder() {
    if (!order) return
    if (!window.confirm('Permanently delete this order and any uploaded files? This cannot be undone.')) return
    setDeleting(true)
    setDeleteMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/delete`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      router.push('/admin')
    } catch (e: any) {
      setDeleteMsg(`Error: ${e.message}`)
      setDeleting(false)
    }
  }

  async function markCompleted() {
    if (!order) return
    setCompleting(true)
    setCompleteMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/complete`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setCompleteMsg('✓ Marked completed')
    } catch (e: any) {
      setCompleteMsg(`Error: ${e.message}`)
    } finally {
      setCompleting(false)
    }
  }

  async function sendReceipt() {
    if (!order) return
    setSendingRcpt(true)
    setRcptMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: rcptTo, cc: rcptCc, bcc: rcptBcc, note: rcptNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setRcptMsg(
        `✓ Receipt sent to ${json.to}${json.cc ? ` (cc ${json.cc})` : ''}${json.bcc ? ` (bcc ${json.bcc})` : ''}`,
      )
    } catch (e: any) {
      setRcptMsg(`Error: ${e.message}`)
    } finally {
      setSendingRcpt(false)
    }
  }
  const activeItems = order.items.filter(
    (i) => i.qty || i.amount || (i.options && i.options.length) || i.description || i.note,
  )

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/admin')} className="no-print text-sm text-gray-400 hover:text-gray-600">
            ← Orders
          </button>
          <h1 className="text-xl font-bold">{customerName(order.customer) || 'Unnamed customer'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-white">
            {STATUS_LABELS[order.status]}
          </span>
          <button onClick={() => router.push(`/admin/orders/${order.id}/edit`)} className="no-print rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
            Edit
          </button>
          <button onClick={toggleArchive} className="no-print rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
            {order.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => router.push(`/admin/orders/${order.id}/print`)} className="no-print rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
            Print / PDF
          </button>
        </div>
      </div>

      {/* Customer & delivery */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Customer &amp; delivery</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {order.event.eventName && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400">Event</p>
              <p className="font-medium text-gray-700">{order.event.eventName}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">Name</p>
            <p className="font-medium text-gray-700">{customerName(order.customer) || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            {order.customer.phone ? (
              <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, '')}`} className="font-medium text-brand underline">
                {order.customer.phone}
              </a>
            ) : (
              <p className="font-medium text-gray-700">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">Email</p>
            {order.customer.email ? (
              <a href={`mailto:${order.customer.email}`} className="break-all font-medium text-brand underline">
                {order.customer.email}
              </a>
            ) : (
              <p className="font-medium text-gray-700">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">Delivery address</p>
            {address ? (
              <>
                <p className="font-medium text-gray-700">{address}</p>
                <a href={mapsHref(order.customer)} target="_blank" rel="noreferrer" className="no-print text-sm text-brand underline">
                  📍 Open in Maps
                </a>
              </>
            ) : (
              <p className="font-medium text-gray-700">—</p>
            )}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Send signing link */}
      <section className="no-print rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Send signing link to customer</h2>
        <p className="mb-3 text-sm text-gray-500">
          {order.customer.email
            ? <>Sends to <span className="font-medium text-gray-700">{order.customer.email}</span></>
            : 'No email on file — add one to the order, or use Copy link below.'}
        </p>

        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a personal note (optional) — appears in a green box at the top of the email…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <input
          type="email"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder="CC (optional) — e.g. spouse's email"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={sendSigningLink}
            disabled={!order.customer.email || sendingLink}
            className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {sendingLink ? 'Sending…' : '✉️ Send signing link'}
          </button>
          <button onClick={copyLink} className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand">
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <ShareButton
            url={link}
            title={`${business} — rental agreement`}
            text="Please review & sign your rental agreement:"
            className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
          />
          <TextCustomer
            phone={order.customer.phone}
            url={link}
            text="Please review & sign your rental agreement:"
            label="Text customer"
            className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
          />
          <a href={link} target="_blank" rel="noreferrer" className="text-sm text-gray-400 underline">
            Preview customer view
          </a>
        </div>
        {sendMsg && <p className="mt-2 text-sm text-gray-600">{sendMsg}</p>}
        <p className="mt-2 break-all text-xs text-gray-400">{link}</p>
      </section>

      <SectionDivider />

      {/* Order summary */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Order</h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label="Event start" value={order.event.eventDate || '—'} />
          <Info label="Delivery time" value={formatTime(order.event.deliveryTime) || '—'} />
          <Info label="Pickup date" value={order.event.pickupDate || '—'} />
          <Info label="Pickup time" value={formatTime(order.event.pickupTime) || '—'} />
          <Info label="Miles" value={order.totals.miles != null ? String(order.totals.miles) : '—'} />
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-400">
              <th className="py-1">Item</th>
              <th className="py-1">Qty</th>
              <th className="py-1">Details</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-gray-400">
                  No items added.
                </td>
              </tr>
            ) : (
              activeItems.map((i) => (
                <tr key={i.key} className="border-b border-gray-100">
                  <td className="py-1.5 font-medium">
                    {itemName(i)}
                    {i.note && (
                      <span className="block text-xs font-normal text-gray-400">{i.note}</span>
                    )}
                  </td>
                  <td className="py-1.5">{i.qty ?? '—'}</td>
                  <td className="py-1.5 text-gray-500">{i.options?.join(', ') || '—'}</td>
                  <td className="py-1.5 text-right">{money(i.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {(order.event.surfaces.length > 0 || order.event.stairs) && (
          <p className="mt-3 text-sm text-gray-500">
            Surface: {order.event.surfaces.join(', ') || '—'}
            {order.event.stairs && ' · Stairs (extra charge)'}
          </p>
        )}
        {order.event.notes && <p className="mt-2 text-sm text-gray-500">Notes: {order.event.notes}</p>}

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <Total label="Delivery" value={money(order.totals.deliveryFee)} />
          <Total label="Subtotal" value={money(order.totals.subtotal)} />
          <Total label="Tax" value={money(order.totals.tax)} />
          <Total label="Total" value={money(order.totals.total)} bold />
          <Total label="Deposit" value={money(order.totals.deposit)} />
          <Total label="Balance" value={money(order.totals.balance)} />
        </div>
      </section>

      <SectionDivider />

      {/* Payment */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Payment</h2>
        <p className="text-sm text-gray-500">
          Method: <span className="font-medium capitalize text-gray-700">{order.paymentMethod || '—'}</span>
          {order.paymentMethod === 'zelle' && zelle && <> · Zelle: <span className="font-medium text-gray-700">{zelle}</span></>}
        </p>
        {order.paymentNote && (
          <p className="mt-1 text-sm text-gray-600">
            📝 <span className="font-medium">Note:</span> {order.paymentNote}
          </p>
        )}
        {order.paymentMethod === 'square' && order.squareLink && !order.squareDepositLink && (
          <a href={order.squareLink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-brand underline">
            Square payment link
          </a>
        )}

        {/* Square deposit link (auto-generated) */}
        <div className="no-print mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">
              Square deposit link {order.depositPaid && <span className="text-green-600">· Paid</span>}
            </p>
            <button
              onClick={createSquareDepositLink}
              disabled={sqLoading || order.depositPaid}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {sqLoading
                ? 'Creating…'
                : order.squareDepositLink
                  ? '↻ Regenerate'
                  : '＋ Create deposit link'}
            </button>
          </div>
          {order.squareDepositLink ? (
            <div className="mt-2 space-y-1">
              <a
                href={order.squareDepositLink}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-sm text-brand underline"
              >
                {order.squareDepositLink}
              </a>
              {order.squareDepositAmount != null &&
                order.squareDepositAmount !== order.totals.deposit && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Deposit is now {money(order.totals.deposit)} but this link is for{' '}
                    {money(order.squareDepositAmount)} — regenerate to update.
                  </p>
                )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Generates a Square checkout link for the deposit ({money(order.totals.deposit)}). It
              marks the deposit paid automatically once the customer pays.
            </p>
          )}
          {sqMsg && <p className="mt-2 text-sm text-gray-600">{sqMsg}</p>}
        </div>

        {/* Square balance / amount-owed link — send to collect on/after delivery */}
        {!order.balancePaid && amountOwed(order) > 0 && (
          <div className="no-print mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-700">
                Collect {money(amountOwed(order))}
                {!order.depositPaid && <span className="text-gray-400"> (full — no deposit paid)</span>}
              </p>
              <button
                onClick={createSquareBalanceLink}
                disabled={sqBalLoading}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {sqBalLoading ? 'Creating…' : order.squareBalanceLink ? '↻ Regenerate' : '＋ Create payment link'}
              </button>
            </div>
            {order.squareBalanceLink ? (
              <div className="mt-2 space-y-2">
                <a
                  href={order.squareBalanceLink}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-sm text-brand underline"
                >
                  {order.squareBalanceLink}
                </a>
                {order.squareBalanceAmount != null &&
                  order.squareBalanceAmount !== amountOwed(order) && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Owed is now {money(amountOwed(order))} but this link is for{' '}
                      {money(order.squareBalanceAmount)} — regenerate to update.
                    </p>
                  )}
                <div className="flex flex-wrap items-center gap-3">
                  <TextCustomer
                    phone={order.customer.phone}
                    url={order.squareBalanceLink}
                    text="Here's your payment link for the balance due:"
                    label="Text customer"
                    className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
                  />
                  <ShareButton
                    url={order.squareBalanceLink}
                    title={`${business} — payment due`}
                    text="Here's your payment link for the balance due:"
                    className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Generates a Square link for what&apos;s still owed. Staff can also create &amp; send
                it from the crew job ticket. It marks the order paid automatically once paid.
              </p>
            )}
            {sqBalMsg && <p className="mt-2 text-sm text-gray-600">{sqBalMsg}</p>}
          </div>
        )}

        <div className="no-print mt-4 flex flex-wrap gap-3">
          <PaidToggle
            paid={order.depositPaid}
            label="Mark deposit paid"
            paidLabel={`Deposit paid (${money(order.totals.deposit)})${order.depositPaidVia === 'square' ? ' · via Square' : ''}`}
            onMark={() => act({ depositPaid: true, depositPaidAt: new Date().toISOString(), depositPaidVia: 'manual' })}
            onUndo={() => act({ depositPaid: false, depositPaidAt: null, depositPaidVia: null })}
          />
          <PaidToggle
            paid={order.balancePaid}
            label="Mark balance paid"
            paidLabel={`Balance paid (${money(order.totals.balance)})${order.balancePaidVia === 'square' ? ' · via Square' : ''}`}
            onMark={() => act({ balancePaid: true, balancePaidAt: new Date().toISOString(), balancePaidVia: 'manual' })}
            onUndo={() => act({ balancePaid: false, balancePaidAt: null, balancePaidVia: null })}
          />
        </div>
      </section>

      <SectionDivider />

      {/* Signature */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Signature</h2>
        {order.signature ? (
          <div>
            <img src={order.signature.signatureDataUrl} alt="signature" className="h-24 border-b border-gray-300" />
            <p className="mt-2 text-xs text-gray-400">
              Signed {new Date(order.signature.signedAt).toLocaleString()} · IP {order.signature.ipAddress}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Not signed yet — share the link above to collect the signature.</p>
        )}
      </section>

      <SectionDivider />

      {/* Driver's license */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Driver&apos;s license</h2>
        <OwnerDLPhotos orderId={order.id} photos={order.dlPhotos || []} />
        {order.dlPurgeAfter && (order.dlPhotos?.length || 0) > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            Auto-deletes {new Date(order.dlPurgeAfter).toLocaleDateString()} (30 days after event).
          </p>
        )}
        {order.signature && (order.dlPhotos?.length || 0) > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-1 text-sm font-medium text-gray-700">
              License photo blurry?
            </p>
            <p className="mb-3 text-xs text-gray-500">
              {order.customer.email
                ? <>Emails <span className="font-medium text-gray-700">{order.customer.email}</span> a &quot;Retake license photo&quot; link. The new photo appears here — delete the blurry one above. Signature stays as is.</>
                : 'No email on file — add one to the order, or use Text / Share / Copy link below.'}
            </p>

            <textarea
              rows={2}
              value={dlNote}
              onChange={(e) => setDlNote(e.target.value)}
              placeholder="Add a personal note (optional) — appears in a green box at the top of the email…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              type="email"
              value={dlCc}
              onChange={(e) => setDlCc(e.target.value)}
              placeholder="CC (optional) — e.g. spouse's email"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={sendDlRetake}
                disabled={!order.customer.email || sendingDl}
                className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {sendingDl ? 'Sending…' : '✉️ Send DL retake'}
              </button>
              <TextCustomer
                phone={order.customer.phone}
                url={link}
                text="Your driver's license photo came out blurry — please retake it here:"
                label="Text customer"
                className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
              />
              <ShareButton
                url={link}
                title={`${business} — retake license photo`}
                text="Your driver's license photo came out blurry — please retake it here:"
                className="rounded-lg border border-gray-300 px-4 py-2.5 hover:border-brand"
              />
            </div>
            {dlMsg && <p className="mt-2 text-sm text-gray-600">{dlMsg}</p>}
          </div>
        )}
      </section>

      <SectionDivider />

      {/* Crew job ticket */}
      <section className="no-print rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Crew job ticket</h2>
        <OwnerSendJob orderId={order.id} />
      </section>

      <SectionDivider />

      {/* Lifecycle */}
      <section className="no-print rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Fulfillment</h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton done={!!order.deliveredAt} label="Mark delivered" doneLabel="Delivered" onClick={() => act({ deliveredAt: new Date().toISOString() })} />
          <ActionButton done={!!order.pickedUpAt} label="Mark picked up" doneLabel="Picked up" onClick={() => act({ pickedUpAt: new Date().toISOString() })} />
          {order.completedAt ? (
            <span className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              ✓ Completed
            </span>
          ) : (
            <button
              onClick={markCompleted}
              disabled={completing}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {completing ? 'Completing…' : 'Mark completed'}
            </button>
          )}
        </div>
        {completeMsg && <p className="mt-2 text-sm text-gray-500">{completeMsg}</p>}
      </section>

      {/* Final receipt — available once the balance is paid */}
      {order.balancePaid && (
        <>
          <SectionDivider />
          <section className="no-print rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Send final receipt</h2>
            <p className="mb-3 text-sm text-gray-500">
              {order.receiptSentAt
                ? `Last sent ${new Date(order.receiptSentAt).toLocaleString()}.`
                : 'Email the itemized receipt to the customer.'}
            </p>
            <input
              type="email"
              value={rcptTo}
              onChange={(e) => setRcptTo(e.target.value)}
              placeholder="Send to email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={rcptCc}
                onChange={(e) => setRcptCc(e.target.value)}
                placeholder="CC (optional)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <input
                type="text"
                value={rcptBcc}
                onChange={(e) => setRcptBcc(e.target.value)}
                placeholder="BCC (optional)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <textarea
              rows={2}
              value={rcptNote}
              onChange={(e) => setRcptNote(e.target.value)}
              placeholder="Add a personal note (optional) — appears in a green box in the receipt…"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <button
              onClick={sendReceipt}
              disabled={!rcptTo.trim() || sendingRcpt}
              className="mt-2 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {sendingRcpt ? 'Sending…' : '✉️ Send final receipt'}
            </button>
            {rcptMsg && <p className="mt-2 text-sm text-gray-600">{rcptMsg}</p>}
          </section>
        </>
      )}

      {/* ===== MARKETING — clean break between the rental contract and content/social sections ===== */}
      <div className="no-print rounded-xl bg-purple-600 px-5 py-3 text-center shadow-sm">
        <h2 className="text-lg font-bold tracking-widest text-white">MARKETING</h2>
        <p className="text-xs text-purple-100">
          Photos &amp; content for social media — not part of the rental contract
        </p>
        {order.event.propertyType === 'public' ? (
          <p className="mt-1 text-xs font-semibold text-white">
            🏞 Public property — consent not required
          </p>
        ) : (
          order.signature && (
            <p className="mt-1 text-xs font-semibold text-white">
              {order.mediaConsent
                ? '✅ Customer approved social-media use'
                : '⚠️ No social-media consent — ask before posting'}
            </p>
          )
        )}
      </div>

      {/* Setup photos + review funnel */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Setup photos</h2>
        <p className="mb-3 text-sm text-gray-500">
          Share the crew link to capture setup photos on-site, then select your
          best shots and send them to the customer with a review request.
        </p>
        <OwnerSetupPhotos
          orderId={order.id}
          photos={order.setupPhotos || []}
          videos={order.videos || []}
          customerEmail={order.customer.email}
          customerPhone={order.customer.phone}
          customerName={customerName(order.customer)}
          photosSentAt={order.photosSentAt || null}
        />
      </section>

      <SectionDivider />

      {/* Content Creation (producer) */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">Content Creation</h2>
        <p className="mb-3 text-sm text-gray-500">
          Select which photos &amp; videos go to your content creator, then send.
          Videos auto-delete 20 days after upload.
        </p>
        <OwnerContentCreation orderId={order.id} photos={order.setupPhotos || []} videos={order.videos || []} customerPhone={order.customer.phone} />
      </section>

      {/* Delete — unsigned orders only; signed orders are protected (archive them) */}
      {!order.signature && (
        <>
          <SectionDivider />
          <section className="no-print rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-800">Delete order</h2>
            <p className="mb-3 text-sm text-gray-500">
              Permanently delete this unsigned order and any uploaded files. This
              can&apos;t be undone. (Once an order is signed it can&apos;t be deleted —
              archive it instead.)
            </p>
            <button
              onClick={deleteOrder}
              disabled={deleting}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete this order'}
            </button>
            {deleteMsg && <p className="mt-2 text-sm text-red-600">{deleteMsg}</p>}
          </section>
        </>
      )}
    </div>
  )
}

function SectionDivider() {
  return <hr className="no-print -my-1 border-t border-purple-200" />
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-700">{value}</p>
    </div>
  )
}

function Total({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold' : 'text-gray-700'}>{value}</span>
    </div>
  )
}

function ActionButton({
  done,
  label,
  doneLabel,
  onClick,
}: {
  done: boolean
  label: string
  doneLabel: string
  onClick: () => void
}) {
  if (done) {
    return (
      <span className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
        ✓ {doneLabel}
      </span>
    )
  }
  return (
    <button onClick={onClick} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand">
      {label}
    </button>
  )
}

function PaidToggle({
  paid,
  label,
  paidLabel,
  onMark,
  onUndo,
}: {
  paid: boolean
  label: string
  paidLabel: string
  onMark: () => void
  onUndo: () => void
}) {
  if (paid) {
    return (
      <button
        onClick={() => window.confirm('Undo this payment status?') && onUndo()}
        title="Click to undo"
        className="group rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-red-50 hover:text-red-600"
      >
        <span className="group-hover:hidden">✓ {paidLabel}</span>
        <span className="hidden group-hover:inline">✕ Undo {paidLabel}</span>
      </button>
    )
  }
  return (
    <button onClick={onMark} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand">
      {label}
    </button>
  )
}
