# Usage Guide · 使用指南

Detailed walkthrough for **local development** and **Cloudflare R2 / CDN production**.

本地开发与 **Cloudflare R2 / CDN 上线** 的详细说明。

> Shorter reference: [README.md](./README.md)

---

## Prerequisites · 前置条件

**EN**

- Node.js 18+
- `npm install` at project root
- JPG folders under `assets/` (see [assets/README.md](./assets/README.md)) — not committed to Git

**中文**

- Node.js 18+
- 在项目根目录执行 `npm install`
- `assets/` 下放置 JPG 文件夹（见 [assets/README.md](./assets/README.md)）— 不提交 Git

Configured players · 已配置球员：`Biba` · `Felipe` · `Lupi`（见 `scripts/players.config.mjs`）

---

## URL routes · 路由

| Path | EN | 中文 |
|------|----|------|
| `/` | Player picker | 球员选择页 |
| `/players/biba` | Biba catalog | Biba 技术目录 |
| `/players/felipe` | Felipe catalog | Felipe 技术目录 |
| `/players/lupi` | Lupi catalog | Lupi 技术目录 |
| `/players/{id}/{techniqueId}` | Player view | 播放器 |

Example · 示例：`/players/biba/02-fh-counter-loop`

---

## Part 1 · Local development · 本地开发

**EN:** No Cloudflare required. Images are read from disk via Vite middleware.

**中文：** 不需要 Cloudflare。图片由 Vite 中间件直接从磁盘读取。

### 1.1 Generate manifest & catalog · 生成 manifest 与 catalog

```bash
npm run generate-manifest
```

One player only · 只生成某一球员：

```bash
node scripts/generate-manifest.mjs --player=felipe
```

**Output · 输出：**

```
public/
├── catalog.json
└── manifests/
    ├── biba/
    │   ├── 01-fh-loop-off-block.json
    │   └── ...
    ├── felipe/
    └── lupi/
```

Local `baseUrl` example · 本地 `baseUrl` 示例：

```json
"baseUrl": "/local-assets/Biba%20JPG/01%20Biba%20FH%20Loop%20Off%20Block%20JPG"
```

### 1.2 Start dev server · 启动开发服务器

```bash
npm run dev
```

Open · 打开：`http://localhost:5173`

### 1.3 Using the app · 使用播放器

**EN**

1. Home → pick **Biba**, **Felipe**, or **Lupi**
2. Browse / search techniques on the player catalog page
3. Open a technique → wait until Camera 1 is ready
4. Play, scrub timeline, switch cameras when loaded

**中文**

1. 首页 → 选择 **Biba**、**Felipe** 或 **Lupi**
2. 在球员目录页浏览 / 搜索技术
3. 进入某技术 → 等待 Camera 1 缓冲完成
4. 播放、拖动时间轴、机位加载完成后切换

| Action · 操作 | Keys · 键盘 |
|---------------|-------------|
| Prev / next camera · 上 / 下一机位 | ← / → |
| Prev / next frame · 上 / 下一帧 | ↓ / ↑ |
| Play / pause · 播放 / 暂停 | Space |
| 1× / ½× / ¼× / ⅒× speed · 速度 | 1 / 2 / 3 / 4 |

### 1.4 Local data flow · 本地数据流

```
Browser · 浏览器
  → GET /catalog.json
  → GET /manifests/biba/02-fh-counter-loop.json
  → JPG: /local-assets/Biba JPG/…/xxx.jpg
  → Preload Camera 1 → play · 预载 Camera 1 → 播放
```

**EN:** Vite serves `/local-assets/` from the `assets/` directory.

**中文：** Vite 将 `/local-assets/` 映射到 `assets/` 目录。

---

## Part 2 · Cloudflare R2 / CDN · CDN 上线

**EN:** For public hosting — catalog, manifests, and JPGs on R2; UI on Cloudflare Pages.

**中文：** 对外发布 — catalog、manifest、JPG 放 R2；前端放 Cloudflare Pages。

### Architecture · 架构

```
catalog.json              →  CDN root · CDN 根目录
manifest.json × N         →  CDN /players/{id}/techniques/{techniqueId}/
JPG frames · JPG 帧图      →  same folder as manifest · 与 manifest 同目录
React frontend · 前端      →  Cloudflare Pages (GitHub Actions deploy)
```

### Step 1 · Cloudflare console · 控制台配置

**EN**

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2** → Create bucket (e.g. `tabletennis-assets`)
2. Bucket → **Settings** → **Custom Domains** → e.g. `https://cdn.your-domain.com`
3. **R2** → **Manage R2 API Tokens** → Read & Write on bucket
4. Save Account ID, Access Key ID, Secret Access Key, bucket name

**中文**

1. [Cloudflare 控制台](https://dash.cloudflare.com/) → **R2** → 创建 bucket（如 `tabletennis-assets`）
2. Bucket → **Settings** → **Custom Domains** → 绑定子域名，如 `https://cdn.your-domain.com`
3. **R2** → **Manage R2 API Tokens** → 对该 bucket **Read & Write**
4. 记下 Account ID、Access Key ID、Secret Access Key、bucket 名称

### Step 2 · Local config · 本地配置

```bash
cp cdn.config.example.json cdn.config.json
```

```json
{
  "cdnBaseUrl": "https://cdn.your-domain.com",
  "r2": {
    "accountId": "your Cloudflare Account ID",
    "bucket": "tabletennis-assets",
    "accessKeyId": "your R2 Access Key",
    "secretAccessKey": "your R2 Secret Key"
  }
}
```

**EN:** `cdnBaseUrl` must match the R2 custom domain — **no trailing slash**.

**中文：** `cdnBaseUrl` 必须与 R2 自定义域名一致，**末尾不要加 `/`**。

**EN:** Do **not** commit `cdn.config.json` (gitignored).

**中文：** **不要**提交 `cdn.config.json`（已在 `.gitignore`）。

### Step 3 · Generate CDN manifests · 生成 CDN 版 manifest

```bash
npm run generate-manifest:cdn
```

```
cdn-staging/
├── catalog.json
├── players/biba/catalog.json
├── players/felipe/catalog.json
├── players/lupi/catalog.json
└── players/{playerId}/techniques/{techniqueId}/manifest.json
```

CDN manifest example · CDN manifest 示例：

```json
{
  "baseUrl": "https://cdn.your-domain.com/players/biba/techniques/01-fh-loop-off-block",
  "source": {
    "folder": "01 Biba FH Loop Off Block JPG",
    "playerAssetsDir": "Biba JPG"
  }
}
```

### Step 4 · Upload to R2 · 上传到 R2

```bash
npm run upload-r2:dry-run                              # preview · 预览
node scripts/upload-to-r2.mjs 01-fh-loop-off-block     # one technique · 单个试点
npm run upload-r2                                      # full upload · 全量
npm run upload-r2:catalog                              # catalog JSON only · 仅 catalog
```

**EN:** Verify in browser:

**中文：** 浏览器验证：

```
https://cdn.your-domain.com/catalog.json
https://cdn.your-domain.com/players/biba/techniques/01-fh-loop-off-block/manifest.json
https://cdn.your-domain.com/players/biba/techniques/01-fh-loop-off-block/01BibaFHLoopOffBlockC01_00216000.jpg
```

**EN:** Full upload is large (multi‑GB per player) — first run takes time.

**中文：** 全量体积很大（每位球员数 GB 级），首次上传需较长时间。

### Step 5 · R2 CORS · CORS 配置

**EN:** `fetch()` for catalog/manifest requires CORS on the bucket. Frame JPGs use `<img>` (no CORS).

**中文：** catalog / manifest 的 `fetch()` 需要 bucket **CORS**。帧图用 `<img>` 加载（不需要 CORS）。

R2 → bucket → **Settings** → **CORS policy**:

```json
[
  {
    "AllowedOrigins": [
      "https://tabletennislab.com",
      "https://www.tabletennislab.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace origins with your site domain · 将 origins 换成你的站点域名。

### Step 6 · Frontend env & build · 前端环境变量与构建

```bash
# .env.production
VITE_CATALOG_URL=https://cdn.your-domain.com/catalog.json
```

```bash
npm run build
```

Output · 输出：`dist/`

### Step 7 · Deploy via GitHub Actions · GitHub Actions 部署

**EN**

- Workflow: `.github/workflows/deploy-pages.yml`
- **Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Optional variable:** `VITE_CATALOG_URL`
- Push to `main` → auto deploy
- **Do not** enable “Connect to Git” on the Cloudflare Pages project (conflicts with this workflow)

**中文**

- 工作流：`.github/workflows/deploy-pages.yml`
- **Secrets：** `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
- **可选变量：** `VITE_CATALOG_URL`
- 推送到 `main` → 自动部署
- **不要**在 Cloudflare Pages 项目里开启 “Connect to Git”（会与 Actions 冲突）

Custom domain · 自定义域名：Pages project → **Custom domains** → `tabletennislab.com`

### CDN data flow · CDN 数据流

```
Browser · 浏览器
  → fetch catalog.json (CDN, needs CORS)
  → fetch manifest.json (CDN, needs CORS)
  → load JPG via img src (CDN, no CORS)
  → preload → play · 预载 → 播放
```

---

## Part 3 · Command reference · 命令速查

| Command | EN | 中文 |
|---------|----|------|
| `npm run generate-manifest` | Before local dev / after asset changes | 本地开发前 / 改 JPG 后 |
| `npm run dev` | Start dev server | 启动开发服务器 |
| `npm run generate-manifest:cdn` | Before R2 upload | 上传 R2 前 |
| `npm run upload-r2:dry-run` | Preview upload list | 预览上传列表 |
| `node scripts/upload-to-r2.mjs <id>` | Upload one technique | 上传单个技术 |
| `npm run upload-r2` | Upload all players + catalog | 全量上传 |
| `npm run build` | Production build | 生产构建 |

---

## Part 4 · Local vs CDN · 两种模式对比

| | Local dev · 本地 | CDN production · 生产 |
|--|------------------|----------------------|
| Catalog | `/catalog.json` | `https://cdn.xxx.com/catalog.json` |
| Manifest | `/manifests/{playerId}/{id}.json` | `https://cdn.xxx.com/players/{playerId}/techniques/{id}/manifest.json` |
| Images · 图片 | `/local-assets/...` | CDN same path · CDN 同路径 |
| Generate · 生成 | `generate-manifest` | `generate-manifest:cdn` |
| R2 required · 需要 R2 | No · 否 | Yes · 是 |

**EN:** Same player code — only URLs differ.

**中文：** 播放器代码相同 — 只是 URL 来源不同。

---

## Part 5 · FAQ · 常见问题

### Changed JPG folders? · 改了 JPG 文件夹？

```bash
npm run generate-manifest          # local · 本地
npm run generate-manifest:cdn      # CDN staging
npm run upload-r2                  # if on CDN · 若已上 CDN
```

### Local and CDN affect each other? · 本地和 CDN 会互相影响吗？

**EN:** No. Local writes `public/`; CDN writes `cdn-staging/`.

**中文：** 不会。本地写 `public/`；CDN 写 `cdn-staging/`。

### Upload 403? · 上传 403？

**EN / 中文：** Check R2 token permissions, Account ID, bucket name · 检查 R2 Token 权限、Account ID、bucket 名称。

### Site shows “Failed to fetch” / “Load failed”? · 站点 Failed to fetch？

**EN**

1. Open `https://cdn…/catalog.json` directly — SSL / DNS issue?
2. R2 CORS for JSON fetches
3. DevTools → Network → failed request

**中文**

1. 直接打开 `https://cdn…/catalog.json` — SSL / DNS 问题？
2. R2 是否配置了 CORS（JSON）
3. DevTools → Network → 看失败请求

### Why one manifest per technique? · 为什么每个技术一个 manifest？

**EN:** Frame counts and filenames differ per technique (e.g. 62–183 frames). `catalog.json` = directory; `manifest.json` = frame list for one technique.

**中文：** 每个技术帧数、文件名不同（约 62–183 帧）。`catalog.json` = 目录；`manifest.json` = 单个技术的帧列表。

### Skipped folders during generate? · generate 时跳过某些文件夹？

**EN:** Folder name must match `folderPattern` in `scripts/players.config.mjs` (e.g. `01 Biba FH Loop Off Block JPG`).

**中文：** 文件夹名须匹配 `scripts/players.config.mjs` 里的 `folderPattern`（如 `01 Biba FH Loop Off Block JPG`）。

### Add a new player? · 新增球员？

**EN:** See [README — Adding a player](./README.md#adding-a-player).

**中文：** 见 [README — Adding a player](./README.md#adding-a-player)。

---

## Part 6 · First-time checklist · 第一次推荐顺序

```
1. npm run generate-manifest && npm run dev     ← verify locally · 本地验证
2. Cloudflare: R2 bucket + custom domain + API token
3. cp cdn.config.example.json cdn.config.json
4. npm run generate-manifest:cdn
5. node scripts/upload-to-r2.mjs 01-fh-loop-off-block
6. Verify CDN URLs in browser · 浏览器验证 CDN URL
7. npm run upload-r2
8. Set VITE_CATALOG_URL → npm run build → push main (GitHub Actions deploy)
```

---

## Part 7 · Files · 文件说明

| Path | EN | 中文 |
|------|----|------|
| `assets/* JPG/` | Source frames (gitignored) | 原始图片（不进 Git） |
| `scripts/players.config.mjs` | Player list & folder patterns | 球员配置与命名规则 |
| `public/catalog.json` | Generated library index | 生成的总目录 |
| `public/manifests/{playerId}/` | Generated per-technique manifests | 各技术 manifest |
| `cdn-staging/` | CDN upload staging | CDN 上传 staging |
| `cdn.config.json` | R2 credentials (local, gitignored) | R2 凭证（本地，不提交） |
| `scripts/generate-manifest.mjs` | Scan assets → manifests | 扫描 assets 生成 manifest |
| `scripts/upload-to-r2.mjs` | Upload to R2 | 上传到 R2 |
| `src/lib/playback/` | Playback engine | 播放引擎 |
| `.github/workflows/deploy-pages.yml` | Pages deploy CI | Pages 部署 CI |
