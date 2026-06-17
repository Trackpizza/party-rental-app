'use client'

import { useEffect, useRef, useState } from 'react'

// Google Places address autocomplete using the NEW Places API
// (AutocompleteSuggestion + Place), driving our own styled input and dropdown.
// The legacy google.maps.places.Autocomplete widget was deprecated, so this
// uses the supported data API instead. Falls back to a plain input (the value
// still updates as you type) when no Maps key is set or the library fails.
let mapsPromise: Promise<void> | null = null
function loadMaps(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve()
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async`
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
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const placesLib = useRef<any>(null)
  const libPromise = useRef<Promise<any> | null>(null)
  const sessionToken = useRef<any>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)

  // Load the Places library on demand, memoized so it only loads once. Returns
  // null if there's no key or Maps fails (caller falls back to a plain input).
  function getPlacesLib(): Promise<any> {
    if (placesLib.current) return Promise.resolve(placesLib.current)
    console.log('[ADDR] getPlacesLib called. key present:', !!key)
    if (!key) return Promise.resolve(null)
    if (!libPromise.current) {
      console.log('[ADDR] starting loadMaps…')
      libPromise.current = loadMaps(key)
        .then(async () => {
          const g = (window as any).google
          console.log('[ADDR] loadMaps resolved. importLibrary present:', !!g?.maps?.importLibrary)
          if (!g?.maps?.importLibrary) return null
          placesLib.current = await g.maps.importLibrary('places')
          console.log('[ADDR] places lib loaded. AutocompleteSuggestion:', !!placesLib.current?.AutocompleteSuggestion)
          return placesLib.current
        })
        .catch((e) => {
          console.warn('[ADDR] loadMaps/importLibrary FAILED', e)
          return null
        })
    }
    return libPromise.current
  }

  // Kick off the load as soon as the field appears, so the library is usually
  // ready by the time the user types (and the first keystroke awaits it anyway).
  useEffect(() => {
    getPlacesLib()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function fetchSuggestions(input: string) {
    console.log('[ADDR] fetchSuggestions:', JSON.stringify(input), 'libReady:', !!placesLib.current)
    if (!input.trim()) {
      setSuggestions([])
      setOpen(false)
      // Empty field = no active session; drop the token so the next address
      // starts a fresh one.
      sessionToken.current = null
      return
    }
    // Wait for the library — this is what makes the first keystroke work even
    // before the Maps script has finished loading (no toggle-off/on needed).
    // Show a loading hint while the script downloads so the field isn't blank.
    if (!placesLib.current) {
      setLoading(true)
      setOpen(true)
    }
    const lib = await getPlacesLib()
    setLoading(false)
    if (!lib?.AutocompleteSuggestion) {
      setSuggestions([])
      setOpen(false)
      return
    }
    try {
      // One session token per "type → pick" cycle keeps billing efficient.
      if (!sessionToken.current && lib.AutocompleteSessionToken) {
        sessionToken.current = new lib.AutocompleteSessionToken()
      }
      const { suggestions: out } =
        await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          includedRegionCodes: ['us'],
          sessionToken: sessionToken.current,
        })
      const preds = (out || []).map((s: any) => s.placePrediction).filter(Boolean)
      console.log('[ADDR] got', preds.length, 'predictions')
      setSuggestions(preds)
      setOpen(preds.length > 0)
      setActive(-1)
    } catch (err) {
      // Most likely an expired/over-used session token. Discard it so the next
      // keystroke retries with a fresh one — self-heals without a remount.
      sessionToken.current = null
      setSuggestions([])
      setOpen(false)
      console.warn('Address autocomplete request failed; resetting session.', err)
    }
  }

  function handleInput(v: string) {
    console.log('[ADDR] handleInput:', JSON.stringify(v))
    onChange(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => fetchSuggestions(v), 200)
  }

  async function choose(pred: any) {
    setOpen(false)
    setSuggestions([])
    try {
      const place = pred.toPlace()
      await place.fetchFields({ fields: ['addressComponents'] })
      const comp = place.addressComponents || []
      const get = (t: string) => comp.find((c: any) => c.types.includes(t))
      const streetNum = get('street_number')?.longText || ''
      const route = get('route')?.longText || ''
      onSelect({
        address: [streetNum, route].filter(Boolean).join(' '),
        // Prefer the neighborhood/district (e.g. "North Hollywood") over the
        // incorporated city ("Los Angeles") since deliveries go by area.
        city:
          get('neighborhood')?.longText ||
          get('sublocality_level_1')?.longText ||
          get('sublocality')?.longText ||
          get('postal_town')?.longText ||
          get('locality')?.longText ||
          '',
        state: get('administrative_area_level_1')?.shortText || '',
        zip: get('postal_code')?.longText || '',
      })
    } catch {
      // Details fetch failed — keep the text the customer picked.
      const txt = pred?.text?.text || ''
      if (txt) onChange(txt)
    }
    // Selection ends the billing session; start fresh next time.
    sessionToken.current = null
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      choose(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">Loading suggestions…</li>
          )}
          {suggestions.map((p, i) => (
            <li
              key={i}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(p)
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? 'bg-gray-100' : ''
              }`}
            >
              {p?.text?.text || ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
