import { headers } from 'next/headers'
import { adminDb } from '@/lib/firebase/admin'
import { Order, customerName, itemName } from '@/lib/types'
import { formatTime, fullAddress, mapsHref, money, amountOwed } from '@/lib/orders'
import { isSquareConfigured } from '@/lib/square'
import CrewCollect from '@/components/CrewCollect'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

// Public crew "job ticket" — what to deliver and where. Intentionally omits the
// driver's license, the signed contract/waiver, the signature, and the itemized
// pricing. Shows the balance due so the crew can collect on delivery.
export default async function JobPage({ params }: { params: { id: string } }) {
  const snap = await adminDb.collection('orders').doc(params.id).get()
  const order = snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }) : null

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-gray-500">
        This job is no longer available.
      </main>
    )
  }

  const address = fullAddress(order.customer)
  const phone = (order.customer.phone || '').trim()
  const telHref = `tel:${phone.replace(/[^\d+]/g, '')}`
  const items = (order.items || []).filter(
    (i) => i.qty || i.amount || (i.options && i.options.length) || i.description || i.note,
  )
  const owed = amountOwed(order)
  const settingsSnap = await adminDb.collection('settings').doc('business').get()
  const squareAuto = settingsSnap.exists && settingsSnap.data()?.squareAutoLinks === true
  const squareReady = isSquareConfigured() && squareAuto

  // "Text owner — payment collected": SMS to the business phone (the page itself
  // stays read-only; only the logged-in owner can actually mark it paid).
  const ownerTel = (
    process.env.NEXT_PUBLIC_OWNER_CELL ||
    process.env.NEXT_PUBLIC_BUSINESS_PHONE ||
    ''
  ).replace(/[^\d+]/g, '')
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const proto = h.get('x-forwarded-proto') || 'https'
  const adminUrl = host ? `${proto}://${host}/admin/orders/${order.id}` : ''
  const who = customerName(order.customer) || 'the customer'
  const paidMsg =
    `Payment collected for ${who} — ${money(owed)}.` +
    (adminUrl ? ` Mark paid: ${adminUrl}` : '')
  const paidSmsHref = `sms:${ownerTel}?body=${encodeURIComponent(paidMsg)}`

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl p-4 pb-16">
        <header className="py-4 text-center">
          <h1 className="text-lg font-bold text-brand">{business}</h1>
          <p className="text-sm text-gray-500">Delivery job ticket · Hoja de entrega</p>
        </header>

        {/* When */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">When · Cuándo</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Deliver / Entrega" value={order.event.eventDate || '—'} />
            <Info label="Delivery time / Hora" value={formatTime(order.event.deliveryTime) || '—'} />
            <Info label="Pickup / Recoger" value={order.event.pickupDate || '—'} />
            <Info label="Pickup time / Hora" value={formatTime(order.event.pickupTime) || '—'} />
          </div>
        </section>

        {/* Where + who */}
        <section className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">Customer · Cliente</h2>
          {order.event.eventName && (
            <p className="mb-1 text-sm text-gray-500">
              Event · Evento: <span className="font-medium text-gray-700">{order.event.eventName}</span>
            </p>
          )}
          <p className="font-medium text-gray-800">{customerName(order.customer) || '—'}</p>
          {phone && (
            <a href={telHref} className="mt-1 inline-block text-brand underline">
              📞 {order.customer.phone}
            </a>
          )}
          {address ? (
            <div className="mt-3">
              <p className="text-sm text-gray-700">{address}</p>
              <a
                href={mapsHref(order.customer)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90"
              >
                📍 Open in Maps · Ver mapa
              </a>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400">No address on file.</p>
          )}
        </section>

        {/* What */}
        <section className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">Equipment · Equipo</h2>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400">No items listed.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-400">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 pl-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.key} className="border-b border-gray-100 align-top">
                    <td className="py-1.5 font-medium text-gray-800">
                      {itemName(i)}
                      {i.note && (
                        <span className="block text-xs font-normal text-gray-500">{i.note}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">{i.qty ?? '—'}</td>
                    <td className="py-1.5 pl-3 text-gray-500">{i.options?.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {(order.event.surfaces.length > 0 || order.event.stairs) && (
            <p className="mt-3 text-sm text-gray-600">
              Surface: {order.event.surfaces.join(', ') || '—'}
              {order.event.stairs && ' · ⚠️ Stairs / Escaleras'}
            </p>
          )}
          {order.event.notes && (
            <p className="mt-2 text-sm text-gray-600">Notes: {order.event.notes}</p>
          )}
        </section>

        {/* Money to collect */}
        <section className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-gray-800">Payment · Pago</h2>
          {order.balancePaid || owed <= 0 ? (
            <p className="text-sm font-medium text-green-700">
              ✓ Paid in full — nothing to collect · Pagado
            </p>
          ) : (
            <>
              <p className="text-gray-700">
                Collect on delivery · Cobrar a la entrega:{' '}
                <span className="text-lg font-bold text-gray-900">{money(owed)}</span>
                {!order.depositPaid && (
                  <span className="block text-xs text-gray-400">Full amount — no deposit paid · Monto total</span>
                )}
              </p>

              {squareReady ? (
                <CrewCollect
                  orderId={order.id}
                  initialLink={order.squareBalanceLink}
                  owed={owed}
                  phone={order.customer.phone || ''}
                />
              ) : (
                order.squareBalanceLinkManual && (
                  <CrewCollect
                    orderId={order.id}
                    initialLink={order.squareBalanceLinkManual}
                    owed={owed}
                    phone={order.customer.phone || ''}
                    allowCreate={false}
                  />
                )
              )}

              {ownerTel && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <a
                    href={paidSmsHref}
                    className="inline-block rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:opacity-90"
                  >
                    💬 Text owner: payment collected
                  </a>
                  <p className="mt-1 text-xs text-gray-400">
                    For cash/other — texts the office you collected · Para efectivo.
                    Only the office marks it paid.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
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
