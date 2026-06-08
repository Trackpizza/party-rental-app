// ============================================================
// Domain model for party-rental-app
// Mirrors the paper order card + the digital order lifecycle.
// ============================================================

// ---- Order lifecycle ----
export type OrderStatus =
  | 'draft'        // staff created, not shared yet
  | 'sent'         // link shared with customer
  | 'signed'       // customer agreed to waiver + signed
  | 'deposit_paid' // owner marked deposit received
  | 'confirmed'    // signed AND deposit paid (auto)
  | 'delivered'    // items dropped at venue
  | 'picked_up'    // items returned
  | 'balance_paid' // final payment received
  | 'completed'    // final receipt sent, done

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
  deposit_paid: 'Deposit Paid',
  confirmed: 'Confirmed',
  delivered: 'Delivered',
  picked_up: 'Picked Up',
  balance_paid: 'Balance Paid',
  completed: 'Completed',
}

// ---- Line items (the rental table on the card) ----
// Each row may carry sub-type checkboxes (e.g. tables: round/square/folding).
export interface LineItem {
  key: string          // e.g. "tables", "chairs", "jumpers", "other-<id>"
  label: string        // "TABLES"
  qty: number | null
  options?: string[]   // selected sub-types, e.g. ["round","folding"]
  amount: number | null
  description?: string // free-text name, used for custom "Other" rows
  note?: string        // per-item details/notes (any item)
}

// Display name for a line item (the custom text for "Other" rows, else label).
export function itemName(i: { key: string; label: string; description?: string }): string {
  if (i.key.startsWith('other')) return (i.description || '').trim() || 'Other'
  return i.label
}

// Canonical catalog used to render a fresh order form.
export const ITEM_CATALOG: { key: string; label: string; options?: string[] }[] = [
  { key: 'tables', label: 'Tables', options: ['Round', 'Square', 'Folding'] },
  { key: 'chairs', label: 'Chairs', options: ['Wood', 'White'] },
  { key: 'jumpers', label: 'Jumpers', options: ['Regular', 'Big Slide', 'Dbl Slide'] },
  { key: 'bathrooms', label: 'Bathrooms', options: ['Single', 'Hand Wash'] },
  { key: 'helium', label: 'Helium' },
  { key: 'tablecloths', label: 'Tablecloths' },
  { key: 'seat_covers', label: 'Seat Covers' },
  { key: 'balloons', label: 'Balloons' },
  { key: 'tents', label: 'Tents' },
  { key: 'heaters', label: 'Heaters' },
]

export type SurfaceType = 'grass' | 'cement' | 'dirt' | 'house' | 'park'
export const SURFACE_TYPES: SurfaceType[] = ['grass', 'cement', 'dirt', 'house', 'park']

export type PaymentMethod = 'zelle' | 'square' | 'cash'

// ---- Driver's license photo ----
export interface DLPhoto {
  storagePath: string   // path in Firebase Storage (owner-read only)
  uploadedAt: string    // ISO
  source: 'staff' | 'customer'
}

// ---- Setup photo (review funnel; marketing asset, not purged) ----
export interface SetupPhoto {
  storagePath: string
  uploadedAt: string
  selected: boolean     // included in the customer gallery/email
}

// ---- Signature record (frozen at signing time) ----
export interface SignatureRecord {
  signatureDataUrl: string   // base64 PNG of the drawn signature
  signedAt: string           // ISO, server timestamp
  ipAddress: string          // captured server-side
  waiverScrolled: boolean
  waiverAgreed: boolean
  waiverVersion: string      // version of waiver text agreed to
  waiverTextSnapshot: string // exact waiver text at signing
  orderSnapshot: string      // JSON snapshot of the order at signing
}

// ---- Customer contact + event details ----
export interface CustomerInfo {
  firstName: string
  lastName: string
  phone: string
  email: string
  address: string
  city: string
  zip: string
}

// Full display name from first/last; falls back to a legacy `name` field
// so orders created before the split still render correctly.
export function customerName(c: {
  firstName?: string
  lastName?: string
  name?: string
}): string {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return full || c.name || ''
}

export interface EventInfo {
  eventDate: string      // ISO date — event start date
  deliveryTime: string
  pickupDate: string     // ISO date — pickup date
  pickupTime: string
  surfaces: SurfaceType[]
  stairs: boolean
  notes: string
}

export interface Totals {
  subtotal: number | null
  deliveryFee: number | null
  tax: number | null
  total: number | null
  deposit: number | null
  balance: number | null
  miles: number | null
}

// ---- The order document (Firestore: orders/{id}) ----
export interface Order {
  id: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  todaysDate: string
  customer: CustomerInfo
  event: EventInfo
  items: LineItem[]
  totals: Totals

  // payments
  paymentMethod: PaymentMethod | null
  squareLink: string | null
  depositPaid: boolean
  depositPaidAt: string | null
  balancePaid: boolean
  balancePaidAt: string | null

  // fulfillment
  sentAt: string | null
  deliveredAt: string | null
  pickedUpAt: string | null
  completedAt: string | null

  // signing
  signature: SignatureRecord | null

  // driver's license photos (owner-read only; auto-purged 30d after event)
  dlPhotos: DLPhoto[]
  dlPurgeAfter: string | null   // ISO; set to eventDate + 30 days

  // setup photos + review funnel (kept; not purged)
  setupPhotos: SetupPhoto[]
  photosSentAt: string | null

  receiptSentAt?: string | null
}
