'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, query, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface Sedcard {
  persona?: string
  bodyMeasurements?: {
    height?: string
    clothingSize?: string
    shoeSize?: string
    chest?: string
    waist?: string
    hips?: string
  }
  appearance?: {
    build?: string
    phenotype?: string
    eyeColor?: string
    skinTone?: string
    hairColor?: string
    hairLength?: string
    beard?: string
  }
  archetypes?: string[]
  customArchetype?: string | null
}

interface Model {
  id: string
  imageUrl: string
  name: string
  sedcard: Sedcard
  createdAt: Timestamp
  createdBy: string
  archived?: boolean
}

function formatDate(ts: Timestamp): string {
  const d = ts.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'models'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setModels(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Model))
            .filter(m => !m.archived)
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await updateDoc(doc(db, 'models', id), { archived: true })
      setModels(prev => prev.filter(m => m.id !== id))
      setDeleteDialogId(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-navy">Models</h1>
        <Link
          href="/models/create"
          className="flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-orange/90 transition-colors"
        >
          + Model erstellen
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-navy/60">
          <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Models werden geladen …</span>
        </div>
      )}

      {!loading && models.length === 0 && (
        <p className="text-navy/50 text-sm">Noch keine Models vorhanden. Erstelle dein erstes Model.</p>
      )}

      {!loading && models.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {models.map(model => {
            const archetypeLabels = [
              ...(model.sedcard?.archetypes ?? []).map(a => a.split(' (')[0]),
              ...(model.sedcard?.customArchetype ? [model.sedcard.customArchetype] : []),
            ].filter(Boolean).join(', ')

            return (
              <div key={model.id} className="bg-white rounded-xl overflow-hidden border border-navy/10 flex flex-col shadow-sm">
                <div className="aspect-square overflow-hidden bg-navy/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={model.imageUrl}
                    alt={model.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <p className="font-bold text-navy">{model.name}</p>

                  <div className="space-y-1.5 text-sm">
                    {model.sedcard?.bodyMeasurements?.height && (
                      <p><span className="text-navy/50">Körpergröße: </span><span className="text-navy">{model.sedcard.bodyMeasurements.height} cm</span></p>
                    )}
                    {model.sedcard?.appearance?.phenotype && (
                      <p><span className="text-navy/50">Phänotyp: </span><span className="text-navy">{model.sedcard.appearance.phenotype}</span></p>
                    )}
                    {model.sedcard?.appearance?.build && (
                      <p><span className="text-navy/50">Statur: </span><span className="text-navy">{model.sedcard.appearance.build}</span></p>
                    )}
                    {model.sedcard?.appearance?.skinTone && (
                      <p><span className="text-navy/50">Hautton: </span><span className="text-navy">{model.sedcard.appearance.skinTone}</span></p>
                    )}
                    {model.sedcard?.appearance?.eyeColor && (
                      <p><span className="text-navy/50">Augenfarbe: </span><span className="text-navy">{model.sedcard.appearance.eyeColor}</span></p>
                    )}
                    {model.sedcard?.appearance?.hairColor && (
                      <p><span className="text-navy/50">Haarfarbe: </span><span className="text-navy">{model.sedcard.appearance.hairColor}</span></p>
                    )}
                    {archetypeLabels && (
                      <p><span className="text-navy/50">Archetypen: </span><span className="text-navy">{archetypeLabels}</span></p>
                    )}
                  </div>

                  <div className="mt-auto pt-2 border-t border-navy/5 flex items-end justify-between gap-2">
                    <div className="space-y-0.5 text-xs text-navy/40">
                      <p><span>Erstellt: </span>{formatDate(model.createdAt)}</p>
                      <p><span>Von: </span>{model.createdBy}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteDialogId(model.id)}
                      className="text-xs text-navy/30 hover:text-red-500 transition-colors shrink-0"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {deleteDialogId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-semibold text-navy">Model löschen?</p>
            <p className="text-sm text-navy/60">Das Model wird ausgeblendet und ist nicht mehr sichtbar.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDelete(deleteDialogId)}
                disabled={deleting}
                className="flex-1 bg-navy text-white font-semibold py-2 rounded-md hover:bg-navy/90 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Wird gelöscht …' : 'Löschen'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogId(null)}
                disabled={deleting}
                className="flex-1 border border-navy/20 text-navy font-medium py-2 rounded-md hover:border-navy/40 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
