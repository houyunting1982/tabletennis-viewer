import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAYERS,
  playerAssetsPath,
  playerAssetsRoot,
} from "./players.config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const publicManifestsDir = path.join(publicDir, "manifests");
const cdnStagingDir = path.join(__dirname, "../cdn-staging");

const DEFAULT_FPS = 59;

function parseArgs(argv) {
  const cdnMode = argv.includes("--cdn");
  const catalogOnly = argv.includes("--catalog-only");
  const playerId = argv.find((arg) => arg.startsWith("--player="))?.slice(9) ?? null;
  const techniqueId =
    argv.find((arg) => !arg.startsWith("--")) ?? null;
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

  if (playerId && !PLAYERS.some((player) => player.id === playerId)) {
    throw new Error(`Unknown player: ${playerId}`);
  }

  return {
    cdnMode,
    catalogOnly,
    playerId,
    techniqueId,
    cdnBaseUrl: cdnBaseUrl?.replace(/\/+$/, "") ?? null,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFolderName(folderName, player) {
  const withoutExt = folderName.replace(/\s+JPG$/i, "").trim();
  const match = withoutExt.match(player.folderPattern);

  if (!match) {
    return null;
  }

  const [, number, title] = match;
  return {
    id: `${number.toLowerCase()}-${slugify(title)}`,
    title,
    playerId: player.id,
    playerName: player.name,
    assetsDir: player.assetsDir,
    sourceFolder: folderName,
    sortKey: number.toLowerCase(),
    fps: DEFAULT_FPS,
  };
}

function techniqueBasePath(technique) {
  return `players/${technique.playerId}/techniques/${technique.id}`;
}

function selectedPlayers(playerId) {
  if (playerId) {
    return PLAYERS.filter((player) => player.id === playerId);
  }
  return PLAYERS;
}

function discoverTechniques(playerFilter) {
  const techniques = [];
  const skipped = [];

  for (const player of selectedPlayers(playerFilter)) {
    const playerRoot = playerAssetsRoot(player);
    if (!fs.existsSync(playerRoot)) {
      console.warn(`Skipping ${player.name}: assets folder not found (${playerRoot})`);
      continue;
    }

    const folders = fs
      .readdirSync(playerRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const folderName of folders) {
      const technique = parseFolderName(folderName, player);
      if (!technique) {
        skipped.push(`${player.name}/${folderName}`);
        continue;
      }
      techniques.push(technique);
    }
  }

  if (techniques.length === 0) {
    throw new Error("No techniques found. Check assets/ player folders.");
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

  const assetsPath = playerAssetsPath(
    { assetsDir: technique.assetsDir },
    technique.sourceFolder,
  );

  return {
    baseUrl: `/local-assets/${assetsPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`,
    manifestUrl: `/manifests/${technique.playerId}/${technique.id}.json`,
    manifestRelativePath: `manifests/${technique.playerId}/${technique.id}.json`,
  };
}

function generateManifest(technique, mode) {
  const sourceDir = path.join(playerAssetsRoot({ assetsDir: technique.assetsDir }), technique.sourceFolder);
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
      playerAssetsDir: technique.assetsDir,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function categorizeTechnique(technique) {
  const { id, title } = technique;

  if (
    id === "60-ready-position" ||
    id === "61-one-step" ||
    id === "62-turn" ||
    id === "63-recover-from-serve" ||
    id === "64-cross-step"
  ) {
    return "footwork";
  }

  if (id.startsWith("11-")) {
    return "fundamentals";
  }

  if (/serve|tomahawk/i.test(id) || /serve|tomahawk/i.test(title)) {
    return "serve";
  }

  if (
    /^(\d+[a-z]?-)?fh-/i.test(id) ||
    title.startsWith("FH ") ||
    /^(\d+[a-z]?-)?fh/i.test(title)
  ) {
    return "forehand";
  }

  if (
    /^(\d+[a-z]?-)?bh-/i.test(id) ||
    title.startsWith("BH ") ||
    /bh/i.test(id)
  ) {
    return "backhand";
  }

  return "forehand";
}

function buildPreviewUrl(manifest) {
  const firstCameraKey = manifest.cameras[0]?.key;
  const firstFrame = firstCameraKey
    ? manifest.frames[firstCameraKey]?.[0]
    : null;

  if (!firstFrame) {
    return null;
  }

  return `${manifest.baseUrl}/${encodeURIComponent(firstFrame)}`;
}

function generateCatalog(manifestFiles) {
  const players = new Map();

  for (const player of PLAYERS) {
    players.set(player.id, {
      id: player.id,
      name: player.name,
      techniques: [],
    });
  }

  for (const {
    technique,
    manifestUrl,
    previewUrl,
    category,
    frameCount,
    cameraCount,
  } of manifestFiles) {
    const playerEntry = players.get(technique.playerId);
    if (!playerEntry) {
      continue;
    }

    playerEntry.techniques.push({
      id: technique.id,
      title: technique.title,
      manifestUrl,
      previewUrl,
      category,
      frameCount,
      cameraCount,
    });
  }

  const catalogPlayers = [...players.values()].filter(
    (player) => player.techniques.length > 0,
  );

  for (const player of catalogPlayers) {
    player.techniques.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  }

  return { players: catalogPlayers };
}

function listPublicManifestFiles() {
  if (!fs.existsSync(publicManifestsDir)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(publicManifestsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const playerId = entry.name;
      for (const manifestName of fs.readdirSync(path.join(publicManifestsDir, playerId))) {
        if (manifestName.endsWith(".json")) {
          files.push(path.join(playerId, manifestName));
        }
      }
      continue;
    }

    if (entry.name.endsWith(".json")) {
      files.push(entry.name);
    }
  }

  return files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function buildCatalogEntryFromManifest(manifest, cdnBaseUrl) {
  const techniquePath = `players/${manifest.playerId}/techniques/${manifest.id}`;
  const firstCameraKey = manifest.cameras[0]?.key;
  const firstFrame = firstCameraKey
    ? manifest.frames[firstCameraKey]?.[0]
    : null;

  return {
    technique: {
      id: manifest.id,
      title: manifest.title,
      playerId: manifest.playerId,
    },
    manifestUrl: `${cdnBaseUrl}/${techniquePath}/manifest.json`,
    previewUrl: firstFrame
      ? `${cdnBaseUrl}/${techniquePath}/${encodeURIComponent(firstFrame)}`
      : null,
    category: categorizeTechnique({
      id: manifest.id,
      title: manifest.title,
    }),
    frameCount: manifest.frameCount,
    cameraCount: manifest.cameras.length,
  };
}

function generateCatalogFromPublicManifests(cdnBaseUrl) {
  const manifestPaths = listPublicManifestFiles();
  if (manifestPaths.length === 0) {
    throw new Error("public/manifests not found. Run: npm run generate-manifest");
  }

  const manifestFiles = manifestPaths.map((relativePath) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(publicManifestsDir, relativePath), "utf8"),
    );
    return buildCatalogEntryFromManifest(manifest, cdnBaseUrl);
  });

  return generateCatalog(manifestFiles);
}

function writeCatalogFiles(catalog, mode) {
  const catalogPath = mode.cdnMode
    ? path.join(cdnStagingDir, "catalog.json")
    : path.join(publicDir, "catalog.json");

  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  if (mode.cdnMode) {
    for (const player of catalog.players) {
      const playerCatalogPath = path.join(
        cdnStagingDir,
        "players",
        player.id,
        "catalog.json",
      );
      fs.mkdirSync(path.dirname(playerCatalogPath), { recursive: true });
      fs.writeFileSync(playerCatalogPath, `${JSON.stringify(player, null, 2)}\n`);
    }
  }

  return catalogPath;
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

  const playerManifestDir = path.join(publicManifestsDir, technique.playerId);
  fs.mkdirSync(playerManifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(playerManifestDir, `${technique.id}.json`),
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

  if (mode.catalogOnly) {
    if (!mode.cdnMode) {
      throw new Error("--catalog-only requires --cdn");
    }

    fs.mkdirSync(cdnStagingDir, { recursive: true });
    const catalog = generateCatalogFromPublicManifests(mode.cdnBaseUrl);
    const catalogPath = writeCatalogFiles(catalog, mode);

    console.log("Generated CDN catalog only (no JPG staging).");
    console.log(`CDN base: ${mode.cdnBaseUrl}`);
    console.log(`Catalog: ${catalogPath}`);
    console.log(`Players: ${catalog.players.length}`);
    for (const player of catalog.players) {
      console.log(`  - ${player.name}: ${player.techniques.length} techniques`);
    }
    console.log("Next: npm run upload-r2:catalog");
    return;
  }

  const { techniques, skipped } = discoverTechniques(mode.playerId);
  const manifestFiles = [];
  const failures = [];

  const selectedTechniques = mode.techniqueId
    ? techniques.filter((technique) => technique.id === mode.techniqueId)
    : techniques;

  if (mode.techniqueId && selectedTechniques.length === 0) {
    throw new Error(`Technique not found: ${mode.techniqueId}`);
  }

  if (mode.cdnMode && !mode.techniqueId && !mode.playerId) {
    fs.rmSync(cdnStagingDir, { recursive: true, force: true });
    fs.mkdirSync(cdnStagingDir, { recursive: true });
  } else if (mode.cdnMode) {
    fs.mkdirSync(cdnStagingDir, { recursive: true });
  }

  if (!mode.cdnMode && !mode.techniqueId && !mode.playerId) {
    fs.rmSync(publicManifestsDir, { recursive: true, force: true });
  }

  for (const technique of selectedTechniques) {
    try {
      const manifest = generateManifest(technique, mode);
      const manifestFile = writeManifestOutputs(manifest, technique, mode);
      manifestFiles.push({
        ...manifestFile,
        previewUrl: buildPreviewUrl(manifest),
        category: categorizeTechnique(technique),
        frameCount: manifest.frameCount,
        cameraCount: manifest.cameras.length,
      });
      console.log(
        `✓ ${technique.playerId}/${technique.id} (${manifest.frameCount} frames, ${manifest.cameras.length} cameras)`,
      );
    } catch (error) {
      failures.push({
        folder: `${technique.playerId}/${technique.sourceFolder}`,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `✗ ${technique.playerId}/${technique.sourceFolder}: ${failures.at(-1).error}`,
      );
    }
  }

  const catalog = mode.cdnMode
    ? generateCatalogFromPublicManifests(mode.cdnBaseUrl)
    : generateCatalog(manifestFiles);
  const catalogPath = writeCatalogFiles(catalog, mode);

  console.log("");
  if (mode.cdnMode) {
    console.log(`Generated ${manifestFiles.length} CDN manifest(s)`);
    console.log(`CDN base: ${mode.cdnBaseUrl}`);
    console.log(`Staging dir: ${cdnStagingDir}`);
    console.log(`Catalog: ${catalogPath}`);
    if (mode.techniqueId) {
      console.log(`Next: npm run upload-r2 -- ${mode.techniqueId}`);
    } else {
      console.log("Next: npm run upload-r2");
    }
  } else {
    console.log(`Generated ${manifestFiles.length} local manifest(s) and catalog.json`);
    for (const player of catalog.players) {
      console.log(`  - ${player.name}: ${player.techniques.length} techniques`);
    }
  }

  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} unrecognized folder(s):`);
    for (const folder of skipped.slice(0, 10)) {
      console.log(`  - ${folder}`);
    }
    if (skipped.length > 10) {
      console.log(`  ... and ${skipped.length - 10} more`);
    }
  }

  if (failures.length > 0) {
    console.log(`Failed ${failures.length} technique(s).`);
    process.exitCode = 1;
  }
}

main();
