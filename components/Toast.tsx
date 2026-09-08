'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const next = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = next.current++
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg animate-toast ${
                t.type === 'success'
                  ? 'bg-green-600'
                  : t.type === 'error'
                    ? 'bg-red-600'
                    : 'bg-gray-800'
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
              </span>
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  )
}
