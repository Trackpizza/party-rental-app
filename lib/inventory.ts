import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase/client'
import { ITEM_CATALOG } from './types'

// Items tracked without per-option breakdown (no checkboxes in catalog).
const TRACKED_NO_OPTIONS = ['heaters']

export interface InventoryEntry {
  key: string    // e.g. "jumpers:Regular" or "heaters"
  label: string  // e.g. "Jumpers – Regular" or "Heaters"
  totalQty: number
}

// All trackable inventory items derived from the catalog.
export const INVENTORY_ITEMS: Omit<InventoryEntry, 'totalQty'>[] = (() => {
  const items: Omit<InventoryEntry, 'totalQty'>[] = []
  for (const cat of ITEM_CATALOG) {
    if (cat.options && cat.options.length > 0) {
      for (const opt of cat.options) {
        items.push({ key: `${cat.key}:${opt}`, label: `${cat.label} – ${opt}` })
      }
    } else if (TRACKED_NO_OPTIONS.includes(cat.key)) {
      items.push({ key: cat.key, label: cat.label })
    }
  }
  return items
})()

// Firestore doc ID — colons are valid in Firestore IDs; we just encode them safe.
function docId(key: string) {
  return key.replace(/:/g, '__')
}

export async function getInventory(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, 'inventory'))
  const result: Record<string, number> = {}
  snap.forEach((d) => {
    const data = d.data()
    // Decode __ back to : to match our key format.
    const key = d.id.replace(/__/g, ':')
    result[key] = typeof data.totalQty === 'number' ? data.totalQty : 0
  })
  return result
}

export async function saveInventoryQty(key: string, totalQty: number): Promise<void> {
  await setDoc(doc(db, 'inventory', docId(key)), { totalQty }, { merge: true })
}

// Returns a map of inventoryKey → qty already booked on eventDate (excluding one order by id).
export async function getBookedQtys(
  eventDate: string,
  excludeOrderId?: string,
): Promise<Record<string, number>> {
  if (!eventDate) return {}
  const snap = await getDocs(
    query(collection(db, 'orders'), where('event.eventDate', '==', eventDate)),
  )
  const booked: Record<string, number> = {}
  snap.forEach((d) => {
    if (d.id === excludeOrderId) return
    const order = d.data()
    if (order.status === 'cancelled') return
    const items: any[] = Array.isArray(order.items) ? order.items : []
    for (const item of items) {
      const ck: string = item.catalogKey || item.key || ''
      const qty = typeof item.qty === 'number' ? item.qty : 0
      if (!qty) continue
      const opts: string[] = Array.isArray(item.options) ? item.options : []
      const cat = ITEM_CATALOG.find((c) => c.key === ck)
      if (cat?.options && opts.length > 0) {
        // Each checked option consumes qty units.
        for (const opt of opts) {
          const invKey = `${ck}:${opt}`
          booked[invKey] = (booked[invKey] || 0) + qty
        }
      } else if (TRACKED_NO_OPTIONS.includes(ck)) {
        booked[ck] = (booked[ck] || 0) + qty
      }
    }
  })
  return booked
}
