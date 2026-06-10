'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { httpsCallable } from 'firebase/functions'
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore'
import { ref, getDownloadURL } from 'firebase/storage'
import { functions, db, storage } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'
import { formatFirebaseError, validationError, type FormattedError } from '@/lib/formatFirebaseError'
import { ModelSedcardForm, emptySedcard, inputCls, type SedcardValues } from '@/app/_components/ModelSedcardForm'

interface GeneratedImage { url: string; storagePath: string }
interface GenerationResult { images: GeneratedImage[]; promptUsed: string; generationId: string }
type ImageState = 'active' | 'discarded' | 'saved'

interface RefinementRecord {
  sourceLabel: string
  text: string
  images: GeneratedImage[]
  imageStates: Record<number, ImageState>
  selectedIdx: number | null
}

interface SaveTarget { storagePath: string; rIdx?: number; imgIdx: number }
interface DiscardTarget { rIdx?: number; imgIdx: number }

interface OriginalModel {
  id: string
  name: string
  imageUrl: string
  storagePath: string
  sedcard: {
    persona?: string
    bodyMeasurements?: { height?: string; clothingSize?: string; shoeSize?: string; chest?: string; waist?: string; hips?: string }
    appearance?: { build?: string; phenotype?: string; eyeColor?: string; skinTone?: string; skinUndertone?: string; hairColor?: string; hairTexture?: string; hairLength?: string; beard?: string; specialFeatures?: string }
    archetypes?: string[]
    customArchetype?: string | null
  }
}

export default function ModelEditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id: modelId } = use(params)
  const router = useRouter()
  const { userDoc } = useAuth()

  const [model, setModel] = useState<OriginalModel | null>(null)
  const [modelLoading, setModelLoading] = useState(true)
  const [modelError, setModelError] = useState<string | null>(null)

  const [sedcard, setSedcard] = useState<SedcardValues>(emptySedcard())
  const [refinementText, setRefinementText] = useState('')

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

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'models', modelId))
        if (!snap.exists()) { setModelError('Model nicht gefunden.'); return }
        const data = snap.data()
        const m = { ...data, id: snap.id } as OriginalModel
        setModel(m)
        const s = m.sedcard
        setSedcard({
          persona: s.persona ?? '',
          height: s.bodyMeasurements?.height ?? '',
          clothingSize: s.bodyMeasurements?.clothingSize ?? '',
          shoeSize: s.bodyMeasurements?.shoeSize ?? '',
          chest: s.bodyMeasurements?.chest ?? '',
          waist: s.bodyMeasurements?.waist ?? '',
          hips: s.bodyMeasurements?.hips ?? '',
          build: s.appearance?.build ?? '',
          phenotype: s.appearance?.phenotype ?? '',
          eyeColor: s.appearance?.eyeColor ?? '',
          skinTone: s.appearance?.skinTone ?? '',
          skinUndertone: s.appearance?.skinUndertone ?? '',
          hairColor: s.appearance?.hairColor ?? '',
          hairTexture: s.appearance?.hairTexture ?? '',
          hairLength: s.appearance?.hairLength ?? '',
          beard: s.appearance?.beard ?? '',
          specialFeatures: s.appearance?.specialFeatures ?? '',
          selectedArchetypes: new Set(s.archetypes ?? []),
          customArchetypeText: s.customArchetype ?? '',
        })
      } catch {
        setModelError('Fehler beim Laden des Models.')
      } finally {
        setModelLoading(false)
      }
    }
    load()
  }, [modelId])

  useEffect(() => {
    if (!zoomUrl) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setZoomUrl(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomUrl])

  function handleSedcardChange(patch: Partial<Omit<SedcardValues, 'selectedArchetypes'>>) {
    setSedcard(prev => ({ ...prev, ...patch }))
  }

  function handleToggleArchetype(label: string) {
    setSedcard(prev => {
      const next = new Set(prev.selectedArchetypes)
      next.has(label) ? next.delete(label) : next.add(label)
      return { ...prev, selectedArchetypes: next }
    })
  }

  function buildPayload(refinement: { storagePath: string; text: string }) {
    const archetypes = Array.from(sedcard.selectedArchetypes).map(l => l.split(' (')[0])
    const customArchetype = sedcard.customArchetypeText.trim() || undefined
    return {
      persona: sedcard.persona.trim(),
      bodyMeasurements: {
        ...(sedcard.height && { height: sedcard.height }),
        ...(sedcard.clothingSize && { clothingSize: sedcard.clothingSize }),
        ...(sedcard.shoeSize && { shoeSize: sedcard.shoeSize }),
        ...(sedcard.chest && { chest: sedcard.chest }),
        ...(sedcard.waist && { waist: sedcard.waist }),
        ...(sedcard.hips && { hips: sedcard.hips }),
      },
      appearance: {
        ...(sedcard.build && { build: sedcard.build }),
        ...(sedcard.phenotype && { phenotype: sedcard.phenotype }),
        ...(sedcard.eyeColor && { eyeColor: sedcard.eyeColor }),
        ...(sedcard.skinTone && { skinTone: sedcard.skinTone }),
        ...(sedcard.skinUndertone && { skinUndertone: sedcard.skinUndertone }),
        ...(sedcard.hairColor && { hairColor: sedcard.hairColor }),
        ...(sedcard.hairTexture && { hairTexture: sedcard.hairTexture }),
        ...(sedcard.hairLength && { hairLength: sedcard.hairLength }),
        ...(sedcard.beard && { beard: sedcard.beard }),
        ...(sedcard.specialFeatures.trim() && { specialFeatures: sedcard.specialFeatures.trim() }),
      },
      archetypes,
      ...(customArchetype && { customArchetype }),
      refinement,
    }
  }

  async function handleGenerate() {
    if (!model) return
    if (!sedcard.persona.trim()) { setError(validationError('Bitte beschreibe die Persona.')); return }
    if (sedcard.selectedArchetypes.size === 0 && !sedcard.customArchetypeText.trim()) {
      setError(validationError('Bitte wähle mindestens einen Archetypen.')); return
    }
    if (!refinementText.trim()) { setError(validationError('Bitte beschreibe, was geändert oder verbessert werden soll.')); return }
    setError(null); setLoading(true)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateModelImages', { timeout: 540000 })
      const response = await fn(buildPayload({ storagePath: model.storagePath, text: refinementText.trim() }))
      setResult(response.data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e: unknown) {
      setError(formatFirebaseError(e))
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
    setSelectedIdx(null)
    setRefineSource(null); setRefineText('')
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
      await addDoc(collection(db, 'models'), {
        imageUrl: permanentUrl,
        storagePath: saveTarget.storagePath,
        name: saveName.trim(),
        sedcard: {
          persona: sedcard.persona,
          bodyMeasurements: { height: sedcard.height, clothingSize: sedcard.clothingSize, shoeSize: sedcard.shoeSize, chest: sedcard.chest, waist: sedcard.waist, hips: sedcard.hips },
          appearance: { build: sedcard.build, phenotype: sedcard.phenotype, eyeColor: sedcard.eyeColor, skinTone: sedcard.skinTone, skinUndertone: sedcard.skinUndertone, hairColor: sedcard.hairColor, hairTexture: sedcard.hairTexture, hairLength: sedcard.hairLength, beard: sedcard.beard, specialFeatures: sedcard.specialFeatures },
          archetypes: Array.from(sedcard.selectedArchetypes),
          customArchetype: sedcard.customArchetypeText.trim() || null,
        },
        createdAt: Timestamp.now(),
        createdBy: userDoc?.name ?? 'Unbekannt',
        editedFrom: model?.id ?? null,
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
    } finally { setSaving(false) }
  }

  async function handleRefine() {
    if (!refineSource || !refineText.trim()) return
    setRefining(true); setRefineError(null)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateModelImages', { timeout: 540000 })
      const response = await fn(buildPayload({ storagePath: refineSource.storagePath, text: refineText.trim() }))
      setRefinementHistory(prev => [...prev, {
        sourceLabel: refineSource.label,
        text: refineText.trim(),
        images: response.data.images,
        imageStates: {},
        selectedIdx: null,
      }])
      setRefineSource(null); setRefineText(''); setSelectedIdx(null)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e: unknown) {
      setRefineError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally { setRefining(false) }
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
        <button type="button" onClick={onDiscard}
          className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
          Verwerfen
        </button>
        <button type="button" onClick={onSave}
          className="text-sm font-medium py-1.5 rounded border border-orange/40 bg-orange/5 text-orange hover:bg-orange/15 transition-colors">
          Speichern
        </button>
        <button type="button" onClick={onRefine}
          className="text-sm font-medium py-1.5 rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition-colors">
          Verfeinern
        </button>
      </div>
    )
  }

  if (modelLoading) {
    return (
      <div className="flex items-center gap-3 text-navy/60 mt-8">
        <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Model wird geladen …</span>
      </div>
    )
  }

  if (modelError || !model) {
    return (
      <div className="mt-8 space-y-4">
        <p className="text-sm text-red-600">{modelError ?? 'Model nicht gefunden.'}</p>
        <Link href="/models" className="text-sm text-orange hover:text-orange/80">← Zurück zu Models</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-2">Model bearbeiten</h1>
      <p className="text-sm text-navy/50 mb-8">Originalmodell: <span className="font-medium text-navy">{model.name}</span> · Das Original bleibt gespeichert.</p>

      {/* Original model image */}
      <div className="mb-10 flex gap-6 items-start p-5 bg-navy/[0.03] rounded-xl border border-navy/10">
        <div className="w-32 h-32 rounded-lg overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={model.imageUrl} alt={model.name} className="w-full h-full object-cover" />
        </div>
        <div className="space-y-1 pt-1">
          <p className="text-xs text-navy/50 uppercase tracking-wide">Originalmodell</p>
          <p className="font-semibold text-navy">{model.name}</p>
          <p className="text-xs text-navy/40 mt-2">Beschreibe unten, was geändert werden soll. Die neuen Varianten werden auf Basis dieses Bildes generiert.</p>
        </div>
      </div>

      {/* Refinement input */}
      <div className="mb-10 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-navy">Was soll geändert werden?</span>
          <textarea rows={4} value={refinementText} onChange={(e) => setRefinementText(e.target.value)}
            placeholder="Beschreibe die gewünschten Änderungen, z. B. Haarfarbe, Styling, Ausdruck …"
            className={`w-full ${inputCls} resize-y`} disabled={loading} />
        </label>
      </div>

      {/* Sedcard */}
      <ModelSedcardForm
        values={sedcard}
        onChange={handleSedcardChange}
        onToggleArchetype={handleToggleArchetype}
        disabled={loading}
        onSubmit={handleGenerate}
        submitLabel={loading ? 'Wird generiert …' : 'Neue Varianten generieren'}
        onCancel={() => router.push('/models')}
      />

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
              <p className="text-sm text-red-700">
                {error.code && <span className="font-medium">{error.code} – </span>}
                {error.explanation}
              </p>
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
            <p className="text-sm text-navy/60 mt-1">Klicke auf ein Bild, um es auszuwählen. Gespeicherte Varianten werden als neues Model angelegt.</p>
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
                      className={`relative w-full aspect-square overflow-hidden rounded-lg border-2 transition-colors ${isSelected ? 'border-orange' : state === 'saved' ? 'border-transparent cursor-default' : 'border-transparent hover:border-orange focus:outline-none focus:border-orange'}`}
                      aria-label={`Variante ${i + 1}`}>
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
                      onSave={() => { setSaveTarget({ storagePath: img.storagePath, imgIdx: i }); setSaveName('') }}
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
                          onSave={() => { setSaveTarget({ storagePath: img.storagePath, rIdx, imgIdx: i }); setSaveName('') }}
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
                <textarea rows={4} value={refineText} onChange={(e) => setRefineText(e.target.value)}
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
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setZoomUrl(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-lg leading-none">
              ×
            </button>
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
              <button type="button" onClick={confirmDiscard}
                className="flex-1 bg-navy text-white font-semibold py-2 rounded-md hover:bg-navy/90 transition-colors">Verwerfen</button>
              <button type="button" onClick={() => setDiscardTarget(null)}
                className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {saveTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Model speichern</p>
            <p className="text-xs text-navy/50">Wird als neues Model gespeichert. Das Original bleibt erhalten.</p>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Name</span>
              <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                placeholder="z. B. Business-Typ v2 …" className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && !saving && saveName.trim()) handleSave() }} />
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
