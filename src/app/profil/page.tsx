'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

const ROLE_LABELS: Record<string, string> = {
  user: 'Nutzer',
  admin: 'Admin',
  developer: 'Developer',
}

export default function ProfilPage() {
  const { user, userDoc } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await signOut(auth)
    router.replace('/login')
  }

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-2xl font-bold text-navy">Profil</h1>

      <div className="bg-white border border-navy/10 rounded-lg divide-y divide-navy/10">
        <Row label="Name" value={userDoc?.name ?? '—'} />
        <Row label="E-Mail" value={user?.email ?? '—'} />
        <Row label="Rolle" value={ROLE_LABELS[userDoc?.role ?? ''] ?? '—'} />
      </div>

      <button
        onClick={handleLogout}
        className="bg-orange text-white font-semibold px-5 py-2 rounded-md hover:bg-orange/90 transition-colors text-sm"
      >
        Abmelden
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center px-4 py-3 gap-4">
      <span className="text-sm text-navy/50 w-24 flex-none">{label}</span>
      <span className="text-sm text-navy font-medium">{value}</span>
    </div>
  )
}
