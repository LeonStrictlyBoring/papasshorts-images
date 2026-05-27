'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import Link from 'next/link'

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setLoading(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, { displayName: name })
      await setDoc(doc(db, 'users', credential.user.uid), {
        name,
        email,
        role: 'user',
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      await signOut(auth)
      setSuccess(true)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('Diese E-Mail-Adresse ist bereits registriert.')
      } else if (code === 'auth/weak-password') {
        setError('Bitte wähle ein stärkeres Passwort.')
      } else {
        setError('Registrierung fehlgeschlagen. Bitte versuche es erneut.')
      }
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-navy">Konto erstellt</h1>
            <p className="text-navy/60 text-sm leading-relaxed">
              Dein Konto wurde erfolgreich angelegt. Du erhältst Zugang, sobald ein Administrator dich freigeschaltet hat.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block bg-orange text-white font-semibold px-6 py-2 rounded-md hover:bg-orange/90 transition-colors text-sm"
          >
            Zum Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-navy">Registrieren</h1>
          <p className="text-navy/50 text-sm mt-1">Erstelle ein neues Konto.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
              placeholder="Max Mustermann"
            />
          </div>

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
              Passwort <span className="text-navy/40 font-normal">(min. 8 Zeichen)</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1" htmlFor="passwordConfirm">
              Passwort bestätigen
            </label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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
            {loading ? 'Konto erstellen …' : 'Konto erstellen'}
          </button>
        </form>

        <p className="text-center text-sm text-navy/50">
          Bereits registriert?{' '}
          <Link href="/login" className="text-orange hover:text-orange/80">
            Zum Login
          </Link>
        </p>
      </div>
    </div>
  )
}
