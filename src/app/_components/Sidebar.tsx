'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'

interface NavItem {
  label: string
  href: string
  indent?: boolean
  requiresAdmin?: boolean
  requiresDeveloper?: boolean
  visibleWhen?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Models', href: '/models' },
  { label: 'Model erstellen', href: '/models/create', indent: true, visibleWhen: '/models' },
  { label: 'Artikel', href: '/artikel' },
  { label: 'Settings', href: '/settings' },
  { label: 'Setting erstellen', href: '/settings/create', indent: true, visibleWhen: '/settings' },
  { label: 'Shootings', href: '/shootings' },
  { label: 'Shooting erstellen', href: '/shootings/create', indent: true, visibleWhen: '/shootings' },
  { label: 'Profil', href: '/profil' },
  { label: 'Nutzerverwaltung', href: '/profil/nutzerverwaltung', indent: true, requiresAdmin: true },
  { label: 'Prompts', href: '/profil/prompts', indent: true, requiresDeveloper: true },
  { label: 'Fehler-Log', href: '/profil/error-logs', indent: true, requiresDeveloper: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isAdmin, isDeveloper } = useAuth()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (href === '/models') return pathname === '/models'
    if (href === '/settings') return pathname === '/settings'
    if (href === '/shootings') return pathname === '/shootings'
    return pathname.startsWith(href)
  }

  const visibleItems = navItems.filter((item) => {
    if (item.requiresDeveloper && !isDeveloper) return false
    if (item.requiresAdmin && !isAdmin) return false
    if (item.visibleWhen && !pathname.startsWith(item.visibleWhen)) return false
    return true
  })

  return (
    <aside className="w-56 bg-navy flex-none flex flex-col overflow-y-auto">
      <nav className="flex-1 pt-16 pb-4">
        <ul>
          {visibleItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center py-3 text-sm font-medium transition-colors border-l-4 ${
                  item.indent ? 'px-10' : 'px-6'
                } ${
                  isActive(item.href)
                    ? 'bg-white/10 text-white border-orange'
                    : 'text-white/60 hover:bg-white/5 hover:text-white border-transparent'
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
