# Table Tennis 4D Viewer (newVersion)

Greenfield frontend player for multi-camera frame-sequence playback.

**完整使用说明见 [USAGE.md](./USAGE.md)**（本地开发 + Cloudflare R2/CDN 部署）。

## Quick start (local)

```bash
cd newVersion
npm install
npm run generate-manifest
npm run dev
```

Open the URL printed by Vite, pick a Biba technique, wait for the camera track buffer, then play.

## Cloudflare R2 / CDN

### 1. Configure R2

1. Create an R2 bucket in Cloudflare Dashboard
2. Connect a custom domain, for example `https://cdn.your-domain.com`
3. Create an R2 API token with read/write access
4. Copy config:

```bash
cp cdn.config.example.json cdn.config.json
```

Fill in:

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

### 2. Generate CDN manifests

```bash
npm run generate-manifest:cdn
```

This writes:

```
cdn-staging/
├── catalog.json
├── players/biba/catalog.json
└── players/biba/techniques/
    ├── 01-fh-loop-off-block/manifest.json
    ├── 02-fh-counter-loop/manifest.json
    └── ...
```

Each technique manifest uses CDN URLs:

```json
{
  "baseUrl": "https://cdn.your-domain.com/players/biba/techniques/01-fh-loop-off-block",
  "source": { "folder": "01 Biba FH Loop Off Block JPG" }
}
```

### 3. Upload to R2

Dry run first:

```bash
npm run upload-r2:dry-run
```

Upload one technique:

```bash
node scripts/upload-to-r2.mjs 01-fh-loop-off-block
```

Upload everything:

```bash
npm run upload-r2
```

Upload puts:

- `players/biba/techniques/<id>/manifest.json`
- `players/biba/techniques/<id>/*.jpg`
- `catalog.json`

### 4. Point the frontend to CDN catalog

Create `.env.production`:

```bash
VITE_CATALOG_URL=https://cdn.your-domain.com/catalog.json
```

Then build and deploy:

```bash
npm run build
```

## Local vs CDN layout

| | Local dev | CDN |
|--|-----------|-----|
| Catalog | `public/catalog.json` | `cdn-staging/catalog.json` |
| Manifest | `public/manifests/<id>.json` | `cdn-staging/players/biba/techniques/<id>/manifest.json` |
| Images | `/local-assets/...` via Vite | R2 bucket same path as manifest folder |
| Generate | `npm run generate-manifest` | `npm run generate-manifest:cdn` |

## Playback model

1. Load catalog
2. Load technique manifest
3. Preload and decode the current camera track
4. Only allow play when the track is ready
5. During playback, advance frames from memory only

## Keyboard shortcuts

- Left / Right: previous / next camera
- Up / Down: next / previous frame
- Space: play / pause
- 1 / 2 / 3 / 4: 100% / 50% / 25% / 10% speed
