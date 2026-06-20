import crypto from 'crypto'

// Minimal Square API helper (no SDK — plain fetch, matching the app's style).
// Phase 1: create a hosted deposit payment link, and verify webhook signatures.

const SQUARE_VERSION = '2025-01-23'

export function squareEnv(): 'sandbox' | 'production' {
  return process.env.SQUARE_ENV === 'production' ? 'production' : 'sandbox'
}

function apiBase(): string {
  return squareEnv() === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

export function isSquareConfigured(): boolean {
  return !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID)
}

// Square deals in the smallest currency unit (cents). Round to avoid float drift.
export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export interface PaymentLinkResult {
  url: string
  orderId: string
  paymentLinkId: string
}

// Create a fixed-amount hosted payment link (Quick Pay). `name` is the title the
// buyer sees, `description` is a short summary (e.g. the rented items).
export async function createPaymentLink(opts: {
  name: string
  amountDollars: number
  description?: string
  buyerEmail?: string
  buyerPhone?: string
  idempotencyKey: string
}): Promise<PaymentLinkResult> {
  const token = process.env.SQUARE_ACCESS_TOKEN
  const locationId = process.env.SQUARE_LOCATION_ID
  if (!token || !locationId) throw new Error('Square is not configured.')

  const body: any = {
    idempotency_key: opts.idempotencyKey,
    quick_pay: {
      name: opts.name,
      price_money: { amount: toCents(opts.amountDollars), currency: 'USD' },
      location_id: locationId,
    },
  }
  if (opts.description) body.description = opts.description
  const buyer: any = {}
  if (opts.buyerEmail) buyer.buyer_email = opts.buyerEmail
  if (opts.buyerPhone) buyer.buyer_phone_number = opts.buyerPhone
  if (Object.keys(buyer).length) body.pre_populated_data = buyer

  const res = await fetch(`${apiBase()}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail || 'Square payment link failed.'
    throw new Error(msg)
  }
  const link = json.payment_link
  return { url: link.url, orderId: link.order_id, paymentLinkId: link.id }
}

// Verify a Square webhook signature. Square signs HMAC-SHA256 over
// (notificationUrl + rawBody) with the subscription's signature key, base64.
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  notificationUrl: string,
): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  if (!key || !signature) return false
  const hmac = crypto.createHmac('sha256', key)
  hmac.update(notificationUrl + rawBody)
  const expected = hmac.digest('base64')
  // Constant-time compare to avoid timing leaks.
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
