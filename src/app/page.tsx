'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'

const TILES = [
  { href: '/models', label: 'Models', description: 'Hier findest Du alle Models und kannst neue erschaffen.' },
  { href: '/artikel', label: 'Artikel', description: 'Lade Fotos der Kleidungsstücke für die Shootings hoch.' },
  { href: '/settings', label: 'Settings', description: 'Erschaffe und verwalte Hintergründe für die Shootings.' },
  { href: '/shootings', label: 'Shootings', description: 'Kombiniere Models, Artikel und Settings zu fertigen Bildern.' },
]

export default function DashboardPage() {
  const { userDoc } = useAuth()
  const name = userDoc?.name ?? ''

  return (
    <div>
      <h1 className="text-3xl font-bold text-navy mb-1">
        Hallo{name ? `, ${name}` : ''}
      </h1>
      <p className="text-navy/50 mb-10">Willkommen in Papas Shorts&apos; AI-Shooting</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group block rounded-xl border border-navy/15 bg-white p-6 hover:border-orange hover:shadow-sm transition-all"
          >
            <h2 className="text-lg font-semibold text-navy group-hover:text-orange transition-colors">
              {tile.label}
            </h2>
            <p className="text-sm text-navy/50 mt-1">{tile.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
