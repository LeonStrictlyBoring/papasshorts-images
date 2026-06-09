'use client'

import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { ref, getDownloadURL } from 'firebase/storage'
import { functions, db, storage } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'
import { formatFirebaseError, validationError, type FormattedError } from '@/lib/formatFirebaseError'

type LocationType = 'indoor' | 'outdoor-urban' | 'outdoor-natur' | null
type ImageState = 'active' | 'discarded' | 'saved'

const MOOD_LABELS = [
  'Luxuriös / High-End',
  'Düster / Moody',
  'Clean / Puristisch',
  'Verträumt / Surreal',
  'Urban / Raw',
]

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full'
const labelCls = 'flex flex-col gap-1'
const labelTextCls = 'text-sm text-navy/70'

interface GeneratedImage { url: string; storagePath: string }
interface GenerationResult { images: GeneratedImage[]; promptUsed: string; generationId: string }

interface RefinementRecord {
  sourceLabel: string
  text: string
  images: GeneratedImage[]
  imageStates: Record<number, ImageState>
  selectedIdx: number | null
}

interface SaveTarget { url: string; storagePath: string; rIdx?: number; imgIdx: number }
interface DiscardTarget { rIdx?: number; imgIdx: number }

export default function SettingCreatePage() {
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

  // Reference images
  const [referenceImages, setReferenceImages] = useState<{ id: string; previewUrl: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generation state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<FormattedError | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Image interaction
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [imageStates, setImageStates] = useState<Record<number, ImageState>>({})
  const [saveTarget, setSaveTarget] = useState<SaveTarget | null>(null)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Refinement history
  const [refinementHistory, setRefinementHistory] = useState<RefinementRecord[]>([])

  // Refinement panel
  const [refinementSource, setRefinementSource] = useState<{ storagePath: string; label: string } | null>(null)
  const [refinementText, setRefinementText] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  // Zoom
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)
  const { userDoc } = useAuth()

  useEffect(() => {
    if (!zoomUrl) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setZoomUrl(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomUrl])

  function toggleMood(label: string) {
    setMoodAdjektive(prev => {
      const next = new Set(prev)
      if (next.has(label)) { next.delete(label) } else { next.add(label) }
      return next
    })
  }

  function buildPayload(refinement?: { storagePath: string; text: string }) {
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
      ...(refinement && { refinement }),
    }
  }

  async function handleSubmit() {
    if (!beschreibung.trim()) { setError(validationError('Bitte beschreibe das gewünschte Setting.')); return }
    if (!locationType) { setError(validationError('Bitte wähle einen Location-Typ aus.')); return }
    setError(null); setLoading(true)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateSettingImages', { timeout: 540000 })
      const response = await fn(buildPayload())
      setResult(response.data); setSubmitted(true)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      setError(formatFirebaseError(err))
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setBeschreibung(''); setLocationType(null)
    setRaumTyp(''); setArchitekturstil(''); setOberflaechenWandstrukturen(''); setBodenbelagIndoor('')
    setUmfeldSzenerie(''); setStaedtischerVibe(''); setBodenbeschaffenheitUrban(''); setHintergrundElemente('')
    setLandschaftsTyp(''); setVegetationDichte(''); setBodenbeschaffenheitNatur(''); setDominateNaturelemente('')
    setLichtCharakter(''); setLichtquelle(''); setTageszeit('')
    setColors(['#1b2a4a']); setFarbsaettigung('')
    setSetDichte(''); setMoebelObjekte(''); setKleindekoration('')
    setStilrichtung(''); setMoodAdjektive(new Set()); setAnderesVibe('')
    setReferenceImages([])
    setSubmitted(false); setResult(null); setSelectedIdx(null); setImageStates({})
    setError(null); setDiscardTarget(null); setSaveTarget(null); setSaveName('')
    setRefinementSource(null); setRefinementText(''); setRefineError(null)
    setRefinementHistory([]); setZoomUrl(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleImageClick(i: number) {
    const state = imageStates[i] ?? 'active'
    if (state === 'discarded' || state === 'saved') return
    setSelectedIdx(prev => prev === i ? null : i)
    setRefinementSource(null); setRefinementText('')
  }

  function handleRefinementImageClick(rIdx: number, i: number) {
    const state = refinementHistory[rIdx]?.imageStates[i] ?? 'active'
    if (state === 'discarded' || state === 'saved') return
    setRefinementHistory(prev => prev.map((r, ri) =>
      ri === rIdx ? { ...r, selectedIdx: r.selectedIdx === i ? null : i } : { ...r, selectedIdx: null }
    ))
    setSelectedIdx(null)
    setRefinementSource(null); setRefinementText('')
  }

  function confirmDiscard() {
    if (!discardTarget) return
    if (discardTarget.rIdx !== undefined) {
      const rIdx = discardTarget.rIdx
      setRefinementHistory(prev => prev.map((r, ri) =>
        ri === rIdx
          ? { ...r, imageStates: { ...r.imageStates, [discardTarget.imgIdx]: 'discarded' },
              selectedIdx: r.selectedIdx === discardTarget.imgIdx ? null : r.selectedIdx }
          : r
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
      const briefing = JSON.parse(JSON.stringify(buildPayload()))
      await addDoc(collection(db, 'settings'), {
        imageUrl: permanentUrl,
        storagePath: saveTarget.storagePath,
        name: saveName.trim(),
        briefing,
        createdAt: Timestamp.now(),
        createdBy: userDoc?.name ?? 'Unbekannt',
      })
      if (saveTarget.rIdx !== undefined) {
        const rIdx = saveTarget.rIdx
        setRefinementHistory(prev => prev.map((r, ri) =>
          ri === rIdx
            ? { ...r, imageStates: { ...r.imageStates, [saveTarget.imgIdx]: 'saved' },
                selectedIdx: r.selectedIdx === saveTarget.imgIdx ? null : r.selectedIdx }
            : r
        ))
      } else {
        setImageStates(prev => ({ ...prev, [saveTarget.imgIdx]: 'saved' }))
        if (selectedIdx === saveTarget.imgIdx) setSelectedIdx(null)
      }
      setSaveTarget(null); setSaveName('')
    } catch {
      setSaveError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRefine() {
    if (!refinementSource || !refinementText.trim()) return
    setRefining(true); setRefineError(null)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateSettingImages', { timeout: 540000 })
      const response = await fn(buildPayload({ storagePath: refinementSource.storagePath, text: refinementText.trim() }))
      setRefinementHistory(prev => [...prev, {
        sourceLabel: refinementSource.label,
        text: refinementText.trim(),
        images: response.data.images,
        imageStates: {},
        selectedIdx: null,
      }])
      setRefinementSource(null); setRefinementText(''); setSelectedIdx(null)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      setRefineError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setRefining(false)
    }
  }

  function ZoomButton({ url }: { url: string }) {
    return (
      <button type="button" onClick={() => setZoomUrl(url)}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
        aria-label="Vergrößern">
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const newImages = await Promise.all(
        files.map(file => new Promise<{ id: string; previewUrl: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, previewUrl: reader.result as string })
          reader.onerror = reject
          reader.readAsDataURL(file)
        }))
      )
      setReferenceImages(prev => [...prev, ...newImages])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeReferenceImage(id: string) {
    setReferenceImages(prev => prev.filter(img => img.id !== id))
  }

  const addColor = () => { if (colors.length < 5) setColors([...colors, '#1b2a4a']) }
  const removeColor = (i: number) => setColors(colors.filter((_, idx) => idx !== i))
  const updateColor = (i: number, v: string) => { const u = [...colors]; u[i] = v; setColors(u) }
  const updateColorHex = (i: number, raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { const u = [...colors]; u[i] = v; setColors(u) }
  }

  const locationLabel = locationType === 'indoor' ? 'Indoor / Innenraum'
    : locationType === 'outdoor-urban' ? 'Outdoor Urban / Städtischer Raum'
    : locationType === 'outdoor-natur' ? 'Outdoor Natur / Landschaft' : '–'

  const allMoodsDisplay = [...Array.from(moodAdjektive), ...(anderesVibe.trim() ? [anderesVibe.trim()] : [])].join(', ')

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-8">Setting erstellen</h1>

      {/* Editable form */}
      {!submitted && (
        <form
          className={`space-y-20 ${loading ? 'opacity-50 pointer-events-none select-none' : ''}`}
          onSubmit={e => { e.preventDefault(); handleSubmit() }}
        >
          {/* Beschreibung */}
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Beschreibung</h3>
            <textarea rows={4} value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
              placeholder="Beschreibe das gewünschte Setting …" className={`${inputCls} resize-y`} />
          </section>

          {/* Location & Räumlichkeit */}
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Location &amp; Räumlichkeit</h3>
            <div className="space-y-6">
              {/* Indoor */}
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="location" value="indoor" checked={locationType === 'indoor'}
                    onChange={() => setLocationType('indoor')} onClick={() => locationType === 'indoor' && setLocationType(null)}
                    className="w-4 h-4 accent-orange" />
                  <span className="text-navy font-medium">Indoor / Innenraum</span>
                </label>
                {locationType === 'indoor' && (
                  <div className="ml-7 flex flex-col gap-4">
                    <label className={labelCls}><span className={labelTextCls}>Raum-Typ</span>
                      <input type="text" value={raumTyp} onChange={e => setRaumTyp(e.target.value)} placeholder="Fotostudio (White Cube), Tageslichtstudio, Hotel, Industriehalle, Loft, Altbauwohnung, Sakralbau, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Architekturstil</span>
                      <input type="text" value={architekturstil} onChange={e => setArchitekturstil(e.target.value)} placeholder="Minimalistisch, industriell, Barock, Jugendstil, Bauhaus, rustikal, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Oberflächen &amp; Wandstrukturen</span>
                      <input type="text" value={oberflaechenWandstrukturen} onChange={e => setOberflaechenWandstrukturen(e.target.value)} placeholder="Sichtbeton, Backstein, Stuck, Holzpaneele, Gips, Fliesen, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Bodenbelag</span>
                      <input type="text" value={bodenbelagIndoor} onChange={e => setBodenbelagIndoor(e.target.value)} placeholder="Fischgrätparkett, Estrich (poliert), Teppich, Epoxidharz, …" className={inputCls} /></label>
                  </div>
                )}
              </div>
              {/* Outdoor Urban */}
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="location" value="outdoor-urban" checked={locationType === 'outdoor-urban'}
                    onChange={() => setLocationType('outdoor-urban')} onClick={() => locationType === 'outdoor-urban' && setLocationType(null)}
                    className="w-4 h-4 accent-orange" />
                  <span className="text-navy font-medium">Outdoor Urban / Städtischer Raum</span>
                </label>
                {locationType === 'outdoor-urban' && (
                  <div className="ml-7 flex flex-col gap-4">
                    <label className={labelCls}><span className={labelTextCls}>Umfeld &amp; Szenerie</span>
                      <input type="text" value={umfeldSzenerie} onChange={e => setUmfeldSzenerie(e.target.value)} placeholder="Straßenschlucht, Dachterrasse, Skatepark, U-Bahn-Station, Hinterhof, Parkhaus, Moderne Glasfassade, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Städtischer Vibe</span>
                      <input type="text" value={staedtischerVibe} onChange={e => setStaedtischerVibe(e.target.value)} placeholder="Brutalistisch, Beton, Historische Altstadt, Futuristische Skyline, Graffiti, Sperrmüll, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Bodenbeschaffenheit</span>
                      <input type="text" value={bodenbeschaffenheitUrban} onChange={e => setBodenbeschaffenheitUrban(e.target.value)} placeholder="Asphalt, Kopfsteinpflaster, Betonplatten, Gitterroste, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Hintergrund-Elemente</span>
                      <input type="text" value={hintergrundElemente} onChange={e => setHintergrundElemente(e.target.value)} placeholder="Neonreklame, Baustellenzäune, Ampelanlagen, spiegelnde Glasfronten, …" className={inputCls} /></label>
                  </div>
                )}
              </div>
              {/* Outdoor Natur */}
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="location" value="outdoor-natur" checked={locationType === 'outdoor-natur'}
                    onChange={() => setLocationType('outdoor-natur')} onClick={() => locationType === 'outdoor-natur' && setLocationType(null)}
                    className="w-4 h-4 accent-orange" />
                  <span className="text-navy font-medium">Outdoor Natur / Landschaft</span>
                </label>
                {locationType === 'outdoor-natur' && (
                  <div className="ml-7 flex flex-col gap-4">
                    <label className={labelCls}><span className={labelTextCls}>Landschafts-Typ</span>
                      <input type="text" value={landschaftsTyp} onChange={e => setLandschaftsTyp(e.target.value)} placeholder="Strand, Küste, Wald, Wüste, Sanddünen, Berge, Felsen, Wiese, Feld, See, Fluss, Vulkanlandschaft, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Vegetation &amp; Dichte</span>
                      <input type="text" value={vegetationDichte} onChange={e => setVegetationDichte(e.target.value)} placeholder="Kahl, karg, dichter Urwald, Weite Steppe, Blühende Heide, Herbstlaub, Schneedecke, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Bodenbeschaffenheit</span>
                      <input type="text" value={bodenbeschaffenheitNatur} onChange={e => setBodenbeschaffenheitNatur(e.target.value)} placeholder="Feiner Sand, Kiesel, Steine, Waldboden, Moos, Trockene und rissige Erde, Gras, Rasen, …" className={inputCls} /></label>
                    <label className={labelCls}><span className={labelTextCls}>Dominante Naturelemente</span>
                      <input type="text" value={dominanteNaturelemente} onChange={e => setDominateNaturelemente(e.target.value)} placeholder="Klippen, alte Baumwurzeln, Schilf, Dünenhafer, …" className={inputCls} /></label>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Ästhetischer Vibe & Epoche */}
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Ästhetischer Vibe &amp; Epoche</h3>
            <label className={labelCls}><span className={labelTextCls}>Stilrichtung / Ära</span>
              <input type="text" value={stilrichtung} onChange={e => setStilrichtung(e.target.value)} placeholder="Y2K, 90s Grunge, 70s Retro, Futuristisch, Zeitlos-Elegant, …" className={inputCls} /></label>
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

          {/* Set-Design & Requisiten */}
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
                <input type="text" value={moebelObjekte} onChange={e => setMoebelObjekte(e.target.value)} placeholder="Mid-Century Sessel, Metall-Stühle, Fahrzeuge, Lampen, …" className={inputCls} /></label>
              <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Kleindekoration &amp; organische Elemente</span>
                <input type="text" value={kleindekoration} onChange={e => setKleindekoration(e.target.value)} placeholder="Blumen, Spiegel, Schnee, Wasserflächen, Kerzen, …" className={inputCls} /></label>
            </div>
          </section>

          {/* Lichtstimmung & Atmosphäre */}
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Lichtstimmung &amp; Atmosphäre</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Licht-Charakter</span>
                <input type="text" value={lichtCharakter} onChange={e => setLichtCharakter(e.target.value)} placeholder="Weich und diffus, Hart mit Schlagschatten, Cinematic, Blitzlicht-Look, …" className={inputCls} /></label>
              <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Lichtquelle</span>
                <input type="text" value={lichtquelle} onChange={e => setLichtquelle(e.target.value)} placeholder="Reines Tageslicht, Studio-Kunstlicht, Mischlicht, Neon- & Farbfilter, …" className={inputCls} /></label>
              <label className={`${labelCls} col-span-2`}><span className={labelTextCls}>Tageszeit / Stimmung</span>
                <input type="text" value={tageszeit} onChange={e => setTageszeit(e.target.value)} placeholder="High-Key hell und clean, Low-Key dunkel und mystisch, Golden Hour, Sonnenuntergang, Nacht, …" className={inputCls} /></label>
            </div>
          </section>

          {/* Farbschema & Tonalität */}
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
                    <button type="button" onClick={() => removeColor(i)} className="text-navy/40 hover:text-navy transition-colors text-lg leading-none" aria-label="Farbe entfernen">×</button>
                  </div>
                ))}
              </div>
              {colors.length < 5 && (
                <button type="button" onClick={addColor} className="block text-sm text-orange hover:text-orange/80 transition-colors font-medium">+ Farbe hinzufügen</button>
              )}
            </div>
            <label className={labelCls}><span className={labelTextCls}>Farbsättigung</span>
              <input type="text" value={farbsaettigung} onChange={e => setFarbsaettigung(e.target.value)} placeholder="Entsättigt, pastellig, Vibrant, knallig, kontrastreich, Schwarz-Weiß, …" className={inputCls} /></label>
          </section>

          {/* Referenzen & Moods */}
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Referenzen &amp; Moods</h3>
            <div className={labelCls}>
              <span className={labelTextCls}>Beispielbilder für das Setting</span>
              <label className="flex items-center gap-3 cursor-pointer self-start">
                <span className="border border-navy/20 rounded-md px-4 py-2 text-sm text-navy/70 hover:border-orange hover:text-navy transition-colors">+ Bilder auswählen</span>
                <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
              {uploading && (
                <div className="flex items-center gap-2 text-navy/60 mt-1">
                  <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm">Bilder werden geladen …</span>
                </div>
              )}
              {referenceImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-2">
                  {referenceImages.map(img => (
                    <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-navy/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeReferenceImage(img.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none" aria-label="Bild entfernen">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="pt-2">
            <button type="submit" disabled={loading}
              className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
              {loading ? 'Wird erstellt …' : 'Setting erstellen'}
            </button>
          </div>
        </form>
      )}

      {/* Read-only summary */}
      {submitted && (
        <div className="space-y-8 bg-navy/5 rounded-xl p-6">
          <section className="space-y-2">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Beschreibung</h3>
            <p className="text-sm text-navy whitespace-pre-wrap">{beschreibung || '–'}</p>
          </section>
          <section className="space-y-3">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Location &amp; Räumlichkeit</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><p className="text-xs text-navy/50">Location-Typ</p><p className="text-navy">{locationLabel}</p></div>
              {locationType === 'indoor' && (<>
                {raumTyp && <div><p className="text-xs text-navy/50">Raum-Typ</p><p className="text-navy">{raumTyp}</p></div>}
                {architekturstil && <div><p className="text-xs text-navy/50">Architekturstil</p><p className="text-navy">{architekturstil}</p></div>}
                {oberflaechenWandstrukturen && <div className="col-span-2"><p className="text-xs text-navy/50">Oberflächen & Wandstrukturen</p><p className="text-navy">{oberflaechenWandstrukturen}</p></div>}
                {bodenbelagIndoor && <div><p className="text-xs text-navy/50">Bodenbelag</p><p className="text-navy">{bodenbelagIndoor}</p></div>}
              </>)}
              {locationType === 'outdoor-urban' && (<>
                {umfeldSzenerie && <div className="col-span-2"><p className="text-xs text-navy/50">Umfeld & Szenerie</p><p className="text-navy">{umfeldSzenerie}</p></div>}
                {staedtischerVibe && <div><p className="text-xs text-navy/50">Städtischer Vibe</p><p className="text-navy">{staedtischerVibe}</p></div>}
                {bodenbeschaffenheitUrban && <div><p className="text-xs text-navy/50">Bodenbeschaffenheit</p><p className="text-navy">{bodenbeschaffenheitUrban}</p></div>}
                {hintergrundElemente && <div className="col-span-2"><p className="text-xs text-navy/50">Hintergrund-Elemente</p><p className="text-navy">{hintergrundElemente}</p></div>}
              </>)}
              {locationType === 'outdoor-natur' && (<>
                {landschaftsTyp && <div><p className="text-xs text-navy/50">Landschafts-Typ</p><p className="text-navy">{landschaftsTyp}</p></div>}
                {vegetationDichte && <div><p className="text-xs text-navy/50">Vegetation & Dichte</p><p className="text-navy">{vegetationDichte}</p></div>}
                {bodenbeschaffenheitNatur && <div><p className="text-xs text-navy/50">Bodenbeschaffenheit</p><p className="text-navy">{bodenbeschaffenheitNatur}</p></div>}
                {dominanteNaturelemente && <div><p className="text-xs text-navy/50">Dominante Naturelemente</p><p className="text-navy">{dominanteNaturelemente}</p></div>}
              </>)}
            </div>
          </section>
          {(lichtCharakter || lichtquelle || tageszeit) && (
            <section className="space-y-3">
              <h3 className="text-base font-bold text-navy uppercase tracking-wide">Lichtstimmung</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {lichtCharakter && <div><p className="text-xs text-navy/50">Licht-Charakter</p><p className="text-navy">{lichtCharakter}</p></div>}
                {lichtquelle && <div><p className="text-xs text-navy/50">Lichtquelle</p><p className="text-navy">{lichtquelle}</p></div>}
                {tageszeit && <div className="col-span-2"><p className="text-xs text-navy/50">Tageszeit / Stimmung</p><p className="text-navy">{tageszeit}</p></div>}
              </div>
            </section>
          )}
          {(stilrichtung || allMoodsDisplay) && (
            <section className="space-y-3">
              <h3 className="text-base font-bold text-navy uppercase tracking-wide">Ästhetischer Vibe</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {stilrichtung && <div><p className="text-xs text-navy/50">Stilrichtung / Ära</p><p className="text-navy">{stilrichtung}</p></div>}
                {allMoodsDisplay && <div className="col-span-2"><p className="text-xs text-navy/50">Mood-Adjektive</p><p className="text-navy">{allMoodsDisplay}</p></div>}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-navy/60">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Dein Setting wird erstellt …</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mt-8 p-4 border border-red-300 bg-red-50 rounded-lg space-y-2">
          {error.kind === 'api' ? (
            <>
              <p className="text-sm font-bold text-red-700">Es tut uns leid, ein Fehler ist aufgetreten.</p>
              <p className="text-sm text-red-700">
                {error.code && <span className="font-medium">{error.code} – </span>}
                {error.explanation}
              </p>
              {error.action && <p className="text-sm text-red-700">{error.action}</p>}
              <button type="button" onClick={handleSubmit} className="text-sm font-medium text-orange hover:text-orange/80 transition-colors">Erneut versuchen</button>
            </>
          ) : (
            <p className="text-sm text-red-700">{error.explanation}</p>
          )}
        </div>
      )}

      {/* Generated images */}
      {result && !loading && (
        <div ref={resultsRef} className="mt-16 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-navy">Deine Setting-Varianten</h2>
            <p className="text-sm text-navy/60 mt-1">Klicke auf ein Bild, um es auszuwählen.</p>
          </div>
          {/* Original batch */}
          <div className="grid grid-cols-3 gap-4 items-start">
            {result.images.map((img, i) => {
              const state = imageStates[i] ?? 'active'
              if (state === 'discarded') return null
              const isSelected = selectedIdx === i
              return (
                <div key={img.storagePath} className="flex flex-col gap-2">
                  <div className="relative">
                    <button type="button" disabled={state === 'saved'} onClick={() => handleImageClick(i)}
                      className={`relative w-full aspect-square overflow-hidden rounded-lg border-2 transition-colors ${isSelected ? 'border-orange' : state === 'saved' ? 'border-transparent cursor-default' : 'border-transparent hover:border-orange focus:outline-none focus:border-orange'}`}
                      aria-label={`Setting-Variante ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Setting-Variante ${i + 1}`} className="w-full h-full object-cover" />
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
                      onRefine={() => { setRefinementSource({ storagePath: img.storagePath, label: `Variante ${i + 1}` }); setSelectedIdx(null) }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Refinement history */}
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
                          className={`relative w-full aspect-square overflow-hidden rounded-lg border-2 transition-colors ${isSelected ? 'border-orange' : state === 'saved' ? 'border-transparent cursor-default' : 'border-transparent hover:border-orange focus:outline-none focus:border-orange'}`}
                          aria-label={`Verfeinerung ${rIdx + 1}, Variante ${i + 1}`}>
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
                          onRefine={() => { setRefinementSource({ storagePath: img.storagePath, label: `Auswahl` }); setRefinementHistory(prev => prev.map((r, ri) => ri === rIdx ? { ...r, selectedIdx: null } : r)) }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Refinement panel */}
          {refinementSource !== null && (
            <div className="space-y-4 border border-navy/10 rounded-xl p-5 bg-navy/[0.02]">
              <p className="text-sm text-navy/50">Auswahl verfeinern</p>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-navy">Anpassungen</span>
                <textarea rows={4} value={refinementText} onChange={e => setRefinementText(e.target.value)}
                  placeholder="Beschreibe, was du ändern möchtest …" className={`w-full ${inputCls} resize-y`} disabled={refining} />
              </label>
              {refining && (
                <div className="flex items-center gap-3 text-navy/60">
                  <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-sm">Neue Varianten werden generiert …</p>
                </div>
              )}
              {refineError && <p className="text-sm text-red-600">{refineError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={handleRefine} disabled={refining || !refinementText.trim()}
                  className="bg-orange text-white font-semibold px-5 py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                  {refining ? 'Wird verfeinert …' : 'Verfeinern'}
                </button>
                <button type="button" onClick={() => { setRefinementSource(null); setRefinementText('') }} disabled={refining}
                  className="px-5 py-2 rounded-md border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset */}
      {submitted && (
        <div className="mt-12 pb-8">
          <button type="button" onClick={handleReset}
            className="border border-navy/30 text-navy/60 font-medium px-6 py-3 rounded-md hover:border-navy/60 hover:text-navy transition-colors">Reset</button>
        </div>
      )}

      {/* Zoom modal */}
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

      {/* Discard dialog */}
      {discardTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Sind Sie sicher?</p>
            <div className="flex gap-3">
              <button type="button" onClick={confirmDiscard}
                className="flex-1 bg-navy text-white font-semibold py-2 rounded-md hover:bg-navy/90 transition-colors">Verwerfen</button>
              <button type="button" onClick={() => setDiscardTarget(null)}
                className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Save dialog */}
      {saveTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Setting speichern</p>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Name</span>
              <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="z. B. Industrieloft, Waldsetting …" className={inputCls} autoFocus
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
