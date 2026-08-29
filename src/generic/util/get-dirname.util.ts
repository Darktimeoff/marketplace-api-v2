import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function getDirname() {
  return dirname(fileURLToPath(import.meta.url));
}