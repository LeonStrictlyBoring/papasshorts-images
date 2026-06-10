'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { httpsCallable } from 'firebase/functions'
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore'
import { ref, getDownloadURL } from 'firebase/storage'
import { functions, db, storage } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'
import { formatFirebaseError, validationError, type FormattedError } from '@/lib/formatFirebaseError'

type LocationType = 'indoor' | 'outdoor-urban' | 'outdoor-natur' | null
type ImageState = 'active' | 'discarded' | 'saved'

const MOOD_LABELS = [
  'Luxuriös / High-End', 'Düster / Moody', 'Clean / Puristisch',
  'Verträumt / Surreal', 'Urban / Raw',
]

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full'
const labelCls = 'flex flex-col gap-1'
const labelTextCls = 'text-sm text-navy/70'

interface GeneratedImage { url: string; storagePath: string }
interface GenerationResult { images: GeneratedImage[]; promptUsed: string; generationId: string }

interface RefinementRecord {
  sourceLabel: string; text: string
  images: GeneratedImage[]; imageStates: Record<number, ImageState>; selectedIdx: number | null
}

interface SaveTarget { url: string; storagePath: string; rIdx?: number; imgIdx: number }
interface DiscardTarget { rIdx?: number; imgIdx: number }

interface OriginalSetting {
  id: string; name: string; imageUrl: string; storagePath?: string
  briefing?: Record<string, unknown>
}

export default function SettingEditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id: settingId } = use(params)
  const router = useRouter()
  const { userDoc } = useAuth()

  const [setting, setSetting] = useState<OriginalSetting | null>(null)
  const [settingLoading, setSettingLoading] = useState(true)
  const [settingError, setSettingError] = useState<string | null>(null)

  // Refinement input
  const [refinementText, setRefinementText] = useState('')

  // Form state
  const [beschreibung, setBeschreibung] = useState('')
  const [locationType, setLocationType] = useState<LocationType>(null)
  const [raumTyp, setRaumTyp] = useState('')
  const [architekturstil, setArchitekturstil] = useState('')
  const [oberflaechenWandstrukturen, setOberflaechenWandstrukturen] = useState('')
  const [bodenbelagIndoor, setBodenbelagIndoor] = useState('')
  const [umfeldSzenerie, setUmfeldSzenerie] = useState('')
  const [staedtischerVibe, setStaedtischerVibe] = useState('')
  const [bodenbeschaffenheitUrban, setBodenbeschaffenheitUrban] = useState('')
  const [hintergrundElemente, setHintergrundElemente] = useState('')
  const [landschaftsTyp, setLandschaftsTyp] = useState('')
  const [vegetationDichte, setVegetationDichte] = useState('')
  const [bodenbeschaffenheitNatur, setBodenbeschaffenheitNatur] = useState('')
  const [dominanteNaturelemente, setDominateNaturelemente] = useState('')
  const [lichtCharakter, setLichtCharakter] = useState('')
  const [lichtquelle, setLichtquelle] = useState('')
  const [tageszeit, setTageszeit] = useState('')
  const [colors, setColors] = useState<string[]>(['#1b2a4a'])
  const [farbsaettigung, setFarbsaettigung] = useState('')
  const [setDichte, setSetDichte] = useState('')
  const [moebelObjekte, setMoebelObjekte] = useState('')
  const [kleindekoration, setKleindekoration] = useState('')
  const [stilrichtung, setStilrichtung] = useState('')
  const [moodAdjektive, setMoodAdjektive] = useState<Set<string>>(new Set())
  const [anderesVibe, setAnderesVibe] = useState('')

  // Generation state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<FormattedError | null>(null)

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [imageStates, setImageStates] = useState<Record<number, ImageState>>({})
  const [refinementHistory, setRefinementHistory] = useState<RefinementRecord[]>([])

  const [saveTarget, setSaveTarget] = useState<SaveTarget | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(null)

  const [refineSource, setRefineSource] = useState<{ storagePath: string; label: string } | null>(null)
  const [refineText, setRefineText] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)

  // Load setting from Firestore and pre-fill form
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'settings', settingId))
        if (!snap.exists()) { setSettingError('Setting nicht gefunden.'); return }
        const data = snap.data()
        const s = { ...data, id: snap.id } as OriginalSetting
        setSetting(s)

        const b = s.briefing as Record<string, unknown> | undefined
        if (!b) return
        setBeschreibung((b.beschreibung as string) ?? '')
        setLocationType((b.locationType as LocationType) ?? null)
        const indoor = b.indoor as Record<string, string> | undefined
        setRaumTyp(indoor?.raumTyp ?? '')
        setArchitekturstil(indoor?.architekturstil ?? '')
        setOberflaechenWandstrukturen(indoor?.oberflaechenWandstrukturen ?? '')
        setBodenbelagIndoor(indoor?.bodenbelag ?? '')
        const ou = b.outdoorUrban as Record<string, string> | undefined
        setUmfeldSzenerie(ou?.umfeldSzenerie ?? '')
        setStaedtischerVibe(ou?.staedtischerVibe ?? '')
        setBodenbeschaffenheitUrban(ou?.bodenbeschaffenheit ?? '')
        setHintergrundElemente(ou?.hintergrundElemente ?? '')
        const on = b.outdoorNatur as Record<string, string> | undefined
        setLandschaftsTyp(on?.landschaftsTyp ?? '')
        setVegetationDichte(on?.vegetationDichte ?? '')
        setBodenbeschaffenheitNatur(on?.bodenbeschaffenheit ?? '')
        setDominateNaturelemente(on?.dominanteNaturelemente ?? '')
        const licht = b.licht as Record<string, string> | undefined
        setLichtCharakter(licht?.charakter ?? '')
        setLichtquelle(licht?.quelle ?? '')
        setTageszeit(licht?.tageszeit ?? '')
        if (Array.isArray(b.farben) && (b.farben as string[]).length > 0) setColors(b.farben as string[])
        setFarbsaettigung((b.farbsaettigung as string) ?? '')
        const sd = b.setDesign as Record<string, string> | undefined
        setSetDichte(sd?.dichte ?? '')
        setMoebelObjekte(sd?.moebelObjekte ?? '')
        setKleindekoration(sd?.kleindekoration ?? '')
        const vibe = b.vibe as Record<string, unknown> | undefined
        setStilrichtung((vibe?.stilrichtung as string) ?? '')
        const moods = (vibe?.moodAdjektive as string[]) ?? []
        setMoodAdjektive(new Set(moods.filter(m => MOOD_LABELS.includes(m))))
        setAnderesVibe(moods.find(m => !MOOD_LABELS.includes(m)) ?? '')
      } catch {
        setSettingError('Fehler beim Laden des Settings.')
      } finally {
        setSettingLoading(false)
      }
    }
    load()
  }, [settingId])

  useEffect(() => {
    if (!zoomUrl) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setZoomUrl(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomUrl])

  function toggleMood(label: string) {
    setMoodAdjektive(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n })
  }

  const addColor = () => { if (colors.length < 5) setColors([...colors, '#1b2a4a']) }
  const removeColor = (i: number) => setColors(colors.filter((_, idx) => idx !== i))
  const updateColor = (i: number, v: string) => { const u = [...colors]; u[i] = v; setColors(u) }
  const updateColorHex = (i: number, raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { const u = [...colors]; u[i] = v; setColors(u) }
  }

  function buildPayload(refinement: { storagePath: string; text: string }) {
    const allMoods = [...Array.from(moodAdjektive), ...(anderesVibe.trim() ? [anderesVibe.trim()] : [])]
    return {
      beschreibung: beschreibung.trim(),
      locationType: locationType!,
      indoor: { raumTyp: raumTyp || undefined, architekturstil: architekturstil || undefined, oberflaechenWandstrukturen: oberflaechenWandstrukturen || undefined, bodenbelag: bodenbelagIndoor || undefined },
      outdoorUrban: { umfeldSzenerie: umfeldSzenerie || undefined, staedtischerVibe: staedtischerVibe || undefined, bodenbeschaffenheit: bodenbeschaffenheitUrban || undefined, hintergrundElemente: hintergrundElemente || undefined },
      outdoorNatur: { landschaftsTyp: landschaftsTyp || undefined, vegetationDichte: vegetationDichte || undefined, bodenbeschaffenheit: bodenbeschaffenheitNatur || undefined, dominanteNaturelemente: dominanteNaturelemente || undefined },
      licht: { charakter: lichtCharakter || undefined, quelle: lichtquelle || undefined, tageszeit: tageszeit || undefined },
      farben: colors,
      farbsaettigung: farbsaettigung || undefined,
      setDesign: { dichte: setDichte || undefined, moebelObjekte: moebelObjekte || undefined, kleindekoration: kleindekoration || undefined },
      vibe: { stilrichtung: stilrichtung || undefined, moodAdjektive: allMoods.length > 0 ? allMoods : undefined },
      refinement,
    }
  }

  async function handleGenerate() {
    if (!setting?.storagePath) { setError(validationError('Das Original-Setting hat keinen Storage-Pfad.')); return }
    if (!beschreibung.trim()) { setError(validationError('Bitte beschreibe das gewünschte Setting.')); return }
    if (!locationType) { setError(validationError('Bitte wähle einen Location-Typ aus.')); return }
    if (!refinementText.trim()) { setError(validationError('Bitte beschreibe, was geändert oder verbessert werden soll.')); return }
    setError(null); setLoading(true)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateSettingImages', { timeout: 540000 })
      const response = await fn(buildPayload({ storagePath: setting.storagePath, text: refinementText.trim() }))
      setResult(response.data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      setError(formatFirebaseError(err))
    } finally { setLoading(false) }
  }

  function handleImageClick(i: number) {
    const state = imageStates[i] ?? 'active'
    if (state === 'discarded' || state === 'saved') return
    setSelectedIdx(prev => prev === i ? null : i)
    setRefineSource(null); setRefineText('')
  }

  function handleRefinementImageClick(rIdx: number, i: number) {
    const state = refinementHistory[rIdx]?.imageStates[i] ?? 'active'
    if (state === 'discarded' || state === 'saved') return
    setRefinementHistory(prev => prev.map((r, ri) =>
      ri === rIdx ? { ...r, selectedIdx: r.selectedIdx === i ? null : i } : { ...r, selectedIdx: null }
    ))
    setSelectedIdx(null); setRefineSource(null); setRefineText('')
  }

  function confirmDiscard() {
    if (!discardTarget) return
    if (discardTarget.rIdx !== undefined) {
      const rIdx = discardTarget.rIdx
      setRefinementHistory(prev => prev.map((r, ri) =>
        ri === rIdx ? { ...r, imageStates: { ...r.imageStates, [discardTarget.imgIdx]: 'discarded' }, selectedIdx: r.selectedIdx === discardTarget.imgIdx ? null : r.selectedIdx } : r
      ))
    } else {
      setImageStates(prev => ({ ...prev, [discardTarget.imgIdx]: 'discarded' }))
      if (selectedIdx === discardTarget.imgIdx) setSelectedIdx(null)
    }
    setDiscardTarget(null)
  }

  async function handleSave() {
    if (!saveTarget || !saveName.trim()) return
    setSaving(true); setSaveError(null)
    try {
      const permanentUrl = await getDownloadURL(ref(storage, saveTarget.storagePath))
      const allMoods = [...Array.from(moodAdjektive), ...(anderesVibe.trim() ? [anderesVibe.trim()] : [])]
      const briefing = JSON.parse(JSON.stringify({
        beschreibung: beschreibung.trim(), locationType,
        indoor: { raumTyp: raumTyp || undefined, architekturstil: architekturstil || undefined, oberflaechenWandstrukturen: oberflaechenWandstrukturen || undefined, bodenbelag: bodenbelagIndoor || undefined },
        outdoorUrban: { umfeldSzenerie: umfeldSzenerie || undefined, staedtischerVibe: staedtischerVibe || undefined, bodenbeschaffenheit: bodenbeschaffenheitUrban || undefined, hintergrundElemente: hintergrundElemente || undefined },
        outdoorNatur: { landschaftsTyp: landschaftsTyp || undefined, vegetationDichte: vegetationDichte || undefined, bodenbeschaffenheit: bodenbeschaffenheitNatur || undefined, dominanteNaturelemente: dominanteNaturelemente || undefined },
        licht: { charakter: lichtCharakter || undefined, quelle: lichtquelle || undefined, tageszeit: tageszeit || undefined },
        farben: colors, farbsaettigung: farbsaettigung || undefined,
        setDesign: { dichte: setDichte || undefined, moebelObjekte: moebelObjekte || undefined, kleindekoration: kleindekoration || undefined },
        vibe: { stilrichtung: stilrichtung || undefined, moodAdjektive: allMoods.length > 0 ? allMoods : undefined },
      }))
      await addDoc(collection(db, 'settings'), {
        imageUrl: permanentUrl, storagePath: saveTarget.storagePath,
        name: saveName.trim(), briefing,
        createdAt: Timestamp.now(), createdBy: userDoc?.name ?? 'Unbekannt',
        editedFrom: setting?.id ?? null,
      })
      if (saveTarget.rIdx !== undefined) {
        const rIdx = saveTarget.rIdx
        setRefinementHistory(prev => prev.map((r, ri) =>
          ri === rIdx ? { ...r, imageStates: { ...r.imageStates, [saveTarget.imgIdx]: 'saved' }, selectedIdx: r.selectedIdx === saveTarget.imgIdx ? null : r.selectedIdx } : r
        ))
      } else {
        setImageStates(prev => ({ ...prev, [saveTarget.imgIdx]: 'saved' }))
        if (selectedIdx === saveTarget.imgIdx) setSelectedIdx(null)
      }
      setSaveTarget(null); setSaveName('')
    } catch {
      setSaveError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally { setSaving(false) }
  }

  async function handleRefine() {
    if (!refineSource || !refineText.trim()) return
    setRefining(true); setRefineError(null)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateSettingImages', { timeout: 540000 })
      const response = await fn(buildPayload({ storagePath: refineSource.storagePath, text: refineText.trim() }))
      setRefinementHistory(prev => [...prev, { sourceLabel: refineSource.label, text: refineText.trim(), images: response.data.images, imageStates: {}, selectedIdx: null }])
      setRefineSource(null); setRefineText(''); setSelectedIdx(null)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      setRefineError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally { setRefining(false) }
  }

  function ZoomButton({ url }: { url: string }) {
    return (
      <button type="button" onClick={() => setZoomUrl(url)}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10" aria-label="Vergrößern">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zm-7-4v8m-4-4h8" />
        </svg>
      </button>
    )
  }

  function ActionButtons({ onDiscard, onSave, onRefine }: { onDiscard: () => void; onSave: () => void; onRefine: () => void }) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={onDiscard} className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">Verwerfen</button>
        <button type="button" onClick={onSave} className="text-sm font-medium py-1.5 rounded border border-orange/40 bg-orange/5 text-orange hover:bg-orange/15 transition-colors">Speichern</button>
        <button type="button" onClick={onRefine} className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">Verfeinern</button>
      </div>
    )
  }

  if (settingLoading) {
    return (
      <div className="flex items-center gap-3 text-navy/60 mt-8">
        <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Setting wird geladen …</span>
      </div>
    )
  }

  if (settingError || !setting) {
    return (
      <div className="mt-8 space-y-4">
        <p className="text-sm text-red-600">{settingError ?? 'Setting nicht gefunden.'}</p>
        <button type="button" onClick={() => router.push('/settings')} className="text-sm text-orange hover:text-orange/80">← Zurück zu Settings</button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-2">Setting bearbeiten</h1>
      <p className="text-sm text-navy/50 mb-8">Original: <span className="font-medium text-navy">{setting.name}</span> · Das Original bleibt gespeichert.</p>

      {/* Original setting image */}
      <div className="mb-10 flex gap-6 items-start p-5 bg-navy/[0.03] rounded-xl border border-navy/10">
        <div className="w-32 h-32 rounded-lg overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setting.imageUrl} alt={setting.name} className="w-full h-full object-cover" />
        </div>
        <div className="space-y-1 pt-1">
          <p className="text-xs text-navy/50 uppercase tracking-wide">Originalsetting</p>
          <p className="font-semibold text-navy">{setting.name}</p>
          <p className="text-xs text-navy/40 mt-2">Beschreibe unten, was geändert werden soll. Die neuen Varianten werden auf Basis dieses Bildes generiert.</p>
        </div>
      </div>

      {/* Refinement input */}
      <div className="mb-10 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-navy">Was soll geändert werden?</span>
          <textarea rows={4} value={refinementText} onChange={e => setRefinementText(e.target.value)}
            placeholder="Beschreibe die gewünschten Änderungen …"
            className={`${inputCls} resize-y`} disabled={loading} />
        </label>
      </div>

      {/* Form */}
      <form className={`space-y-20 ${loading ? 'opacity-50 pointer-events-none select-none' : ''}`}
        onSubmit={e => { e.preventDefault(); handleGenerate() }}>

        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Beschreibung</h3>
          <textarea rows={4} value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
            placeholder="Beschreibe das gewünschte Setting …" className={`${inputCls} resize-y`} />
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Location &amp; Räumlichkeit</h3>
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="location" value="indoor" checked={locationType === 'indoor'}
                  onChange={() => setLocationType('indoor')} onClick={() => locationType === 'indoor' && setLocationType(null)} className="w-4 h-4 accent-orange" />
                <span className="text-navy font-medium">Indoor / Innenraum</span>
              </label>
              {locationType === 'indoor' && (
                <div className="ml-7 flex flex-col gap-4">
                  <label className={labelCls}><span className={labelTextCls}>Raum-Typ</span>
                    <input type="text" value={raumTyp} onChange={e => setRaumTyp(e.target.value)} placeholder="Fotostudio, Hotel, Loft, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Architekturstil</span>
                    <input type="text" value={architekturstil} onChange={e => setArchitekturstil(e.target.value)} placeholder="Minimalistisch, industriell, Bauhaus, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Oberflächen &amp; Wandstrukturen</span>
                    <input type="text" value={oberflaechenWandstrukturen} onChange={e => setOberflaechenWandstrukturen(e.target.value)} placeholder="Sichtbeton, Backstein, Holzpaneele, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Bodenbelag</span>
                    <input type="text" value={bodenbelagIndoor} onChange={e => setBodenbelagIndoor(e.target.value)} placeholder="Parkett, Estrich, Teppich, …" className={inputCls} /></label>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="location" value="outdoor-urban" checked={locationType === 'outdoor-urban'}
                  onChange={() => setLocationType('outdoor-urban')} onClick={() => locationType === 'outdoor-urban' && setLocationType(null)} className="w-4 h-4 accent-orange" />
                <span className="text-navy font-medium">Outdoor Urban / Städtischer Raum</span>
              </label>
              {locationType === 'outdoor-urban' && (
                <div className="ml-7 flex flex-col gap-4">
                  <label className={labelCls}><span className={labelTextCls}>Umfeld &amp; Szenerie</span>
                    <input type="text" value={umfeldSzenerie} onChange={e => setUmfeldSzenerie(e.target.value)} placeholder="Straßenschlucht, Dachterrasse, Parkhaus, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Städtischer Vibe</span>
                    <input type="text" value={staedtischerVibe} onChange={e => setStaedtischerVibe(e.target.value)} placeholder="Brutalistisch, Historische Altstadt, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Bodenbeschaffenheit</span>
                    <input type="text" value={bodenbeschaffenheitUrban} onChange={e => setBodenbeschaffenheitUrban(e.target.value)} placeholder="Asphalt, Kopfsteinpflaster, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Hintergrund-Elemente</span>
                    <input type="text" value={hintergrundElemente} onChange={e => setHintergrundElemente(e.target.value)} placeholder="Neonreklame, Glasfronten, …" className={inputCls} /></label>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="location" value="outdoor-natur" checked={locationType === 'outdoor-natur'}
                  onChange={() => setLocationType('outdoor-natur')} onClick={() => locationType === 'outdoor-natur' && setLocationType(null)} className="w-4 h-4 accent-orange" />
                <span className="text-navy font-medium">Outdoor Natur / Landschaft</span>
              </label>
              {locationType === 'outdoor-natur' && (
                <div className="ml-7 flex flex-col gap-4">
                  <label className={labelCls}><span className={labelTextCls}>Landschafts-Typ</span>
                    <input type="text" value={landschaftsTyp} onChange={e => setLandschaftsTyp(e.target.value)} placeholder="Strand, Wald, Wüste, Berge, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Vegetation &amp; Dichte</span>
                    <input type="text" value={vegetationDichte} onChange={e => setVegetationDichte(e.target.value)} placeholder="Kahl, dichter Urwald, Herbstlaub, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Bodenbeschaffenheit</span>
                    <input type="text" value={bodenbeschaffenheitNatur} onChange={e => setBodenbeschaffenheitNatur(e.target.value)} placeholder="Sand, Kiesel, Waldboden, Gras, …" className={inputCls} /></label>
                  <label className={labelCls}><span className={labelTextCls}>Dominante Naturelemente</span>
                    <input type="text" value={dominanteNaturelemente} onChange={e => setDominateNaturelemente(e.target.value)} placeholder="Klippen, Baumwurzeln, Schilf, …" className={inputCls} /></label>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Ästhetischer Vibe &amp; Epoche</h3>
          <label className={labelCls}><span className={labelTextCls}>Stilrichtung / Ära</span>
            <input type="text" value={stilrichtung} onChange={e => setStilrichtung(e.target.value)} placeholder="Y2K, 90s Grunge, Futuristisch, …" className={inputCls} /></label>
          <div className="space-y-2">
            <span className={labelTextCls}>Mood-Adjektive</span>
            {MOOD_LABELS.map(label => (
              <label key={label} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={moodAdjektive.has(label)} onChange={() => toggleMood(label)} className="w-4 h-4 accent-orange shrink-0" />
                <span className="text-navy">{label}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" readOnly checked={anderesVibe.trim().length > 0} className="w-4 h-4 accent-orange shrink-0 pointer-events-none" />
              <input type="text" value={anderesVibe} onChange={e => setAnderesVibe(e.target.value)} placeholder="Anderes …" className={inputCls} />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Set-Design &amp; Requisiten</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className={`${labelCls} col-span-2 sm:col-span-1`}><span className={labelTextCls}>Dichte des Sets</span>
              <select value={setDichte} onChange={e => setSetDichte(e.target.value)} className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                <option value="">Keine Angabe</option>
                <option value="minimalistisch">Minimalistisch (Fokus nur auf Model)</option>
                <option value="medium">Medium</option>
                <option value="maximalistisch">Maximalistisch (opulent / voll)</option>
              </select>
            </label>
            <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Möbel und Objekte</span>
              <input type="text" value={moebelObjekte} onChange={e => setMoebelObjekte(e.target.value)} placeholder="Mid-Century Sessel, Lampen, …" className={inputCls} /></label>
            <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Kleindekoration &amp; organische Elemente</span>
              <input type="text" value={kleindekoration} onChange={e => setKleindekoration(e.target.value)} placeholder="Blumen, Spiegel, Kerzen, …" className={inputCls} /></label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Lichtstimmung &amp; Atmosphäre</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Licht-Charakter</span>
              <input type="text" value={lichtCharakter} onChange={e => setLichtCharakter(e.target.value)} placeholder="Weich und diffus, Hart mit Schlagschatten, …" className={inputCls} /></label>
            <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Lichtquelle</span>
              <input type="text" value={lichtquelle} onChange={e => setLichtquelle(e.target.value)} placeholder="Tageslicht, Studio-Kunstlicht, Neon, …" className={inputCls} /></label>
            <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Tageszeit / Stimmung</span>
              <input type="text" value={tageszeit} onChange={e => setTageszeit(e.target.value)} placeholder="High-Key, Golden Hour, Nacht, …" className={inputCls} /></label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Farbschema &amp; Tonalität</h3>
          <div className="space-y-3">
            <span className={labelTextCls}>Dominante Farben des Settings</span>
            <div className="flex flex-col gap-3">
              {colors.map((color, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden border border-navy/20 cursor-pointer">
                    <div className="absolute inset-0" style={{ backgroundColor: color }} />
                    <input type="color" value={color.length === 7 ? color : '#1b2a4a'} onChange={e => updateColor(i, e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <input type="text" value={color} onChange={e => updateColorHex(i, e.target.value)} maxLength={7} placeholder="#000000"
                    className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-32 font-mono text-sm" />
                  <button type="button" onClick={() => removeColor(i)} className="text-navy/40 hover:text-navy transition-colors text-lg leading-none">×</button>
                </div>
              ))}
            </div>
            {colors.length < 5 && (
              <button type="button" onClick={addColor} className="block text-sm text-orange hover:text-orange/80 transition-colors font-medium">+ Farbe hinzufügen</button>
            )}
          </div>
          <label className={labelCls}><span className={labelTextCls}>Farbsättigung</span>
            <input type="text" value={farbsaettigung} onChange={e => setFarbsaettigung(e.target.value)} placeholder="Entsättigt, pastellig, Vibrant, …" className={inputCls} /></label>
        </section>

        <div className="pt-2 flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
            {loading ? 'Wird generiert …' : 'Neue Varianten generieren'}
          </button>
          <button type="button" onClick={() => router.push('/settings')} disabled={loading}
            className="border border-navy/30 text-navy/60 font-medium px-6 py-3 rounded-md hover:border-navy/60 hover:text-navy transition-colors">
            Abbrechen
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-navy/60">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Neue Varianten werden generiert …</p>
        </div>
      )}

      {error && !loading && (
        <div className="mt-8 p-4 border border-red-300 bg-red-50 rounded-lg space-y-2">
          {error.kind === 'api' ? (
            <>
              <p className="text-sm font-bold text-red-700">Es tut uns leid, ein Fehler ist aufgetreten.</p>
              <p className="text-sm text-red-700">{error.code && <span className="font-medium">{error.code} – </span>}{error.explanation}</p>
              {error.action && <p className="text-sm text-red-700">{error.action}</p>}
              <button type="button" onClick={handleGenerate} className="text-sm font-medium text-orange hover:text-orange/80 transition-colors">Erneut versuchen</button>
            </>
          ) : (
            <p className="text-sm text-red-700">{error.explanation}</p>
          )}
        </div>
      )}

      {result && !loading && (
        <div ref={resultsRef} className="mt-16 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-navy">Neue Varianten</h2>
            <p className="text-sm text-navy/60 mt-1">Klicke auf ein Bild, um es auszuwählen. Gespeicherte Varianten werden als neues Setting angelegt.</p>
          </div>
          <div className="grid grid-cols-3 gap-4 items-start">
            {result.images.map((img, i) => {
              const state = imageStates[i] ?? 'active'
              if (state === 'discarded') return null
              const isSelected = selectedIdx === i
              return (
                <div key={img.storagePath} className="flex flex-col gap-2">
                  <div className="relative">
                    <button type="button" disabled={state === 'saved'} onClick={() => handleImageClick(i)}
                      className={`relative w-full aspect-square overflow-hidden rounded-lg border-2 transition-colors ${isSelected ? 'border-orange' : state === 'saved' ? 'border-transparent cursor-default' : 'border-transparent hover:border-orange'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Variante ${i + 1}`} className="w-full h-full object-cover" />
                      {state === 'saved' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                    <ZoomButton url={img.url} />
                  </div>
                  {isSelected && state === 'active' && (
                    <ActionButtons
                      onDiscard={() => setDiscardTarget({ imgIdx: i })}
                      onSave={() => { setSaveTarget({ url: img.url, storagePath: img.storagePath, imgIdx: i }); setSaveName('') }}
                      onRefine={() => { setRefineSource({ storagePath: img.storagePath, label: `Variante ${i + 1}` }); setSelectedIdx(null) }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {refinementHistory.map((record, rIdx) => (
            <div key={rIdx} className="space-y-4 pt-4 border-t border-navy/10">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-navy">{record.sourceLabel} verfeinern</p>
                <p className="text-sm text-navy/60">Anpassungen: {record.text}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 items-start">
                {record.images.map((img, i) => {
                  const state = record.imageStates[i] ?? 'active'
                  if (state === 'discarded') return null
                  const isSelected = record.selectedIdx === i
                  return (
                    <div key={img.storagePath} className="flex flex-col gap-2">
                      <div className="relative">
                        <button type="button" disabled={state === 'saved'} onClick={() => handleRefinementImageClick(rIdx, i)}
                          className={`relative w-full aspect-square overflow-hidden rounded-lg border-2 transition-colors ${isSelected ? 'border-orange' : state === 'saved' ? 'border-transparent cursor-default' : 'border-transparent hover:border-orange'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={`Verfeinerung ${rIdx + 1}, Variante ${i + 1}`} className="w-full h-full object-cover" />
                          {state === 'saved' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                        <ZoomButton url={img.url} />
                      </div>
                      {isSelected && state === 'active' && (
                        <ActionButtons
                          onDiscard={() => setDiscardTarget({ rIdx, imgIdx: i })}
                          onSave={() => { setSaveTarget({ url: img.url, storagePath: img.storagePath, rIdx, imgIdx: i }); setSaveName('') }}
                          onRefine={() => { setRefineSource({ storagePath: img.storagePath, label: `Verfeinerung ${rIdx + 1}, Variante ${i + 1}` }); setRefinementHistory(prev => prev.map((r, ri) => ri === rIdx ? { ...r, selectedIdx: null } : r)) }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {refineSource !== null && (
            <div className="space-y-4 border border-navy/10 rounded-xl p-5 bg-navy/[0.02]">
              <p className="text-sm text-navy/50">Auswahl verfeinern</p>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-navy">Anpassungen</span>
                <textarea rows={4} value={refineText} onChange={e => setRefineText(e.target.value)}
                  placeholder="Beschreibe, was du ändern möchtest …" className={`${inputCls} resize-y`} disabled={refining} />
              </label>
              {refining && (
                <div className="flex items-center gap-3 text-navy/60">
                  <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-sm">Neue Varianten werden generiert …</p>
                </div>
              )}
              {refineError && <p className="text-sm text-red-600">{refineError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={handleRefine} disabled={refining || !refineText.trim()}
                  className="bg-orange text-white font-semibold px-5 py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                  {refining ? 'Wird verfeinert …' : 'Verfeinern'}
                </button>
                <button type="button" onClick={() => { setRefineSource(null); setRefineText('') }} disabled={refining}
                  className="px-5 py-2 rounded-md border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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

      {discardTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Sind Sie sicher?</p>
            <div className="flex gap-3">
              <button type="button" onClick={confirmDiscard} className="flex-1 bg-navy text-white font-semibold py-2 rounded-md hover:bg-navy/90 transition-colors">Verwerfen</button>
              <button type="button" onClick={() => setDiscardTarget(null)} className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {saveTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Setting speichern</p>
            <p className="text-xs text-navy/50">Wird als neues Setting gespeichert. Das Original bleibt erhalten.</p>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Name</span>
              <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="z. B. Studio v2 …" className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange" autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && !saving && saveName.trim()) handleSave() }} />
            </label>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={handleSave} disabled={saving || !saveName.trim()}
                className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                {saving ? 'Wird gespeichert …' : 'Speichern'}
              </button>
              <button type="button" onClick={() => { setSaveTarget(null); setSaveName(''); setSaveError(null) }} disabled={saving}
                className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
