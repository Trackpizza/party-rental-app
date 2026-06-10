import { adminDb, adminStorage } from '@/lib/firebase/admin'
import type { Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

async function signedUrl(path: string): Promise<string | null> {
  try {
    const [url] = await adminStorage
      .bucket()
      .file(path)
      .getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 })
    return url
  } catch {
    return null
  }
}

export default async function GalleryPage({ params }: { params: { id: string } }) {
  const snap = await adminDb.collection('orders').doc(params.id).get()
  const order = snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }) : null

  const bizSnap = await adminDb.collection('settings').doc('business').get()
  const reviewUrl = bizSnap.exists ? (bizSnap.data() as any).googleReviewUrl || '' : ''

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-gray-500">
        These photos are no longer available.
      </main>
    )
  }

  const selected = (order.setupPhotos || []).filter((p) => p.selected)
  const photos = selected.length ? selected : order.setupPhotos || []
  const urls = (await Promise.all(photos.map((p) => signedUrl(p.storagePath)))).filter(
    (u): u is string => !!u,
  )
  const videoUrls = (
    await Promise.all(
      (order.videos || [])
        .filter((v) => v.type === 'walkthrough')
        .map((v) => signedUrl(v.storagePath)),
    )
  ).filter((u): u is string => !!u)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl p-4 pb-16">
        <header className="py-4 text-center">
          <h1 className="text-lg font-bold text-brand">{business}</h1>
          <p className="text-sm text-gray-500">Photos from your event · Fotos de su evento 🎉</p>
        </header>

        {videoUrls.length > 0 && (
          <div className="mb-3 space-y-3">
            {videoUrls.map((u, i) => (
              <video key={i} src={u} controls className="w-full rounded-xl bg-black" />
            ))}
          </div>
        )}

        {urls.length === 0 && videoUrls.length === 0 ? (
          <p className="text-center text-gray-400">No photos to show yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {urls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" download className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt={`event photo ${i + 1}`}
                  className="aspect-square w-full rounded-xl border border-gray-200 object-cover"
                />
              </a>
            ))}
          </div>
        )}

        {urls.length > 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            Tap any photo to open it full size, then save it to your phone.
            <br />
            Toque cualquier foto para verla en grande y guardarla en su teléfono.
          </p>
        )}

        {reviewUrl && (
          <div className="mt-8 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-gray-800">
              Thank you for choosing us for your event!
            </p>
            <p className="mt-1 text-sm text-gray-500">
              A quick review means others can find us. Thank you!
            </p>
            <a
              href={reviewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              ⭐ Leave a Google Review
            </a>

            <p className="mt-6 border-t border-gray-100 pt-5 font-semibold text-gray-800">
              ¡Gracias por elegirnos para su evento!
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Una reseña rápida ayuda a que otros nos encuentren. ¡Gracias!
            </p>
            <a
              href={reviewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              ⭐ Deja una reseña en Google
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
