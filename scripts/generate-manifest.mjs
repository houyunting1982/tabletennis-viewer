import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const bibaRoot = path.join(repoRoot, "Biba JPG");
const publicDir = path.join(__dirname, "../public");
const publicManifestsDir = path.join(publicDir, "manifests");
const cdnStagingDir = path.join(__dirname, "../cdn-staging");

const DEFAULT_FPS = 59;
const PLAYER_ID = "biba";

function parseArgs(argv) {
  const cdnMode = argv.includes("--cdn");
  const configPath = path.join(__dirname, "../cdn.config.json");
  let cdnBaseUrl = process.env.CDN_BASE_URL ?? null;

  if (!cdnBaseUrl && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    cdnBaseUrl = config.cdnBaseUrl ?? null;
  }

  if (cdnMode && !cdnBaseUrl) {
    throw new Error(
      "CDN mode requires cdnBaseUrl in cdn.config.json or CDN_BASE_URL env var",
    );
  }

  return {
    cdnMode,
    cdnBaseUrl: cdnBaseUrl?.replace(/\/+$/, "") ?? null,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFolderName(folderName) {
  const withoutExt = folderName.replace(/\s+JPG$/i, "").trim();
  const match = withoutExt.match(/^(\d+[a-zA-Z]?)\.?\s+Biba\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const [, number, title] = match;
  return {
    id: `${number.toLowerCase()}-${slugify(title)}`,
    title,
    playerId: PLAYER_ID,
    sourceFolder: folderName,
    sortKey: number.toLowerCase(),
    fps: DEFAULT_FPS,
  };
}

function techniqueBasePath(technique) {
  return `players/${technique.playerId}/techniques/${technique.id}`;
}

function discoverTechniques() {
  if (!fs.existsSync(bibaRoot)) {
    throw new Error(`Biba assets folder not found: ${bibaRoot}`);
  }

  const folders = fs
    .readdirSync(bibaRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const techniques = [];
  const skipped = [];

  for (const folderName of folders) {
    const technique = parseFolderName(folderName);
    if (!technique) {
      skipped.push(folderName);
      continue;
    }
    techniques.push(technique);
  }

  return { techniques, skipped };
}

function parseCameraKey(filename) {
  const match = filename.match(/^(.*C\d+)_/i);
  if (!match) {
    throw new Error(`Unable to parse camera key from filename: ${filename}`);
  }
  return match[1];
}

function cameraKeyToSlug(cameraKey) {
  const match = cameraKey.match(/C(\d+)$/i);
  if (!match) {
    throw new Error(`Unable to parse camera number from key: ${cameraKey}`);
  }
  return `c${match[1].padStart(2, "0").toLowerCase()}`;
}

function buildUrls(technique, mode) {
  if (mode.cdnMode) {
    const techniquePath = techniqueBasePath(technique);
    return {
      baseUrl: `${mode.cdnBaseUrl}/${techniquePath}`,
      manifestUrl: `${mode.cdnBaseUrl}/${techniquePath}/manifest.json`,
      manifestRelativePath: `${techniquePath}/manifest.json`,
    };
  }

  return {
    baseUrl: `/local-assets/${encodeURIComponent(technique.sourceFolder)}`,
    manifestUrl: `/manifests/${technique.id}.json`,
    manifestRelativePath: `manifests/${technique.id}.json`,
  };
}

function generateManifest(technique, mode) {
  const sourceDir = path.join(bibaRoot, technique.sourceFolder);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source folder not found: ${sourceDir}`);
  }

  const filenames = fs
    .readdirSync(sourceDir)
    .filter((name) => name.toLowerCase().endsWith(".jpg"))
    .sort();

  if (filenames.length === 0) {
    throw new Error(`No JPG files found in ${sourceDir}`);
  }

  const grouped = new Map();
  for (const filename of filenames) {
    const cameraSourceKey = parseCameraKey(filename);
    const cameraKey = cameraKeyToSlug(cameraSourceKey);
    if (!grouped.has(cameraKey)) {
      grouped.set(cameraKey, []);
    }
    grouped.get(cameraKey).push(filename);
  }

  const cameraKeys = [...grouped.keys()].sort();
  const counts = cameraKeys.map((cameraKey) => grouped.get(cameraKey).length);
  const frameCount = Math.min(...counts);
  const warnings = [];

  for (const cameraKey of cameraKeys) {
    const filenamesForCamera = grouped.get(cameraKey);
    const count = filenamesForCamera.length;
    if (count !== frameCount) {
      warnings.push(
        `Camera ${cameraKey} has ${count} frames; trimmed to ${frameCount} to match shortest track`,
      );
      grouped.set(cameraKey, filenamesForCamera.slice(0, frameCount));
    }
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`  ! ${technique.sourceFolder}: ${warning}`);
    }
  }

  const urls = buildUrls(technique, mode);

  return {
    id: technique.id,
    title: technique.title,
    playerId: technique.playerId,
    frameCount,
    cameras: cameraKeys.map((cameraKey, index) => ({
      index,
      key: cameraKey,
      name: `Camera ${index + 1}`,
    })),
    baseUrl: urls.baseUrl,
    frames: Object.fromEntries(cameraKeys.map((key) => [key, grouped.get(key)])),
    timing: {
      fps: technique.fps,
    },
    source: {
      folder: technique.sourceFolder,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function generateCatalog(manifestFiles) {
  const players = new Map();

  for (const { technique, manifestUrl } of manifestFiles) {
    if (!players.has(technique.playerId)) {
      players.set(technique.playerId, {
        id: technique.playerId,
        name: "Biba",
        techniques: [],
      });
    }

    players.get(technique.playerId).techniques.push({
      id: technique.id,
      title: technique.title,
      manifestUrl,
    });
  }

  for (const player of players.values()) {
    player.techniques.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  }

  return { players: [...players.values()] };
}

function writeManifestOutputs(manifest, technique, mode) {
  const urls = buildUrls(technique, mode);

  if (mode.cdnMode) {
    const techniqueDir = path.join(cdnStagingDir, techniqueBasePath(technique));
    fs.mkdirSync(techniqueDir, { recursive: true });
    fs.writeFileSync(
      path.join(techniqueDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return {
      technique,
      manifestUrl: urls.manifestUrl,
      manifestRelativePath: urls.manifestRelativePath,
    };
  }

  fs.mkdirSync(publicManifestsDir, { recursive: true });
  fs.writeFileSync(
    path.join(publicManifestsDir, `${technique.id}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return {
    technique,
    manifestUrl: urls.manifestUrl,
    manifestRelativePath: urls.manifestRelativePath,
  };
}

function main() {
  const mode = parseArgs(process.argv.slice(2));
  const { techniques, skipped } = discoverTechniques();
  const manifestFiles = [];
  const failures = [];

  if (mode.cdnMode) {
    fs.rmSync(cdnStagingDir, { recursive: true, force: true });
    fs.mkdirSync(cdnStagingDir, { recursive: true });
  }

  for (const technique of techniques) {
    try {
      const manifest = generateManifest(technique, mode);
      const manifestFile = writeManifestOutputs(manifest, technique, mode);
      manifestFiles.push(manifestFile);
      console.log(
        `✓ ${technique.id} (${manifest.frameCount} frames, ${manifest.cameras.length} cameras)`,
      );
    } catch (error) {
      failures.push({
        folder: technique.sourceFolder,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`✗ ${technique.sourceFolder}: ${failures.at(-1).error}`);
    }
  }

  const catalog = generateCatalog(manifestFiles);
  const catalogPath = mode.cdnMode
    ? path.join(cdnStagingDir, "catalog.json")
    : path.join(publicDir, "catalog.json");
  const playerCatalogPath = mode.cdnMode
    ? path.join(cdnStagingDir, "players", PLAYER_ID, "catalog.json")
    : null;

  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  if (playerCatalogPath) {
    fs.mkdirSync(path.dirname(playerCatalogPath), { recursive: true });
    fs.writeFileSync(
      playerCatalogPath,
      `${JSON.stringify(catalog.players[0], null, 2)}\n`,
    );
  }

  console.log("");
  if (mode.cdnMode) {
    console.log(`Generated ${manifestFiles.length} CDN manifest(s)`);
    console.log(`CDN base: ${mode.cdnBaseUrl}`);
    console.log(`Staging dir: ${cdnStagingDir}`);
    console.log(`Catalog: ${catalogPath}`);
    console.log("Next: npm run upload-r2");
  } else {
    console.log(`Generated ${manifestFiles.length} local manifest(s) and catalog.json`);
  }

  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} non-Biba folder(s):`);
    for (const folder of skipped) {
      console.log(`  - ${folder}`);
    }
  }

  if (failures.length > 0) {
    console.log(`Failed ${failures.length} technique(s).`);
    process.exitCode = 1;
  }
}

main();
