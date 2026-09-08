'use client'

import { useEffect, useState } from 'react'

export default function OfflineBar() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!offline) return null
  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
      ⚠ No internet connection — changes may not save
    </div>
  )
}
