'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, query, orderBy, getDocs, doc, addDoc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, auth } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

const KATEGORIEN = [
  'Jogger', 'Stoffhose', 'Jeans', 'Chino', 'Flex Chino', 'Smart Chino',
  'Sommer Shorts', 'Boxer Shorts', 'Retro Shorts', 'Sporthose', 'Badehose',
  'T-Shirt', 'Socken',
]

const ANSICHTEN = ['Vorderansicht', 'Rückansicht', 'Seitenansicht links', 'Seitenansicht rechts', 'Detail']
const MAX_BILDER = 10

interface ArtikelBild { url: string; storagePath: string; ansicht: string }
interface Artikel {
  id: string
  bilder: ArtikelBild[]
  produktname: string
  artikelId: string
  kategorie: string
  beschreibung: string
  createdAt: Timestamp
  createdBy: string
  archived?: boolean
}

interface PendingBild { localId: string; file: File | null; preview: string | null; ansicht: string }
interface EditBild { localId: string; url?: string; storagePath?: string; file?: File; preview?: string; ansicht: string }

type SortKey = 'produktname' | 'artikelId' | 'kategorie' | 'createdAt' | 'createdBy'
type SortDir = 'asc' | 'desc'

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full text-sm'
const selectCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange w-full text-sm'

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

function validateFile(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Nur JPG, PNG und WebP sind erlaubt.'
  if (file.size > 10 * 1024 * 1024) return 'Datei zu groß. Maximal 10 MB erlaubt.'
  return null
}

export default function ArtikelPage() {
  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterKategorie, setFilterKategorie] = useState('')
  const [filterCreator, setFilterCreator] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Anlegen modal
  const [anlegenOpen, setAnlegenOpen] = useState(false)
  const [anlegenProduktname, setAnlegenProduktname] = useState('')
  const [anlegenArtikelId, setAnlegenArtikelId] = useState('')
  const [anlegenKategorie, setAnlegenKategorie] = useState('')
  const [anlegenBeschreibung, setAnlegenBeschreibung] = useState('')
  const [pendingBilder, setPendingBilder] = useState<PendingBild[]>([{ localId: '1', file: null, preview: null, ansicht: '' }])
  const [anlegenSaving, setAnlegenSaving] = useState(false)
  const [anlegenError, setAnlegenError] = useState<string | null>(null)

  // Bearbeiten modal
  const [editArtikel, setEditArtikel] = useState<Artikel | null>(null)
  const [editProduktname, setEditProduktname] = useState('')
  const [editArtikelId, setEditArtikelId] = useState('')
  const [editKategorie, setEditKategorie] = useState('')
  const [editBeschreibung, setEditBeschreibung] = useState('')
  const [editBilder, setEditBilder] = useState<EditBild[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Zoom modal
  const [zoomArtikel, setZoomArtikel] = useState<Artikel | null>(null)
  const [zoomIdx, setZoomIdx] = useState(0)

  const { userDoc } = useAuth()
  const anlegenFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const editFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'artikel'), orderBy('createdAt', 'desc')))
        setArtikel(snap.docs.map(d => ({ id: d.id, ...d.data() } as Artikel)).filter(a => !a.archived))
      } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!zoomArtikel) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setZoomArtikel(null)
      if (e.key === 'ArrowRight') setZoomIdx(i => Math.min(i + 1, (zoomArtikel!.bilder?.length ?? 1) - 1))
      if (e.key === 'ArrowLeft') setZoomIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomArtikel])

  const creators = useMemo(() => [...new Set(artikel.map(a => a.createdBy))].sort(), [artikel])

  const filtered = useMemo(() => {
    let list = artikel
    if (filterKategorie) list = list.filter(a => a.kategorie === filterKategorie)
    if (filterCreator) list = list.filter(a => a.createdBy === filterCreator)
    if (filterFrom) { const from = new Date(filterFrom); list = list.filter(a => a.createdAt.toDate() >= from) }
    if (filterTo) { const to = new Date(filterTo); to.setHours(23, 59, 59, 999); list = list.filter(a => a.createdAt.toDate() <= to) }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'produktname') cmp = a.produktname.localeCompare(b.produktname)
      else if (sortKey === 'artikelId') cmp = a.artikelId.localeCompare(b.artikelId)
      else if (sortKey === 'kategorie') cmp = a.kategorie.localeCompare(b.kategorie)
      else if (sortKey === 'createdAt') cmp = a.createdAt.toMillis() - b.createdAt.toMillis()
      else cmp = a.createdBy.localeCompare(b.createdBy)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [artikel, filterKategorie, filterCreator, filterFrom, filterTo, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set())
    else setSelected(new Set(filtered.map(a => a.id)))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      for (const id of Array.from(selected)) batch.update(doc(db, 'artikel', id), { archived: true })
      await batch.commit()
      setArtikel(prev => prev.filter(a => !selected.has(a.id)))
      setSelected(new Set()); setDeleteDialogOpen(false)
    } finally { setDeleting(false) }
  }

  // ── Anlegen modal helpers ──────────────────────────────────────────────────

  function resetAnlegen() {
    setAnlegenProduktname(''); setAnlegenArtikelId(''); setAnlegenKategorie(''); setAnlegenBeschreibung('')
    setPendingBilder([{ localId: '1', file: null, preview: null, ansicht: '' }])
    setAnlegenError(null)
  }

  function addPendingBild() {
    if (pendingBilder.length >= MAX_BILDER) return
    setPendingBilder(prev => [...prev, { localId: Date.now().toString(), file: null, preview: null, ansicht: '' }])
  }

  function removePendingBild(localId: string) {
    setPendingBilder(prev => {
      const next = prev.filter(b => b.localId !== localId)
      if (next.length === 0) return [{ localId: Date.now().toString(), file: null, preview: null, ansicht: '' }]
      return next
    })
    if (anlegenFileRefs.current[localId]) {
      anlegenFileRefs.current[localId]!.value = ''
    }
  }

  function handlePendingFileSelect(localId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateFile(file)
    if (err) { setAnlegenError(err); return }
    setAnlegenError(null)
    setPendingBilder(prev => prev.map(b => {
      if (b.localId !== localId) return b
      if (b.preview) URL.revokeObjectURL(b.preview)
      return { ...b, file, preview: URL.createObjectURL(file) }
    }))
  }

  function handlePendingAnsicht(localId: string, ansicht: string) {
    setPendingBilder(prev => prev.map(b => b.localId === localId ? { ...b, ansicht } : b))
  }

  async function handleAnlegen() {
    if (!anlegenProduktname.trim()) { setAnlegenError('Produktname ist ein Pflichtfeld.'); return }
    if (!anlegenArtikelId.trim()) { setAnlegenError('ID ist ein Pflichtfeld.'); return }
    if (!anlegenKategorie) { setAnlegenError('Bitte eine Kategorie wählen.'); return }
    const filled = pendingBilder.filter(b => b.file)
    if (filled.length === 0) { setAnlegenError('Mindestens ein Bild ist erforderlich.'); return }
    if (filled.some(b => !b.ansicht)) { setAnlegenError('Bitte für jedes Bild eine Ansicht wählen.'); return }
    setAnlegenSaving(true); setAnlegenError(null)
    try {
      const userId = auth.currentUser?.uid ?? 'unbekannt'
      const timestamp = Date.now()
      const bilder: ArtikelBild[] = []
      for (const b of filled) {
        const storagePath = `artikel/${userId}/${timestamp}/${b.file!.name}`
        const storageRef = ref(storage, storagePath)
        await uploadBytes(storageRef, b.file!)
        const url = await getDownloadURL(storageRef)
        bilder.push({ url, storagePath, ansicht: b.ansicht })
      }
      const now = Timestamp.now()
      const docRef = await addDoc(collection(db, 'artikel'), {
        bilder,
        produktname: anlegenProduktname.trim(),
        artikelId: anlegenArtikelId.trim(),
        kategorie: anlegenKategorie,
        beschreibung: anlegenBeschreibung.trim(),
        createdAt: now,
        createdBy: userDoc?.name ?? 'Unbekannt',
      })
      setArtikel(prev => [{
        id: docRef.id, bilder,
        produktname: anlegenProduktname.trim(), artikelId: anlegenArtikelId.trim(),
        kategorie: anlegenKategorie, beschreibung: anlegenBeschreibung.trim(),
        createdAt: now, createdBy: userDoc?.name ?? 'Unbekannt',
      }, ...prev])
      resetAnlegen(); setAnlegenOpen(false)
    } catch {
      setAnlegenError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally { setAnlegenSaving(false) }
  }

  // ── Bearbeiten modal helpers ───────────────────────────────────────────────

  function openEdit(a: Artikel) {
    setEditArtikel(a)
    setEditProduktname(a.produktname)
    setEditArtikelId(a.artikelId)
    setEditKategorie(a.kategorie)
    setEditBeschreibung(a.beschreibung ?? '')
    setEditBilder((a.bilder ?? []).map(b => ({ localId: b.storagePath, url: b.url, storagePath: b.storagePath, ansicht: b.ansicht })))
    setEditError(null)
  }

  function removeEditBild(localId: string) {
    setEditBilder(prev => prev.filter(b => b.localId !== localId))
  }

  function handleEditFileSelect(localId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateFile(file)
    if (err) { setEditError(err); return }
    setEditError(null)
    setEditBilder(prev => prev.map(b => {
      if (b.localId !== localId) return b
      if (b.preview) URL.revokeObjectURL(b.preview)
      return { ...b, file, preview: URL.createObjectURL(file) }
    }))
  }

  function addEditBild() {
    if (editBilder.length >= MAX_BILDER) return
    setEditBilder(prev => [...prev, { localId: `new-${Date.now()}`, ansicht: '' }])
  }

  async function handleEditSave() {
    if (!editArtikel) return
    if (!editProduktname.trim()) { setEditError('Produktname ist ein Pflichtfeld.'); return }
    if (!editArtikelId.trim()) { setEditError('ID ist ein Pflichtfeld.'); return }
    if (!editKategorie) { setEditError('Bitte eine Kategorie wählen.'); return }
    if (editBilder.length === 0) { setEditError('Mindestens ein Bild ist erforderlich.'); return }
    if (editBilder.some(b => !b.ansicht)) { setEditError('Bitte für jedes Bild eine Ansicht wählen.'); return }
    setEditSaving(true); setEditError(null)
    try {
      const userId = auth.currentUser?.uid ?? 'unbekannt'
      const timestamp = Date.now()
      const bilder: ArtikelBild[] = []
      for (const b of editBilder) {
        if (b.file) {
          const storagePath = `artikel/${userId}/${timestamp}/${b.file.name}`
          const storageRef = ref(storage, storagePath)
          await uploadBytes(storageRef, b.file)
          const url = await getDownloadURL(storageRef)
          bilder.push({ url, storagePath, ansicht: b.ansicht })
        } else if (b.url && b.storagePath) {
          bilder.push({ url: b.url, storagePath: b.storagePath, ansicht: b.ansicht })
        }
      }
      await updateDoc(doc(db, 'artikel', editArtikel.id), {
        bilder,
        produktname: editProduktname.trim(),
        artikelId: editArtikelId.trim(),
        kategorie: editKategorie,
        beschreibung: editBeschreibung.trim(),
      })
      setArtikel(prev => prev.map(a => a.id === editArtikel.id
        ? { ...a, bilder, produktname: editProduktname.trim(), artikelId: editArtikelId.trim(), kategorie: editKategorie, beschreibung: editBeschreibung.trim() }
        : a))
      setEditArtikel(null)
    } catch {
      setEditError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally { setEditSaving(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-navy">Artikel</h1>
        <button type="button" onClick={() => { resetAnlegen(); setAnlegenOpen(true) }}
          className="flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-orange/90 transition-colors">
          + Artikel anlegen
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Kategorie</span>
          <select value={filterKategorie} onChange={e => setFilterKategorie(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange">
            <option value="">Alle</option>
            {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
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
        {(filterKategorie || filterCreator || filterFrom || filterTo) && (
          <button type="button" onClick={() => { setFilterKategorie(''); setFilterCreator(''); setFilterFrom(''); setFilterTo('') }}
            className="text-sm text-navy/50 hover:text-navy transition-colors pb-2">Filter zurücksetzen</button>
        )}
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 bg-orange/10 border border-orange/20 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-navy">{selected.size} Artikel ausgewählt</span>
          <button type="button" onClick={() => setDeleteDialogOpen(true)}
            className="text-sm font-semibold text-white bg-navy px-4 py-1.5 rounded-md hover:bg-navy/90 transition-colors">Löschen</button>
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-sm text-navy/50 hover:text-navy transition-colors">Auswahl aufheben</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-navy/60">
          <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Artikel werden geladen …</span>
        </div>
      )}
      {!loading && artikel.length === 0 && <p className="text-navy/50 text-sm">Noch keine Artikel vorhanden.</p>}
      {!loading && artikel.length > 0 && filtered.length === 0 && <p className="text-navy/50 text-sm">Keine Artikel gefunden. Filter anpassen?</p>}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="border border-navy/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-navy/5 border-b border-navy/10">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="w-4 h-4 accent-orange" />
                </th>
                <th className="w-16 px-2 py-3" />
                <th className="px-4 py-3 text-left"><SortButton label="Produktname" active={sortKey === 'produktname'} dir={sortDir} onClick={() => toggleSort('produktname')} /></th>
                <th className="px-4 py-3 text-left"><SortButton label="ID" active={sortKey === 'artikelId'} dir={sortDir} onClick={() => toggleSort('artikelId')} /></th>
                <th className="px-4 py-3 text-left"><SortButton label="Kategorie" active={sortKey === 'kategorie'} dir={sortDir} onClick={() => toggleSort('kategorie')} /></th>
                <th className="px-4 py-3 text-left"><SortButton label="Erstellt" active={sortKey === 'createdAt'} dir={sortDir} onClick={() => toggleSort('createdAt')} /></th>
                <th className="px-4 py-3 text-left"><SortButton label="Ersteller" active={sortKey === 'createdBy'} dir={sortDir} onClick={() => toggleSort('createdBy')} /></th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filtered.map(a => (
                <tr key={a.id} className={`transition-colors ${selected.has(a.id) ? 'bg-orange/5' : 'hover:bg-navy/[0.02]'}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="w-4 h-4 accent-orange" />
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => { setZoomArtikel(a); setZoomIdx(0) }}
                      className="w-12 h-12 rounded-md overflow-hidden border border-navy/10 bg-navy/5 shrink-0 hover:ring-2 hover:ring-orange transition-all block relative">
                      {a.bilder?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.bilder[0].url} alt={a.produktname} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-navy/20 text-xs flex items-center justify-center h-full">–</span>
                      )}
                      {(a.bilder?.length ?? 0) > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 bg-black/50 text-white text-[9px] rounded px-0.5 leading-tight">{a.bilder.length}</span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-navy">{a.produktname}</td>
                  <td className="px-4 py-3 text-sm text-navy/70 font-mono">{a.artikelId}</td>
                  <td className="px-4 py-3 text-sm text-navy/70">{a.kategorie}</td>
                  <td className="px-4 py-3 text-sm text-navy/60 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-navy/60">{a.createdBy}</td>
                  <td className="px-2 py-3">
                    <button type="button" onClick={() => openEdit(a)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-navy/10 transition-colors text-navy/40 hover:text-navy"
                      title="Artikel bearbeiten">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Zoom modal (3.0.2) ─────────────────────────────────────────────── */}
      {zoomArtikel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setZoomArtikel(null)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh]" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setZoomArtikel(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-lg leading-none">×</button>
            <div className="p-6 flex gap-6 h-full">
              {/* Image area */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex-1 min-h-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={zoomArtikel.bilder?.[zoomIdx]?.url} alt={zoomArtikel.produktname}
                    className="w-full h-full rounded-lg object-contain object-left" />
                </div>
                {/* Ansicht label */}
                {zoomArtikel.bilder?.[zoomIdx]?.ansicht && (
                  <p className="text-sm text-navy/60 text-center">{zoomArtikel.bilder[zoomIdx].ansicht}</p>
                )}
                {/* Navigation + pagination */}
                {(zoomArtikel.bilder?.length ?? 0) > 1 && (
                  <div className="flex items-center justify-center gap-4">
                    <button type="button" onClick={() => setZoomIdx(i => Math.max(0, i - 1))} disabled={zoomIdx === 0}
                      className="w-8 h-8 rounded-full border border-navy/20 text-navy/60 flex items-center justify-center hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-30">‹</button>
                    <div className="flex gap-1.5">
                      {zoomArtikel.bilder.map((_, i) => (
                        <button key={i} type="button" onClick={() => setZoomIdx(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === zoomIdx ? 'bg-orange' : 'bg-navy/20 hover:bg-navy/40'}`} />
                      ))}
                    </div>
                    <button type="button" onClick={() => setZoomIdx(i => Math.min(i + 1, zoomArtikel.bilder.length - 1))} disabled={zoomIdx === zoomArtikel.bilder.length - 1}
                      className="w-8 h-8 rounded-full border border-navy/20 text-navy/60 flex items-center justify-center hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-30">›</button>
                  </div>
                )}
              </div>
              {/* Metadata */}
              <div className="w-72 shrink-0 flex flex-col justify-end gap-4">
                <div className="space-y-3">
                  {[{ label: 'Produktname', value: zoomArtikel.produktname }, { label: 'ID', value: zoomArtikel.artikelId }, { label: 'Kategorie', value: zoomArtikel.kategorie }].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">{label}</span>
                      <p className="text-sm text-navy mt-0.5">{value || '–'}</p>
                    </div>
                  ))}
                  {zoomArtikel.beschreibung && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">Beschreibung</span>
                      <p className="text-sm text-navy mt-0.5 whitespace-pre-wrap">{zoomArtikel.beschreibung}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">Bilder</span>
                    <p className="text-sm text-navy/60 mt-0.5">{zoomArtikel.bilder?.length ?? 0} Bild{(zoomArtikel.bilder?.length ?? 0) !== 1 ? 'er' : ''}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">Erstellt</span>
                    <p className="text-sm text-navy/60 mt-0.5">{formatDate(zoomArtikel.createdAt)} von {zoomArtikel.createdBy}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Anlegen modal (3.0.1) ──────────────────────────────────────────── */}
      {anlegenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <p className="font-semibold text-navy text-lg">Artikel anlegen</p>

              <div className="space-y-1">
                <label className="text-sm text-navy/70">Produktname <span className="text-orange">*</span></label>
                <input type="text" value={anlegenProduktname} onChange={e => setAnlegenProduktname(e.target.value)} placeholder="z. B. Jogger Classic" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">ID <span className="text-orange">*</span></label>
                <input type="text" value={anlegenArtikelId} onChange={e => setAnlegenArtikelId(e.target.value)} placeholder="z. B. JOG-001" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">Kategorie <span className="text-orange">*</span></label>
                <select value={anlegenKategorie} onChange={e => setAnlegenKategorie(e.target.value)} className={selectCls}>
                  <option value="">Bitte wählen …</option>
                  {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">Beschreibung</label>
                <textarea rows={3} value={anlegenBeschreibung} onChange={e => setAnlegenBeschreibung(e.target.value)} placeholder="Optionale Beschreibung …" className={`${inputCls} resize-y`} />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-navy">Bilder hochladen <span className="text-orange">*</span></p>
                {pendingBilder.map((b, idx) => (
                  <div key={b.localId} className="border border-navy/10 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-navy/50">Bild {idx + 1}</span>
                      {pendingBilder.length > 1 && (
                        <button type="button" onClick={() => removePendingBild(b.localId)} className="text-xs text-navy/40 hover:text-red-500 transition-colors">Entfernen</button>
                      )}
                    </div>
                    {b.preview ? (
                      <div className="relative w-full aspect-video rounded overflow-hidden border border-navy/10 bg-navy/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.preview} alt="Vorschau" className="w-full h-full object-contain" />
                        <button type="button" onClick={() => {
                          if (b.preview) URL.revokeObjectURL(b.preview)
                          setPendingBilder(prev => prev.map(p => p.localId === b.localId ? { ...p, file: null, preview: null } : p))
                          if (anlegenFileRefs.current[b.localId]) anlegenFileRefs.current[b.localId]!.value = ''
                        }} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-black/70">×</button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-navy/20 rounded-lg p-5 cursor-pointer hover:border-orange transition-colors">
                        <span className="text-xs text-navy/50">JPG, PNG oder WebP</span>
                        <span className="text-xs text-orange font-medium">Datei auswählen</span>
                        <input ref={el => { anlegenFileRefs.current[b.localId] = el }} type="file" accept="image/jpeg,image/png,image/webp"
                          onChange={e => handlePendingFileSelect(b.localId, e)} className="hidden" />
                      </label>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs text-navy/70">Ansicht <span className="text-orange">*</span></label>
                      <select value={b.ansicht} onChange={e => handlePendingAnsicht(b.localId, e.target.value)} className={selectCls}>
                        <option value="">Bitte auswählen</option>
                        {ANSICHTEN.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {pendingBilder.length < MAX_BILDER && (
                  <button type="button" onClick={addPendingBild}
                    className="w-full text-sm border border-dashed border-navy/20 rounded-lg py-2 text-navy/50 hover:border-orange hover:text-orange transition-colors">
                    + Weiteres Bild hochladen
                  </button>
                )}
              </div>

              {anlegenSaving && (
                <div className="flex items-center gap-3 text-navy/60">
                  <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm">Wird gespeichert …</span>
                </div>
              )}
              {anlegenError && <p className="text-sm text-red-600">{anlegenError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleAnlegen} disabled={anlegenSaving}
                  className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                  {anlegenSaving ? 'Wird gespeichert …' : 'Speichern'}
                </button>
                <button type="button" onClick={() => { resetAnlegen(); setAnlegenOpen(false) }} disabled={anlegenSaving}
                  className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bearbeiten modal (3.0.3) ───────────────────────────────────────── */}
      {editArtikel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <p className="font-semibold text-navy text-lg">Artikel bearbeiten</p>

              <div className="space-y-1">
                <label className="text-sm text-navy/70">Produktname <span className="text-orange">*</span></label>
                <input type="text" value={editProduktname} onChange={e => setEditProduktname(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">ID <span className="text-orange">*</span></label>
                <input type="text" value={editArtikelId} onChange={e => setEditArtikelId(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">Kategorie <span className="text-orange">*</span></label>
                <select value={editKategorie} onChange={e => setEditKategorie(e.target.value)} className={selectCls}>
                  <option value="">Bitte wählen …</option>
                  {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">Beschreibung</label>
                <textarea rows={3} value={editBeschreibung} onChange={e => setEditBeschreibung(e.target.value)} className={`${inputCls} resize-y`} />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-navy">Bilder</p>
                {editBilder.map((b, idx) => (
                  <div key={b.localId} className="border border-navy/10 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-navy/50">Bild {idx + 1}</span>
                      <button type="button" onClick={() => removeEditBild(b.localId)} className="text-xs text-navy/40 hover:text-red-500 transition-colors">Entfernen</button>
                    </div>
                    {(b.preview ?? b.url) ? (
                      <div className="relative w-full aspect-video rounded overflow-hidden border border-navy/10 bg-navy/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.preview ?? b.url} alt="Vorschau" className="w-full h-full object-contain" />
                        <label className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded cursor-pointer hover:bg-black/70 transition-colors">
                          Ersetzen
                          <input ref={el => { editFileRefs.current[b.localId] = el }} type="file" accept="image/jpeg,image/png,image/webp"
                            onChange={e => handleEditFileSelect(b.localId, e)} className="hidden" />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-navy/20 rounded-lg p-5 cursor-pointer hover:border-orange transition-colors">
                        <span className="text-xs text-navy/50">JPG, PNG oder WebP</span>
                        <span className="text-xs text-orange font-medium">Datei auswählen</span>
                        <input ref={el => { editFileRefs.current[b.localId] = el }} type="file" accept="image/jpeg,image/png,image/webp"
                          onChange={e => handleEditFileSelect(b.localId, e)} className="hidden" />
                      </label>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs text-navy/70">Ansicht <span className="text-orange">*</span></label>
                      <select value={b.ansicht} onChange={e => setEditBilder(prev => prev.map(p => p.localId === b.localId ? { ...p, ansicht: e.target.value } : p))} className={selectCls}>
                        <option value="">Bitte auswählen</option>
                        {ANSICHTEN.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {editBilder.length < MAX_BILDER && (
                  <button type="button" onClick={addEditBild}
                    className="w-full text-sm border border-dashed border-navy/20 rounded-lg py-2 text-navy/50 hover:border-orange hover:text-orange transition-colors">
                    + Weiteres Bild hinzufügen
                  </button>
                )}
              </div>

              {editSaving && (
                <div className="flex items-center gap-3 text-navy/60">
                  <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm">Wird gespeichert …</span>
                </div>
              )}
              {editError && <p className="text-sm text-red-600">{editError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleEditSave} disabled={editSaving}
                  className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                  {editSaving ? 'Wird gespeichert …' : 'Speichern'}
                </button>
                <button type="button" onClick={() => setEditArtikel(null)} disabled={editSaving}
                  className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">{selected.size} Artikel löschen?</p>
            <p className="text-sm text-navy/60">{selected.size === 1 ? 'Der Artikel wird' : 'Die Artikel werden'} ausgeblendet und {selected.size === 1 ? 'ist' : 'sind'} nicht mehr sichtbar.</p>
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
