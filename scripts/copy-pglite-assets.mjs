#!/usr/bin/env node
/**
 * The production bundle rewrites PGLite to `_libs/electric-sql__pglite.mjs`
 * and then loads `./pglite.data`, `./pglite.wasm`, and `./initdb.wasm` from
 * beside that file. Rollup does not emit those binaries, so `vite preview`
 * (and any boot without DATABASE_URL) dies looking for them.
 */
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const sourceDir = join(root, "node_modules/@electric-sql/pglite/dist");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];
const output = join(root, ".vercel/output");

function walk(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (name === "electric-sql__pglite.mjs") found.push(path);
  }
  return found;
}

const bundles = walk(output);
if (bundles.length === 0) {
  console.log("[pglite] no bundled electric-sql__pglite.mjs — skipping");
  process.exit(0);
}

for (const bundle of bundles) {
  const destDir = join(bundle, "..");
  for (const file of files) {
    const from = join(sourceDir, file);
    if (!existsSync(from)) {
      console.error(`[pglite] missing ${from}`);
      process.exit(1);
    }
    copyFileSync(from, join(destDir, file));
  }
  console.log(`[pglite] copied data + wasm next to ${bundle}`);
}
