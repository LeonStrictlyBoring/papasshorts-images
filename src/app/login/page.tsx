'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import Link from 'next/link'

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'users', credential.user.uid))
      const status = snap.exists() ? snap.data().status : null

      if (status === 'pending') {
        await signOut(auth)
        setError('Dein Konto wartet noch auf Freischaltung.')
        setLoading(false)
        return
      }
      if (status !== 'active') {
        await signOut(auth)
        setError('Dein Konto ist nicht aktiv. Wende dich an einen Administrator.')
        setLoading(false)
        return
      }
      // active: AppShell redirect fires via onAuthStateChanged
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('E-Mail oder Passwort falsch.')
      } else if (code === 'auth/too-many-requests') {
        setError('Zu viele fehlgeschlagene Versuche. Bitte warte kurz oder setze dein Passwort zurück.')
      } else {
        setError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-navy">Anmelden</h1>
          <p className="text-navy/50 text-sm mt-1">Melde dich mit deiner E-Mail-Adresse an.</p>
        </div>

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

          <div>
            <label className="block text-sm font-medium text-navy mb-1" htmlFor="password">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>

        <div className="text-center text-sm space-y-2">
          <p>
            <Link href="/forgot-password" className="text-orange hover:text-orange/80">
              Passwort vergessen?
            </Link>
          </p>
          <p className="text-navy/50">
            Noch kein Konto?{' '}
            <Link href="/register" className="text-orange hover:text-orange/80">
              Registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
