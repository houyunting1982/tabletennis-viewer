import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const PLAYERS = [
  {
    id: "biba",
    name: "Biba",
    assetsDir: "Biba JPG",
    folderPattern: /^(\d+[a-zA-Z]?)\.?\s+Biba\s+(.+)$/i,
  },
  {
    id: "felipe",
    name: "Felipe",
    assetsDir: "Felipe JPG",
    folderPattern: /^(\d+[a-zA-Z]?)\.?\s+Felipe\s+(.+)$/i,
  },
  {
    id: "lupi",
    name: "Lupi",
    assetsDir: "Lupi JPG",
    folderPattern: /^(\d+[a-zA-Z]?)\.?\s+Lupi\s+(.+)$/i,
  },
];

export function playerAssetsRoot(player) {
  return path.join(projectRoot, "assets", player.assetsDir);
}

export function playerAssetsPath(player, sourceFolder) {
  return `${player.assetsDir}/${sourceFolder}`;
}
