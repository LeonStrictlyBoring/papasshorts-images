'use client'

import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

export default function Header() {
  const { userDoc } = useAuth()

  async function handleLogout() {
    await signOut(auth)
  }

  return (
    <header className="h-14 bg-light-gray flex items-center justify-end px-6 flex-none">
      <div className="flex items-center gap-4 text-navy text-sm">
        <span className="opacity-60">{userDoc?.name ?? ''}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer font-medium"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
