# Architektur & Code-Aufbau

Dieses Dokument beschreibt, wie das Bildgenerierungs-Tool intern funktioniert: Seiten, Cloud Functions, Datenmodell, Generierungs-Flow, Security Rules und bekannte Eigenheiten. Es richtet sich an Entwickler, die das Tool übernehmen oder erweitern.

## Überblick

```
Browser (Next.js Static Export)
   │  Firebase JS SDK
   ├── Firebase Auth          (Login, Registrierung, Passwort-Reset)
   ├── Cloud Firestore        (direktes Lesen/Schreiben der Inhalte)
   ├── Cloud Storage          (Artikel-Bild-Uploads)
   └── Cloud Functions        (httpsCallable, Region europe-west3)
          │
          ├── Gemini API (gemini-3-pro-image-preview)  ← Secret GEMINI_API_KEY
          ├── Cloud Storage (generierte Bilder)
          └── Firestore (Prompts lesen, Rate-Limits, Error-Logs)
```

Alle Seiten sind Client-Komponenten (`'use client'`). Es gibt keine API-Routes und keine Server Actions — das Frontend spricht direkt per Firebase SDK mit Firestore/Storage und ruft die Cloud Functions per `httpsCallable` auf. Die Bildgenerierung läuft **synchron** im Callable-Request (bis zu 9 Minuten Wartezeit im Browser); es gibt keinen Job-/Polling-Mechanismus.

## Frontend: Seiten & Routen

| Route | Zweck | Cloud Functions | Firestore/Storage |
|---|---|---|---|
| `/` | Dashboard mit Kacheln zu Models, Artikel, Settings, Shootings | – | – |
| `/login`, `/register`, `/forgot-password` | Auth-Flow (siehe unten) | – | `users` |
| `/models` | Model-Liste, Soft-Delete (`archived`) | – | `models` |
| `/models/create` | Sedcard-Formular → 3 Modelbilder generieren, verfeinern, speichern | `generateModelImages` | `models` |
| `/models/[id]/edit` | Bestehendes Model als Vorlage → neue Varianten (legt **neues** Dokument an) | `generateModelImages` | `models` |
| `/settings` | Setting-Liste mit Filter/Sortierung, Multi-Select-Soft-Delete | – | `settings` |
| `/settings/create` | Setting-Briefing (Location-Typ, Licht, Farben, Set-Design, Vibe) → 4 Bilder | `generateSettingImages` | `settings` |
| `/settings/from-photo` | Foto hochladen (max. 5 MB, Base64) + Anpassungstext → 4 Setting-Bilder | `generateSettingFromPhoto` | `settings` |
| `/settings/[id]/edit` | Setting laden, Briefing zurückspielen, Refinement | `generateSettingImages` | `settings` |
| `/shootings` | Shooting-Liste, Bild-Download über Function | `getSignedDownloadUrl` | `shootings` |
| `/shootings/create` | **Kern-Workflow**: Models + Artikel + Setting + Regie-Parameter + Seitenverhältnis → 3 Shots in 4K | `generateShootingShots` | `models`, `artikel`, `settings`, `shootings` |
| `/artikel` | Artikelverwaltung mit Multi-Bild-Upload (Ansicht pro Bild), Kategorien | – | `artikel` + Storage-Upload |
| `/profil` | Eigenes Profil, Abmelden | – | – |
| `/profil/nutzerverwaltung` | Nutzer freischalten, Rollen ändern, Nutzer löschen (nur Admin/Developer) | `deleteUser` | `users` |
| `/profil/prompts` | System-Prompts der 4 Generierungs-Flows editieren (nur Developer) | – | `prompts` |
| `/profil/error-logs` | Fehler-Log-Viewer, Filter, CSV-Export (nur Developer) | – | `errorLogs` |

**Zentrale Bausteine:**

- `src/lib/firebase.ts` – Firebase-Init aus `NEXT_PUBLIC_*`-Env-Variablen; Functions-Region fest auf `europe-west3`.
- `src/lib/AuthContext.tsx` – lädt `users/{uid}` und stellt `role`/`status` bereit (`isAdmin` = admin oder developer, `isDeveloper`).
- `src/app/_components/AppShell.tsx` – Routen-Gate: ohne aktiven Account Redirect auf `/login`; `/profil/prompts` nur Developer, `/profil/nutzerverwaltung` nur Admin/Developer.
- `src/lib/formatFirebaseError.ts` – mappt Function-Fehlercodes (`resource-exhausted`, `unavailable`, `deadline-exceeded`, …) auf deutsche Fehlermeldungen mit Handlungsempfehlung.

**Dynamische Edit-Routen bei Static Export:** `models/[id]/edit` und `settings/[id]/edit` exportieren statisch nur den Platzhalter `_` (`generateStaticParams`). Firebase Hosting schreibt per Rewrite `/models/*/edit` → `/models/_/edit.html` um, und die Client-Komponente liest die echte ID aus `window.location`-Pfad. Wer neue dynamische Routen anlegt, muss dieses Muster (Platzhalter + Rewrite in `firebase.json`) mitziehen.

## Auth-Flow & Rollen

1. **Registrierung** (`/register`): legt Firebase-Auth-User an und schreibt `users/{uid}` mit `role: 'user'`, `status: 'pending'` — danach sofortiges Sign-out („Du erhältst Zugang, sobald ein Administrator dich freigeschaltet hat").
2. **Freischaltung**: Admin/Developer setzt in der Nutzerverwaltung `status: 'active'` (direkter Firestore-Write, keine Function). Das UI verhindert, dass der letzte aktive Admin deaktiviert wird; die Developer-Rolle kann nur ein Developer vergeben.
3. **Login**: prüft nach dem Sign-in den Status im `users`-Dokument; `pending`/`inactive` → Sign-out mit Hinweis.
4. **Passwort vergessen**: `sendPasswordResetEmail`; unbekannte E-Mails werden bewusst nicht verraten (keine User-Enumeration).

Rollen: `user` → alle Inhalts-Seiten; `admin` → zusätzlich Nutzerverwaltung; `developer` → zusätzlich Prompts + Error-Logs.

## Cloud Functions

Alle Functions: `onCall` (callable), Region `europe-west3`, `maxInstances: 10` global. Die vier Generierungs-Functions haben `timeoutSeconds: 540` und laden ihren System-Prompt aus Firestore (`prompts/<id>`, Feld `systemPrompt`), in den sie die Formularwerte als `{{platzhalter}}` einsetzen. Das Frontend ruft sie mit Client-Timeout 540 000 ms auf.

| Function | Prompt-Dokument | Output | Besonderheiten |
|---|---|---|---|
| `generateModelImages` | `model-creation` | 3 Bilder, **parallel** generiert | Input = komplette Sedcard (Persona, Maße, Aussehen, Archetypen); Memory 512 MiB |
| `generateSettingImages` | `setting-creation` | 4 Bilder, parallel | Strukturiertes Briefing: Location-Typ (indoor / outdoor-urban / outdoor-natur), Licht, Farben, Set-Design, Vibe; Memory 512 MiB |
| `generateSettingFromPhoto` | `setting-from-photo` | 4 Bilder, parallel | Foto kommt als Base64 im Request; bei Refinement ist das Foto optional; Memory 512 MiB |
| `generateShootingShots` | `shooting-creation` | 3 Shots, **sequenziell** | Lädt alle Referenzbilder (Models, Artikel, Setting) aus Storage und übergibt sie nummeriert an Gemini; `imageConfig: { aspectRatio, imageSize: '4K' }`; Retry: max. 2 Wiederholungen pro Shot, wenn Gemini kein Bild liefert; Memory 1 GiB |
| `getSignedDownloadUrl` | – | Base64-Dateiinhalt | Liefert trotz des Namens keine Signed URL, sondern den Dateiinhalt als Base64 (für den Blob-Download im Browser); Memory 256 MiB |
| `createUser` | – | `{ uid, resetLink }` | Admin-only; legt User mit Status `active` an und erzeugt Passwort-Reset-Link. **Wird vom Frontend aktuell nicht aufgerufen** |
| `deleteUser` | – | `{ success }` | Admin-only; verhindert Selbstlöschung und das Löschen des letzten aktiven Admins |
| `generateImage` | – | 1 Bild | Freitext-Prompt, Signed URL mit 1 h Gültigkeit. **Legacy — wird vom Frontend nicht aufgerufen** |

**Refinement-Muster** (überall gleich): Der Client schickt das ursprüngliche Briefing erneut plus `refinement: { storagePath, text }`. Die Function lädt das Referenzbild aus Storage und hängt es mit dem Anpassungstext an den Prompt an. Beim Speichern entsteht immer ein **neues** Dokument — bestehende Einträge werden nie überschrieben.

**Gemini-Anbindung**: SDK `@google/genai`, Modell in allen Functions hartkodiert `gemini-3-pro-image-preview`, `responseModalities: ['IMAGE']`. API-Key kommt aus dem Cloud Secret Manager (`secrets: ['GEMINI_API_KEY']`). Fehler werden klassifiziert: Quota → `resource-exhausted` (Meldung „Limit erreicht"), Überlastung → `unavailable`, Rest → `internal`.

## Firestore-Datenmodell

| Collection | Felder (Kern) | Geschrieben von |
|---|---|---|
| `users/{uid}` | `name`, `email`, `role` (`user`\|`admin`\|`developer`), `status` (`pending`\|`active`\|`inactive`), `createdAt` | Registrierung, Nutzerverwaltung, `createUser` |
| `models` | `imageUrl`, `storagePath`, `name`, `sedcard` (komplettes Formular), `createdAt`, `createdBy`, `archived` | Client nach Generierung |
| `settings` | `imageUrl`, `storagePath`, `name`, `briefing` (nur beim Create-Flow, nicht bei from-photo), `createdAt`, `createdBy`, `archived` | Client nach Generierung |
| `artikel` | `produktname`, `artikelId`, `kategorie`, `beschreibung`, `bilder[] { url, storagePath, ansicht }`, `createdAt`, `createdBy`, `archived` | Client (Artikel-Seite) |
| `shootings` | `imageUrl`, `storagePath`, `models[]` (Namen), `setting` (Name), `artikel[] { produktname, artikelId }`, `createdAt`, `createdBy`, `archived` | Client nach Generierung |
| `prompts/{id}` | `systemPrompt`, `updatedAt`, `updatedBy` — feste IDs: `model-creation`, `setting-creation`, `setting-from-photo`, `shooting-creation` | Prompts-Seite (Developer) |
| `errorLogs` | `flow`, `userId`, `errorType`, `message`, `errString`, `severity`, `code`, `timestamp` | nur Functions (Admin SDK) |
| `rateLimits/{uid}` | `dailyCount`, `dailyDate`, `minuteCount`, `minuteWindow` | nur Functions (Admin SDK) |

Wichtig zu wissen: **Es gibt keine echten Referenzen zwischen Collections.** `shootings` speichert Models/Setting/Artikel denormalisiert als Namen bzw. Artikelnummern; `createdBy` ist der Anzeigename, nicht die UID. Löschen ist durchgängig **Soft-Delete** über das Feld `archived`. `firestore.indexes.json` ist leer — es sind keine Composite-Indizes nötig.

Die **System-Prompts liegen ausschließlich in Firestore**, nicht im Repo. Die Prompts-Seite dokumentiert die verfügbaren Platzhalter pro Flow.

## Storage-Struktur

| Pfad | Inhalt |
|---|---|
| `generated/models/<uid>/<timestamp>/<i>.jpg` | generierte Modelbilder |
| `generated/settings/<uid>/<timestamp>/<i>.jpg` | generierte Settings (beide Flows) |
| `generated/shootings/<uid>/<timestamp>/<i>.jpg` | generierte Shooting-Shots |
| `artikel/<uid>/<timestamp>/<dateiname>` | vom Client hochgeladene Artikelbilder |
| `generated/<uuid>.jpg` | Legacy (`generateImage`) |

Generierte Bilder bekommen einen `firebaseStorageDownloadTokens`-Token und damit eine **dauerhaft gültige** Download-URL, die in Firestore gespeichert wird. Die Listen-Seiten „heilen" veraltete URLs (z. B. abgelaufene Signed URLs aus früheren Versionen), indem sie sie per `getDownloadURL` erneuern.

## Security Rules

**Firestore** (`firestore.rules`):

- `users`: eigener Nutzer nur lesen; Admin/Developer voll; Selbstregistrierung nur mit `role: 'user'` + `status: 'pending'`
- `models`/`settings`/`artikel`/`shootings`: eingeloggte User dürfen lesen und anlegen; Updates nur, wenn sie ausschließlich `archived` ändern (Soft-Delete); Volltschreibzugriff nur Admin/Developer
- `prompts`: nur Developer; `errorLogs`: Developer lesen, schreiben nur Admin SDK; `rateLimits`: nur Admin SDK

**Storage** (`storage.rules`):

- `artikel/{userId}/**`: lesen alle eingeloggten; schreiben nur der Besitzer, nur Bilder (jpeg/png/webp) unter 10 MB
- `generated/**`: lesen alle eingeloggten; schreiben nur Functions

## Rate-Limiting & Error-Logging

- **Rate-Limit** (`functions/src/rateLimit.ts`): pro User 500 Generierungen/Tag und 10/Minute (UTC-Kalenderfenster), atomar per Firestore-Transaktion in `rateLimits/{uid}`. Greift in allen Generierungs-Functions; Überschreitung → Fehlermeldung „Limit erreicht".
- **Error-Logging** (`functions/src/logToFirestore.ts`): Fehler gehen doppelt raus — strukturiert ins Cloud Logging (`logger.error/warn`) und als Dokument nach `errorLogs` (sichtbar auf der Error-Logs-Seite). Speziell beim Shooting-Flow werden auch leere Gemini-Antworten protokolliert (`NoImageReturned` pro Versuch, `SilentFailure` wenn ein Shot nach allen Versuchen fehlt — der Shot fehlt dann einfach im Ergebnis, die Function wirft keinen Fehler).

## Bekannte Eigenheiten & Hinweise

Punkte, die beim Weiterentwickeln bewusst sein sollten (Stand: Übergabe Juli 2026):

1. **`status: 'pending'` wird serverseitig nicht geprüft.** Die Security Rules und die Functions prüfen nur „eingeloggt" bzw. die Rolle — das Status-Gate (pending/inactive) sitzt im Client. Ein registrierter, noch nicht freigeschalteter User könnte per direktem SDK-Zugriff Inhalte lesen/anlegen und Generierungen aufrufen.
2. **Keine Owner-Trennung bei Inhalten:** Alle eingeloggten User sehen alle Models/Settings/Artikel/Shootings (bewusstes Team-Tool-Design).
3. **`getSignedDownloadUrl`** prüft nicht, ob der angefragte Storage-Pfad zum aufrufenden User gehört, und hat kein Rate-Limit.
4. **Synchrone Generierung:** Der Browser wartet bis zu 9 Minuten auf die Callable-Antwort. Bei Timeout-Problemen wäre ein Job-Modell (Firestore-Dokument + Polling/Listener) der nächste Ausbauschritt.
5. **`sharp`** ist als Dependency installiert, wird aber nirgends importiert (Überbleibsel).
6. **`generateImage` und `createUser`** werden vom Frontend nicht genutzt (Legacy bzw. vorbereitet).
7. **Umgebungen:** Es gibt nur ein Firebase-Projekt (`bildgenerierung-495412`); getrennte Stage-/Prod-Umgebungen sind nicht konfiguriert.
