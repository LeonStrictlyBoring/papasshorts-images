# Papas Shorts – Bildgenerierungs-Tool

Internes Tool zur KI-gestützten Generierung von Produkt- und Kampagnenbildern für Papas Shorts: virtuelle **Models** anlegen, **Settings** (Locations/Szenen) entwerfen oder aus Fotos ableiten, eigene **Artikel** hinterlegen und daraus komplette **Shootings** in 4K generieren.

Eine ausführliche Beschreibung von Architektur, Code-Aufbau, Datenmodell und allen Cloud Functions steht in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech-Stack

| Ebene | Technologie |
|---|---|
| Frontend | [Next.js](https://nextjs.org) (App Router, Static Export im Production-Build), React, Tailwind CSS v4 |
| Auth | Firebase Authentication (E-Mail/Passwort, Freischaltung durch Admin) |
| Datenbank | Cloud Firestore (Region `eur3`) |
| Bilder/Dateien | Cloud Storage for Firebase |
| Backend | Cloud Functions for Firebase (TypeScript, Node 24, Region `europe-west3`) |
| Hosting | Firebase Hosting (statischer Export aus `out/`) |
| Bildgenerierung | Google Gemini API, Modell `gemini-3-pro-image-preview` |

Firebase-Projekt: `bildgenerierung-495412` (alle Aliase in `.firebaserc` zeigen auf dieses Projekt).

## Repository-Aufbau

```
src/app/              Next.js-Seiten (Models, Settings, Shootings, Artikel, Profil, Auth)
src/app/_components/  AppShell (Routen-Gate), Header, Sidebar, ModelSedcardForm
src/lib/              Firebase-Init, AuthContext, Fehler-Formatierung
functions/src/        Cloud Functions (Generierung, User-Management, Rate-Limit, Logging)
firebase.json         Hosting-, Functions-, Firestore-, Storage-Konfiguration
firestore.rules       Firestore Security Rules
storage.rules         Storage Security Rules
docs/                 Ausführliche Architektur-Dokumentation
```

## Lokale Entwicklung

Voraussetzungen: Node.js, Firebase CLI (`npm i -g firebase-tools`), Zugriff auf das Firebase-Projekt.

1. Abhängigkeiten installieren:

   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

2. `.env.local` im Projekt-Root anlegen. Die Werte stehen in der Firebase Console unter *Projekteinstellungen → Deine Apps → Web-App*:

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

3. Dev-Server starten:

   ```bash
   npm run dev
   ```

   Die App läuft auf http://localhost:3000 und spricht direkt gegen das echte Firebase-Projekt (Auth, Firestore, Functions in `europe-west3`) — es gibt keine Emulator-Konfiguration.

## Nutzer & Rollen

- Neue Nutzer registrieren sich unter `/register` und landen im Status `pending`.
- Ein **Admin** oder **Developer** schaltet sie unter *Profil → Nutzerverwaltung* frei (Status `active`).
- Rollen: `user` (Standard), `admin` (zusätzlich Nutzerverwaltung), `developer` (zusätzlich System-Prompts unter *Profil → Prompts* und Fehler-Logs unter *Profil → Error-Logs*).

Die System-Prompts für die Generierung liegen **nicht im Repo**, sondern in Firestore (`prompts/*`) und werden über die Prompts-Seite gepflegt.

## Build & Deploy

Es gibt keine CI/CD-Pipeline — Deploys laufen manuell über die Firebase CLI.

**Hosting** (Frontend): Der Production-Build erzeugt einen statischen Export nach `out/`. Der Build muss vor dem Deploy manuell laufen (kein `predeploy`-Hook für Hosting):

```bash
npm run build
firebase deploy --only hosting
```

**Functions**: Der TypeScript-Build läuft automatisch als `predeploy`-Hook:

```bash
firebase deploy --only functions
```

Die Functions benötigen das Secret `GEMINI_API_KEY` im Cloud Secret Manager (`firebase functions:secrets:set GEMINI_API_KEY`).

**Rules & Indexes**:

```bash
firebase deploy --only firestore,storage
```

## Branches

- `main` – Default-Branch, aktueller Stand
- `develop` – Entwicklungsbranch, Features werden hierhin gemerged
- `stage` – historischer Staging-Stand
