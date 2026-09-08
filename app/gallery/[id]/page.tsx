import { adminDb, adminStorage } from '@/lib/firebase/admin'
import type { Order } from '@/lib/types'
import GalleryActions from '@/components/GalleryActions'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

// Pass downloadAs to get a URL that GCS serves with a Content-Disposition
// attachment header, so clicking it saves the file instead of opening it. The
// bucket has no CORS config, so downloading has to happen this way rather than
// by fetching the bytes in the browser.
async function signedUrl(path: string, downloadAs?: string): Promise<string | null> {
  try {
    const [url] = await adminStorage
      .bucket()
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
        ...(downloadAs
          ? { responseDisposition: `attachment; filename="${downloadAs}"` }
          : {}),
      })
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
  // Each photo gets a view URL and a matching download URL, kept together so a
  // photo whose signing failed drops out of both lists at once.
  const signedPhotos = await Promise.all(
    photos.map(async (p, i) => {
      const ext = (p.storagePath.split('.').pop() || 'jpg').toLowerCase()
      const [view, download] = await Promise.all([
        signedUrl(p.storagePath),
        signedUrl(p.storagePath, `event-photo-${i + 1}.${ext}`),
      ])
      return { view, download }
    }),
  )
  const items = signedPhotos.filter(
    (s): s is { view: string; download: string | null } => !!s.view,
  )
  const walkthroughs = (order.videos || []).filter((v) => v.type === 'walkthrough')
  const selWalk = walkthroughs.filter((v) => v.selected)
  const videoUrls = (
    await Promise.all((selWalk.length ? selWalk : walkthroughs).map((v) => signedUrl(v.storagePath)))
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
              <video key={i} src={u} controls className="mx-auto block max-h-[70vh] max-w-full rounded-xl bg-black" />
            ))}
          </div>
        )}

        {items.length === 0 && videoUrls.length === 0 ? (
          <p className="text-center text-gray-400">No photos to show yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it, i) => (
              <a key={i} href={it.view} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.view}
                  alt={`event photo ${i + 1}`}
                  className="aspect-square w-full rounded-xl border border-gray-200 object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <GalleryActions
          downloadUrls={items.map((s) => s.download).filter((u): u is string => !!u)}
        />

        {items.length > 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            Tap any photo to open it full size, then save it to your phone.
            <br />
            Toque cualquier foto para verla en grande y guardarla en su teléfono.
          </p>
        )}

        {reviewUrl && (
          <div className="mt-8 overflow-hidden rounded-2xl shadow-md">
            <div className="bg-gradient-to-br from-yellow-400 to-amber-500 px-6 pt-7 pb-2 text-center">
              <div className="text-4xl">⭐⭐⭐⭐⭐</div>
              <p className="mt-3 text-xl font-bold text-white">
                Loved your event? Tell others!
              </p>
              <p className="mt-1 text-sm text-yellow-100">
                A quick Google review helps your neighbors find us — and means the world to our small business.
              </p>
              <a
                href={reviewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-xl bg-white px-8 py-3 font-bold text-amber-600 shadow hover:bg-yellow-50"
              >
                Leave a Google Review →
              </a>
            </div>
            <div className="bg-amber-50 px-6 py-5 text-center">
              <p className="font-semibold text-amber-900">¿Le encantó su evento?</p>
              <p className="mt-1 text-sm text-amber-700">
                Una reseña rápida ayuda a que otros vecinos nos encuentren. ¡Le agradecemos mucho!
              </p>
              <a
                href={reviewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-xl bg-amber-500 px-8 py-3 font-bold text-white hover:bg-amber-600"
              >
                ⭐ Deja una reseña en Google
              </a>
            </div>
          </div>
        )}

        {order.requestTestimonial && (
          <div className="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Loved your event? We&apos;d be grateful for a quick video shout-out.
            </p>
            <a
              href={`/testimonial/${order.id}`}
              className="mt-3 inline-block rounded-lg border-2 border-brand px-6 py-3 font-semibold text-brand hover:bg-brand hover:text-white"
            >
              🎥 Leave a quick video review
            </a>
            <p className="mt-4 text-sm text-gray-500">
              ¿Le encantó su evento? Nos encantaría un breve saludo en video.
            </p>
            <a
              href={`/testimonial/${order.id}`}
              className="mt-3 inline-block rounded-lg border-2 border-brand px-6 py-3 font-semibold text-brand hover:bg-brand hover:text-white"
            >
              🎥 Deje una reseña en video
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
