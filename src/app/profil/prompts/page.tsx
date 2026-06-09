'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'
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
  {
    id: 'setting-creation',
    label: 'Setting erstellen',
    placeholders: [
      { key: '{{beschreibung}}',      description: 'Freitext-Beschreibung des Settings' },
      { key: '{{location_typ}}',      description: 'Location-Typ (Indoor / Outdoor Urban / Outdoor Natur)' },
      { key: '{{raum_typ}}',          description: 'Indoor: Raum-Typ' },
      { key: '{{architekturstil}}',   description: 'Indoor: Architekturstil' },
      { key: '{{oberflaechen}}',      description: 'Indoor: Oberflächen & Wandstrukturen' },
      { key: '{{bodenbelag_indoor}}', description: 'Indoor: Bodenbelag' },
      { key: '{{umfeld}}',            description: 'Outdoor Urban: Umfeld & Szenerie' },
      { key: '{{staedtischer_vibe}}', description: 'Outdoor Urban: Städtischer Vibe' },
      { key: '{{bodenbelag_urban}}',  description: 'Outdoor Urban: Bodenbeschaffenheit' },
      { key: '{{hintergrund}}',       description: 'Outdoor Urban: Hintergrund-Elemente' },
      { key: '{{landschafts_typ}}',   description: 'Outdoor Natur: Landschafts-Typ' },
      { key: '{{vegetation}}',        description: 'Outdoor Natur: Vegetation & Dichte' },
      { key: '{{bodenbelag_natur}}',  description: 'Outdoor Natur: Bodenbeschaffenheit' },
      { key: '{{naturelemente}}',     description: 'Outdoor Natur: Dominante Naturelemente' },
      { key: '{{licht_charakter}}',   description: 'Licht-Charakter' },
      { key: '{{lichtquelle}}',       description: 'Lichtquelle' },
      { key: '{{tageszeit}}',         description: 'Tageszeit / Stimmung' },
      { key: '{{farben}}',            description: 'Dominante Farben (Hex-Werte, kommagetrennt)' },
      { key: '{{farbsaettigung}}',    description: 'Farbsättigung' },
      { key: '{{set_dichte}}',        description: 'Dichte des Sets (Minimalistisch / Medium / Maximalistisch)' },
      { key: '{{moebler}}',           description: 'Möbel und Objekte' },
      { key: '{{kleindekoration}}',   description: 'Kleindekoration & organische Elemente' },
      { key: '{{stilrichtung}}',      description: 'Stilrichtung / Ära' },
      { key: '{{mood_adjektive}}',    description: 'Mood-Adjektive, kommagetrennt' },
    ],
  },
  {
    id: 'shooting-creation',
    label: 'Shooting erstellen',
    placeholders: [
      { key: '{{model_artikel_setting}}', description: 'Automatisch generierte Beschreibung: welches Model (mit Bildnummer) welche Artikel trägt + Setting (mit Bildnummer)' },
      { key: '{{regie_beschreibung}}',    description: 'Freitext-Beschreibung der Regieanweisungen' },
      { key: '{{posing_typ}}',            description: 'Posing-Typ (z.B. Dynamic Walk, Standing 3/4 view)' },
      { key: '{{arm_haltung}}',           description: 'Arm- & Handhaltung' },
      { key: '{{koerper_spannung}}',      description: 'Körperspannung & Fluss' },
      { key: '{{bildausschnitt}}',        description: 'Bildausschnitt (z.B. Full body shot, Medium shot)' },
      { key: '{{kamerawinkel}}',          description: 'Kamerawinkel (z.B. Eye-level, Low-angle)' },
      { key: '{{objektiv}}',              description: 'Objektiv-Charakteristik (z.B. 85mm, 50mm, 35mm)' },
      { key: '{{blickkontakt}}',          description: 'Blickkontakt (z.B. Looking directly into the camera)' },
      { key: '{{gesichtsausdruck}}',      description: 'Gesichtsausdruck (z.B. Neutral expression)' },
      { key: '{{stoff_dynamik}}',         description: 'Stoff-Dynamik (z.B. Fabric blowing in the wind)' },
      { key: '{{fokus_bereich}}',         description: 'Fokus-Bereich (Freitext, z.B. Focus on the texture)' },
      { key: '{{fotografie_stil}}',       description: 'Fotografie-Stil (z.B. Commercial fashion photography)' },
      { key: '{{bildschaerfe}}',          description: 'Bildschärfe & Hintergrund (z.B. Shallow depth of field)' },
      { key: '{{realismus}}',             description: 'Aktive Realismus-Flags (Photorealistic, Candid look, Film grain) kommagetrennt' },
    ],
  },
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
  const { userDoc } = useAuth()
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
    const updatedBy = userDoc?.name ?? 'Unbekannt'
    await setDoc(doc(db, 'prompts', id), {
      systemPrompt: draft,
      updatedAt: serverTimestamp(),
      updatedBy,
    })
    setData({ systemPrompt: draft, updatedAt: Timestamp.now(), updatedBy })
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
          <p className="text-xs text-navy/50">Verfügbare Platzhalter:</p>
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
