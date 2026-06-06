import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore'
import { db } from './firebase/client'
import {
  Order,
  LineItem,
  Totals,
  ITEM_CATALOG,
} from './types'

// A draft order while it's being filled out (no id/timestamps yet).
export type OrderDraft = Omit<Order, 'id' | 'createdAt' | 'updatedAt'>

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Fresh blank order with one empty LineItem per catalog entry.
export function buildEmptyOrder(): OrderDraft {
  const items: LineItem[] = ITEM_CATALOG.map((c) => ({
    key: c.key,
    label: c.label,
    qty: null,
    options: [],
    amount: null,
  }))

  return {
    status: 'draft',
    todaysDate: todayISO(),
    customer: { name: '', phone: '', email: '', address: '', city: '', zip: '' },
    event: {
      eventDate: '',
      deliveryTime: '',
      pickupTime: '',
      surfaces: [],
      stairs: false,
      notes: '',
    },
    items,
    totals: {
      subtotal: null,
      deliveryFee: null,
      tax: null,
      total: null,
      deposit: null,
      balance: null,
      miles: null,
    },
    paymentMethod: null,
    squareLink: null,
    depositPaid: false,
    depositPaidAt: null,
    balancePaid: false,
    balancePaidAt: null,
    deliveredAt: null,
    pickedUpAt: null,
    completedAt: null,
    signature: null,
    dlPhotos: [],
    dlPurgeAfter: null,
  }
}

// Recompute derived totals from line-item amounts + delivery + tax.
// subtotal & total are always derived; tax & deposit can be overridden by staff.
export function recalcTotals(
  items: LineItem[],
  t: Totals,
): Totals {
  const itemsSum = items.reduce((sum, i) => sum + (i.amount || 0), 0)
  const subtotal = itemsSum + (t.deliveryFee || 0)
  const tax = t.tax || 0
  const total = subtotal + tax
  // Default deposit = 50% of total, rounded to the cent, unless staff set one.
  const deposit = t.deposit != null ? t.deposit : Math.round((total / 2) * 100) / 100
  const balance = Math.round((total - deposit) * 100) / 100
  return {
    ...t,
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(total * 100) / 100,
    deposit,
    balance,
  }
}

// 30 days after the event date (for DL photo auto-purge).
export function purgeDateFromEvent(eventDate: string): string | null {
  if (!eventDate) return null
  const d = new Date(eventDate)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

// Create a new order document; returns the new id.
export async function createOrder(draft: OrderDraft): Promise<string> {
  const now = new Date().toISOString()
  const payload = {
    ...draft,
    dlPurgeAfter: purgeDateFromEvent(draft.event.eventDate),
    createdAt: now,
    updatedAt: now,
  }
  const ref = await addDoc(collection(db, 'orders'), payload)
  return ref.id
}

export async function updateOrder(
  id: string,
  patch: Partial<Order>,
): Promise<void> {
  await updateDoc(doc(db, 'orders', id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, 'orders', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }
}

export function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${n.toFixed(2)}`
}
