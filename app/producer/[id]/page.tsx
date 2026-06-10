import { adminDb, adminStorage } from '@/lib/firebase/admin'
import { customerName, type Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

async function signed(path: string, download = false): Promise<string | null> {
  try {
    const fileName = path.split('/').pop() || 'file'
    const [url] = await adminStorage
      .bucket()
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 2 * 60 * 60 * 1000,
        ...(download ? { responseDisposition: `attachment; filename="${fileName}"` } : {}),
      })
    return url
  } catch {
    return null
  }
}

export default async function ProducerPage({ params }: { params: { id: string } }) {
  const snap = await adminDb.collection('orders').doc(params.id).get()
  const order = snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }) : null

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-gray-500">
        This content is no longer available.
      </main>
    )
  }

  const photos = await Promise.all(
    (order.setupPhotos || []).map(async (p) => ({
      view: await signed(p.storagePath),
      dl: await signed(p.storagePath, true),
    })),
  )
  const videos = await Promise.all(
    (order.videos || []).map(async (v) => ({
      type: v.type,
      view: await signed(v.storagePath),
      dl: await signed(v.storagePath, true),
    })),
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl p-4 pb-16">
        <header className="py-4">
          <h1 className="text-lg font-bold text-brand">{business} — content</h1>
          <p className="text-sm text-gray-500">
            {customerName(order.customer)} {order.event?.eventDate ? `· ${order.event.eventDate}` : ''}
          </p>
        </header>

        {videos.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Videos</h2>
            <div className="space-y-3">
              {videos.map((v, i) => (
                <div key={i} className="rounded-xl bg-white p-2 shadow-sm">
                  <p className="mb-1 text-xs capitalize text-gray-400">{v.type}</p>
                  {v.view && <video src={v.view} controls className="w-full rounded-md bg-black" />}
                  {v.dl && (
                    <a href={v.dl} className="mt-1 inline-block text-sm text-brand underline">
                      ⬇ Download video
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Photos</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p, i) =>
                p.view ? (
                  <a key={i} href={p.dl || p.view} download className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.view}
                      alt={`photo ${i + 1}`}
                      className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
                    />
                  </a>
                ) : null,
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">Tap a photo to download it.</p>
          </section>
        )}

        {photos.length === 0 && videos.length === 0 && (
          <p className="text-gray-400">No content yet.</p>
        )}
      </div>
    </main>
  )
}
