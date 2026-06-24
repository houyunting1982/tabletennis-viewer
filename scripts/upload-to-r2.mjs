import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { playerAssetsRoot } from "./players.config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const cdnStagingDir = path.join(__dirname, "../cdn-staging");
const configPath = path.join(__dirname, "../cdn.config.json");

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "Missing cdn.config.json. Copy cdn.config.example.json and fill in your R2 settings.",
    );
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const { cdnBaseUrl, r2 } = config;

  if (!cdnBaseUrl || !r2?.accountId || !r2?.bucket || !r2?.accessKeyId || !r2?.secretAccessKey) {
    throw new Error("cdn.config.json is missing required fields");
  }

  return config;
}

function parseArgs(argv) {
  const catalogOnly = argv.includes("--catalog-only");
  const techniqueId =
    argv.find((arg) => !arg.startsWith("--")) ?? null;
  const dryRun = argv.includes("--dry-run");

  if (catalogOnly && techniqueId) {
    throw new Error("Use either --catalog-only or a technique id, not both.");
  }

  return { techniqueId, catalogOnly, dryRun };
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".json") {
    return "application/json";
  }
  return "application/octet-stream";
}

async function uploadFile(client, bucket, key, filePath, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] put ${key}`);
    return;
  }

  const body = fs.readFileSync(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(filePath),
      CacheControl:
        key.endsWith(".json")
          ? "public, max-age=300"
          : "public, max-age=31536000, immutable",
    }),
  );
  console.log(`↑ ${key}`);
}

function discoverTechniqueDirs(techniqueId) {
  const playersRoot = path.join(cdnStagingDir, "players");
  if (!fs.existsSync(playersRoot)) {
    throw new Error("cdn-staging is empty. Run: npm run generate-manifest:cdn");
  }

  const dirs = [];
  for (const playerEntry of fs.readdirSync(playersRoot, { withFileTypes: true })) {
    if (!playerEntry.isDirectory()) {
      continue;
    }

    const techniquesRoot = path.join(playersRoot, playerEntry.name, "techniques");
    if (!fs.existsSync(techniquesRoot)) {
      continue;
    }

    for (const techniqueEntry of fs.readdirSync(techniquesRoot, { withFileTypes: true })) {
      if (!techniqueEntry.isDirectory()) {
        continue;
      }
      if (techniqueId && techniqueEntry.name !== techniqueId) {
        continue;
      }
      dirs.push(path.join(techniquesRoot, techniqueEntry.name));
    }
  }

  if (techniqueId && dirs.length === 0) {
    throw new Error(`Technique not found in cdn-staging: ${techniqueId}`);
  }

  return dirs;
}

function sourceDirForManifest(manifest) {
  const assetsDir = manifest.source?.playerAssetsDir ?? "Biba JPG";
  return path.join(playerAssetsRoot({ assetsDir }), manifest.source.folder);
}

function r2PrefixForTechniqueDir(techniqueDir) {
  return path.relative(cdnStagingDir, techniqueDir).split(path.sep).join("/");
}

function discoverCatalogKeys() {
  const keys = ["catalog.json"];
  const playersRoot = path.join(cdnStagingDir, "players");
  if (!fs.existsSync(playersRoot)) {
    return keys;
  }

  for (const playerEntry of fs.readdirSync(playersRoot, { withFileTypes: true })) {
    if (playerEntry.isDirectory()) {
      keys.push(`players/${playerEntry.name}/catalog.json`);
    }
  }

  return keys;
}

async function main() {
  const { techniqueId, catalogOnly, dryRun } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });

  if (catalogOnly) {
    console.log(
      `${dryRun ? "Dry run" : "Uploading"} catalog only to ${config.r2.bucket}`,
    );

    for (const catalogKey of discoverCatalogKeys()) {
      const localCatalogPath = path.join(cdnStagingDir, catalogKey);
      if (!fs.existsSync(localCatalogPath)) {
        throw new Error(
          `Missing ${catalogKey}. Run: npm run generate-catalog:cdn`,
        );
      }

      await uploadFile(
        client,
        config.r2.bucket,
        catalogKey,
        localCatalogPath,
        dryRun,
      );
    }

    console.log("");
    console.log(dryRun ? "Dry run complete." : "Catalog upload complete.");
    console.log(`CDN catalog: ${config.cdnBaseUrl}/catalog.json`);
    return;
  }

  const techniqueDirs = discoverTechniqueDirs(techniqueId);
  console.log(
    `${dryRun ? "Dry run" : "Uploading"} ${techniqueDirs.length} technique(s) to ${config.r2.bucket}`,
  );

  for (const techniqueDir of techniqueDirs) {
    const techniqueIdFromPath = path.basename(techniqueDir);
    const manifestPath = path.join(techniqueDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const sourceDir = sourceDirForManifest(manifest);

    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Source folder not found: ${sourceDir}`);
    }

    const r2Prefix = r2PrefixForTechniqueDir(techniqueDir);
    await uploadFile(
      client,
      config.r2.bucket,
      `${r2Prefix}/manifest.json`,
      manifestPath,
      dryRun,
    );

    const filenames = new Set(
      Object.values(manifest.frames).flatMap((entries) => entries),
    );

    for (const filename of filenames) {
      const localPath = path.join(sourceDir, filename);
      if (!fs.existsSync(localPath)) {
        throw new Error(`Missing frame file: ${localPath}`);
      }
      await uploadFile(
        client,
        config.r2.bucket,
        `${r2Prefix}/${filename}`,
        localPath,
        dryRun,
      );
    }
  }

  if (!techniqueId) {
    for (const catalogKey of discoverCatalogKeys()) {
      const localCatalogPath = path.join(cdnStagingDir, catalogKey);
      if (fs.existsSync(localCatalogPath)) {
        await uploadFile(
          client,
          config.r2.bucket,
          catalogKey,
          localCatalogPath,
          dryRun,
        );
      }
    }
  }

  console.log("");
  console.log(dryRun ? "Dry run complete." : "Upload complete.");
  console.log(`CDN catalog: ${config.cdnBaseUrl}/catalog.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
