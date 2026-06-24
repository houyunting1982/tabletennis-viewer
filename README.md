# Table Tennis Lab — Multi-Angle Viewer

A frame-accurate web player for studying table tennis technique from **24 synchronized camera angles**. Browse a technique library by player, scrub frame-by-frame, switch cameras during playback, and adjust speed.

Demo site: [tabletennislab.com](https://tabletennislab.com)

---

## Features

- **Multi-player library** — Biba, Felipe, and Lupi, each with their own technique catalog
- **24-camera playback** — phased loading (Camera 1 first, then background preload)
- **SPA routing** — shareable URLs per player and technique
- **Local dev** — JPG sequences stay on disk under `assets/` (not in Git)
- **CDN production** — optional Cloudflare R2 + custom domain for images and manifests
- **GitHub Actions deploy** — frontend to Cloudflare Pages on push to `main`

---

## URL routes

| Path | Page |
|------|------|
| `/` | Player picker (Biba / Felipe / Lupi) |
| `/players/biba` | Biba technique catalog |
| `/players/felipe` | Felipe technique catalog |
| `/players/lupi` | Lupi technique catalog |
| `/players/{playerId}/{techniqueId}` | Player + timeline + camera rail |

Example: `/players/biba/02-fh-counter-loop`

---

## Quick start (local)

### 1. Install

```bash
npm install
```

### 2. Add JPG assets

Large frame folders are **gitignored**. Place them under `assets/`:

```
assets/
├── Biba JPG/
├── Felipe JPG/
└── Lupi JPG/
```

Each technique is a subfolder, e.g. `01 Biba FH Loop Off Block JPG/`, with files like `…C01_00216000.jpg`.

Symlink example:

```bash
ln -s "/path/to/Biba JPG" "assets/Biba JPG"
ln -s "/path/to/Felipe JPG" "assets/Felipe JPG"
ln -s "/path/to/Lupi JPG" "assets/Lupi JPG"
```

See [assets/README.md](./assets/README.md) for naming rules and player config.

### 3. Generate manifests + catalog

```bash
npm run generate-manifest
```

This scans all configured players and writes:

- `public/catalog.json` — full library
- `public/manifests/{playerId}/{techniqueId}.json` — per-technique frame lists

Generate one player only:

```bash
node scripts/generate-manifest.mjs --player=felipe
```

### 4. Run dev server

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Pick a player → technique → wait for Camera 1 to buffer → Play.

### 5. Production build (optional)

```bash
npm run build
npm run preview
```

---

## Project structure

```
tabletennis-viewer/
├── assets/                 # Local JPG sources (gitignored except README)
├── public/
│   ├── catalog.json        # Generated — technique directory
│   ├── manifests/          # Generated — {playerId}/{techniqueId}.json
│   ├── images/             # Static UI assets (hero image, etc.)
│   └── _redirects          # SPA fallback for Cloudflare Pages
├── scripts/
│   ├── players.config.mjs  # Player ids, folder names, parse patterns
│   ├── generate-manifest.mjs
│   └── upload-to-r2.mjs
├── src/
│   ├── components/         # Catalog, player view, controls, camera rail
│   ├── hooks/
│   └── lib/playback/       # Engine, buffer loader, manifest helpers
├── cdn.config.json         # R2 credentials (gitignored — copy from example)
├── .env.production         # VITE_CATALOG_URL for production builds
└── .github/workflows/
    └── deploy-pages.yml    # Build + deploy to Cloudflare Pages
```

---

## npm scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server + local asset middleware |
| `npm run build` | Typecheck + production bundle → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run generate-manifest` | Scan `assets/` → `public/catalog.json` + manifests |
| `npm run generate-manifest:cdn` | Same + write `cdn-staging/` with CDN URLs |
| `npm run generate-catalog:cdn` | Regenerate CDN catalog only (no JPG copy) |
| `npm run upload-r2` | Upload `cdn-staging/` to Cloudflare R2 |
| `npm run upload-r2:catalog` | Upload catalog JSON only |
| `npm run upload-r2:dry-run` | Print what would be uploaded |

---

## How data flows

### Local development

```
Browser
  → GET /catalog.json
  → pick technique → GET /manifests/biba/02-fh-counter-loop.json
  → frames from /local-assets/Biba JPG/…/*.jpg  (Vite middleware → assets/)
```

No R2 or CDN required. Catalog and manifests are **generated** into `public/`; JPGs are served directly from `assets/`.

### Production (current setup)

```
Browser (tabletennislab.com)
  → fetch(VITE_CATALOG_URL)  →  https://cdn.tabletennislab.com/catalog.json
  → manifest + JPG URLs on CDN (R2 custom domain)
  → static UI from Cloudflare Pages
```

Set in `.env.production` or GitHub Actions variable:

```bash
VITE_CATALOG_URL=https://cdn.tabletennislab.com/catalog.json
```

**Note:** JSON catalog/manifest fetches need **CORS** on the R2 bucket. Frame images use `<img>` loading (no CORS). See [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/) if catalog fetch fails in the browser.

---

## CDN / R2 setup (optional)

Used when you deploy assets to Cloudflare R2 instead of bundling JPGs with Pages.

### 1. Config

```bash
cp cdn.config.example.json cdn.config.json
```

```json
{
  "cdnBaseUrl": "https://cdn.your-domain.com",
  "r2": {
    "accountId": "...",
    "bucket": "tabletennis-assets",
    "accessKeyId": "...",
    "secretAccessKey": "..."
  }
}
```

Do **not** commit `cdn.config.json`.

### 2. Generate CDN staging

```bash
npm run generate-manifest:cdn
```

Output layout:

```
cdn-staging/
├── catalog.json
├── players/biba/catalog.json
├── players/felipe/catalog.json
├── players/lupi/catalog.json
└── players/{playerId}/techniques/{techniqueId}/
    ├── manifest.json
    └── *.jpg
```

### 3. Upload

```bash
npm run upload-r2:dry-run          # inspect
node scripts/upload-to-r2.mjs 01-fh-loop-off-block   # one technique
npm run upload-r2                # everything
```

### 4. R2 custom domain + CORS

1. R2 bucket → **Settings** → **Custom domains** → add e.g. `cdn.your-domain.com`
2. **CORS policy** — allow your site origin:

```json
[
  {
    "AllowedOrigins": ["https://tabletennislab.com", "https://www.tabletennislab.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Deploy frontend (Cloudflare Pages)

Deployment is via **GitHub Actions only** (do not connect Cloudflare Pages to Git — that path conflicts with this workflow).

**Secrets** (repo → Settings → Secrets):

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Token with **Cloudflare Pages · Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

**Optional variables** (Settings → Actions → Variables):

| Variable | Default |
|----------|---------|
| `VITE_CATALOG_URL` | `https://cdn.tabletennislab.com/catalog.json` |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `tabletennis-viewer` |

Push to `main` → build → `wrangler pages deploy dist`. Manual runs: **Actions → Deploy Pages → Run workflow**.

Custom domain: Cloudflare Pages project → **Custom domains** → add `tabletennislab.com`.

---

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_CATALOG_URL` | `.env.production` / CI | Catalog JSON URL (default local: `/catalog.json`) |
| `BIBA_ASSETS_DIR` | shell | Override path to Biba JPG folder (legacy) |
| `CDN_BASE_URL` | shell | Override `cdnBaseUrl` for `--cdn` scripts |

Copy [.env.example](./.env.example) for local overrides.

---

## Adding a player

1. Add JPG folder: `assets/NewPlayer JPG/`
2. Register in [scripts/players.config.mjs](./scripts/players.config.mjs):

```js
{
  id: "newplayer",
  name: "New Player",
  assetsDir: "NewPlayer JPG",
  folderPattern: /^(\d+[a-zA-Z]?)\.?\s+New Player\s+(.+)$/i,
}
```

3. Technique folders must match the pattern, e.g. `01 New Player FH Loop JPG/`
4. Run `npm run generate-manifest`

---

## Playback behavior

1. Load catalog → user picks player and technique
2. Fetch technique `manifest.json`
3. **Phase 1:** load all frames for Camera 1 → enable Play
4. **Background:** preload other cameras (priority follows playhead when playing)
5. Clock-driven frame advance; stalls to **Buffering** if the next frame is not ready
6. Switch camera only when that camera’s track is 100% loaded

---

## Keyboard shortcuts (player view)

| Key | Action |
|-----|--------|
| ← / → | Previous / next **ready** camera |
| ↑ / ↓ | Previous / next frame |
| Space | Play / pause |
| 1–4 | Speed 1× / ½× / ¼× / ⅒× |

---

## Local vs CDN file layout

| | Local dev | CDN (R2) |
|--|-----------|------------|
| Catalog | `public/catalog.json` | `cdn-staging/catalog.json` |
| Manifest | `public/manifests/{playerId}/{id}.json` | `cdn-staging/players/{playerId}/techniques/{id}/manifest.json` |
| Images | `/local-assets/{Player JPG}/…` | Same path under bucket prefix |
| Generate | `npm run generate-manifest` | `npm run generate-manifest:cdn` |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Empty library after `dev` | Run `npm run generate-manifest`; check `assets/` folders exist |
| Technique skipped in generate | Folder name does not match `folderPattern` in `players.config.mjs` |
| `Failed to fetch` / `Load failed` on live site | CDN SSL or CORS; test `https://cdn…/catalog.json` directly |
| Play button disabled | Camera 1 still loading; wait for overlay to finish |
| Safari vs Chrome differ | Often CDN/IPv6/QUIC; not app logic |

More step-by-step notes (bilingual EN/中文): [USAGE.md](./USAGE.md)

---

## Tech stack

- **UI:** React 18, TypeScript, Vite 5
- **Playback:** Canvas frame display, custom buffer loader + frame clock
- **Hosting:** Cloudflare Pages (frontend), Cloudflare R2 (media, optional)
- **CI:** GitHub Actions + `wrangler pages deploy`

---

## License

Private project — all rights reserved unless otherwise noted.
