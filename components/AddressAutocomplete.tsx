'use client'

import { useEffect, useRef } from 'react'

// Google Places address autocomplete. Falls back to a plain input when no
// Maps key is configured, so the form always works.
let mapsPromise: Promise<void> | null = null
function loadMaps(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve()
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(s)
  })
  return mapsPromise
}

export interface AddressParts {
  address: string
  city: string
  state: string
  zip: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  className,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (parts: AddressParts) => void
  className?: string
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!key || !inputRef.current) return
    let ac: any
    let cancelled = false
    loadMaps(key)
      .then(async () => {
        const g = (window as any).google
        if (cancelled || !g?.maps?.importLibrary || !inputRef.current) return
        const places = await g.maps.importLibrary('places')
        ac = new places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components'],
        })
        ac.addListener('place_changed', () => {
          const comp = ac.getPlace()?.address_components || []
          const get = (t: string) =>
            comp.find((c: any) => c.types.includes(t))
          const streetNum = get('street_number')?.long_name || ''
          const route = get('route')?.long_name || ''
          onSelect({
            address: [streetNum, route].filter(Boolean).join(' '),
            city:
              get('locality')?.long_name ||
              get('sublocality')?.long_name ||
              get('postal_town')?.long_name ||
              '',
            state: get('administrative_area_level_1')?.short_name || '',
            zip: get('postal_code')?.long_name || '',
          })
        })
      })
      .catch(() => {
        /* fall back to plain input */
      })
    return () => {
      cancelled = true
      if (ac && (window as any).google) {
        ;(window as any).google.maps.event.clearInstanceListeners(ac)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={className}
    />
  )
}
