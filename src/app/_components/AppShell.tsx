'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import Header from './Header'
import Sidebar from './Sidebar'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, userDoc, loading, isAdmin, isDeveloper } = useAuth()
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (loading) return

    if (isPublic) {
      if (user && userDoc?.status === 'active') {
        router.replace('/')
      }
      return
    }

    if (!user) {
      router.replace('/login')
      return
    }
    if (!userDoc || userDoc.status !== 'active') {
      router.replace('/login')
      return
    }
    if (pathname.startsWith('/profil/prompts') && !isDeveloper) {
      router.replace('/')
      return
    }
    if (pathname.startsWith('/profil/nutzerverwaltung') && !isAdmin) {
      router.replace('/')
    }
  }, [loading, user, userDoc, pathname, isPublic, isAdmin, isDeveloper, router])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isPublic) {
    if (user && userDoc?.status === 'active') return null
    return <>{children}</>
  }

  if (!user || !userDoc || userDoc.status !== 'active') return null
  if (pathname.startsWith('/profil/prompts') && !isDeveloper) return null
  if (pathname.startsWith('/profil/nutzerverwaltung') && !isAdmin) return null

  return (
    <>
      <Header />
      <div className="absolute top-2 left-28 -translate-x-1/2 z-20 w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md">
        <img src="/Logo-papasshorts.png" alt="Papas Shorts" className="w-full h-full object-cover" />
      </div>
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white pt-[69px] px-8 pb-8">
          {children}
        </main>
      </div>
    </>
  )
}
