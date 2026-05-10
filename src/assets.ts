// Resolve the path to paperese's bundled assets directory and copy
// the files a renderer needs alongside its output. Templates reference
// assets by basename (`orcid.png`) so the .tex stays portable across
// machines — the matching binaries get planted next to the .tex by
// `copyAssetsTo()` so `pdflatex paper.tex` finds them in CWD.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Walk up from this file looking for an `assets/` directory. Works
 *  in dev (src/assets.ts → ../assets) and after `bun build` (the
 *  bundled dist/paperese.js sits next to assets/ when the published
 *  package layout is preserved). */
function findAssetsDir(): string {
  const candidates = [
    path.resolve(__dirname, '..', 'assets'),         // src → ../assets
    path.resolve(__dirname, '..', '..', 'assets'),   // dist/ → ../../assets
    path.resolve(process.cwd(), 'assets'),           // CWD-relative fallback
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
  }
  return candidates[0]!;
}

const ASSETS_DIR = findAssetsDir();

/** Copy the named asset(s) into `outDir` if not already present.
 *  Idempotent: skips files that already exist with the right size. */
export function copyAssetsTo(outDir: string, names: string[]): void {
  if (!fs.existsSync(ASSETS_DIR)) return;
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of names) {
    const src = path.join(ASSETS_DIR, name);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(outDir, name);
    if (fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size) continue;
    fs.copyFileSync(src, dst);
  }
}

/** Absolute path to an asset, for callers that want to embed an
 *  absolute reference instead of copying. */
export function assetPath(name: string): string {
  return path.join(ASSETS_DIR, name);
}
