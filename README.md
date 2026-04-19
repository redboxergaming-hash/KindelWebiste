# Kindle Smart Dashboard (Basis)

Leichtgewichtiges, statisches Grundgerüst für ein Kindle-optimiertes Smart Dashboard.

## Struktur

- `index.html` – Startseite mit Dashboard-Layout.
- `assets/css/styles.css` – minimalistisches Basis-Styling (E-Ink-freundlich).
- `assets/js/widgets.js` – Widget-Registry (clock, weather, calendar, feed, placeholder).
- `assets/js/app.js` – lädt `config/dashboard.json` und rendert die erste Seite.
- `config/dashboard.json` – zentrale Dashboard-Konfiguration.
- `netlify/functions/` – API-Endpunkte für Health, Wetter, Kalender und Feed.

## Lokal starten

### Option 1: Python Static Server

```bash
python3 -m http.server 8080
```

Danach im Browser öffnen: `http://localhost:8080`

### Option 2: Netlify CLI (empfohlen für Functions)

```bash
netlify dev
```

Dann sind Seite und Functions gemeinsam verfügbar.

## Feed Function (RSS Aggregation)

`GET /api/feed` lädt RSS serverseitig aus einer erlaubten Quellenliste und reduziert auf ein kleines Format:

```json
{
  "ok": true,
  "data": {
    "source": "hn",
    "title": "Hacker News",
    "items": [
      {
        "title": "Example headline",
        "publishedAt": "Mon, 20 Apr 2026 10:00:00 GMT",
        "source": "Hacker News"
      }
    ]
  },
  "meta": {
    "generatedAt": "<ISO_DATETIME>",
    "source": "rss",
    "count": 1
  }
}
```

### Sichere Feed-Konfiguration

Direkte freie URL-Übergabe vom Frontend ist absichtlich **nicht** aktiviert. Stattdessen wird serverseitig aus einer erlaubten Source-Liste gelesen.

Standardquellen:

- `hn` → Hacker News (`https://hnrss.org/frontpage`)
- `bbc` → BBC World (`http://feeds.bbci.co.uk/news/world/rss.xml`)

Optionale Variablen:

- `FEED_DEFAULT_SOURCE` (default `hn`)
- `FEED_MAX_ITEMS` (default `3`)
- `FEED_TIMEOUT_MS` (default `5000`)
- `FEED_SOURCES_JSON` (optional JSON-Map erlaubter Quellen)

Beispiel für `FEED_SOURCES_JSON`:

```json
{
  "hn": { "label": "Hacker News", "url": "https://hnrss.org/frontpage" },
  "mynews": { "label": "My Feed", "url": "https://example.com/rss.xml" }
}
```

### Feed lokal testen

```bash
netlify dev
curl -s "http://localhost:8888/api/feed?source=hn" | jq
```

Fehlerfall testen (ungültige Quelle):

```bash
curl -s "http://localhost:8888/api/feed?source=unknown" | jq
```

## Weather Function (echt)

`GET /api/weather` ruft serverseitig OpenWeather ab und normalisiert auf ein kompaktes Format.

Erforderliche Variablen:

- `WEATHER_API_KEY`
- `WEATHER_LAT`
- `WEATHER_LON`

Optional:

- `WEATHER_UNITS` (default `metric`)
- `WEATHER_LANG` (default `de`)
- `WEATHER_TIMEOUT_MS` (default `4500`)

## Calendar Function (echt)

`GET /api/calendar` ruft serverseitig Google Calendar (Service Account) ab und reduziert auf kommende Termine.

Erforderliche Variablen:

- `GCAL_CLIENT_EMAIL`
- `GCAL_PRIVATE_KEY` (`\n` escaped erlaubt)
- `GCAL_CALENDAR_ID`

Optional:

- `GCAL_TIMEZONE` (default `Europe/Berlin`)
- `GCAL_MAX_RESULTS` (default `5`)
- `GCAL_TIMEOUT_MS` (default `5000`)

## Weitere Functions

- `GET /api/health` – Health-Status (Mock).
- `GET /health` – Legacy-Health-Endpunkt.
