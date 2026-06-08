import { adminDb } from '@/lib/firebase/admin'
import { DEFAULT_WAIVER } from '@/lib/waiver'
import SignFlow, { SignFlowData } from '@/components/SignFlow'
import { customerName, type Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'
const zelle = process.env.NEXT_PUBLIC_ZELLE_NUMBER || ''

interface WaiverSettingsLike2 {
  text: string
  version: string
}

async function loadOrder(id: string): Promise<Order | null> {
  const snap = await adminDb.collection('orders').doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }
}

async function loadWaiver(): Promise<WaiverSettingsLike2> {
  const snap = await adminDb.collection('settings').doc('waiver').get()
  if (snap.exists) {
    const d = snap.data() as any
    return { text: d.text, version: d.version }
  }
  return { text: DEFAULT_WAIVER, version: 'v1' }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </main>
  )
}

export default async function OrderSignPage({
  params,
}: {
  params: { id: string }
}) {
  const order = await loadOrder(params.id)

  if (!order) {
    return (
      <Centered>
        <h1 className="text-lg font-bold text-gray-700">Order not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          This link may be incorrect or expired. Please contact {business}.
        </p>
      </Centered>
    )
  }

  if (order.signature) {
    return (
      <Centered>
        <div className="text-4xl">✅</div>
        <h1 className="mt-3 text-lg font-bold text-green-700">Already signed</h1>
        <p className="mt-2 text-sm text-gray-500">
          This order was signed on{' '}
          {new Date(order.signature.signedAt).toLocaleDateString()}. Thank you!
        </p>
      </Centered>
    )
  }

  const waiver = await loadWaiver()

  const data: SignFlowData = {
    orderId: order.id,
    business,
    customerName: customerName(order.customer),
    items: order.items.map((i) => ({
      label: i.label,
      qty: i.qty,
      options: i.options || [],
      amount: i.amount,
      description: i.description || '',
    })),
    totals: {
      total: order.totals.total,
      deposit: order.totals.deposit,
      balance: order.totals.balance,
    },
    event: {
      eventDate: order.event.eventDate,
      deliveryTime: order.event.deliveryTime,
      pickupDate: order.event.pickupDate || '',
      pickupTime: order.event.pickupTime,
    },
    payment: {
      method: order.paymentMethod,
      zelle,
      squareLink: order.squareLink,
    },
    waiverText: waiver.text,
    waiverVersion: waiver.version,
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <SignFlow data={data} />
    </main>
  )
}
