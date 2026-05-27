'use client'

import { useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

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

export default function ModelCreatePage() {
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

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)

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
      const archetypes = Array.from(selectedArchetypes).map((label) => label.split(' (')[0])
      const customArchetype = customArchetypeText.trim() || undefined

      const response = await fn({
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
      })

      setResult(response.data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-8">Model erstellen</h1>

      <form
        className={`space-y-20 ${loading ? 'opacity-50 pointer-events-none select-none' : ''}`}
        onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
      >
        {/* Persona */}
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

        {/* Körpermaße & Steckbrief */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Körpermaße &amp; Steckbrief</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Körpergröße (in cm)</span>
                <input
                  type="number" min={100} max={250} placeholder="z. B. 175"
                  value={height} onChange={(e) => setHeight(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Statur / Körpertyp</span>
                <select value={build} onChange={(e) => setBuild(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Schlank', 'Sportlich', 'Kurvig', 'Zierlich'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Konfektionsgröße</span>
                <select value={clothingSize} onChange={(e) => setClothingSize(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['S', 'M', 'L', 'XL'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Schuhgröße</span>
                <select value={shoeSize} onChange={(e) => setShoeSize(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {[38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Brustumfang (in cm)</span>
                <input
                  type="number" min={50} max={200} placeholder="z. B. 90"
                  value={chest} onChange={(e) => setChest(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Taillenumfang (in cm)</span>
                <input
                  type="number" min={50} max={200} placeholder="z. B. 70"
                  value={waist} onChange={(e) => setWaist(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Hüftumfang (in cm)</span>
                <input
                  type="number" min={50} max={200} placeholder="z. B. 95"
                  value={hips} onChange={(e) => setHips(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </div>
        </section>

        {/* Optische Merkmale */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Optische Merkmale</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Phänotyp</span>
                <select value={phenotype} onChange={(e) => setPhenotype(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {[
                    'Kaukasisch', 'Mediterran', 'Afrikanisch', 'Nahöstlich', 'Ostasiatisch',
                    'Südasiatisch', 'Südostasiatisch', 'Lateinamerikanisch', 'Native American', 'Aborigines',
                  ].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Augenfarbe</span>
                <select value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Blau', 'Grün', 'Braun', 'Grau'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Hautton</span>
                <select value={skinTone} onChange={(e) => setSkinTone(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Sehr Hell', 'Hell', 'Medium', 'Olive', 'Gebräunt', 'Dunkel', 'Sehr dunkel'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haut-Unterton</span>
                <select value={skinUndertone} onChange={(e) => setSkinUndertone(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Warm (Gold / Gelblich)', 'Kühl (Rosé / Bläulich)', 'Oliv (Grünlich)', 'Neutral'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haarfarbe</span>
                <select value={hairColor} onChange={(e) => setHairColor(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Blond', 'Braun', 'Schwarz', 'Rot', 'Grau', 'Glatze'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haarstruktur</span>
                <select value={hairTexture} onChange={(e) => setHairTexture(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Glatt', 'Wellig', 'Lockig', 'Afro'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haarlänge</span>
                <select value={hairLength} onChange={(e) => setHairLength(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Rasiert', 'Kurz', 'Mittellang', 'Lang'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Bart (falls zutreffend)</span>
                <select value={beard} onChange={(e) => setBeard(e.target.value)} className={selectCls}>
                  <option value="">Keine Angabe</option>
                  {['Glatt rasiert', '3-Tage-Bart', 'Vollbart', 'Schnurrbart'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-navy/70">Besondere Merkmale</span>
            <textarea
              rows={3}
              value={specialFeatures}
              onChange={(e) => setSpecialFeatures(e.target.value)}
              placeholder="z. B. Sommersprossen, Tattoos, Narben …"
              className={`w-full ${inputCls} resize-y`}
            />
          </label>
        </section>

        {/* Model-Typ & Archetyp */}
        <section className="space-y-2">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide mb-4">Model-Typ &amp; Archetyp</h3>
          {ARCHETYPES.map((label) => (
            <label key={label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedArchetypes.has(label)}
                onChange={() => toggleArchetype(label)}
                className="w-4 h-4 accent-orange shrink-0"
              />
              <span className="text-navy">{label}</span>
            </label>
          ))}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              readOnly
              checked={customArchetypeText.trim().length > 0}
              className="w-4 h-4 accent-orange shrink-0 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Weitere …"
              value={customArchetypeText}
              onChange={(e) => setCustomArchetypeText(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </label>
        </section>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Wird erstellt …' : 'Models erstellen'}
          </button>
        </div>
      </form>

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
          <button
            type="button"
            onClick={handleSubmit}
            className="text-sm font-medium text-orange hover:text-orange/80 transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Generated images */}
      {result && !loading && (
        <div ref={resultsRef} className="mt-16 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-navy">Deine Model-Varianten</h2>
            <p className="text-sm text-navy/60 mt-1">Wähle dein Lieblings-Model für den nächsten Schritt.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {result.images.map((img, i) => (
              <button
                key={img.storagePath}
                type="button"
                className="relative aspect-square overflow-hidden rounded-lg border-2 border-transparent hover:border-orange focus:outline-none focus:border-orange transition-colors"
                aria-label={`Model-Variante ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Model-Variante ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
