'use client'

import { useState } from 'react'

type LocationType = 'indoor' | 'outdoor-urban' | 'outdoor-natur' | null

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full'
const labelCls = 'flex flex-col gap-1'
const labelTextCls = 'text-sm text-navy/70'

export default function SettingCreatePage() {
  const [locationType, setLocationType] = useState<LocationType>(null)
  const [colors, setColors] = useState<string[]>(['#1b2a4a'])

  const addColor = () => {
    if (colors.length < 5) setColors([...colors, '#1b2a4a'])
  }

  const removeColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index))
  }

  const updateColor = (index: number, value: string) => {
    const updated = [...colors]
    updated[index] = value
    setColors(updated)
  }

  const updateColorHex = (index: number, raw: string) => {
    const value = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
      const updated = [...colors]
      updated[index] = value
      setColors(updated)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-8">Setting erstellen</h1>

      <form className="space-y-10">

        {/* Beschreibung */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Beschreibung</h3>
          <textarea
            rows={4}
            placeholder="Beschreibe das gewünschte Setting …"
            className={`${inputCls} resize-y`}
          />
        </section>

        {/* Location & Räumlichkeit */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Location &amp; Räumlichkeit</h3>

          <div className="space-y-6">
            {/* Indoor */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value="indoor"
                  checked={locationType === 'indoor'}
                  onChange={() => setLocationType('indoor')}
                  className="w-4 h-4 accent-orange"
                />
                <span className="text-navy font-medium">Indoor / Innenraum</span>
              </label>

              {locationType === 'indoor' && (
                <div className="ml-7 grid grid-cols-2 gap-4">
                  <label className={labelCls}>
                    <span className={labelTextCls}>Raum-Typ</span>
                    <input type="text" placeholder="Fotostudio (White Cube), Tageslichtstudio, Hotel, Industriehalle, Loft, Altbauwohnung, Sakralbau, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Architekturstil</span>
                    <input type="text" placeholder="Minimalistisch, industriell, Barock, Jugendstil, Bauhaus, rustikal, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Oberflächen &amp; Wandstrukturen</span>
                    <input type="text" placeholder="Sichtbeton, Backstein, Stuck, Holzpaneele, Gips, Fliesen, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Bodenbelag</span>
                    <input type="text" placeholder="Fischgrätparkett, Estrich (poliert), Teppich, Epoxidharz, …" className={inputCls} />
                  </label>
                </div>
              )}
            </div>

            {/* Outdoor Urban */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value="outdoor-urban"
                  checked={locationType === 'outdoor-urban'}
                  onChange={() => setLocationType('outdoor-urban')}
                  className="w-4 h-4 accent-orange"
                />
                <span className="text-navy font-medium">Outdoor Urban / Städtischer Raum</span>
              </label>

              {locationType === 'outdoor-urban' && (
                <div className="ml-7 grid grid-cols-2 gap-4">
                  <label className={labelCls}>
                    <span className={labelTextCls}>Umfeld &amp; Szenerie</span>
                    <input type="text" placeholder="Straßenschlucht, Dachterrasse, Skatepark, U-Bahn-Station, Hinterhof, Parkhaus, Moderne Glasfassade, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Städtischer Vibe</span>
                    <input type="text" placeholder="Brutalistisch, Beton, Historische Altstadt, Futuristische Skyline, Graffiti, Sperrmüll, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Bodenbeschaffenheit</span>
                    <input type="text" placeholder="Asphalt, Kopfsteinpflaster, Betonplatten, Gitterroste, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Hintergrund-Elemente</span>
                    <input type="text" placeholder="Neonreklame, Baustellenzäune, Ampelanlagen, spiegelnde Glasfronten, …" className={inputCls} />
                  </label>
                </div>
              )}
            </div>

            {/* Outdoor Natur */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value="outdoor-natur"
                  checked={locationType === 'outdoor-natur'}
                  onChange={() => setLocationType('outdoor-natur')}
                  className="w-4 h-4 accent-orange"
                />
                <span className="text-navy font-medium">Outdoor Natur / Landschaft</span>
              </label>

              {locationType === 'outdoor-natur' && (
                <div className="ml-7 grid grid-cols-2 gap-4">
                  <label className={labelCls}>
                    <span className={labelTextCls}>Landschafts-Typ</span>
                    <input type="text" placeholder="Strand, Küste, Wald, Wüste, Sanddünen, Berge, Felsen, Wiese, Feld, See, Fluss, Vulkanlandschaft, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Vegetation &amp; Dichte</span>
                    <input type="text" placeholder="Kahl, karg, dichter Urwald, Weite Steppe, Blühende Heide, Herbstlaub, Schneedecke, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Bodenbeschaffenheit</span>
                    <input type="text" placeholder="Feiner Sand, Kiesel, Steine, Waldboden, Moos, Trockene und rissige Erde, Gras, Rasen, …" className={inputCls} />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>Dominante Naturelemente</span>
                    <input type="text" placeholder="Klippen, alte Baumwurzeln, Schilf, Dünenhafer, …" className={inputCls} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Lichtstimmung & Atmosphäre */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Lichtstimmung &amp; Atmosphäre</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelCls}>
              <span className={labelTextCls}>Licht-Charakter</span>
              <input type="text" placeholder="Weich und diffus, Hart mit Schlagschatten, Cinematic, Blitzlicht-Look, …" className={inputCls} />
            </label>
            <label className={labelCls}>
              <span className={labelTextCls}>Lichtquelle</span>
              <input type="text" placeholder="Reines Tageslicht, Studio-Kunstlicht, Mischlicht, Neon- & Farbfilter, …" className={inputCls} />
            </label>
            <label className={`${labelCls} col-span-2`}>
              <span className={labelTextCls}>Tageszeit / Stimmung</span>
              <input type="text" placeholder="High-Key hell und clean, Low-Key dunkel und mystisch, Golden Hour, Sonnenuntergang, Nacht, …" className={inputCls} />
            </label>
          </div>
        </section>

        {/* Farbschema & Tonalität */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Farbschema &amp; Tonalität</h3>

          <div className="space-y-2">
            <span className={labelTextCls}>Dominante Farben des Settings</span>
            {colors.map((color, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden border border-navy/20 cursor-pointer">
                  <div className="absolute inset-0" style={{ backgroundColor: color }} />
                  <input
                    type="color"
                    value={color.length === 7 ? color : '#1b2a4a'}
                    onChange={(e) => updateColor(i, e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => updateColorHex(i, e.target.value)}
                  maxLength={7}
                  placeholder="#000000"
                  className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-32 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeColor(i)}
                  className="text-navy/40 hover:text-navy transition-colors text-lg leading-none"
                  aria-label="Farbe entfernen"
                >
                  ×
                </button>
              </div>
            ))}
            {colors.length < 5 && (
              <button
                type="button"
                onClick={addColor}
                className="text-sm text-orange hover:text-orange/80 transition-colors font-medium"
              >
                + Weitere Farbe
              </button>
            )}
          </div>

          <label className={labelCls}>
            <span className={labelTextCls}>Farbsättigung</span>
            <input type="text" placeholder="Entsättigt, pastellig, Vibrant, knallig, kontrastreich, Schwarz-Weiß, …" className={inputCls} />
          </label>
        </section>

        {/* Set-Design & Requisiten */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Set-Design &amp; Requisiten</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className={`${labelCls} col-span-2 sm:col-span-1`}>
              <span className={labelTextCls}>Dichte des Sets</span>
              <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                <option value="">Keine Angabe</option>
                <option value="minimalistisch">Minimalistisch (Fokus nur auf Model)</option>
                <option value="medium">Medium</option>
                <option value="maximalistisch">Maximalistisch (opulent / voll)</option>
              </select>
            </label>
            <label className={labelCls}>
              <span className={labelTextCls}>Möbel und Objekte</span>
              <input type="text" placeholder="Mid-Century Sessel, Metall-Stühle, Fahrzeuge, Lampen, …" className={inputCls} />
            </label>
            <label className={labelCls}>
              <span className={labelTextCls}>Kleindekoration &amp; organische Elemente</span>
              <input type="text" placeholder="Blumen, Spiegel, Schnee, Wasserflächen, Kerzen, …" className={inputCls} />
            </label>
          </div>
        </section>

        {/* Ästhetischer Vibe & Epoche */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Ästhetischer Vibe &amp; Epoche</h3>

          <label className={labelCls}>
            <span className={labelTextCls}>Stilrichtung / Ära</span>
            <input type="text" placeholder="Y2K, 90s Grunge, 70s Retro, Futuristisch, Zeitlos-Elegant, …" className={inputCls} />
          </label>

          <div className="space-y-2">
            <span className={labelTextCls}>Mood-Adjektive</span>
            {[
              'Luxuriös / High-End',
              'Düster / Moody',
              'Clean / Puristisch',
              'Verträumt / Surreal',
              'Urban / Raw',
            ].map((label) => (
              <label key={label} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-orange shrink-0" />
                <span className="text-navy">{label}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-orange shrink-0" />
              <input
                type="text"
                placeholder="Anderes …"
                className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full"
              />
            </label>
          </div>
        </section>

        {/* Referenzen & Moods */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Referenzen &amp; Moods</h3>
          <label className={labelCls}>
            <span className={labelTextCls}>Beispielbilder für das Setting</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="border border-navy/20 rounded-md px-3 py-2 text-navy/70 file:mr-3 file:border-0 file:bg-navy file:text-white file:rounded file:px-3 file:py-1 file:text-sm file:cursor-pointer cursor-pointer"
            />
          </label>
        </section>

        <div className="pt-2">
          <button
            type="button"
            className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors"
          >
            Settings erstellen
          </button>
        </div>

      </form>
    </div>
  )
}
