'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, query, orderBy, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface Setting {
  id: string
  imageUrl: string
  name: string
  createdAt: Timestamp
  createdBy: string
  archived?: boolean
}

type SortKey = 'name' | 'createdAt' | 'createdBy'
type SortDir = 'asc' | 'desc'

function formatDate(ts: Timestamp): string {
  const d = ts.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${active ? 'text-orange' : 'text-navy/50 hover:text-navy'}`}>
      {label}
      <span className="text-[10px]">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterCreator, setFilterCreator] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'settings'), orderBy('createdAt', 'desc')))
        setSettings(
          snap.docs.map(d => ({ id: d.id, ...d.data() } as Setting)).filter(s => !s.archived)
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const creators = useMemo(() => [...new Set(settings.map(s => s.createdBy))].sort(), [settings])

  const filtered = useMemo(() => {
    let list = settings
    if (filterCreator) list = list.filter(s => s.createdBy === filterCreator)
    if (filterFrom) {
      const from = new Date(filterFrom)
      list = list.filter(s => s.createdAt.toDate() >= from)
    }
    if (filterTo) {
      const to = new Date(filterTo)
      to.setHours(23, 59, 59, 999)
      list = list.filter(s => s.createdAt.toDate() <= to)
    }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'createdAt') cmp = a.createdAt.toMillis() - b.createdAt.toMillis()
      else cmp = a.createdBy.localeCompare(b.createdBy)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [settings, filterCreator, filterFrom, filterTo, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      for (const id of Array.from(selected)) {
        batch.update(doc(db, 'settings', id), { archived: true })
      }
      await batch.commit()
      setSettings(prev => prev.filter(s => !selected.has(s.id)))
      setSelected(new Set())
      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-navy">Settings</h1>
        <Link href="/settings/create"
          className="flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-orange/90 transition-colors">
          + Setting erstellen
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Ersteller</span>
          <select value={filterCreator} onChange={e => setFilterCreator(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange">
            <option value="">Alle</option>
            {creators.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Von</span>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Bis</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange" />
        </div>
        {(filterCreator || filterFrom || filterTo) && (
          <button type="button" onClick={() => { setFilterCreator(''); setFilterFrom(''); setFilterTo('') }}
            className="text-sm text-navy/50 hover:text-navy transition-colors pb-2">
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 bg-orange/10 border border-orange/20 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-navy">
            {selected.size} {selected.size === 1 ? 'Setting' : 'Settings'} ausgewählt
          </span>
          <button type="button" onClick={() => setDeleteDialogOpen(true)}
            className="text-sm font-semibold text-white bg-navy px-4 py-1.5 rounded-md hover:bg-navy/90 transition-colors">
            Löschen
          </button>
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-sm text-navy/50 hover:text-navy transition-colors">
            Auswahl aufheben
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-navy/60">
          <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Settings werden geladen …</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && settings.length === 0 && (
        <p className="text-navy/50 text-sm">Noch keine Settings vorhanden. Erstelle dein erstes Setting.</p>
      )}

      {/* No filter results */}
      {!loading && settings.length > 0 && filtered.length === 0 && (
        <p className="text-navy/50 text-sm">Keine Settings gefunden. Filter anpassen?</p>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="border border-navy/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-navy/5 border-b border-navy/10">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-orange" />
                </th>
                <th className="w-16 px-2 py-3" />
                <th className="px-4 py-3 text-left">
                  <SortButton label="Titel" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortButton label="Erstellt" active={sortKey === 'createdAt'} dir={sortDir} onClick={() => toggleSort('createdAt')} />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortButton label="Ersteller" active={sortKey === 'createdBy'} dir={sortDir} onClick={() => toggleSort('createdBy')} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filtered.map(s => (
                <tr key={s.id}
                  className={`transition-colors ${selected.has(s.id) ? 'bg-orange/5' : 'hover:bg-navy/[0.02]'}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)}
                      className="w-4 h-4 accent-orange" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="w-12 h-12 rounded-md overflow-hidden border border-navy/10 bg-navy/5 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-navy">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-navy/60 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-navy/60">{s.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">
              {selected.size} {selected.size === 1 ? 'Setting' : 'Settings'} löschen?
            </p>
            <p className="text-sm text-navy/60">
              {selected.size === 1 ? 'Das Setting' : 'Die Settings'} {selected.size === 1 ? 'wird' : 'werden'} ausgeblendet und {selected.size === 1 ? 'ist' : 'sind'} nicht mehr sichtbar.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-navy text-white font-semibold py-2 rounded-md hover:bg-navy/90 transition-colors disabled:opacity-50">
                {deleting ? 'Wird gelöscht …' : 'Löschen'}
              </button>
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}
                className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
