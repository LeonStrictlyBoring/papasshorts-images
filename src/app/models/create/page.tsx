'use client'

import { useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { functions, db } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

const ARCHETYPES = [
  'Klassischer Gentleman (Anzüge, Luxus, zeitlose Eleganz)',
  'Urbaner Rebell (Streetwear, Tattoos, moderner Edge)',
  'Naturbursche (Outdoor, Workwear, markant mit Bart)',
  'Androgener Ästhet (High-Fashion, avantgardistisch, feine Züge)',
  'Kumpel (Casual Wear, E-Commerce, sympathisch)',
  'Mentor / Vater (Best Ager, Vertrauen, Familie, Casual Comfort)',
  'Leader / Chef (Macht, Status, Senior Executive, Alpha-Ausstrahlung)',
  'Performer / Sportler (Athletisch, Dynamik, Activewear, Fitness)',
  'Homoerotisch (Sinnlich, progressive Mode)',
  'Normalo / Bürgerlich (Unauffällig, Mainstream, klassische Kaufhausmode, bürgerlich)',
  'Nerd / Intellectual (Brille, smarte Ausstrahlung, Preppy-Look, Strickwesten)',
  'Rockstar / Bohemien (Künstlerisch, lange Haare, Schmuck, Vintage, Festival-Style)',
  'Youngster / Gen-Z (Teenie-Look, TikTok-Trends, Skater, jugendliche Leichtigkeit)',
]

const inputCls =
  'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange'
const selectCls =
  'border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange'

interface GeneratedImage {
  url: string
  storagePath: string
}

interface GenerationResult {
  images: GeneratedImage[]
  promptUsed: string
  generationId: string
}

type ImageState = 'active' | 'discarded' | 'saved'

export default function ModelCreatePage() {
  // Form state
  const [persona, setPersona] = useState('')
  const [height, setHeight] = useState('')
  const [clothingSize, setClothingSize] = useState('')
  const [shoeSize, setShoeSize] = useState('')
  const [chest, setChest] = useState('')
  const [waist, setWaist] = useState('')
  const [hips, setHips] = useState('')
  const [build, setBuild] = useState('')
  const [phenotype, setPhenotype] = useState('')
  const [eyeColor, setEyeColor] = useState('')
  const [skinTone, setSkinTone] = useState('')
  const [skinUndertone, setSkinUndertone] = useState('')
  const [hairColor, setHairColor] = useState('')
  const [hairTexture, setHairTexture] = useState('')
  const [hairLength, setHairLength] = useState('')
  const [beard, setBeard] = useState('')
  const [specialFeatures, setSpecialFeatures] = useState('')
  const [selectedArchetypes, setSelectedArchetypes] = useState<Set<string>>(new Set())
  const [customArchetypeText, setCustomArchetypeText] = useState('')

  // Generation state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Image interaction
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [imageStates, setImageStates] = useState<Record<number, ImageState>>({})

  // Discard dialog
  const [discardDialogIdx, setDiscardDialogIdx] = useState<number | null>(null)

  // Save dialog
  const [saveDialogIdx, setSaveDialogIdx] = useState<number | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Refinement
  const [refinementSource, setRefinementSource] = useState<number | null>(null)
  const [refinementText, setRefinementText] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)
  const { userDoc } = useAuth()

  function toggleArchetype(label: string) {
    setSelectedArchetypes((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function validate(): string | null {
    if (!persona.trim()) return 'Bitte beschreibe die Persona.'
    if (selectedArchetypes.size === 0 && !customArchetypeText.trim()) {
      return 'Bitte wähle mindestens einen Archetypen oder trage einen eigenen ein.'
    }
    return null
  }

  function buildRequestPayload(refinement?: { storagePath: string; text: string }) {
    const archetypes = Array.from(selectedArchetypes).map((label) => label.split(' (')[0])
    const customArchetype = customArchetypeText.trim() || undefined
    return {
      persona: persona.trim(),
      bodyMeasurements: {
        ...(height && { height }),
        ...(clothingSize && { clothingSize }),
        ...(shoeSize && { shoeSize }),
        ...(chest && { chest }),
        ...(waist && { waist }),
        ...(hips && { hips }),
      },
      appearance: {
        ...(build && { build }),
        ...(phenotype && { phenotype }),
        ...(eyeColor && { eyeColor }),
        ...(skinTone && { skinTone }),
        ...(skinUndertone && { skinUndertone }),
        ...(hairColor && { hairColor }),
        ...(hairTexture && { hairTexture }),
        ...(hairLength && { hairLength }),
        ...(beard && { beard }),
        ...(specialFeatures.trim() && { specialFeatures: specialFeatures.trim() }),
      },
      archetypes,
      ...(customArchetype && { customArchetype }),
      ...(refinement && { refinement }),
    }
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateModelImages')
      const response = await fn(buildRequestPayload())
      setResult(response.data)
      setSubmitted(true)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setPersona(''); setHeight(''); setClothingSize(''); setShoeSize('')
    setChest(''); setWaist(''); setHips('')
    setBuild(''); setPhenotype(''); setEyeColor(''); setSkinTone(''); setSkinUndertone('')
    setHairColor(''); setHairTexture(''); setHairLength(''); setBeard(''); setSpecialFeatures('')
    setSelectedArchetypes(new Set()); setCustomArchetypeText('')
    setSubmitted(false); setResult(null); setSelectedIdx(null); setImageStates({})
    setError(null); setDiscardDialogIdx(null); setSaveDialogIdx(null); setSaveName('')
    setRefinementSource(null); setRefinementText(''); setRefineError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleImageClick(i: number) {
    const state = imageStates[i] ?? 'active'
    if (state === 'discarded' || state === 'saved') return
    setSelectedIdx((prev) => (prev === i ? null : i))
    if (refinementSource !== null) { setRefinementSource(null); setRefinementText('') }
  }

  function confirmDiscard(i: number) {
    setImageStates((prev) => ({ ...prev, [i]: 'discarded' }))
    setDiscardDialogIdx(null)
    if (selectedIdx === i) setSelectedIdx(null)
  }

  async function handleSave() {
    if (saveDialogIdx === null || !result || !saveName.trim()) return
    setSaving(true); setSaveError(null)
    try {
      await addDoc(collection(db, 'models'), {
        imageUrl: result.images[saveDialogIdx].url,
        storagePath: result.images[saveDialogIdx].storagePath,
        name: saveName.trim(),
        sedcard: {
          persona,
          bodyMeasurements: { height, clothingSize, shoeSize, chest, waist, hips },
          appearance: { build, phenotype, eyeColor, skinTone, skinUndertone, hairColor, hairTexture, hairLength, beard, specialFeatures },
          archetypes: Array.from(selectedArchetypes),
          customArchetype: customArchetypeText.trim() || null,
        },
        createdAt: Timestamp.now(),
        createdBy: userDoc?.name ?? 'Unbekannt',
      })
      setImageStates((prev) => ({ ...prev, [saveDialogIdx]: 'saved' }))
      setSaveDialogIdx(null); setSaveName('')
      if (selectedIdx === saveDialogIdx) setSelectedIdx(null)
    } catch {
      setSaveError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRefine() {
    if (refinementSource === null || !result || !refinementText.trim()) return
    setRefining(true); setRefineError(null)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateModelImages')
      const response = await fn(buildRequestPayload({
        storagePath: result.images[refinementSource].storagePath,
        text: refinementText.trim(),
      }))
      setResult((prev) =>
        prev ? { ...prev, images: [...prev.images, ...response.data.images] } : response.data
      )
      setRefinementSource(null); setRefinementText(''); setSelectedIdx(null)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      setRefineError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setRefining(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-8">Model erstellen</h1>

      {/* Editable form */}
      {!submitted && (
        <form
          className={`space-y-20 ${loading ? 'opacity-50 pointer-events-none select-none' : ''}`}
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        >
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Persona</h3>
            <textarea
              rows={4}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="Beschreibe die Persona des Models …"
              className={`w-full ${inputCls} resize-y`}
            />
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Körpermaße &amp; Steckbrief</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Körpergröße (in cm)</span>
                  <input type="number" min={100} max={250} placeholder="z. B. 175"
                    value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Statur / Körpertyp</span>
                  <select value={build} onChange={(e) => setBuild(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Schlank', 'Sportlich', 'Kurvig', 'Zierlich'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Konfektionsgröße</span>
                  <select value={clothingSize} onChange={(e) => setClothingSize(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['S', 'M', 'L', 'XL'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Schuhgröße</span>
                  <select value={shoeSize} onChange={(e) => setShoeSize(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {[38,39,40,41,42,43,44,45,46,47,48].map((n) => <option key={n} value={String(n)}>{n}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Brustumfang (in cm)</span>
                  <input type="number" min={50} max={200} placeholder="z. B. 90"
                    value={chest} onChange={(e) => setChest(e.target.value)} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Taillenumfang (in cm)</span>
                  <input type="number" min={50} max={200} placeholder="z. B. 70"
                    value={waist} onChange={(e) => setWaist(e.target.value)} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Hüftumfang (in cm)</span>
                  <input type="number" min={50} max={200} placeholder="z. B. 95"
                    value={hips} onChange={(e) => setHips(e.target.value)} className={inputCls} />
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Optische Merkmale</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Phänotyp</span>
                  <select value={phenotype} onChange={(e) => setPhenotype(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Kaukasisch','Mediterran','Afrikanisch','Nahöstlich','Ostasiatisch','Südasiatisch','Südostasiatisch','Lateinamerikanisch','Native American','Aborigines'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Augenfarbe</span>
                  <select value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Blau','Grün','Braun','Grau'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Hautton</span>
                  <select value={skinTone} onChange={(e) => setSkinTone(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Sehr Hell','Hell','Medium','Olive','Gebräunt','Dunkel','Sehr dunkel'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Haut-Unterton</span>
                  <select value={skinUndertone} onChange={(e) => setSkinUndertone(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Warm (Gold / Gelblich)','Kühl (Rosé / Bläulich)','Oliv (Grünlich)','Neutral'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Haarfarbe</span>
                  <select value={hairColor} onChange={(e) => setHairColor(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Blond','Braun','Schwarz','Rot','Grau','Glatze'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Haarstruktur</span>
                  <select value={hairTexture} onChange={(e) => setHairTexture(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Glatt','Wellig','Lockig','Afro'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Haarlänge</span>
                  <select value={hairLength} onChange={(e) => setHairLength(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Rasiert','Kurz','Mittellang','Lang'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-navy/70">Bart (falls zutreffend)</span>
                  <select value={beard} onChange={(e) => setBeard(e.target.value)} className={selectCls}>
                    <option value="">Keine Angabe</option>
                    {['Glatt rasiert','3-Tage-Bart','Vollbart','Schnurrbart'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Besondere Merkmale</span>
              <textarea rows={3} value={specialFeatures} onChange={(e) => setSpecialFeatures(e.target.value)}
                placeholder="z. B. Sommersprossen, Tattoos, Narben …" className={`w-full ${inputCls} resize-y`} />
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide mb-4">Model-Typ &amp; Archetyp</h3>
            {ARCHETYPES.map((label) => (
              <label key={label} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={selectedArchetypes.has(label)} onChange={() => toggleArchetype(label)}
                  className="w-4 h-4 accent-orange shrink-0" />
                <span className="text-navy">{label}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" readOnly checked={customArchetypeText.trim().length > 0}
                className="w-4 h-4 accent-orange shrink-0 pointer-events-none" />
              <input type="text" placeholder="Weitere …" value={customArchetypeText}
                onChange={(e) => setCustomArchetypeText(e.target.value)} className={`${inputCls} w-full`} />
            </label>
          </section>

          <div className="pt-2">
            <button type="submit" disabled={loading}
              className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
              {loading ? 'Wird erstellt …' : 'Models erstellen'}
            </button>
          </div>
        </form>
      )}

      {/* Read-only form summary */}
      {submitted && (
        <div className="space-y-8 bg-navy/5 rounded-xl p-6">
          <section className="space-y-2">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Persona</h3>
            <p className="text-sm text-navy whitespace-pre-wrap">{persona || '–'}</p>
          </section>

          {(height || build || clothingSize || shoeSize || chest || waist || hips) && (
            <section className="space-y-3">
              <h3 className="text-base font-bold text-navy uppercase tracking-wide">Körpermaße &amp; Steckbrief</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {([
                  ['Körpergröße', height ? `${height} cm` : ''],
                  ['Statur / Körpertyp', build],
                  ['Konfektionsgröße', clothingSize],
                  ['Schuhgröße', shoeSize],
                  ['Brustumfang', chest ? `${chest} cm` : ''],
                  ['Taillenumfang', waist ? `${waist} cm` : ''],
                  ['Hüftumfang', hips ? `${hips} cm` : ''],
                ] as [string, string][]).filter(([, v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-navy/50">{label}</p>
                    <p className="text-sm text-navy">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(phenotype || eyeColor || skinTone || skinUndertone || hairColor || hairTexture || hairLength || beard || specialFeatures) && (
            <section className="space-y-3">
              <h3 className="text-base font-bold text-navy uppercase tracking-wide">Optische Merkmale</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {([
                  ['Phänotyp', phenotype],
                  ['Augenfarbe', eyeColor],
                  ['Hautton', skinTone],
                  ['Haut-Unterton', skinUndertone],
                  ['Haarfarbe', hairColor],
                  ['Haarstruktur', hairTexture],
                  ['Haarlänge', hairLength],
                  ['Bart', beard],
                ] as [string, string][]).filter(([, v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-navy/50">{label}</p>
                    <p className="text-sm text-navy">{value}</p>
                  </div>
                ))}
                {specialFeatures && (
                  <div className="col-span-2">
                    <p className="text-xs text-navy/50">Besondere Merkmale</p>
                    <p className="text-sm text-navy">{specialFeatures}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Model-Typ &amp; Archetyp</h3>
            <p className="text-sm text-navy">
              {[...Array.from(selectedArchetypes), customArchetypeText.trim()].filter(Boolean).join(', ') || '–'}
            </p>
          </section>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-navy/60">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Deine Models werden erstellt …</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mt-8 p-4 border border-red-300 bg-red-50 rounded-lg space-y-3">
          <p className="text-sm text-red-700">{error}</p>
          {!submitted && (
            <button type="button" onClick={handleSubmit}
              className="text-sm font-medium text-orange hover:text-orange/80 transition-colors">
              Erneut versuchen
            </button>
          )}
        </div>
      )}

      {/* Generated images */}
      {result && !loading && (
        <div ref={resultsRef} className="mt-16 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-navy">Deine Model-Varianten</h2>
            <p className="text-sm text-navy/60 mt-1">Klicke auf ein Bild, um es auszuwählen.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-start">
            {result.images.map((img, i) => {
              const state = imageStates[i] ?? 'active'
              if (state === 'discarded') return null
              const isSelected = selectedIdx === i
              return (
                <div key={img.storagePath} className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={state === 'saved'}
                    onClick={() => handleImageClick(i)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                      isSelected ? 'border-orange'
                        : state === 'saved' ? 'border-transparent cursor-default'
                        : 'border-transparent hover:border-orange focus:outline-none focus:border-orange'
                    }`}
                    aria-label={`Model-Variante ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`Model-Variante ${i + 1}`} className="w-full h-full object-cover" />
                    {state === 'saved' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {isSelected && state === 'active' && (
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => setDiscardDialogIdx(i)}
                        className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
                        Verwerfen
                      </button>
                      <button type="button" onClick={() => { setSaveDialogIdx(i); setSaveName('') }}
                        className="text-sm font-medium py-1.5 rounded border border-orange/40 bg-orange/5 text-orange hover:bg-orange/15 transition-colors">
                        Speichern
                      </button>
                      <button type="button" onClick={() => { setRefinementSource(i); setSelectedIdx(null) }}
                        className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
                        Verfeinern
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Refinement panel */}
          {refinementSource !== null && (
            <div className="space-y-4 border border-navy/10 rounded-xl p-5 bg-navy/[0.02]">
              <p className="text-sm text-navy/50">Variante {refinementSource + 1} verfeinern</p>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-navy">Anpassungen</span>
                <textarea rows={4} value={refinementText}
                  onChange={(e) => setRefinementText(e.target.value)}
                  placeholder="Beschreibe, was du ändern möchtest …"
                  className={`w-full ${inputCls} resize-y`}
                  disabled={refining}
                />
              </label>
              {refining && (
                <div className="flex items-center gap-3 text-navy/60">
                  <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-sm">Neue Varianten werden generiert …</p>
                </div>
              )}
              {refineError && <p className="text-sm text-red-600">{refineError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={handleRefine}
                  disabled={refining || !refinementText.trim()}
                  className="bg-orange text-white font-semibold px-5 py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                  {refining ? 'Wird verfeinert …' : 'Verfeinern'}
                </button>
                <button type="button" onClick={() => { setRefinementSource(null); setRefinementText('') }}
                  disabled={refining}
                  className="px-5 py-2 rounded-md border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset button */}
      {submitted && (
        <div className="mt-12 pb-8">
          <button type="button" onClick={handleReset}
            className="border border-navy/30 text-navy/60 font-medium px-6 py-3 rounded-md hover:border-navy/60 hover:text-navy transition-colors">
            Reset
          </button>
        </div>
      )}

      {/* Discard dialog */}
      {discardDialogIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Sind Sie sicher?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => confirmDiscard(discardDialogIdx)}
                className="flex-1 bg-navy text-white font-semibold py-2 rounded-md hover:bg-navy/90 transition-colors">
                Verwerfen
              </button>
              <button type="button" onClick={() => setDiscardDialogIdx(null)}
                className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save dialog */}
      {saveDialogIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Model speichern</p>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Name</span>
              <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                placeholder="z. B. Business-Typ, Casual …"
                className={inputCls} autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && !saving && saveName.trim()) handleSave() }}
              />
            </label>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={handleSave} disabled={saving || !saveName.trim()}
                className="flex-1 bg-orange text-white font-semibold py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
                {saving ? 'Wird gespeichert …' : 'Speichern'}
              </button>
              <button type="button" onClick={() => { setSaveDialogIdx(null); setSaveName(''); setSaveError(null) }}
                disabled={saving}
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
