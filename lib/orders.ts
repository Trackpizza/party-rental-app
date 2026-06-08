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
  // Local calendar date (not UTC) — avoids rolling to "tomorrow" in the evening.
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

// "14:30" -> "2:30 PM" for friendly display.
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return hhmm
  const ampm = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
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
    customer: { firstName: '', lastName: '', phone: '', email: '', address: '', city: '', zip: '' },
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
    setupPhotos: [],
    photosSentAt: null,
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100

// Recompute derived totals. Tax auto-calculates from taxRate (% of the items
// subtotal) unless taxManual; deposit defaults to 50% unless depositManual.
export function recalcTotals(
  items: LineItem[],
  t: Totals,
  opts: { taxRate?: number; taxManual?: boolean; depositManual?: boolean } = {},
): Totals {
  const itemsSum = items.reduce((sum, i) => sum + (i.amount || 0), 0)
  const subtotal = itemsSum + (t.deliveryFee || 0)
  const tax = opts.taxManual
    ? t.tax || 0
    : r2(itemsSum * ((opts.taxRate || 0) / 100))
  const total = subtotal + tax
  const deposit =
    opts.depositManual && t.deposit != null ? t.deposit : r2(total / 2)
  const balance = r2(total - deposit)
  return {
    ...t,
    subtotal: r2(subtotal),
    tax: r2(tax),
    total: r2(total),
    deposit,
    balance,
  }
}

// N days after the event date (for DL photo auto-purge).
export function purgeDateFromEvent(eventDate: string, days = 30): string | null {
  if (!eventDate) return null
  const d = new Date(eventDate)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// Create a new order document; returns the new id.
export async function createOrder(draft: OrderDraft, purgeDays = 30): Promise<string> {
  const now = new Date().toISOString()
  const payload = {
    ...draft,
    dlPurgeAfter: purgeDateFromEvent(draft.event.eventDate, purgeDays),
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
