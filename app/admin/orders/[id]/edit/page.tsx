'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getOrder, OrderDraft } from '@/lib/orders'
import { Order } from '@/lib/types'
import OrderForm from '@/components/OrderForm'

// Strip the server-managed fields so the form works on a plain draft and we
// don't write `id`/timestamps back into the document body on save.
function toDraft(o: Order): OrderDraft {
  const d = { ...o } as Partial<Order>
  delete d.id
  delete d.createdAt
  delete d.updatedAt
  return d as OrderDraft
}

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOrder(id).then((o) => {
      if (o) setDraft(toDraft(o))
      setLoading(false)
    })
  }, [id])

  if (loading) return <p className="text-gray-400">Loading order…</p>
  if (!draft)
    return (
      <div className="text-center">
        <p className="text-gray-500">Order not found.</p>
        <button onClick={() => router.push('/admin')} className="mt-4 text-brand underline">
          Back to orders
        </button>
      </div>
    )

  return <OrderForm mode="edit" initial={draft} orderId={id} />
}
