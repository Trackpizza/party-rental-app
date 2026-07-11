'use client'

import { useEffect, useState } from 'react'
import { INVENTORY_ITEMS, getInventory, saveInventoryQty } from '@/lib/inventory'

export default function InventoryPage() {
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getInventory().then((inv) => {
      const map: Record<string, string> = {}
      for (const item of INVENTORY_ITEMS) {
        map[item.key] = inv[item.key] != null ? String(inv[item.key]) : ''
      }
      setQtys(map)
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await Promise.all(
      INVENTORY_ITEMS.map((item) =>
        saveInventoryQty(item.key, parseInt(qtys[item.key] || '0', 10) || 0),
      ),
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Group items by catalog item (e.g. all "Jumpers" together).
  const groups: { groupLabel: string; items: typeof INVENTORY_ITEMS }[] = []
  for (const item of INVENTORY_ITEMS) {
    const groupLabel = item.label.split(' – ')[0]
    const last = groups[groups.length - 1]
    if (last && last.groupLabel === groupLabel) {
      last.items.push(item)
    } else {
      groups.push({ groupLabel, items: [item] })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Inventory</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">✓ Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Set how many of each item you own. When you're booking an order, the form will show how many are still available on that date.
      </p>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ groupLabel, items }) => (
            <section key={groupLabel} className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-800">{groupLabel}</h2>
              <div className="space-y-2">
                {items.map((item) => {
                  const optLabel = item.label.includes(' – ')
                    ? item.label.split(' – ')[1]
                    : null
                  return (
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="w-36 text-sm text-gray-600">
                        {optLabel ?? item.label}
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={qtys[item.key] ?? ''}
                        onChange={(e) =>
                          setQtys((prev) => ({ ...prev, [item.key]: e.target.value }))
                        }
                        className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
                      />
                      <span className="text-sm text-gray-400">owned</span>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
