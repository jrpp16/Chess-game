# Chess-game

Schachspiel mit Cursor — lokales Zwei-Spieler-Schach im Browser.

## Starten

```bash
npm install
npm run dev
```

Öffne die angezeigte URL (Standard: Port 5173, mit Base-Pfad `/Chess-game/`).

## GitHub Pages

Nach Push auf `main` baut der Workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) das Projekt und veröffentlicht `dist` auf GitHub Pages.

Live-URL (sobald Pages aktiv ist): **https://jrpp16.github.io/Chess-game/**

Repository-Einstellung: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Funktionen

- Vollständige Schachregeln (Zugvalidierung via [chess.js](https://github.com/jhlywa/chess.js))
- Klicksteuerung mit Anzeige legaler Züge
- Schach / Schachmatt / Patt / Remis
- Zugliste, Rückgängig, Neue Partie
- Bauernumwandlung per Dialog

## Build

```bash
npm run build
npm run preview
```
