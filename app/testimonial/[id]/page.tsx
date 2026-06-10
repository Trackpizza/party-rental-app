import { adminDb } from '@/lib/firebase/admin'
import { DEFAULT_VIDEO_RELEASE } from '@/lib/settings'
import { customerName, type Order } from '@/lib/types'
import TestimonialRecorder from '@/components/TestimonialRecorder'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

export default async function TestimonialPage({
  params,
}: {
  params: { id: string }
}) {
  const snap = await adminDb.collection('orders').doc(params.id).get()
  if (!snap.exists) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-gray-500">
        This link is invalid.
      </main>
    )
  }
  const order = snap.data() as Order

  const biz = await adminDb.collection('settings').doc('business').get()
  const releaseText = (biz.exists && (biz.data() as any).videoReleaseText) || DEFAULT_VIDEO_RELEASE

  return (
    <TestimonialRecorder
      orderId={params.id}
      customerName={customerName(order.customer)}
      releaseText={releaseText}
      business={business}
    />
  )
}
