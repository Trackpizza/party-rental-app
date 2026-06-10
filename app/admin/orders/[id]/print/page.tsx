'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getOrder, money, formatTime } from '@/lib/orders'
import { getWaiver } from '@/lib/waiver'
import { auth } from '@/lib/firebase/client'
import { Order, customerName, itemName } from '@/lib/types'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'
const phone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || ''
const address = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || ''

export default function PrintContractPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [waiver, setWaiver] = useState('')
  const [dlUrls, setDlUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const o = await getOrder(id)
      if (!o) {
        setLoading(false)
        return
      }
      setOrder(o)
      setWaiver(o.signature?.waiverTextSnapshot || (await getWaiver()).text)

      const token = await auth.currentUser?.getIdToken()
      if (token && o.dlPhotos?.length) {
        const urls: string[] = []
        for (const p of o.dlPhotos) {
          try {
            const r = await fetch(
              `/api/orders/${id}/dl/view?path=${encodeURIComponent(p.storagePath)}`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
            const j = await r.json()
            if (r.ok && j.url) urls.push(j.url)
          } catch {
            /* skip */
          }
        }
        setDlUrls(urls)
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>
  if (!order) return <p className="p-6">Order not found.</p>

  const items = order.items.filter(
    (i) => i.qty || i.amount || (i.options && i.options.length) || i.description || i.note,
  )
  const t = order.totals

  return (
    <div className="mx-auto max-w-3xl bg-white p-2 text-ink print:p-0">
      {/* toolbar (screen only) */}
      <div className="no-print mb-4 flex justify-end">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90"
        >
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* header */}
      <div className="border-b-2 border-ink pb-3 text-center">
        <h1 className="text-2xl font-bold">{business}</h1>
        <p className="text-sm text-gray-600">{phone} · {address}</p>
        <p className="mt-1 text-sm font-semibold">RENTAL ORDER &amp; AGREEMENT</p>
      </div>

      {/* meta */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div><b>Order:</b> {order.id}</div>
        <div><b>Today:</b> {order.todaysDate || '—'}</div>
        <div><b>Event start:</b> {order.event.eventDate || '—'} {formatTime(order.event.deliveryTime)}</div>
        <div><b>Pickup:</b> {order.event.pickupDate || order.event.eventDate || '—'} {formatTime(order.event.pickupTime)}</div>
      </div>

      {/* customer */}
      <div className="mt-3 rounded border border-gray-300 p-3 text-sm">
        <p><b>{customerName(order.customer)}</b> &nbsp; {order.customer.phone}</p>
        <p className="text-gray-700">
          {order.customer.address}{order.customer.city ? `, ${order.customer.city}` : ''}{order.customer.state ? `, ${order.customer.state}` : ''} {order.customer.zip}
        </p>
        <p className="text-gray-700">{order.customer.email}</p>
      </div>

      {/* items */}
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-1">Item</th>
            <th className="py-1">Qty</th>
            <th className="py-1">Details</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.key} className="border-b border-gray-200">
              <td className="py-1">{itemName(i)}</td>
              <td className="py-1">{i.qty ?? ''}</td>
              <td className="py-1 text-gray-600">
                {[i.options?.join(', '), i.note].filter(Boolean).join(' · ')}
              </td>
              <td className="py-1 text-right">{money(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* surfaces/notes + totals */}
      <div className="mt-3 flex justify-between gap-6 text-sm">
        <div className="flex-1">
          {(order.event.surfaces.length > 0 || order.event.stairs) && (
            <p><b>Surface:</b> {order.event.surfaces.join(', ')}{order.event.stairs ? ' · Stairs' : ''}</p>
          )}
          {order.totals.miles != null && <p><b>Miles:</b> {order.totals.miles}</p>}
          {order.event.notes && <p><b>Notes:</b> {order.event.notes}</p>}
          <p className="mt-1"><b>Payment:</b> {order.paymentMethod || '—'}</p>
        </div>
        <div className="w-56 text-sm">
          <Row l="Subtotal" v={money(t.subtotal)} />
          <Row l="Delivery" v={money(t.deliveryFee)} />
          <Row l="Tax" v={money(t.tax)} />
          <Row l="Total" v={money(t.total)} bold />
          <Row l="Deposit" v={money(t.deposit)} />
          <Row l="Balance" v={money(t.balance)} />
        </div>
      </div>

      {/* terms */}
      <div className="mt-4 border-t border-ink pt-2">
        <p className="text-xs font-semibold">TERMS</p>
        <pre className="whitespace-pre-wrap font-sans text-[10px] leading-snug text-gray-700">{waiver}</pre>
      </div>

      {/* signature */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          {order.signature ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.signature.signatureDataUrl} alt="signature" className="h-16 border-b border-ink" />
              <p className="text-[10px] text-gray-500">
                Signed {new Date(order.signature.signedAt).toLocaleString()} · IP {order.signature.ipAddress}
              </p>
            </>
          ) : (
            <div className="w-64 border-b border-ink pb-8" />
          )}
          <p className="text-xs">Customer Signature</p>
        </div>
      </div>

      {/* driver's license */}
      {dlUrls.length > 0 && (
        <div className="mt-4 break-inside-avoid border-t border-ink pt-2">
          <p className="text-xs font-semibold">DRIVER&apos;S LICENSE ON FILE</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {dlUrls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt="license" className="h-40 rounded border border-gray-300" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-gray-300 font-bold' : ''}`}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  )
}
