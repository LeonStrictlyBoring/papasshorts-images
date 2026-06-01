'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, query, orderBy, getDocs, doc, addDoc, writeBatch, Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, auth } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

const KATEGORIEN = [
  'Jogger', 'Stoffhose', 'Jeans', 'Chino', 'Flex Chino', 'Smart Chino',
  'Sommer Shorts', 'Boxer Shorts', 'Retro Shorts', 'Sporthose', 'Badehose',
  'T-Shirt', 'Socken',
]

interface Artikel {
  id: string
  imageUrl: string
  storagePath: string
  produktname: string
  artikelId: string
  kategorie: string
  beschreibung: string
  createdAt: Timestamp
  createdBy: string
  archived?: boolean
}

type SortKey = 'produktname' | 'artikelId' | 'kategorie' | 'createdAt' | 'createdBy'
type SortDir = 'asc' | 'desc'

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full text-sm'

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

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [produktname, setProduktname] = useState('')
  const [artikelIdInput, setArtikelIdInput] = useState('')
  const [kategorie, setKategorie] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { userDoc } = useAuth()

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'artikel'), orderBy('createdAt', 'desc')))
        setArtikel(snap.docs.map(d => ({ id: d.id, ...d.data() } as Artikel)).filter(a => !a.archived))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const creators = useMemo(() => [...new Set(artikel.map(a => a.createdBy))].sort(), [artikel])

  const filtered = useMemo(() => {
    let list = artikel
    if (filterKategorie) list = list.filter(a => a.kategorie === filterKategorie)
    if (filterCreator) list = list.filter(a => a.createdBy === filterCreator)
    if (filterFrom) {
      const from = new Date(filterFrom)
      list = list.filter(a => a.createdAt.toDate() >= from)
    }
    if (filterTo) {
      const to = new Date(filterTo); to.setHours(23, 59, 59, 999)
      list = list.filter(a => a.createdAt.toDate() <= to)
    }
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
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set())
    else setSelected(new Set(filtered.map(a => a.id)))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      for (const id of Array.from(selected)) {
        batch.update(doc(db, 'artikel', id), { archived: true })
      }
      await batch.commit()
      setArtikel(prev => prev.filter(a => !selected.has(a.id)))
      setSelected(new Set()); setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Nur JPG, PNG und WebP sind erlaubt.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Datei zu groß. Maximal 10 MB erlaubt.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploadError(null)
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setUploadFile(file)
    setUploadPreview(URL.createObjectURL(file))
  }

  function resetUploadForm() {
    setUploadFile(null)
    if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    setUploadPreview(null)
    setProduktname(''); setArtikelIdInput(''); setKategorie(''); setBeschreibung('')
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function closeUpload() {
    resetUploadForm(); setUploadOpen(false)
  }

  async function handleUpload() {
    if (!uploadFile) { setUploadError('Bitte eine Datei auswählen.'); return }
    if (!produktname.trim()) { setUploadError('Produktname ist ein Pflichtfeld.'); return }
    if (!artikelIdInput.trim()) { setUploadError('ID ist ein Pflichtfeld.'); return }
    if (!kategorie) { setUploadError('Bitte eine Kategorie wählen.'); return }
    setUploading(true); setUploadError(null)
    try {
      const userId = auth.currentUser?.uid ?? 'unbekannt'
      const timestamp = Date.now()
      const storagePath = `artikel/${userId}/${timestamp}/${uploadFile.name}`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, uploadFile)
      const imageUrl = await getDownloadURL(storageRef)
      const now = Timestamp.now()
      const docRef = await addDoc(collection(db, 'artikel'), {
        imageUrl, storagePath,
        produktname: produktname.trim(),
        artikelId: artikelIdInput.trim(),
        kategorie,
        beschreibung: beschreibung.trim(),
        createdAt: now,
        createdBy: userDoc?.name ?? 'Unbekannt',
      })
      setArtikel(prev => [{
        id: docRef.id, imageUrl, storagePath,
        produktname: produktname.trim(), artikelId: artikelIdInput.trim(),
        kategorie, beschreibung: beschreibung.trim(),
        createdAt: now, createdBy: userDoc?.name ?? 'Unbekannt',
      }, ...prev])
      closeUpload()
    } catch {
      setUploadError('Upload fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-navy">Artikel</h1>
        <button type="button" onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-orange/90 transition-colors">
          + Artikel hochladen
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
          <span className="text-sm font-medium text-navy">
            {selected.size} {selected.size === 1 ? 'Artikel' : 'Artikel'} ausgewählt
          </span>
          <button type="button" onClick={() => setDeleteDialogOpen(true)}
            className="text-sm font-semibold text-white bg-navy px-4 py-1.5 rounded-md hover:bg-navy/90 transition-colors">Löschen</button>
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-sm text-navy/50 hover:text-navy transition-colors">Auswahl aufheben</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-navy/60">
          <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Artikel werden geladen …</span>
        </div>
      )}

      {!loading && artikel.length === 0 && (
        <p className="text-navy/50 text-sm">Noch keine Artikel vorhanden. Lade deinen ersten Artikel hoch.</p>
      )}
      {!loading && artikel.length > 0 && filtered.length === 0 && (
        <p className="text-navy/50 text-sm">Keine Artikel gefunden. Filter anpassen?</p>
      )}

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
                <th className="px-4 py-3 text-left">
                  <SortButton label="Produktname" active={sortKey === 'produktname'} dir={sortDir} onClick={() => toggleSort('produktname')} />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortButton label="ID" active={sortKey === 'artikelId'} dir={sortDir} onClick={() => toggleSort('artikelId')} />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortButton label="Kategorie" active={sortKey === 'kategorie'} dir={sortDir} onClick={() => toggleSort('kategorie')} />
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
              {filtered.map(a => (
                <tr key={a.id} className={`transition-colors ${selected.has(a.id) ? 'bg-orange/5' : 'hover:bg-navy/[0.02]'}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="w-4 h-4 accent-orange" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="w-12 h-12 rounded-md overflow-hidden border border-navy/10 bg-navy/5 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.imageUrl} alt={a.produktname} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-navy">{a.produktname}</td>
                  <td className="px-4 py-3 text-sm text-navy/70 font-mono">{a.artikelId}</td>
                  <td className="px-4 py-3 text-sm text-navy/70">{a.kategorie}</td>
                  <td className="px-4 py-3 text-sm text-navy/60 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-navy/60">{a.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <p className="font-semibold text-navy text-lg">Artikel hochladen</p>

              {/* File selector */}
              <div className="space-y-2">
                <span className="text-sm text-navy/70">Datei <span className="text-orange">*</span></span>
                {uploadPreview ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-navy/10 bg-navy/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadPreview} alt="Vorschau" className="w-full h-full object-contain" />
                    <button type="button" onClick={() => { setUploadFile(null); if (uploadPreview) URL.revokeObjectURL(uploadPreview); setUploadPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black/70 transition-colors">×</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-navy/20 rounded-lg p-8 cursor-pointer hover:border-orange transition-colors">
                    <span className="text-sm text-navy/50">JPG, PNG, WebP, GIF oder SVG</span>
                    <span className="text-xs text-orange font-medium">Datei auswählen</span>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  </label>
                )}
              </div>

              {/* Form fields */}
              <div className="space-y-1">
                <label className="text-sm text-navy/70">Produktname <span className="text-orange">*</span></label>
                <input type="text" value={produktname} onChange={e => setProduktname(e.target.value)}
                  placeholder="z. B. Jogger Classic" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">ID <span className="text-orange">*</span></label>
                <input type="text" value={artikelIdInput} onChange={e => setArtikelIdInput(e.target.value)}
                  placeholder="z. B. JOG-001" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">Kategorie <span className="text-orange">*</span></label>
                <select value={kategorie} onChange={e => setKategorie(e.target.value)}
                  className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange w-full text-sm">
                  <option value="">Bitte wählen …</option>
                  {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-navy/70">Beschreibung</label>
                <textarea rows={3} value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
                  placeholder="Optionale Beschreibung …" className={`${inputCls} resize-y`} />
              </div>

              {uploading && (
                <div className="flex items-center gap-3 text-navy/60">
                  <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm">Wird hochgeladen …</span>
                </div>
              )}
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleUpload} disabled={uploading}
                  className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                  {uploading ? 'Wird gespeichert …' : 'Speichern'}
                </button>
                <button type="button" onClick={closeUpload} disabled={uploading}
                  className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">
              {selected.size} {selected.size === 1 ? 'Artikel' : 'Artikel'} löschen?
            </p>
            <p className="text-sm text-navy/60">
              {selected.size === 1 ? 'Der Artikel wird' : 'Die Artikel werden'} ausgeblendet und {selected.size === 1 ? 'ist' : 'sind'} nicht mehr sichtbar.
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
