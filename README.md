# Kindle Smart Dashboard

Leichtgewichtiges, statisches Dashboard für Kindle/E-Ink mit optionalem iPhone-Editor (lokal im Browserzustand).

## Projektstruktur

- `index.html` – Einstiegspunkt, lädt Dashboard- und Editor-Modus.
- `config/dashboard.json` – zentrale Konfiguration (Pages, Widgets, Rotation).
- `assets/css/styles.css` – minimalistisches UI (Dashboard + Editor).
- `assets/js/utils.js` – kleine Debug-Logging-Utility.
- `assets/js/app.js` – Moduslogik, Config-Laden, Seitenrotation, Rendering-Orchestrierung.
- `assets/js/widgets.js` – Widget-Registry und Widget-Implementierungen.
- `assets/js/editor.js` – lokaler Editor (ohne Server-Persistenz).
- `netlify/functions/` – serverseitige API-Aggregation (Weather, Calendar, Feed, Health).
- `netlify.toml` – Redirects und Functions-Konfiguration.

## Lokale Entwicklung

### 1) Nur statisches Frontend

```bash
python3 -m http.server 8080
```

Dann öffnen: `http://localhost:8080`

### 2) Frontend + Netlify Functions

```bash
netlify dev
```

Dann öffnen:
- App: `http://localhost:8888`
- Beispiel-API: `http://localhost:8888/api/health`

## Netlify Deploy

1. Repo mit Netlify verbinden.
2. Environment Variables setzen (siehe unten).
3. Deploy starten (`main`/Produktions-Branch).
4. Redirects und Functions werden über `netlify.toml` automatisch verwendet.

## Environment Variables

### Weather (`/api/weather`)

Pflicht:
- `WEATHER_API_KEY`
- `WEATHER_LAT`
- `WEATHER_LON`

Optional:
- `WEATHER_UNITS` (default `metric`)
- `WEATHER_LANG` (default `de`)
- `WEATHER_TIMEOUT_MS` (default `4500`)

### Calendar (`/api/calendar`)

Pflicht:
- `GCAL_CLIENT_EMAIL`
- `GCAL_PRIVATE_KEY` (`\n` escaped erlaubt)
- `GCAL_CALENDAR_ID`

Optional:
- `GCAL_TIMEZONE` (default `Europe/Berlin`)
- `GCAL_MAX_RESULTS` (default `5`)
- `GCAL_TIMEOUT_MS` (default `5000`)

### Feed (`/api/feed`)

Optional:
- `FEED_DEFAULT_SOURCE` (default `hn`)
- `FEED_MAX_ITEMS` (default `3`)
- `FEED_TIMEOUT_MS` (default `5000`)
- `FEED_SOURCES_JSON` (allowlist für sichere Quellen)

## Editor-Workflow (lokal)

Editor öffnen:
- `?mode=editor`

Im Editor möglich:
- Seiten hinzufügen / umbenennen
- Widgets hinzufügen / entfernen / Up-Down sortieren
- einfache Widget-Konfigfelder bearbeiten
- JSON exportieren (anzeigen + herunterladen)
- JSON importieren (Textfeld oder Datei)
- Preview im Dashboard: `?mode=dashboard&preview=1`

Wichtig:
- Änderungen sind lokal im Browserzustand (kein Server-Save).
- Preview nutzt temporär `localStorage`.

## Debug-Logging

Aktivieren über:
- URL: `?debug=1`
- oder `localStorage.setItem('dashboard_debug', '1')`

Dann werden zusätzliche Debug-Logs für App/Widgets ausgegeben.
