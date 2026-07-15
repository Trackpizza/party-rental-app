import Link from 'next/link'
import StandaloneRedirect from '@/components/StandaloneRedirect'

export default function Home() {
  const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'
  const phone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || ''
  const address = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || ''
  const website = process.env.NEXT_PUBLIC_BUSINESS_WEBSITE || ''
  const websiteLabel = website.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const tel = phone.replace(/[^\d+]/g, '')
  const smsBody = encodeURIComponent("Hi! I'd like to book a party rental.")
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <StandaloneRedirect to="/admin" />
      <h1 className="text-3xl font-bold text-brand">{business}</h1>
      <p className="mt-2 text-gray-500">
        Party rentals · Renta para fiestas 🎉
        <br />
        Tables, chairs, jumpers &amp; more · Mesas, sillas, brincolines y más
      </p>

      {phone && (
        <>
          <p className="mt-8 text-gray-600">
            Ready to book? Call or text us · ¿Listo para reservar? Llame o envíe un texto:
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <a
              href={`tel:${tel}`}
              className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              📞 Call · Llamar {phone}
            </a>
            <a
              href={`sms:${tel}?body=${smsBody}`}
              className="rounded-lg border-2 border-brand px-6 py-3 font-semibold text-brand hover:bg-brand hover:text-white"
            >
              💬 Text us · Enviar texto
            </a>
          </div>
        </>
      )}

      {website && (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="mt-6 font-medium text-brand underline hover:opacity-80"
        >
          🌐 {websiteLabel}
        </a>
      )}

      {address && (
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3 text-sm text-gray-500 underline hover:text-brand"
        >
          📍 {address}
        </a>
      )}

      <Link href="/admin" className="mt-12 text-xs text-gray-300 hover:text-gray-500">
        Staff sign in
      </Link>
    </main>
  )
}
