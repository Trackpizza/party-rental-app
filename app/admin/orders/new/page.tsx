'use client'

import { buildEmptyOrder } from '@/lib/orders'
import OrderForm from '@/components/OrderForm'

export default function NewOrderPage() {
  return <OrderForm mode="create" initial={buildEmptyOrder()} />
}
