'use client'

export const ARCHETYPES = [
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

export const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange'
export const selectCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange'

export interface SedcardValues {
  persona: string
  height: string
  clothingSize: string
  shoeSize: string
  chest: string
  waist: string
  hips: string
  build: string
  phenotype: string
  eyeColor: string
  skinTone: string
  skinUndertone: string
  hairColor: string
  hairTexture: string
  hairLength: string
  beard: string
  specialFeatures: string
  selectedArchetypes: Set<string>
  customArchetypeText: string
}

export function emptySedcard(): SedcardValues {
  return {
    persona: '', height: '', clothingSize: '', shoeSize: '',
    chest: '', waist: '', hips: '',
    build: '', phenotype: '', eyeColor: '', skinTone: '', skinUndertone: '',
    hairColor: '', hairTexture: '', hairLength: '', beard: '', specialFeatures: '',
    selectedArchetypes: new Set(), customArchetypeText: '',
  }
}

interface Props {
  values: SedcardValues
  onChange: (patch: Partial<Omit<SedcardValues, 'selectedArchetypes'>>) => void
  onToggleArchetype: (label: string) => void
  disabled?: boolean
  onSubmit: () => void
  submitLabel?: string
  onCancel?: () => void
  cancelLabel?: string
}

export function ModelSedcardForm({ values, onChange, onToggleArchetype, disabled, onSubmit, submitLabel = 'Models erstellen', onCancel, cancelLabel = 'Abbrechen' }: Props) {
  const { persona, height, clothingSize, shoeSize, chest, waist, hips, build, phenotype, eyeColor, skinTone, skinUndertone, hairColor, hairTexture, hairLength, beard, specialFeatures, selectedArchetypes, customArchetypeText } = values

  return (
    <form className={`space-y-20 ${disabled ? 'opacity-50 pointer-events-none select-none' : ''}`}
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}>

      <section className="space-y-4">
        <h3 className="text-base font-bold text-navy uppercase tracking-wide">Persona</h3>
        <textarea rows={4} value={persona} onChange={(e) => onChange({ persona: e.target.value })}
          placeholder="Beschreibe die Persona des Models …" className={`w-full ${inputCls} resize-y`} />
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-bold text-navy uppercase tracking-wide">Körpermaße &amp; Steckbrief</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Körpergröße (in cm)</span>
              <input type="number" min={100} max={250} placeholder="z. B. 175" value={height} onChange={(e) => onChange({ height: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Statur / Körpertyp</span>
              <select value={build} onChange={(e) => onChange({ build: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Schlank', 'Sportlich', 'Kurvig', 'Zierlich'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Konfektionsgröße</span>
              <select value={clothingSize} onChange={(e) => onChange({ clothingSize: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Schuhgröße</span>
              <select value={shoeSize} onChange={(e) => onChange({ shoeSize: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {[38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map(n => <option key={n} value={String(n)}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Brustumfang (in cm)</span>
              <input type="number" min={50} max={200} placeholder="z. B. 90" value={chest} onChange={(e) => onChange({ chest: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Taillenumfang (in cm)</span>
              <input type="number" min={50} max={200} placeholder="z. B. 70" value={waist} onChange={(e) => onChange({ waist: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Hüftumfang (in cm)</span>
              <input type="number" min={50} max={200} placeholder="z. B. 95" value={hips} onChange={(e) => onChange({ hips: e.target.value })} className={inputCls} />
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
              <select value={phenotype} onChange={(e) => onChange({ phenotype: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Kaukasisch', 'Mediterran', 'Afrikanisch', 'Nahöstlich', 'Ostasiatisch', 'Südasiatisch', 'Südostasiatisch', 'Lateinamerikanisch', 'Native American', 'Aborigines'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Augenfarbe</span>
              <select value={eyeColor} onChange={(e) => onChange({ eyeColor: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Blau', 'Grün', 'Braun', 'Grau'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Hautton</span>
              <select value={skinTone} onChange={(e) => onChange({ skinTone: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Sehr Hell', 'Hell', 'Medium', 'Olive', 'Gebräunt', 'Dunkel', 'Sehr dunkel'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Haut-Unterton</span>
              <select value={skinUndertone} onChange={(e) => onChange({ skinUndertone: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Warm (Gold / Gelblich)', 'Kühl (Rosé / Bläulich)', 'Oliv (Grünlich)', 'Neutral'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Haarfarbe</span>
              <select value={hairColor} onChange={(e) => onChange({ hairColor: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Blond', 'Braun', 'Schwarz', 'Rot', 'Grau', 'Glatze'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Haarstruktur</span>
              <select value={hairTexture} onChange={(e) => onChange({ hairTexture: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Glatt', 'Wellig', 'Lockig', 'Afro'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Haarlänge</span>
              <select value={hairLength} onChange={(e) => onChange({ hairLength: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Rasiert', 'Kurz', 'Mittellang', 'Lang'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-navy/70">Bart (falls zutreffend)</span>
              <select value={beard} onChange={(e) => onChange({ beard: e.target.value })} className={selectCls}>
                <option value="">Keine Angabe</option>
                {['Glatt rasiert', '3-Tage-Bart', 'Vollbart', 'Schnurrbart'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy/70">Besondere Merkmale</span>
          <textarea rows={3} value={specialFeatures} onChange={(e) => onChange({ specialFeatures: e.target.value })}
            placeholder="z. B. Sommersprossen, Tattoos, Narben …" className={`w-full ${inputCls} resize-y`} />
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-bold text-navy uppercase tracking-wide mb-4">Model-Typ &amp; Archetyp</h3>
        {ARCHETYPES.map(label => (
          <label key={label} className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={selectedArchetypes.has(label)} onChange={() => onToggleArchetype(label)} className="w-4 h-4 accent-orange shrink-0" />
            <span className="text-navy">{label}</span>
          </label>
        ))}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" readOnly checked={customArchetypeText.trim().length > 0} className="w-4 h-4 accent-orange shrink-0 pointer-events-none" />
          <input type="text" placeholder="Weitere …" value={customArchetypeText} onChange={(e) => onChange({ customArchetypeText: e.target.value })} className={`${inputCls} w-full`} />
        </label>
      </section>

      <div className="pt-2 flex gap-3">
        <button type="submit" disabled={disabled}
          className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors disabled:opacity-50">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={disabled}
            className="border border-navy/30 text-navy/60 font-medium px-6 py-3 rounded-md hover:border-navy/60 hover:text-navy transition-colors">
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  )
}
