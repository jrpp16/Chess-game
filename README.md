# Chess-game

Schachspiel mit Cursor — lokales Zwei-Spieler-Schach im Browser.

## Starten

```bash
npm install
npm run dev
```

Öffne die angezeigte URL (Standard: Port 5173, mit Base-Pfad `/Chess-game/`).

## GitHub Pages

Live-URL: **https://jrpp16.github.io/Chess-game/**

Der Build landet im Ordner `docs/` (Vite `base: /Chess-game/`). Der Workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) führt bei Push auf `main` `npm ci`, `npm run build` und deployt den Ordner `docs`.

**Wichtig (sonst leeres Brett / „Neue Partie“ ohne Wirkung):** GitHub darf nicht das ungebaute Repository-Root ausliefern — dann fehlen `/Chess-game/assets/…` und die Dev-Pfade `/src/…` liefern 404.

In **Settings → Pages → Build and deployment** eine der folgenden Optionen wählen:

1. **Empfohlen:** **Source → GitHub Actions** (Workflow „Deploy to GitHub Pages“), oder  
2. **Alternative:** **Deploy from a branch** → Branch `main`, Ordner **`/docs`**

Ohne diese Einstellung wird weiterhin die rohe `index.html` aus dem Repo-Root mit `/src/main.js` ausgeliefert — JavaScript und Stylesheet laden nicht.

## Funktionen

- Vollständige Schachregeln (Zugvalidierung via [chess.js](https://github.com/jhlywa/chess.js))
- Klicksteuerung mit Anzeige legaler Züge
- Schach / Schachmatt / Patt / Remis
- Zugliste, Rückgängig, Neue Partie
- Bauernumwandlung per Dialog (touch-freundlich)
- **Computergegner** (Minimax, Alpha-Beta, drei Schwierigkeiten)
- Lokale **Erfahrungswerte** in IndexedDB (kein Machine Learning)

## Build

```bash
npm run build
npm run preview
```

## Agenten & andere Assistenten

Für einen **einheitlichen Workflow** (Scope, Git, Tests, Übergabe zwischen Agenten): siehe **[AGENTS.md](./AGENTS.md)**.
