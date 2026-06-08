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

let otherCounter = 0
export function newOtherItem(): LineItem {
  otherCounter += 1
  return {
    key: `other-${Date.now()}-${otherCounter}`,
    label: 'Other',
    qty: null,
    options: [],
    amount: null,
    description: '',
  }
}

export function isOtherItem(i: LineItem): boolean {
  return i.key.startsWith('other')
}

// Fresh blank order with one empty LineItem per catalog entry + one custom "Other".
export function buildEmptyOrder(): OrderDraft {
  const items: LineItem[] = ITEM_CATALOG.map((c) => ({
    key: c.key,
    label: c.label,
    qty: null,
    options: [],
    amount: null,
  }))
  items.push(newOtherItem())

  return {
    status: 'draft',
    todaysDate: todayISO(),
    customer: { name: '', phone: '', email: '', address: '', city: '', zip: '' },
    event: {
      eventDate: '',
      deliveryTime: '',
      pickupDate: '',
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
    sentAt: null,
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

// Derive the furthest-along lifecycle status purely from flags/timestamps.
// signed + deposit auto-advances to "confirmed"; everything else is linear.
export function deriveStatus(o: Order): Order['status'] {
  if (o.completedAt) return 'completed'
  if (o.balancePaid) return 'balance_paid'
  if (o.pickedUpAt) return 'picked_up'
  if (o.deliveredAt) return 'delivered'
  if (o.signature && o.depositPaid) return 'confirmed'
  if (o.depositPaid) return 'deposit_paid'
  if (o.signature) return 'signed'
  if (o.sentAt) return 'sent'
  return 'draft'
}

// Apply a patch, recompute status from the merged result, and persist.
export async function applyOrderAction(
  order: Order,
  patch: Partial<Order>,
): Promise<void> {
  const merged = { ...order, ...patch }
  await updateOrder(order.id, { ...patch, status: deriveStatus(merged) })
}

export function customerLink(orderId: string): string {
  // Prefer the actual origin the owner is on (client-side) so links always
  // match wherever the app is hosted; fall back to env for any server use.
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/order/${orderId}`
}
