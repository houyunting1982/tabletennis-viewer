import path from "node:path";
import fs from "node:fs";
import type { ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = path.resolve(__dirname);
const assetsRoot = path.join(projectRoot, "assets");

function createLocalAssetMiddleware(
  urlPrefix: string,
  diskRoot: string,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    const requestUrl = req.url?.split("?")[0] ?? "";
    if (!requestUrl.startsWith(urlPrefix)) {
      next();
      return;
    }

    const relativePath = decodeURIComponent(requestUrl.slice(urlPrefix.length));
    const resolvedPath = path.normalize(path.join(diskRoot, relativePath));

    if (!resolvedPath.startsWith(diskRoot)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      next();
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".json"
          ? "application/json"
          : "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(resolvedPath).pipe(res);
  };
}

function sendJson(res: ServerResponse, payload: unknown) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function localDevServerPlugin(): Plugin {
  const catalogPath = path.join(__dirname, "public/catalog.json");

  return {
    name: "local-dev-server",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = req.url?.split("?")[0] ?? "";

        if (req.method === "GET" && requestUrl === "/api/catalog") {
          if (!fs.existsSync(catalogPath)) {
            res.statusCode = 404;
            sendJson(res, { error: "catalog.json not found" });
            return;
          }

          const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
          sendJson(res, catalog);
          return;
        }

        next();
      });

      server.middlewares.use(
        createLocalAssetMiddleware("/local-assets/", assetsRoot),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), localDevServerPlugin()],
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
});
