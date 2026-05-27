'use client'

import { createContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

export interface UserDoc {
  name: string
  email: string
  role: 'user' | 'admin' | 'developer'
  status: 'pending' | 'active' | 'inactive'
  createdAt: unknown
}

export interface AuthContextValue {
  user: User | null
  userDoc: UserDoc | null
  loading: boolean
  isAdmin: boolean
  isDeveloper: boolean
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  userDoc: null,
  loading: true,
  isAdmin: false,
  isDeveloper: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setUser(firebaseUser)
        setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null)
      } else {
        setUser(null)
        setUserDoc(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const isAdmin = userDoc?.role === 'admin' || userDoc?.role === 'developer'
  const isDeveloper = userDoc?.role === 'developer'

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, isAdmin, isDeveloper }}>
      {children}
    </AuthContext.Provider>
  )
}
