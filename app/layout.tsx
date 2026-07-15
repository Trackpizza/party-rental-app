import type { Metadata, Viewport } from 'next'
import './globals.css'
import { InstallProvider } from '@/components/InstallProvider'

const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

export const metadata: Metadata = {
  title: business,
  description: 'Rental orders & e-signature',
  applicationName: business,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: business },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#7c2d91',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <InstallProvider>{children}</InstallProvider>
      </body>
    </html>
  )
}
