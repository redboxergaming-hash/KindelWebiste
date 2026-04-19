# Kindle Smart Dashboard (Basis)

Leichtgewichtiges, statisches Grundgerüst für ein Kindle-optimiertes Smart Dashboard.

## Struktur

- `index.html` – Startseite mit ruhigem Dashboard-Layout.
- `assets/css/styles.css` – minimalistisches Basis-Styling (E-Ink-freundlich).
- `assets/js/app.js` – einfacher App-Start ohne Business-Logik.
- `netlify.toml` – Netlify Build/Functions Konfiguration.
- `netlify/functions/health.js` – einfache Health-Function.

## Lokal starten

### Option 1: Python Static Server

```bash
python3 -m http.server 8080
```

Danach im Browser öffnen: `http://localhost:8080`

### Option 2: Netlify CLI (optional)

```bash
netlify dev
```

Dann sind Seite und Function gemeinsam verfügbar.

## Health-Check

- Mit Netlify (`netlify dev`): `http://localhost:8888/health`
- Direkt als Function-Route: `http://localhost:8888/.netlify/functions/health`
