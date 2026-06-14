import { adminDb } from '@/lib/firebase/admin'
import { customerName, itemName, type Order } from '@/lib/types'
import { formatTime, fullAddress, mapsHref } from '@/lib/orders'
import CrewSetupUpload from '@/components/CrewSetupUpload'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

export default async function SetupUploadPage({
  params,
}: {
  params: { id: string }
}) {
  const snap = await adminDb.collection('orders').doc(params.id).get()
  if (!snap.exists) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-gray-500">
        This upload link is invalid.
      </main>
    )
  }
  const order = { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }
  const who = customerName(order.customer) || 'Event'
  const address = fullAddress(order.customer)
  const items = (order.items || []).filter(
    (i) => i.qty || i.amount || (i.options && i.options.length) || i.description || i.note,
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-sm p-4 pb-16">
        <header className="py-4 text-center">
          <h1 className="text-lg font-bold text-brand">{business}</h1>
          <p className="text-sm text-gray-500">Setup photos · Fotos del montaje</p>
        </header>

        {/* Job context — so the crew knows they're at the right spot */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-base font-semibold text-gray-800">{who}</p>
          {(order.event?.eventDate || order.event?.deliveryTime) && (
            <p className="mt-0.5 text-sm text-gray-500">
              {order.event?.eventDate || '—'}
              {order.event?.deliveryTime ? ` · Delivery ${formatTime(order.event.deliveryTime)}` : ''}
            </p>
          )}

          {address ? (
            <div className="mt-3">
              <p className="text-sm text-gray-700">{address}</p>
              <a
                href={mapsHref(order.customer)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                📍 Open in Maps · Ver mapa
              </a>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-400">No address on file.</p>
          )}

          {items.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Rented items · Artículos
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
                {items.map((i) => (
                  <li key={i.key}>
                    {itemName(i)}
                    {i.qty ? ` ×${i.qty}` : ''}
                    {i.options?.length ? ` (${i.options.join(', ')})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="mt-3">
          <CrewSetupUpload orderId={params.id} />
        </div>
      </div>
    </main>
  )
}
