'use client'

import { useState, useEffect } from 'react'
import { db, auth } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

type PromptId = 'model-creation' | 'setting-creation' | 'shooting-creation'

interface PromptData {
  systemPrompt: string
  updatedAt: Timestamp | null
  updatedBy: string
}

interface Placeholder {
  key: string
  description: string
}

const PROMPTS: { id: PromptId; label: string; placeholders?: Placeholder[] }[] = [
  {
    id: 'model-creation',
    label: 'Model erstellen',
    placeholders: [
      { key: '{{persona}}',            description: 'Freitext-Beschreibung der Persona' },
      { key: '{{körpergröße}}',        description: 'Körpergröße in cm' },
      { key: '{{konfektionsgröße}}',   description: 'Konfektionsgröße (S / M / L / XL)' },
      { key: '{{schuhgröße}}',         description: 'Schuhgröße' },
      { key: '{{brustumfang}}',        description: 'Brustumfang in cm' },
      { key: '{{taillenumfang}}',      description: 'Taillenumfang in cm' },
      { key: '{{hüftumfang}}',         description: 'Hüftumfang in cm' },
      { key: '{{statur}}',             description: 'Statur / Körpertyp (z.B. Schlank, Sportlich)' },
      { key: '{{phänotyp}}',           description: 'Phänotyp (z.B. Kaukasisch, Mediterran)' },
      { key: '{{augenfarbe}}',         description: 'Augenfarbe' },
      { key: '{{hautton}}',            description: 'Hautton (z.B. Hell, Medium, Dunkel)' },
      { key: '{{haut_unterton}}',      description: 'Haut-Unterton (z.B. Warm, Kühl, Neutral)' },
      { key: '{{haarfarbe}}',          description: 'Haarfarbe' },
      { key: '{{haarstruktur}}',       description: 'Haarstruktur (z.B. Glatt, Lockig)' },
      { key: '{{haarlänge}}',          description: 'Haarlänge (z.B. Kurz, Lang)' },
      { key: '{{bart}}',               description: 'Bart (z.B. Glatt rasiert, Vollbart)' },
      { key: '{{besondere_merkmale}}', description: 'Besondere Merkmale (Freitext)' },
      { key: '{{archetypen}}',         description: 'Gewählte Archetypen, kommagetrennt' },
    ],
  },
  { id: 'setting-creation', label: 'Setting erstellen' },
  { id: 'shooting-creation', label: 'Shooting erstellen' },
]

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full resize-y'

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function PromptSection({ id, label, placeholders }: { id: PromptId; label: string; placeholders?: Placeholder[] }) {
  const [data, setData] = useState<PromptData | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'prompts', id)).then((snap) => {
      if (snap.exists()) {
        setData(snap.data() as PromptData)
      } else {
        setData({ systemPrompt: '', updatedAt: null, updatedBy: '' })
      }
    })
  }, [id])

  function handleEdit() {
    setDraft(data?.systemPrompt ?? '')
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    const userId = auth.currentUser?.uid ?? 'unbekannt'
    await setDoc(doc(db, 'prompts', id), {
      systemPrompt: draft,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    setData({ systemPrompt: draft, updatedAt: Timestamp.now(), updatedBy: userId })
    setEditing(false)
    setSaving(false)
  }

  return (
    <section className="border border-navy/10 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-navy uppercase tracking-wide">{label}</h2>
        {!editing && (
          <button
            type="button"
            onClick={handleEdit}
            className="text-sm text-orange hover:text-orange/80 font-medium transition-colors"
          >
            Bearbeiten
          </button>
        )}
      </div>

      {placeholders && placeholders.length > 0 && (
        <div className="space-y-2 pb-2 border-b border-navy/10">
          <p className="text-xs text-navy/50">
            Dieser Prompt wird mit den Sedcard-Daten des Models bestückt. Verfügbare Platzhalter:
          </p>
          <ul className="space-y-1">
            {placeholders.map((p) => (
              <li key={p.key} className="flex items-baseline gap-2 text-sm">
                <code className="bg-navy/5 text-navy font-mono text-xs px-1.5 py-0.5 rounded shrink-0">
                  {p.key}
                </code>
                <span className="text-navy/50">— {p.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <textarea
            rows={12}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={inputCls}
            placeholder="System-Prompt eingeben …"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-orange text-white font-semibold px-5 py-2 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? 'Speichern …' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-navy/60 hover:text-navy font-medium px-5 py-2 rounded-md transition-colors text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {data === null ? (
            <p className="text-navy/40 text-sm">Wird geladen …</p>
          ) : data.systemPrompt ? (
            <p className="text-navy text-sm whitespace-pre-wrap font-mono">{data.systemPrompt}</p>
          ) : (
            <p className="text-navy/40 text-sm italic">Noch kein Prompt hinterlegt.</p>
          )}
          {data?.updatedAt && (
            <p className="text-xs text-navy/40">
              Zuletzt bearbeitet am {formatDate(data.updatedAt)} von {data.updatedBy}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default function PromptsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold text-navy">Prompt-Verwaltung</h1>
      {PROMPTS.map((p) => (
        <PromptSection key={p.id} id={p.id} label={p.label} placeholders={p.placeholders} />
      ))}
    </div>
  )
}
