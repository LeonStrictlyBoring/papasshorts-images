'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, query, orderBy, getDocs, doc, writeBatch, Timestamp, updateDoc } from 'firebase/firestore'
import { ref, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'

async function downloadImage(url: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = 'shooting.jpg'
    a.click()
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

interface Shooting {
  id: string
  imageUrl: string
  storagePath?: string
  models: string[]
  setting: string
  artikel: { produktname: string; artikelId: string }[]
  createdAt: Timestamp
  createdBy: string
  archived?: boolean
}

type SortKey = 'setting' | 'createdAt' | 'createdBy'
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

export default function ShootingsPage() {
  const [shootings, setShootings] = useState<Shooting[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterCreator, setFilterCreator] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [zoomShooting, setZoomShooting] = useState<Shooting | null>(null)

  useEffect(() => {
    if (!zoomShooting) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setZoomShooting(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomShooting])

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'shootings'), orderBy('createdAt', 'desc')))
        setShootings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shooting)).filter(s => !s.archived))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const creators = useMemo(() => [...new Set(shootings.map(s => s.createdBy))].sort(), [shootings])

  const filtered = useMemo(() => {
    let list = shootings
    if (filterCreator) list = list.filter(s => s.createdBy === filterCreator)
    if (filterFrom) { const f = new Date(filterFrom); list = list.filter(s => s.createdAt.toDate() >= f) }
    if (filterTo) { const t = new Date(filterTo); t.setHours(23,59,59,999); list = list.filter(s => s.createdAt.toDate() <= t) }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'setting') cmp = (a.setting || '').localeCompare(b.setting || '')
      else if (sortKey === 'createdAt') cmp = a.createdAt.toMillis() - b.createdAt.toMillis()
      else cmp = a.createdBy.localeCompare(b.createdBy)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [shootings, filterCreator, filterFrom, filterTo, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      for (const id of Array.from(selected)) batch.update(doc(db, 'shootings', id), { archived: true })
      await batch.commit()
      setShootings(prev => prev.filter(s => !selected.has(s.id)))
      setSelected(new Set()); setDeleteDialogOpen(false)
    } finally { setDeleting(false) }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-navy">Shootings</h1>
        <Link href="/shootings/create"
          className="flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-orange/90 transition-colors">
          + Shooting erstellen
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
            className="text-sm text-navy/50 hover:text-navy transition-colors pb-2">Filter zurücksetzen</button>
        )}
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 bg-orange/10 border border-orange/20 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-navy">{selected.size} Shot{selected.size !== 1 ? 's' : ''} ausgewählt</span>
          <button type="button" onClick={() => setDeleteDialogOpen(true)}
            className="text-sm font-semibold text-white bg-navy px-4 py-1.5 rounded-md hover:bg-navy/90 transition-colors">Löschen</button>
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-sm text-navy/50 hover:text-navy transition-colors">Auswahl aufheben</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-navy/60">
          <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Shootings werden geladen …</span>
        </div>
      )}
      {!loading && shootings.length === 0 && <p className="text-navy/50 text-sm">Noch keine Shots gespeichert.</p>}
      {!loading && shootings.length > 0 && filtered.length === 0 && <p className="text-navy/50 text-sm">Keine Shots gefunden. Filter anpassen?</p>}

      {!loading && filtered.length > 0 && (
        <div className="border border-navy/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-navy/5 border-b border-navy/10">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="w-4 h-4 accent-orange" />
                </th>
                <th className="w-16 px-2 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">Model(s)</th>
                <th className="px-4 py-3 text-left">
                  <SortButton label="Setting" active={sortKey === 'setting'} dir={sortDir} onClick={() => toggleSort('setting')} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">Artikel</th>
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
                <tr key={s.id} className={`transition-colors ${selected.has(s.id) ? 'bg-orange/5' : 'hover:bg-navy/[0.02]'}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="w-4 h-4 accent-orange" />
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => setZoomShooting(s)}
                      className="w-12 h-12 rounded-md overflow-hidden border border-navy/10 bg-navy/5 hover:ring-2 hover:ring-orange transition-all block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt="" className="w-full h-full object-cover"
                        onError={async (e) => {
                          if (!s.storagePath) return
                          try {
                            const fresh = await getDownloadURL(ref(storage, s.storagePath))
                            e.currentTarget.src = fresh
                            await updateDoc(doc(db, 'shootings', s.id), { imageUrl: fresh })
                          } catch { /* silent */ }
                        }} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-navy">{(s.models || []).join(', ') || '–'}</td>
                  <td className="px-4 py-3 text-sm text-navy">{s.setting || '–'}</td>
                  <td className="px-4 py-3 text-sm text-navy/60">
                    {(s.artikel || []).map(a => `${a.produktname} (${a.artikelId})`).join(', ') || '–'}
                  </td>
                  <td className="px-4 py-3 text-sm text-navy/60 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-navy/60">{s.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Zoom modal */}
      {zoomShooting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setZoomShooting(null)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setZoomShooting(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-lg leading-none">
              ×
            </button>

            <div className="p-6 flex gap-6 h-full">
              {/* Bild */}
              <div className="flex-1 min-w-0 h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={zoomShooting.imageUrl} alt="Shooting" className="w-full h-full rounded-lg object-contain object-left" />
              </div>

              {/* Details + Download, unten bündig */}
              <div className="w-80 shrink-0 flex flex-col justify-end gap-4">
                <div className="space-y-2">
                  {[
                    { label: 'Model(s)', value: (zoomShooting.models || []).join(', ') || '–' },
                    { label: 'Setting',  value: zoomShooting.setting || '–' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">{label}</span>
                      <p className="text-sm text-navy mt-0.5">{value}</p>
                    </div>
                  ))}
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">Artikel</span>
                    <p className="text-sm text-navy mt-0.5">
                      {(zoomShooting.artikel || []).length > 0
                        ? (zoomShooting.artikel || []).map(a => `${a.produktname} (${a.artikelId})`).join(', ')
                        : '–'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">Erstellt</span>
                    <p className="text-sm text-navy/60 mt-0.5">{formatDate(zoomShooting.createdAt)} von {zoomShooting.createdBy}</p>
                  </div>
                </div>

                <button type="button" onClick={() => downloadImage(zoomShooting.imageUrl)}
                  className="flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-orange/90 transition-colors w-full justify-center">
                  ↓ Bild herunterladen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">{selected.size} Shot{selected.size !== 1 ? 's' : ''} löschen?</p>
            <p className="text-sm text-navy/60">{selected.size === 1 ? 'Der Shot wird' : 'Die Shots werden'} ausgeblendet und {selected.size === 1 ? 'ist' : 'sind'} nicht mehr sichtbar.</p>
            <div className="flex gap-3">
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-navy text-white font-semibold py-2 rounded-md hover:bg-navy/90 transition-colors disabled:opacity-50">
                {deleting ? 'Wird gelöscht …' : 'Löschen'}
              </button>
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}
                className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
