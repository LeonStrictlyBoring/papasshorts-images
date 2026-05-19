export default function ModelCreatePage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-navy mb-8">Model erstellen</h1>

      <form className="space-y-10">
        {/* Persona */}
        <section className="space-y-4">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide">Persona</h3>
          <textarea
            rows={4}
            placeholder="Beschreibe die Persona des Models …"
            className="w-full border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange resize-y"
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
                  type="number"
                  min={100}
                  max={250}
                  placeholder="z. B. 175"
                  className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Statur / Körpertyp</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["Schlank", "Sportlich", "Kurvig", "Zierlich"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Konfektionsgröße</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["S", "M", "L", "XL"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Schuhgröße</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {[38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Brustumfang (in cm)</span>
                <input
                  type="number"
                  min={50}
                  max={200}
                  placeholder="z. B. 90"
                  className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Taillenumfang (in cm)</span>
                <input
                  type="number"
                  min={50}
                  max={200}
                  placeholder="z. B. 70"
                  className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Hüftumfang (in cm)</span>
                <input
                  type="number"
                  min={50}
                  max={200}
                  placeholder="z. B. 95"
                  className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange"
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
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {[
                    "Kaukasisch",
                    "Mediterran",
                    "Afrikanisch",
                    "Nahöstlich",
                    "Ostasiatisch",
                    "Südasiatisch",
                    "Südostasiatisch",
                    "Lateinamerikanisch",
                    "Native American",
                    "Aborigines",
                  ].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Augenfarbe</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["Blau", "Grün", "Braun", "Grau"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Hautton</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["Sehr Hell", "Hell", "Medium", "Olive", "Gebräunt", "Dunkel", "Sehr dunkel"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haut-Unterton</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {[
                    "Warm (Gold / Gelblich)",
                    "Kühl (Rosé / Bläulich)",
                    "Oliv (Grünlich)",
                    "Neutral",
                  ].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haarfarbe</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["Blond", "Braun", "Schwarz", "Rot", "Grau", "Glatze"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haarstruktur</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["Glatt", "Wellig", "Lockig", "Afro"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Haarlänge</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["Rasiert", "Kurz", "Mittellang", "Lang"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-navy/70">Bart (falls zutreffend)</span>
                <select className="border border-navy/20 rounded-md px-3 py-2 text-navy focus:outline-none focus:border-orange">
                  <option value="">Keine Angabe</option>
                  {["Glatt rasiert", "3-Tage-Bart", "Vollbart", "Schnurrbart"].map((v) => (
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
              placeholder="z. B. Sommersprossen, Tattoos, Narben …"
              className="w-full border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange resize-y"
            />
          </label>
        </section>

        {/* Model-Typ & Archetyp */}
        <section className="space-y-2">
          <h3 className="text-base font-bold text-navy uppercase tracking-wide mb-4">Model-Typ &amp; Archetyp</h3>
          {[
            "Klassischer Gentleman (Anzüge, Luxus, zeitlose Eleganz)",
            "Urbaner Rebell (Streetwear, Tattoos, moderner Edge)",
            "Naturbursche (Outdoor, Workwear, markant mit Bart)",
            "Androgener Ästhet (High-Fashion, avantgardistisch, feine Züge)",
            "Kumpel (Casual Wear, E-Commerce, sympathisch)",
            "Mentor / Vater (Best Ager, Vertrauen, Familie, Casual Comfort)",
            "Leader / Chef (Macht, Status, Senior Executive, Alpha-Ausstrahlung)",
            "Performer / Sportler (Athletisch, Dynamik, Activewear, Fitness)",
            "Homoerotisch (Sinnlich, progressive Mode)",
            "Normalo / Bürgerlich (Unauffällig, Mainstream, klassische Kaufhausmode, bürgerlich)",
            "Nerd / Intellectual (Brille, smarte Ausstrahlung, Preppy-Look, Strickwesten)",
            "Rockstar / Bohemien (Künstlerisch, lange Haare, Schmuck, Vintage, Festival-Style)",
            "Youngster / Gen-Z (Teenie-Look, TikTok-Trends, Skater, jugendliche Leichtigkeit)",
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
              placeholder="Weitere …"
              className="border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full"
            />
          </label>
        </section>

        <div className="pt-2">
          <button
            type="button"
            className="bg-orange text-white font-semibold px-6 py-3 rounded-md hover:bg-orange/90 transition-colors"
          >
            Models erstellen
          </button>
        </div>
      </form>
    </div>
  );
}
