'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Order, STATUS_LABELS } from '@/lib/types'
import { money, applyOrderAction, customerLink, formatTime } from '@/lib/orders'
import OwnerDLPhotos from '@/components/OwnerDLPhotos'
import OwnerSetupPhotos from '@/components/OwnerSetupPhotos'

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

  async function copyLink() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const act = (patch: Partial<Order>) => order && applyOrderAction(order, patch)

  async function markCompleted() {
    if (!order) return
    setCompleting(true)
    setCompleteMsg('')
    try {
      const res = await fetch(`/api/orders/${order.id}/complete`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setCompleteMsg(
        json.emailed
          ? `✓ Receipt emailed to ${json.to}`
          : `Completed — receipt not sent (${json.reason})`,
      )
    } catch (e: any) {
      setCompleteMsg(`Error: ${e.message}`)
    } finally {
      setCompleting(false)
    }
  }
  const activeItems = order.items.filter(
    (i) => i.qty || i.amount || (i.options && i.options.length) || i.description,
  )

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/admin')} className="no-print text-sm text-gray-400 hover:text-gray-600">
            ← Orders
          </button>
          <h1 className="text-xl font-bold">{order.customer.name || 'Unnamed customer'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-white">
            {STATUS_LABELS[order.status]}
          </span>
          <button onClick={() => router.push(`/admin/orders/${order.id}/print`)} className="no-print rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-brand">
            Print / PDF
          </button>
        </div>
      </div>

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
          <a href={link} target="_blank" rel="noreferrer" className="text-sm text-gray-400 underline">
            Preview customer view
          </a>
        </div>
        {sendMsg && <p className="mt-2 text-sm text-gray-600">{sendMsg}</p>}
        <p className="mt-2 break-all text-xs text-gray-400">{link}</p>
      </section>

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
                  <td className="py-1.5 font-medium">{i.description || i.label}</td>
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
          <Total label="Subtotal" value={money(order.totals.subtotal)} />
          <Total label="Delivery" value={money(order.totals.deliveryFee)} />
          <Total label="Tax" value={money(order.totals.tax)} />
          <Total label="Total" value={money(order.totals.total)} bold />
          <Total label="Deposit" value={money(order.totals.deposit)} />
          <Total label="Balance" value={money(order.totals.balance)} />
        </div>
      </section>

      {/* Payment */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Payment</h2>
        <p className="text-sm text-gray-500">
          Method: <span className="font-medium capitalize text-gray-700">{order.paymentMethod || '—'}</span>
          {order.paymentMethod === 'zelle' && zelle && <> · Zelle: <span className="font-medium text-gray-700">{zelle}</span></>}
        </p>
        {order.paymentMethod === 'square' && order.squareLink && (
          <a href={order.squareLink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-brand underline">
            Square payment link
          </a>
        )}
        <div className="no-print mt-4 flex flex-wrap gap-3">
          <ActionButton
            done={order.depositPaid}
            label="Mark deposit paid"
            doneLabel={`Deposit paid (${money(order.totals.deposit)})`}
            onClick={() => act({ depositPaid: true, depositPaidAt: new Date().toISOString() })}
          />
          <ActionButton
            done={order.balancePaid}
            label="Mark balance paid"
            doneLabel={`Balance paid (${money(order.totals.balance)})`}
            onClick={() => act({ balancePaid: true, balancePaidAt: new Date().toISOString() })}
          />
        </div>
      </section>

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

      {/* Driver's license */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Driver&apos;s license</h2>
        <OwnerDLPhotos orderId={order.id} photos={order.dlPhotos || []} />
        {order.dlPurgeAfter && (order.dlPhotos?.length || 0) > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            Auto-deletes {new Date(order.dlPurgeAfter).toLocaleDateString()} (30 days after event).
          </p>
        )}
      </section>

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
          customerEmail={order.customer.email}
          photosSentAt={order.photosSentAt || null}
        />
      </section>

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
              {completing ? 'Completing…' : 'Mark completed + email receipt'}
            </button>
          )}
        </div>
        {completeMsg && <p className="mt-2 text-sm text-gray-500">{completeMsg}</p>}
        {order.completedAt && (
          <button
            onClick={markCompleted}
            disabled={completing}
            className="no-print mt-2 text-xs text-gray-400 underline hover:text-gray-600"
          >
            {completing ? 'Resending…' : 'Resend receipt'}
          </button>
        )}
      </section>
    </div>
  )
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
