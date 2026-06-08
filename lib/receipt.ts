import { Order, customerName } from './types'

function money(n: number | null | undefined): string {
  if (n == null) return '$0.00'
  return `$${n.toFixed(2)}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function fmtTime(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return hhmm
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

// Inline-styled HTML receipt (email clients need inline styles).
export function buildReceiptHtml(order: Order, business: string): string {
  const rows = order.items
    .filter((i) => i.qty || i.amount || (i.options && i.options.length) || i.description)
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;">
          ${i.description || i.label}${
            i.options && i.options.length ? ` <span style="color:#888;">(${i.options.join(', ')})</span>` : ''
          }
        </td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center;color:#555;">${i.qty ?? ''}</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;">${money(i.amount)}</td>
      </tr>`,
    )
    .join('')

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h1 style="color:#7c2d91;font-size:20px;margin-bottom:2px;">${business}</h1>
    <p style="color:#888;margin-top:0;">Rental Receipt</p>

    <p style="margin:16px 0 4px;"><strong>${customerName(order.customer) || 'Customer'}</strong></p>
    <p style="color:#555;margin:0;font-size:14px;">
      Event ${fmtDate(order.event.eventDate)} ${fmtTime(order.event.deliveryTime)}
      &nbsp;→&nbsp; Pickup ${fmtDate(order.event.pickupDate || order.event.eventDate)} ${fmtTime(order.event.pickupTime)}
    </p>

    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
      <thead>
        <tr style="color:#888;text-align:left;">
          <th style="padding-bottom:4px;">Item</th>
          <th style="padding-bottom:4px;text-align:center;">Qty</th>
          <th style="padding-bottom:4px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table style="width:100%;margin-top:16px;font-size:14px;">
      <tr><td style="color:#555;">Subtotal</td><td style="text-align:right;">${money(order.totals.subtotal)}</td></tr>
      <tr><td style="color:#555;">Delivery</td><td style="text-align:right;">${money(order.totals.deliveryFee)}</td></tr>
      <tr><td style="color:#555;">Tax</td><td style="text-align:right;">${money(order.totals.tax)}</td></tr>
      <tr><td style="font-weight:bold;padding-top:6px;">Total</td><td style="text-align:right;font-weight:bold;padding-top:6px;">${money(order.totals.total)}</td></tr>
      <tr><td style="color:#555;">Deposit paid${order.depositPaidAt ? ` (${fmtDate(order.depositPaidAt)})` : ''}</td><td style="text-align:right;">${money(order.totals.deposit)}</td></tr>
      <tr><td style="color:#555;">Balance paid${order.balancePaidAt ? ` (${fmtDate(order.balancePaidAt)})` : ''}</td><td style="text-align:right;">${money(order.totals.balance)}</td></tr>
    </table>

    <p style="margin-top:20px;padding:12px;background:#f0fdf4;border-radius:8px;color:#15803d;text-align:center;font-weight:bold;">
      Thank you for your business! 🎉
    </p>

    <p style="color:#999;font-size:12px;margin-top:20px;">
      ${process.env.NEXT_PUBLIC_BUSINESS_PHONE || ''}<br/>
      ${process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || ''}
    </p>
  </div>`
}
