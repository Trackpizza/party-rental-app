'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.replace('/admin')
    } catch (err: any) {
      setError('Incorrect email or password.')
      setBusy(false)
    }
  }

  async function handleReset() {
    setError('')
    setNotice('')
    if (!email.trim()) {
      setError('Enter your email above first, then tap “Forgot password?”.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setNotice(`Reset link sent to ${email.trim()}. Check your inbox (and spam).`)
    } catch (err: any) {
      setError('Could not send the reset email. Check the address and try again.')
    }
  }

  const business = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Party Rentals'

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold text-brand">{business}</h1>
        <p className="mt-1 text-sm text-gray-500">Staff sign in</p>

        <label className="mt-6 block text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {notice && <p className="mt-3 text-sm text-green-600">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="mt-4 block w-full text-center text-sm text-gray-500 underline hover:text-brand"
        >
          Forgot password?
        </button>
      </form>
    </main>
  )
}
