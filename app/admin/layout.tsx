'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import AuthGuard from '@/components/AuthGuard'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // The login page renders inside /admin but must NOT be gated.
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <header className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <Link href="/admin" className="font-bold text-brand">
            {business}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-gray-600 hover:text-brand">
              Orders
            </Link>
            <Link href="/admin/calendar" className="text-gray-600 hover:text-brand">
              Calendar
            </Link>
            <Link href="/admin/settings" className="text-gray-600 hover:text-brand">
              Settings
            </Link>
            <Link
              href="/admin/orders/new"
              className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:opacity-90"
            >
              + New Order
            </Link>
            <button
              onClick={async () => {
                await signOut(auth)
                router.replace('/admin/login')
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              Sign out
            </button>
          </nav>
        </header>
        <div className="mx-auto max-w-5xl p-4">{children}</div>
      </div>
    </AuthGuard>
  )
}
