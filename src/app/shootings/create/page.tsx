'use client'

import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, query, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore'
import { functions, db } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

// ── Types ──────────────────────────────────────────────────────────────────

interface PoolModel {
  id: string; name: string; imageUrl: string; storagePath: string
  sedcard?: { appearance?: { phenotype?: string; build?: string }; archetypes?: string[] }
  archived?: boolean
}
interface PoolArtikel {
  id: string; produktname: string; artikelId: string
  imageUrl: string; storagePath: string; kategorie: string; archived?: boolean
}
interface PoolSetting {
  id: string; name: string; imageUrl: string; storagePath: string; archived?: boolean
}
interface SelectedArtikel {
  id: string; produktname: string; artikelId: string
  imageUrl: string; storagePath: string; kategorie: string
}
interface ModelBlock {
  blockId: string
  model: { id: string; name: string; imageUrl: string; storagePath: string } | null
  artikel: SelectedArtikel[]
}
interface Shot { url: string; storagePath: string }
interface ShotBlock {
  id: string
  shots: Shot[]
  savedIndices: Set<number>
  discardedIndices: Set<number>
  selectedIdx: number | null
  showRefinementInput: boolean
  refinementText: string
  refining: boolean
  refineError: string | null
  refinedFrom?: string
  refinedWithText?: string
}
interface GenerationResult { images: { url: string; storagePath: string }[]; generationId: string }

const KATEGORIEN = ['Jogger','Stoffhose','Jeans','Chino','Flex Chino','Smart Chino',
  'Sommer Shorts','Boxer Shorts','Retro Shorts','Sporthose','Badehose','T-Shirt','Socken']

const selectCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange w-full text-sm'
const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full text-sm'

// ── Main Component ─────────────────────────────────────────────────────────

export default function ShootingCreatePage() {
  const { userDoc } = useAuth()
  const streamRef = useRef<HTMLDivElement>(null)

  // Form state
  const [modelBlocks, setModelBlocks] = useState<ModelBlock[]>([{ blockId: '1', model: null, artikel: [] }])
  const [selectedSetting, setSelectedSetting] = useState<{ id: string; name: string; imageUrl: string; storagePath: string } | null>(null)

  // Regie fields
  const [beschreibung, setBeschreibung] = useState('')
  const [posingTyp, setPosingTyp] = useState('')
  const [armHaltung, setArmHaltung] = useState('')
  const [koerperSpannung, setKoerperSpannung] = useState('')
  const [bildausschnitt, setBildausschnitt] = useState('')
  const [kamerawinkel, setKamerawinkel] = useState('')
  const [objektivChar, setObjektivChar] = useState('')
  const [blickkontakt, setBlickkontakt] = useState('')
  const [gesichtsausdruck, setGesichtsausdruck] = useState('')
  const [stoffDynamik, setStoffDynamik] = useState('')
  const [fokusBereich, setFokusBereich] = useState('')
  const [fotografieStil, setFotografieStil] = useState('')
  const [bildschaerfe, setBildschaerfe] = useState('')
  const [photorealistic, setPhotorealistic] = useState(false)
  const [candidLook, setCandidLook] = useState(false)
  const [filmGrain, setFilmGrain] = useState(false)

  // Generation state
  const [submitted, setSubmitted] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [shotBlocks, setShotBlocks] = useState<ShotBlock[]>([])
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  // Model overlay
  const [modelOverlayBlockId, setModelOverlayBlockId] = useState<string | null>(null)
  const [poolModels, setPoolModels] = useState<PoolModel[]>([])
  const [poolModelsLoading, setPoolModelsLoading] = useState(false)
  const [modelOverlaySelected, setModelOverlaySelected] = useState<string | null>(null)

  // Artikel overlay
  const [artikelOverlayBlockId, setArtikelOverlayBlockId] = useState<string | null>(null)
  const [poolArtikel, setPoolArtikel] = useState<PoolArtikel[]>([])
  const [poolArtikelLoading, setPoolArtikelLoading] = useState(false)
  const [artikelOverlaySelected, setArtikelOverlaySelected] = useState<Set<string>>(new Set())
  const [artikelFilterKat, setArtikelFilterKat] = useState('')

  // Setting overlay
  const [settingOverlayOpen, setSettingOverlayOpen] = useState(false)
  const [poolSettings, setPoolSettings] = useState<PoolSetting[]>([])
  const [poolSettingsLoading, setPoolSettingsLoading] = useState(false)
  const [settingOverlaySelected, setSettingOverlaySelected] = useState<string | null>(null)

  useEffect(() => {
    if (!zoomUrl) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setZoomUrl(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomUrl])

  // Load pool data when overlays open
  useEffect(() => {
    if (!modelOverlayBlockId || poolModels.length) return
    setPoolModelsLoading(true)
    getDocs(query(collection(db, 'models'), orderBy('createdAt', 'desc')))
      .then(s => setPoolModels(s.docs.map(d => ({ id: d.id, ...d.data() } as PoolModel)).filter(m => !m.archived)))
      .finally(() => setPoolModelsLoading(false))
  }, [modelOverlayBlockId, poolModels.length])

  useEffect(() => {
    if (!artikelOverlayBlockId || poolArtikel.length) return
    setPoolArtikelLoading(true)
    getDocs(query(collection(db, 'artikel'), orderBy('createdAt', 'desc')))
      .then(s => setPoolArtikel(s.docs.map(d => ({ id: d.id, ...d.data() } as PoolArtikel)).filter(a => !a.archived)))
      .finally(() => setPoolArtikelLoading(false))
  }, [artikelOverlayBlockId, poolArtikel.length])

  useEffect(() => {
    if (!settingOverlayOpen || poolSettings.length) return
    setPoolSettingsLoading(true)
    getDocs(query(collection(db, 'settings'), orderBy('createdAt', 'desc')))
      .then(s => setPoolSettings(s.docs.map(d => ({ id: d.id, ...d.data() } as PoolSetting)).filter(s => !s.archived)))
      .finally(() => setPoolSettingsLoading(false))
  }, [settingOverlayOpen, poolSettings.length])

  // Helpers
  function addModelBlock() {
    setModelBlocks(prev => [...prev, { blockId: Date.now().toString(), model: null, artikel: [] }])
  }
  function removeModelBlock(blockId: string) {
    setModelBlocks(prev => prev.filter(b => b.blockId !== blockId))
  }
  function removeArtikelFromBlock(blockId: string, artikelId: string) {
    setModelBlocks(prev => prev.map(b => b.blockId === blockId
      ? { ...b, artikel: b.artikel.filter(a => a.id !== artikelId) } : b))
  }

  function openModelOverlay(blockId: string) {
    const block = modelBlocks.find(b => b.blockId === blockId)
    setModelOverlaySelected(block?.model?.id ?? null)
    setModelOverlayBlockId(blockId)
  }
  function confirmModelSelection() {
    if (!modelOverlayBlockId || !modelOverlaySelected) return
    const m = poolModels.find(m => m.id === modelOverlaySelected)
    if (!m) return
    setModelBlocks(prev => prev.map(b => b.blockId === modelOverlayBlockId
      ? { ...b, model: { id: m.id, name: m.name, imageUrl: m.imageUrl, storagePath: m.storagePath } }
      : b))
    setModelOverlayBlockId(null)
  }

  function openArtikelOverlay(blockId: string) {
    const block = modelBlocks.find(b => b.blockId === blockId)
    setArtikelOverlaySelected(new Set(block?.artikel.map(a => a.id) ?? []))
    setArtikelFilterKat('')
    setArtikelOverlayBlockId(blockId)
  }
  function confirmArtikelSelection() {
    if (!artikelOverlayBlockId) return
    const selected = poolArtikel.filter(a => artikelOverlaySelected.has(a.id))
    setModelBlocks(prev => prev.map(b => b.blockId === artikelOverlayBlockId
      ? { ...b, artikel: selected.map(a => ({ id: a.id, produktname: a.produktname, artikelId: a.artikelId, imageUrl: a.imageUrl, storagePath: a.storagePath, kategorie: a.kategorie })) }
      : b))
    setArtikelOverlayBlockId(null)
  }

  function openSettingOverlay() {
    setSettingOverlaySelected(selectedSetting?.id ?? null)
    setSettingOverlayOpen(true)
  }
  function confirmSettingSelection() {
    if (!settingOverlaySelected) return
    const s = poolSettings.find(s => s.id === settingOverlaySelected)
    if (!s) return
    setSelectedSetting({ id: s.id, name: s.name, imageUrl: s.imageUrl, storagePath: s.storagePath })
    setSettingOverlayOpen(false)
  }

  function buildPayload(refinement?: { storagePath: string; text: string }) {
    const activeBlocks = modelBlocks.filter(b => b.model)
    return {
      models: activeBlocks.map(b => ({ name: b.model!.name, storagePath: b.model!.storagePath })),
      modelArtikel: activeBlocks.map(b => ({
        modelName: b.model!.name,
        artikel: b.artikel.map(a => ({ produktname: a.produktname, artikelId: a.artikelId, storagePath: a.storagePath })),
      })),
      setting: { name: selectedSetting!.name, storagePath: selectedSetting!.storagePath },
      regie: JSON.parse(JSON.stringify({
        beschreibung, posingTyp: posingTyp || undefined, armHaltung: armHaltung || undefined,
        koerperSpannung: koerperSpannung || undefined, bildausschnitt: bildausschnitt || undefined,
        kamerawinkel: kamerawinkel || undefined, objektivCharakteristik: objektivChar || undefined,
        blickkontakt: blickkontakt || undefined, gesichtsausdruck: gesichtsausdruck || undefined,
        stoffDynamik: stoffDynamik || undefined, fokusBereich: fokusBereich || undefined,
        fotografieStil: fotografieStil || undefined, bildschaerfe: bildschaerfe || undefined,
        photorealistic: photorealistic || undefined, candidLook: candidLook || undefined, filmGrain: filmGrain || undefined,
      })),
      ...(refinement && { refinement }),
    }
  }

  const canStart = beschreibung.trim().length > 0
    && modelBlocks.some(b => b.model && b.artikel.length > 0)
    && selectedSetting !== null

  async function generate(payload: ReturnType<typeof buildPayload>) {
    setGenerating(true); setGenError(null)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateShootingShots')
      const res = await fn(payload)
      const newBlock: ShotBlock = {
        id: Date.now().toString(),
        shots: res.data.images,
        savedIndices: new Set(),
        discardedIndices: new Set(),
        selectedIdx: null,
        showRefinementInput: false,
        refinementText: '',
        refining: false,
        refineError: null,
      }
      setShotBlocks(prev => [...prev, newBlock])
      setTimeout(() => streamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setGenerating(false)
    }
  }

  async function handleStart() {
    if (!canStart) return
    setSubmitted(true)
    await generate(buildPayload())
  }

  async function handleVerwerfenNeu() {
    await generate(buildPayload())
  }

  async function handleRefine(blockId: string) {
    setShotBlocks(prev => prev.map(b => b.id === blockId ? { ...b, refining: true, refineError: null } : b))
    try {
      const block = shotBlocks.find(b => b.id === blockId)
      if (!block || block.selectedIdx === null) return
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateShootingShots')
      const res = await fn(buildPayload({
        storagePath: block.shots[block.selectedIdx].storagePath,
        text: block.refinementText,
      }))
      const newBlock: ShotBlock = {
        id: Date.now().toString(),
        shots: res.data.images,
        savedIndices: new Set(),
        discardedIndices: new Set(),
        selectedIdx: null,
        showRefinementInput: false,
        refinementText: '',
        refining: false,
        refineError: null,
        refinedFrom: 'Auswahl verfeinern',
        refinedWithText: block.refinementText.trim(),
      }
      setShotBlocks(prev => [...prev.map(b => b.id === blockId ? { ...b, refining: false, selectedIdx: null, showRefinementInput: false, refinementText: '' } : b), newBlock])
      setTimeout(() => streamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)
    } catch (err: unknown) {
      setShotBlocks(prev => prev.map(b => b.id === blockId
        ? { ...b, refining: false, refineError: err instanceof Error ? err.message : 'Fehler beim Verfeinern' }
        : b))
    }
  }

  async function handleSaveShot(blockId: string, shotIdx: number) {
    const block = shotBlocks.find(b => b.id === blockId)
    if (!block) return
    const shot = block.shots[shotIdx]
    try {
      await addDoc(collection(db, 'shootings'), {
        imageUrl: shot.url,
        storagePath: shot.storagePath,
        models: modelBlocks.filter(b => b.model).map(b => b.model!.name),
        setting: selectedSetting!.name,
        artikel: modelBlocks.flatMap(b => b.artikel.map(a => ({ produktname: a.produktname, artikelId: a.artikelId }))),
        createdAt: Timestamp.now(),
        createdBy: userDoc?.name ?? 'Unbekannt',
      })
      setShotBlocks(prev => prev.map(b => b.id === blockId
        ? { ...b, savedIndices: new Set([...b.savedIndices, shotIdx]) } : b))
    } catch { /* silent */ }
  }

  const filteredArtikel = artikelFilterKat
    ? poolArtikel.filter(a => a.kategorie === artikelFilterKat)
    : poolArtikel

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-10 pb-16">
      <h1 className="text-3xl font-bold text-navy">Shooting erstellen</h1>

      {/* ── Schritt 1: Model & Artikel ── */}
      {!submitted ? (
        <section className="space-y-6">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Model(s) &amp; Artikel</h3>
          {modelBlocks.map((block, blockIdx) => (
            <div key={block.blockId} className="border border-navy/10 rounded-xl p-5 space-y-4 bg-navy/[0.01]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-navy/60">Model {blockIdx + 1}</span>
                {modelBlocks.length > 1 && (
                  <button type="button" onClick={() => removeModelBlock(block.blockId)}
                    className="text-xs text-navy/40 hover:text-red-500 transition-colors">Entfernen</button>
                )}
              </div>

              {/* Model selection */}
              {block.model ? (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-navy/10 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={block.model.imageUrl} alt={block.model.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-navy">{block.model.name}</p>
                  </div>
                  <button type="button" onClick={() => openModelOverlay(block.blockId)}
                    className="text-xs text-orange hover:text-orange/80 transition-colors">Ändern</button>
                  <button type="button" onClick={() => setModelBlocks(prev => prev.map(b => b.blockId === block.blockId ? { ...b, model: null } : b))}
                    className="text-xs text-navy/40 hover:text-navy transition-colors">×</button>
                </div>
              ) : (
                <button type="button" onClick={() => openModelOverlay(block.blockId)}
                  className="text-sm border border-navy/20 rounded-md px-4 py-2 text-navy/60 hover:border-orange hover:text-navy transition-colors">
                  + Model auswählen
                </button>
              )}

              {/* Artikel */}
              <div className="space-y-2">
                {block.artikel.length > 0 && (
                  <div className="space-y-2">
                    {block.artikel.map(a => (
                      <div key={a.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md overflow-hidden border border-navy/10 shrink-0 bg-navy/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.imageUrl} alt={a.produktname} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-sm text-navy flex-1">{a.produktname} <span className="text-navy/40 font-mono">{a.artikelId}</span></p>
                        <button type="button" onClick={() => removeArtikelFromBlock(block.blockId, a.id)}
                          className="text-navy/40 hover:text-navy transition-colors text-sm">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => openArtikelOverlay(block.blockId)}
                  className="text-sm border border-navy/20 rounded-md px-4 py-2 text-navy/60 hover:border-orange hover:text-navy transition-colors">
                  {block.artikel.length > 0 ? 'Artikel bearbeiten' : '+ Artikel zuordnen'}
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addModelBlock}
            className="text-sm text-orange hover:text-orange/80 font-medium transition-colors">
            + Model hinzufügen
          </button>
        </section>
      ) : (
        <section className="bg-navy/5 rounded-xl p-5 space-y-3">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Model(s) &amp; Artikel</h3>
          {modelBlocks.filter(b => b.model).map((block, i) => (
            <div key={block.blockId} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md overflow-hidden border border-navy/10 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.model!.imageUrl} alt={block.model!.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-medium text-navy">{block.model!.name}</p>
                <p className="text-xs text-navy/50">{block.artikel.map(a => a.produktname).join(', ') || '–'}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Schritt 2: Setting ── */}
      {!submitted ? (
        <section className="space-y-3">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Setting</h3>
          {selectedSetting ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden border border-navy/10 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedSetting.imageUrl} alt={selectedSetting.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-medium text-navy flex-1">{selectedSetting.name}</p>
              <button type="button" onClick={openSettingOverlay}
                className="text-xs text-orange hover:text-orange/80 transition-colors">Ändern</button>
              <button type="button" onClick={() => setSelectedSetting(null)}
                className="text-xs text-navy/40 hover:text-navy transition-colors">×</button>
            </div>
          ) : (
            <button type="button" onClick={openSettingOverlay}
              className="text-sm border border-navy/20 rounded-md px-4 py-2 text-navy/60 hover:border-orange hover:text-navy transition-colors">
              + Setting auswählen
            </button>
          )}
        </section>
      ) : selectedSetting && (
        <section className="bg-navy/5 rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md overflow-hidden border border-navy/10 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedSetting.imageUrl} alt={selectedSetting.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-navy/50 uppercase tracking-wide">Setting</p>
            <p className="text-sm font-medium text-navy">{selectedSetting.name}</p>
          </div>
        </section>
      )}

      {/* ── Schritt 3: Regieanweisungen ── */}
      {!submitted ? (
        <section className="space-y-6">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Regieanweisungen</h3>

          <div className="space-y-1">
            <label className="text-sm text-navy/70">Beschreibung <span className="text-orange">*</span></label>
            <textarea rows={4} value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
              placeholder="Beschreibe die gewünschten Shots …" className={`${inputCls} resize-y`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Posing-Typ</label>
              <select value={posingTyp} onChange={e => setPosingTyp(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Dynamic Walk (Gehend)','Standing 3/4 view (Dreiviertel-Profil)','Frontal symmetrical (Symmetrisch frontal)','Lean against wall (Anlehnen)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Arm- &amp; Handhaltung</label>
              <select value={armHaltung} onChange={e => setArmHaltung(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Hands in pockets (Hände in den Taschen)','Natural relaxed arms (Locker fallend)','Holding a bag (Tasche haltend)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Körperspannung &amp; Fluss</label>
              <select value={koerperSpannung} onChange={e => setKoerperSpannung(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Candid snapshot (Schnappschuss-Look)','Editorial pose','Catalog style (Klassisch gerade)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Bildausschnitt</label>
              <select value={bildausschnitt} onChange={e => setBildausschnitt(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Full body shot (Ganzkörper)','Knee-up shot (Amerikanisch - ab Knie)','Medium shot (Hüfte aufwärts)','Close-up (Detail)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Kamerawinkel</label>
              <select value={kamerawinkel} onChange={e => setKamerawinkel(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Eye-level (Augenhöhe)','Low-angle (Leichte Froschperspektive)','Straight-on (Frontal)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Objektiv-Charakteristik</label>
              <select value={objektivChar} onChange={e => setObjektivChar(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['85mm lens (Porträt, natürlicher Look)','50mm lens (Realistischer Blick)','35mm lens (Mehr Kontext/Hintergrund)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Blickkontakt</label>
              <select value={blickkontakt} onChange={e => setBlickkontakt(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Looking directly into the camera (Direkter Blick)','Looking away slightly (Leicht weggeschaut)','Profile view (Profil)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Gesichtsausdruck</label>
              <select value={gesichtsausdruck} onChange={e => setGesichtsausdruck(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Soft subtle smile (Sanftes Schmunzeln)','Neutral expression (Neutral/High-End)','Friendly and approachable (Freundlich/Nahbar)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Stoff-Dynamik</label>
              <select value={stoffDynamik} onChange={e => setStoffDynamik(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Fabric blowing in the wind (Windhauch im Stoff)','Natural drapes (Natürlicher Faltenwurf)','Form-fitting (Eng anliegend, statisch)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Fotografie-Stil</label>
              <select value={fotografieStil} onChange={e => setFotografieStil(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Commercial fashion photography','High-end e-commerce look','Street style photography'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-navy/70">Bildschärfe &amp; Hintergrund</label>
              <select value={bildschaerfe} onChange={e => setBildschaerfe(e.target.value)} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Shallow depth of field (Scharfes Model, unscharfer Hintergrund)','Sharp focus throughout (Alles scharf)'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-sm text-navy/70">Fokus-Bereich</label>
              <input type="text" value={fokusBereich} onChange={e => setFokusBereich(e.target.value)}
                placeholder='z. B. "Focus on the texture of the knitwear"' className={inputCls} />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-navy/70">Realismus-Verstärker</span>
            {[
              { label: 'Photorealistic', val: photorealistic, set: setPhotorealistic },
              { label: 'Candid look', val: candidLook, set: setCandidLook },
              { label: 'Shot on 35mm film grain (für analogen Touch)', val: filmGrain, set: setFilmGrain },
            ].map(({ label, val, set }) => (
              <label key={label} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="w-4 h-4 accent-orange shrink-0" />
                <span className="text-sm text-navy">{label}</span>
              </label>
            ))}
          </div>

          <button type="button" onClick={handleStart} disabled={!canStart || generating}
            className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-40">
            Shooting starten
          </button>
        </section>
      ) : (
        <section className="bg-navy/5 rounded-xl p-5 space-y-1">
          <p className="text-xs text-navy/50 uppercase tracking-wide">Regieanweisungen</p>
          <p className="text-sm text-navy whitespace-pre-wrap">{beschreibung}</p>
        </section>
      )}

      {/* ── Error ── */}
      {genError && (
        <div className="p-4 border border-red-300 bg-red-50 rounded-lg space-y-3">
          <p className="text-sm text-red-700">{genError}</p>
          <button type="button" onClick={handleVerwerfenNeu} disabled={generating}
            className="text-sm font-medium text-orange hover:text-orange/80 transition-colors disabled:opacity-50">
            Erneut versuchen
          </button>
        </div>
      )}

      {/* ── Chat Stream ── */}
      {shotBlocks.length > 0 && (
        <div className="space-y-8 border-t border-navy/10 pt-8" ref={streamRef}>
          {shotBlocks.map((block, blockIdx) => (
            <div key={block.id} className="space-y-4">
              {/* Header */}
              {block.refinedFrom ? (
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-navy">{block.refinedFrom}</p>
                  <p className="text-sm text-navy/60">Anpassungen: {block.refinedWithText}</p>
                </div>
              ) : (
                <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide">
                  {blockIdx === 0 ? 'Generierung 1' : `Generierung ${blockIdx + 1}`}
                </p>
              )}

              {/* Shot grid */}
              <div className="grid grid-cols-3 gap-4 items-start">
                {block.shots.map((shot, i) => {
                  if (block.discardedIndices.has(i)) return null
                  const isSaved = block.savedIndices.has(i)
                  const isSelected = block.selectedIdx === i
                  return (
                    <div key={shot.storagePath} className="flex flex-col gap-2">
                      <div className="relative">
                        <button type="button"
                          onClick={() => setShotBlocks(prev => prev.map(b => b.id === block.id
                            ? { ...b, selectedIdx: b.selectedIdx === i ? null : i, showRefinementInput: false } : b))}
                          disabled={isSaved}
                          className={`relative w-full aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                            isSelected ? 'border-orange' : isSaved ? 'border-transparent cursor-default' : 'border-transparent hover:border-orange'
                          }`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={shot.url} alt={`Shot ${i + 1}`} className="w-full h-full object-cover" />
                          {isSaved && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                        {/* Zoom icon */}
                        <button type="button" onClick={() => setZoomUrl(shot.url)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                          aria-label="Vergrößern">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zm-7-4v8m-4-4h8" />
                          </svg>
                        </button>
                      </div>
                      {isSelected && !isSaved && (
                        <div className="flex flex-col gap-1">
                          <button type="button"
                            onClick={() => setShotBlocks(prev => prev.map(b => b.id === block.id
                              ? { ...b, discardedIndices: new Set([...b.discardedIndices, i]), selectedIdx: null } : b))}
                            className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
                            Verwerfen
                          </button>
                          <button type="button" onClick={() => handleSaveShot(block.id, i)}
                            className="text-sm font-medium py-1.5 rounded border border-orange/40 bg-orange/5 text-orange hover:bg-orange/15 transition-colors">
                            Speichern
                          </button>
                          <button type="button"
                            onClick={() => setShotBlocks(prev => prev.map(b => b.id === block.id ? { ...b, showRefinementInput: true } : b))}
                            className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
                            Verfeinern
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Refinement input */}
              {block.selectedIdx !== null && block.showRefinementInput && (
                <div className="space-y-3 border border-navy/10 rounded-xl p-4 bg-navy/[0.02]">
                  <p className="text-sm text-navy/50">Auswahl verfeinern</p>
                  <textarea rows={3} value={block.refinementText}
                    onChange={e => setShotBlocks(prev => prev.map(b => b.id === block.id ? { ...b, refinementText: e.target.value } : b))}
                    placeholder="Beschreibe die gewünschten Anpassungen …"
                    className={`${inputCls} resize-y`} disabled={block.refining} />
                  {block.refining && (
                    <div className="flex items-center gap-2 text-navy/60">
                      <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="text-sm">Neue Varianten werden generiert …</span>
                    </div>
                  )}
                  {block.refineError && <p className="text-sm text-red-600">{block.refineError}</p>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => handleRefine(block.id)}
                      disabled={block.refining || !block.refinementText.trim()}
                      className="bg-orange text-white font-semibold px-5 py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50 text-sm">
                      {block.refining ? 'Wird verfeinert …' : 'Verfeinern'}
                    </button>
                    <button type="button"
                      onClick={() => setShotBlocks(prev => prev.map(b => b.id === block.id ? { ...b, showRefinementInput: false, refinementText: '' } : b))}
                      disabled={block.refining}
                      className="text-sm px-5 py-2 rounded-md border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {generating && (
        <div className="flex flex-col items-center gap-3 text-navy/60 py-8">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Shots werden generiert …</p>
        </div>
      )}

      {/* ── Zoom Modal ── */}
      {zoomUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setZoomUrl(null)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh]" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setZoomUrl(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-lg leading-none">×</button>
            <div className="p-6 h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoomUrl} alt="Zoom" className="w-full h-full rounded-lg object-contain object-left" />
            </div>
          </div>
        </div>
      )}

      {/* ── Model Overlay ── */}
      {modelOverlayBlockId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy/10">
            <p className="font-semibold text-navy">Model auswählen</p>
            <button type="button" onClick={() => setModelOverlayBlockId(null)} className="text-navy/50 hover:text-navy text-lg">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {poolModelsLoading && <div className="flex items-center gap-2 text-navy/50"><div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" /><span className="text-sm">Wird geladen …</span></div>}
            <div className="space-y-3 max-w-2xl mx-auto">
              {poolModels.map(m => (
                <button key={m.id} type="button" onClick={() => setModelOverlaySelected(m.id)}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl border-2 transition-colors text-left ${modelOverlaySelected === m.id ? 'border-orange bg-orange/5' : 'border-navy/10 hover:border-navy/30'}`}>
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-navy/10 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-medium text-navy">{m.name}</p>
                    {m.sedcard?.appearance?.phenotype && <p className="text-xs text-navy/50">{m.sedcard.appearance.phenotype}{m.sedcard.appearance.build ? ` · ${m.sedcard.appearance.build}` : ''}</p>}
                    {m.sedcard?.archetypes?.[0] && <p className="text-xs text-navy/40">{m.sedcard.archetypes[0].split(' (')[0]}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-navy/10 flex gap-3 max-w-2xl mx-auto w-full">
            <button type="button" onClick={confirmModelSelection} disabled={!modelOverlaySelected}
              className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-40">Auswählen</button>
            <button type="button" onClick={() => setModelOverlayBlockId(null)}
              className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
          </div>
        </div>
      )}

      {/* ── Artikel Overlay ── */}
      {artikelOverlayBlockId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy/10">
            <p className="font-semibold text-navy">Artikel zuordnen</p>
            <button type="button" onClick={() => setArtikelOverlayBlockId(null)} className="text-navy/50 hover:text-navy text-lg">×</button>
          </div>
          <div className="px-6 py-3 border-b border-navy/5">
            <select value={artikelFilterKat} onChange={e => setArtikelFilterKat(e.target.value)}
              className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange">
              <option value="">Alle Kategorien</option>
              {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {poolArtikelLoading && <div className="flex items-center gap-2 text-navy/50"><div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" /><span className="text-sm">Wird geladen …</span></div>}
            <div className="space-y-2 max-w-2xl mx-auto">
              {filteredArtikel.map(a => (
                <label key={a.id} className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-colors ${artikelOverlaySelected.has(a.id) ? 'border-orange bg-orange/5' : 'border-navy/10 hover:border-navy/30'}`}>
                  <input type="checkbox" checked={artikelOverlaySelected.has(a.id)}
                    onChange={() => setArtikelOverlaySelected(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}
                    className="w-4 h-4 accent-orange shrink-0" />
                  <div className="w-12 h-12 rounded-md overflow-hidden border border-navy/10 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.produktname} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy">{a.produktname}</p>
                    <p className="text-xs text-navy/50 font-mono">{a.artikelId} · {a.kategorie}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-navy/10 flex gap-3 max-w-2xl mx-auto w-full">
            <button type="button" onClick={confirmArtikelSelection}
              className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors">
              {artikelOverlaySelected.size > 0 ? `${artikelOverlaySelected.size} Artikel übernehmen` : 'Übernehmen'}
            </button>
            <button type="button" onClick={() => setArtikelOverlayBlockId(null)}
              className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
          </div>
        </div>
      )}

      {/* ── Setting Overlay ── */}
      {settingOverlayOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy/10">
            <p className="font-semibold text-navy">Setting auswählen</p>
            <button type="button" onClick={() => setSettingOverlayOpen(false)} className="text-navy/50 hover:text-navy text-lg">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {poolSettingsLoading && <div className="flex items-center gap-2 text-navy/50"><div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" /><span className="text-sm">Wird geladen …</span></div>}
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
              {poolSettings.map(s => (
                <button key={s.id} type="button" onClick={() => setSettingOverlaySelected(s.id)}
                  className={`rounded-xl border-2 overflow-hidden text-left transition-colors ${settingOverlaySelected === s.id ? 'border-orange' : 'border-navy/10 hover:border-navy/30'}`}>
                  <div className="aspect-video overflow-hidden bg-navy/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm font-medium text-navy px-3 py-2">{s.name}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-navy/10 flex gap-3 max-w-2xl mx-auto w-full">
            <button type="button" onClick={confirmSettingSelection} disabled={!settingOverlaySelected}
              className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-40">Auswählen</button>
            <button type="button" onClick={() => setSettingOverlayOpen(false)}
              className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  )
}
