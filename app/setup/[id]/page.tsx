import { adminDb } from '@/lib/firebase/admin'
import type { Order } from '@/lib/types'
import CrewSetupUpload from '@/components/CrewSetupUpload'

export const dynamic = 'force-dynamic'

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
  const order = snap.data() as Order
  const name = `${order.customer?.name || ''}${order.event?.eventDate ? ' · ' + order.event.eventDate : ''}`

  return <CrewSetupUpload orderId={params.id} customerName={name} />
}
