# Local assets (not in Git)

Place large frame-sequence folders here. Scripts read `assets/Biba JPG/` by default.

## Biba (current)

Copy or move from the old repo:

```bash
cp -R "/Users/houyunting/GitProjects/TableTennis4dView/Biba JPG" "assets/Biba JPG"
```

Or symlink to avoid duplicating disk space:

```bash
ln -s "/Users/houyunting/GitProjects/TableTennis4dView/Biba JPG" "assets/Biba JPG"
```

## Other players (future)

Add more top-level folders under `assets/` as needed, for example:

```
assets/
├── Biba JPG/
├── Player2 JPG/
└── Player3 JPG/
```

Override the Biba path without moving files:

```bash
export BIBA_ASSETS_DIR="/absolute/path/to/Biba JPG"
```
