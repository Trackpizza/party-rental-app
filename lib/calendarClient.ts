'use client'

import { auth } from './firebase/client'

/**
 * Push an order's delivery/pickup events to Google Calendar.
 *
 * Returns the server's message rather than throwing, because the two callers
 * want different things: saving an order treats this as fire-and-forget (a
 * calendar outage must never block a save), while the Sync button on the order
 * page surfaces the result. The route itself no-ops when syncing is switched off.
 */
export async function syncOrderCalendar(
  orderId: string,
  opts: { remove?: boolean } = {},
): Promise<{ ok: boolean; error?: string; skipped?: string }> {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return { ok: false, error: 'Not signed in.' }
    const res = await fetch(`/api/orders/${orderId}/calendar-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ remove: !!opts.remove }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json.error || `Sync failed (${res.status})` }
    return { ok: true, skipped: json.skipped }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not reach the server.' }
  }
}
