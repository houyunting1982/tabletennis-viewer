# 使用指南

本文说明如何在 **本地开发** 和 **Cloudflare R2 / CDN** 两种模式下使用 `newVersion` 播放器。

---

## 前置条件

- Node.js 18+
- 项目根目录下有 `Biba JPG/` 文件夹（原始图片）
- 已在 `newVersion/` 里执行过 `npm install`

---

## 一、本地开发（推荐先做）

本地模式不需要 Cloudflare，图片直接从磁盘读取。

### 1. 生成 manifest 和 catalog

```bash
cd newVersion
npm run generate-manifest
```

会生成：

```
public/
├── catalog.json                         # 技术目录（67 个 Biba 技术）
└── manifests/
    ├── 01-fh-loop-off-block.json
    ├── 02-fh-counter-loop.json
    └── ...
```

每个 manifest 里的 `baseUrl` 指向本地路径，例如：

```json
"baseUrl": "/local-assets/01%20Biba%20FH%20Loop%20Off%20Block%20JPG"
```

### 2. 启动开发服务器

```bash
npm run dev
```

浏览器打开 `http://localhost:5173`

### 3. 使用播放器

1. 首页看到 **Biba · 67 techniques**
2. 可用搜索框过滤（例如输入 `Turn`、`Serve`）
3. 点击某个技术进入播放器
4. 等待缓冲完成（例如 `62/62 frames`）
5. 使用控制栏或键盘操作：

| 操作 | 键盘 |
|------|------|
| 上一机位 / 下一机位 | ← / → |
| 上一帧 / 下一帧 | ↓ / ↑ |
| 播放 / 暂停 | 空格 |
| 100% / 50% / 25% / 10% 速度 | 1 / 2 / 3 / 4 |

### 4. 本地数据流

```
浏览器
  → GET /catalog.json
  → 选技术，GET /manifests/01-fh-loop-off-block.json
  → 按 manifest 拉 JPG：/local-assets/01%20Biba%20.../xxx.jpg
  → 预载当前机位全部帧 → 播放
```

图片 **不经过 API**，Vite dev server 直接读 `../Biba JPG/`。

---

## 二、Cloudflare R2 / CDN（上线用）

适合：想把站点部署到网上，让别人也能访问。

### 架构

```
catalog.json          →  CDN 根目录
manifest.json × 67    →  CDN /players/biba/techniques/<id>/
JPG 帧图              →  与 manifest 同目录
前端 React            →  Cloudflare Pages（或其他静态托管）
```

### Step 1：Cloudflare 控制台配置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **R2** → Create bucket（例如 `tabletennis-assets`）
3. Bucket → **Settings** → **Custom Domains** → 绑定子域名  
   例如：`https://cdn.your-domain.com`
4. **R2** → **Manage R2 API Tokens** → Create API Token  
   权限：对该 bucket 的 Read & Write
5. 记下：
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Bucket 名称

### Step 2：填写本地配置

```bash
cd newVersion
cp cdn.config.example.json cdn.config.json
```

编辑 `cdn.config.json`（此文件已在 `.gitignore`，不会提交）：

```json
{
  "cdnBaseUrl": "https://cdn.your-domain.com",
  "r2": {
    "accountId": "你的 Cloudflare Account ID",
    "bucket": "tabletennis-assets",
    "accessKeyId": "你的 R2 Access Key",
    "secretAccessKey": "你的 R2 Secret Key"
  }
}
```

> `cdnBaseUrl` 必须和 R2 自定义域名一致，**不要**末尾加 `/`。

### Step 3：生成 CDN 版 manifest

```bash
npm run generate-manifest:cdn
```

输出到 `cdn-staging/`：

```
cdn-staging/
├── catalog.json
├── players/biba/catalog.json
└── players/biba/techniques/
    ├── 01-fh-loop-off-block/
    │   └── manifest.json
    ├── 02-fh-counter-loop/
    │   └── manifest.json
    └── ...（共 67 个）
```

此时 manifest 里的 URL 已是 CDN 地址：

```json
{
  "id": "01-fh-loop-off-block",
  "title": "FH Loop Off Block",
  "baseUrl": "https://cdn.your-domain.com/players/biba/techniques/01-fh-loop-off-block",
  "source": {
    "folder": "01 Biba FH Loop Off Block JPG"
  }
}
```

### Step 4：上传到 R2

**先 dry-run（不实际上传）：**

```bash
npm run upload-r2:dry-run
```

**先试 1 个技术：**

```bash
node scripts/upload-to-r2.mjs 01-fh-loop-off-block
```

上传后在浏览器验证这两个 URL 能打开：

```
https://cdn.your-domain.com/players/biba/techniques/01-fh-loop-off-block/manifest.json
https://cdn.your-domain.com/players/biba/techniques/01-fh-loop-off-block/01BibaFHLoopOffBlockC01_00216000.jpg
```

**确认无误后，上传全部 67 个技术 + catalog：**

```bash
npm run upload-r2
```

> 全量约 3.8GB，首次上传需要一些时间。

R2 上最终结构：

```
tabletennis-assets/
├── catalog.json
└── players/biba/techniques/
    └── 01-fh-loop-off-block/
        ├── manifest.json
        ├── 01BibaFHLoopOffBlockC01_00216000.jpg
        └── ...
```

### Step 5：前端指向 CDN

创建 `.env.production`：

```bash
VITE_CATALOG_URL=https://cdn.your-domain.com/catalog.json
```

构建：

```bash
npm run build
```

`dist/` 即为可部署的前端静态文件。

### Step 6：部署前端（Cloudflare Pages 示例）

1. Dashboard → **Workers & Pages** → **Create** → **Pages**
2. 连接 GitHub 仓库，或手动上传 `dist/`
3. Build settings：
   - Root directory: `newVersion`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Environment variables：`VITE_CATALOG_URL=https://cdn.your-domain.com/catalog.json`
5. 部署完成后访问 Pages 域名

### CDN 模式数据流

```
浏览器
  → GET https://cdn.xxx.com/catalog.json
  → 选技术，GET manifestUrl（也在 CDN 上）
  → 按 manifest.baseUrl 拉每一帧 JPG（CDN，不进 API）
  → 预载机位 → 播放
```

---

## 三、命令速查

| 命令 | 何时用 |
|------|--------|
| `npm run generate-manifest` | 本地开发前 / 新增 Biba 文件夹后 |
| `npm run dev` | 本地启动播放器 |
| `npm run generate-manifest:cdn` | 准备上传 R2 前 |
| `npm run upload-r2:dry-run` | 检查会上传哪些文件 |
| `node scripts/upload-to-r2.mjs <id>` | 只上传某一个技术（试点） |
| `npm run upload-r2` | 上传全部技术 + catalog |
| `npm run build` | 构建生产版前端 |

---

## 四、两种模式对比

| | 本地 dev | CDN 生产 |
|--|----------|----------|
| Catalog | `/catalog.json` | `https://cdn.xxx.com/catalog.json` |
| Manifest | `/manifests/<id>.json` | `https://cdn.xxx.com/players/biba/techniques/<id>/manifest.json` |
| 图片 | `/local-assets/...` | `https://cdn.xxx.com/players/biba/techniques/<id>/*.jpg` |
| 生成命令 | `generate-manifest` | `generate-manifest:cdn` |
| 需要 R2 | 否 | 是 |

本地开发和 CDN **共用同一套播放器代码**，只是 catalog / manifest / 图片 URL 不同。

---

## 五、常见问题

### Q: 改了 `Biba JPG/` 里的内容怎么办？

重新生成 manifest，再上传：

```bash
npm run generate-manifest          # 本地
npm run generate-manifest:cdn      # CDN
npm run upload-r2                  # 若已上 CDN
```

### Q: 本地 dev 和 CDN 会互相影响吗？

不会。  
- 本地：`npm run generate-manifest` → 写 `public/`  
- CDN：`npm run generate-manifest:cdn` → 写 `cdn-staging/`

### Q: `cdn.config.json` 要提交 Git 吗？

**不要。** 含 Secret Key，已在 `.gitignore`。

### Q: 上传失败 / 403？

检查 R2 API Token 权限、Account ID、Bucket 名称是否正确。

### Q: 浏览器能打开 JPG，但播放器报错？

1. 检查 manifest 里的 `baseUrl` 是否和 CDN 域名一致  
2. 检查 R2 自定义域名是否已生效（DNS 有时需几分钟）  
3. 打开 DevTools → Network，看哪条请求失败

### Q: 为什么每个技术要单独一个 manifest？

每个技术帧数、文件名不同（62～183 帧不等），无法用一个文件描述全部。  
`catalog.json` 负责目录，`manifest.json` 负责单个技术的帧列表。

---

## 六、推荐操作顺序（第一次）

```
1. npm run generate-manifest && npm run dev     ← 本地确认播放器 OK
2. Cloudflare 建 R2 bucket + 绑域名 + API Token
3. cp cdn.config.example.json cdn.config.json   ← 填凭证
4. npm run generate-manifest:cdn
5. node scripts/upload-to-r2.mjs 01-fh-loop-off-block   ← 先试 1 个
6. 浏览器验证 CDN 上 manifest + JPG 能打开
7. npm run upload-r2                            ← 全量上传
8. 设 VITE_CATALOG_URL，npm run build，部署 Pages
```

---

## 七、文件说明

| 文件 / 目录 | 作用 |
|-------------|------|
| `Biba JPG/` | 原始图片（不上传 Git，本地/R2 源） |
| `public/catalog.json` | 本地技术目录 |
| `public/manifests/*.json` | 本地 manifest |
| `cdn-staging/` | CDN 上传前的 manifest  staging |
| `cdn.config.json` | R2 凭证（本地，不提交） |
| `scripts/generate-manifest.mjs` | 扫描 Biba 文件夹，生成 manifest |
| `scripts/upload-to-r2.mjs` | 上传 manifest + JPG 到 R2 |
| `src/lib/playback/` | 播放引擎（预载、缓存、播放） |
