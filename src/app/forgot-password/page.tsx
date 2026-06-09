'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`,
      })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/user-not-found') {
        setError('Ein Fehler ist aufgetreten. Bitte versuche es erneut.')
        setLoading(false)
        return
      }
    }
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-navy">Passwort zurücksetzen</h1>
          <p className="text-navy/50 text-sm mt-1">Gib deine E-Mail-Adresse ein und wir senden dir einen Reset-Link.</p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm text-navy">
              Falls diese E-Mail-Adresse registriert ist, wurde ein Reset-Link versendet. Bitte prüfe dein Postfach.
            </p>
            <Link href="/login" className="block text-sm text-orange hover:text-orange/80">
              ← Zurück zum Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1" htmlFor="email">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputCls}
                placeholder="name@beispiel.de"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Wird gesendet …' : 'Reset-Link senden'}
            </button>

            <p className="text-center text-sm">
              <Link href="/login" className="text-orange hover:text-orange/80">
                ← Zurück zum Login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
