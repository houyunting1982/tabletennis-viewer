# Local assets (not in Git)

Large frame-sequence folders live here. Run `npm run generate-manifest` after adding or changing JPG folders.

## Layout

```
assets/
├── Biba JPG/      → player id: biba
├── Felipe JPG/    → player id: felipe
└── Lupi JPG/      → player id: lupi
```

Player folders and naming rules are defined in `scripts/players.config.mjs`.

## Setup

Copy or symlink from your source archive, for example:

```bash
ln -s "/path/to/Biba JPG" "assets/Biba JPG"
ln -s "/path/to/Felipe JPG" "assets/Felipe JPG"
ln -s "/path/to/Lupi JPG" "assets/Lupi JPG"
```

Then generate manifests and start dev:

```bash
npm run generate-manifest
npm run dev
```

## Generate one player only

```bash
node scripts/generate-manifest.mjs --player=felipe
```

## Override a player folder path

```bash
export BIBA_ASSETS_DIR="/absolute/path/to/Biba JPG"
```

(Other players: edit `scripts/players.config.mjs` or add env support later.)

## CDN

CDN upload is separate. After local playback works, use:

```bash
npm run generate-manifest:cdn
npm run upload-r2
```
