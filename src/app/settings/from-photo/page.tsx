'use client'

import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { ref, getDownloadURL } from 'firebase/storage'
import { functions, db, storage } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'
import { formatFirebaseError, validationError, type FormattedError } from '@/lib/formatFirebaseError'

type ImageState = 'active' | 'discarded' | 'saved'

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full'

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

export default function SettingFromPhotoPage() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg')
  const [anpassungen, setAnpassungen] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<FormattedError | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [imageStates, setImageStates] = useState<Record<number, ImageState>>({})
  const [saveTarget, setSaveTarget] = useState<SaveTarget | null>(null)
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [refinementHistory, setRefinementHistory] = useState<RefinementRecord[]>([])
  const [refinementSource, setRefinementSource] = useState<{ storagePath: string; label: string } | null>(null)
  const [refinementText, setRefinementText] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { userDoc } = useAuth()

  useEffect(() => {
    if (!zoomUrl) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setZoomUrl(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Das Bild darf maximal 5 MB groß sein.')
      return
    }
    setPhotoError(null)
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const [prefix, base64] = dataUrl.split(',')
      const mime = prefix.match(/data:([^;]+);/)?.[1] ?? 'image/jpeg'
      setPhotoPreviewUrl(dataUrl)
      setPhotoBase64(base64)
      setPhotoMimeType(mime)
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!photoBase64) { setError(validationError('Bitte lade ein Foto hoch.')); return }
    if (!anpassungen.trim()) { setError(validationError('Bitte beschreibe die gewünschten Anpassungen.')); return }
    setError(null); setLoading(true)
    try {
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateSettingFromPhoto', { timeout: 540000 })
      const response = await fn({ photoBase64, mimeType: photoMimeType, anpassungen: anpassungen.trim() })
      setResult(response.data); setSubmitted(true)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err: unknown) {
      setError(formatFirebaseError(err))
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setPhoto(null); setPhotoPreviewUrl(null); setPhotoBase64(null); setPhotoMimeType('image/jpeg')
    setAnpassungen(''); setPhotoError(null)
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
      await addDoc(collection(db, 'settings'), {
        imageUrl: permanentUrl,
        storagePath: saveTarget.storagePath,
        name: saveName.trim(),
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
      const fn = httpsCallable<unknown, GenerationResult>(functions, 'generateSettingFromPhoto', { timeout: 540000 })
      const response = await fn({ anpassungen: anpassungen.trim(), refinement: { storagePath: refinementSource.storagePath, text: refinementText.trim() } })
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

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-8">Setting von Foto</h1>

      {/* Form */}
      {!submitted && (
        <form
          className={`space-y-8 ${loading ? 'opacity-50 pointer-events-none select-none' : ''}`}
          onSubmit={e => { e.preventDefault(); handleSubmit() }}
        >
          {/* Foto-Upload */}
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Foto</h3>
            {photoPreviewUrl ? (
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviewUrl} alt="Hochgeladenes Foto" className="w-32 h-32 object-cover rounded-lg border border-navy/10" />
                <button type="button" onClick={() => { setPhoto(null); setPhotoPreviewUrl(null); setPhotoBase64(null) }}
                  className="text-sm text-navy/50 hover:text-navy transition-colors">
                  Foto entfernen
                </button>
              </div>
            ) : (
              <label className="flex flex-col gap-2 cursor-pointer self-start">
                <div className="flex items-center gap-3 border border-dashed border-navy/30 rounded-lg px-6 py-8 hover:border-orange hover:bg-orange/5 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-sm text-navy/60">Foto auswählen <span className="text-navy/40 text-xs">(max. 5 MB)</span></span>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
            {photoError && <p className="text-sm text-red-600">{photoError}</p>}
          </section>

          {/* Anpassungen */}
          <section className="space-y-4">
            <h3 className="text-base font-bold text-navy uppercase tracking-wide">Anpassungen</h3>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Beschreibe, was du am Setting ändern möchtest</span>
              <textarea rows={5} value={anpassungen} onChange={e => setAnpassungen(e.target.value)}
                placeholder="z. B. Entferne alle Personen aus dem Bild und behalte nur das Setting …"
                className={`${inputCls} resize-y`} />
            </label>
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
        <div className="space-y-4 bg-navy/5 rounded-xl p-6">
          <div className="flex items-start gap-4">
            {photoPreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreviewUrl} alt="Eingabe-Foto" className="w-24 h-24 object-cover rounded-lg border border-navy/10 shrink-0" />
            )}
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Anpassungen</p>
              <p className="text-sm text-navy whitespace-pre-wrap">{anpassungen}</p>
            </div>
          </div>
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
                          onRefine={() => { setRefinementSource({ storagePath: img.storagePath, label: 'Auswahl' }); setRefinementHistory(prev => prev.map((r, ri) => ri === rIdx ? { ...r, selectedIdx: null } : r)) }}
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
