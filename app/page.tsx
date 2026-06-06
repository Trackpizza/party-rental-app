import Link from 'next/link'

export default function Home() {
  const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-bold text-brand">{business}</h1>
      <p className="mt-2 text-gray-500">Rental orders &amp; e-signature</p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/admin"
          className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90"
        >
          Staff Dashboard
        </Link>
      </div>
    </main>
  )
}
