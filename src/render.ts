// Top-level: markdown source string → LaTeX `.tex` source. Paperese
// is a thin assembler around pandoc's LaTeX writer + a template:
//
//   1. splitFrontMatter (markdsl) — meta + body
//   2. abstract: if front-matter has it as a string, use as-is; if
//      it's a markdown sub-document, run it through pandoc too
//   3. body: pandoc -t latex on the prose
//   4. template(meta, body, abstract) → full .tex source
//   5. optionally writeFileSync to `output`

import fs from 'node:fs';
import path from 'node:path';

import { splitFrontMatter } from 'markdsl';

import { copyAssetsTo } from './assets';
import { referencesToBibtex } from './bibtex';
import { runPandocLatex } from './pandoc';
import { builtInTemplates } from './templates';
import type { TexFrontMatter, TexTemplate } from './types';

export interface RenderTexOptions {
  /** Template name (registered in `builtInTemplates`) or a custom
   *  function. Default: `'arxiv-two-column'`. */
  template?: keyof typeof builtInTemplates | TexTemplate;
  /** Caller-supplied values that override front-matter `values:`. Not
   *  used by the built-in templates yet — reserved for marker
   *  registries that consume markdsl's `substituteMarkers`. */
  values?: Record<string, unknown>;
  /** Output path. If set, writes to disk and resolves to the path. */
  output?: string;
  /** Working directory for relative paths (e.g. bibliography). */
  baseDir?: string;
}

function resolveTemplate(t: RenderTexOptions['template']): TexTemplate {
  if (typeof t === 'function') return t;
  const key = t ?? 'arxiv-two-column';
  const found = builtInTemplates[key];
  if (!found) {
    const known = Object.keys(builtInTemplates).join(', ');
    throw new Error(`Unknown template: '${key}'. Built-ins: ${known}.`);
  }
  return found;
}

/** Markdown source → LaTeX `.tex` source. Returns the rendered string;
 *  pass `output:` to write to disk too. */
export function renderTex(srcText: string, opts: RenderTexOptions = {}): string {
  const { meta, body } = splitFrontMatter<TexFrontMatter>(srcText);
  const template = resolveTemplate(opts.template);

  // Citation handling: a real .bib file (natbib) is the canonical
  // path. When the front-matter declares `references:` instead, we
  // serialize that array to a generated .bib next to the .tex so the
  // natbib pipeline (numeric `[1]` / `[2]` cites, hyperlinked) is
  // identical to a hand-written .bib.
  const baseDir = opts.baseDir
    ?? (opts.output ? path.dirname(path.resolve(opts.output))
        : meta.output ? path.dirname(path.resolve(meta.output))
        : process.cwd());
  let bibFile = meta.bibliography;
  if (!bibFile && Array.isArray(meta.references) && meta.references.length > 0) {
    const generatedPath = path.join(baseDir, '_paperese-refs.bib');
    fs.writeFileSync(generatedPath, referencesToBibtex(meta.references));
    bibFile = path.basename(generatedPath); // relative — pdflatex resolves in CWD
    // Surface the generated path to the template so it emits
    // `\\bibliography{<file>}` like a hand-written .bib.
    meta.bibliography = bibFile;
  }
  const bodyTex = runPandocLatex(body, { bibFile });

  // Abstract handling: if it's a string, treat as plain prose. If
  // markdown formatting matters, the author can wrap with `*emph*`
  // etc. and pandoc will handle it on re-render — but for now we
  // pipe it through pandoc so any `$math$` or `\cite{}` lands as
  // proper LaTeX.
  const abstractTex = meta.abstract
    ? runPandocLatex(meta.abstract).trim()
    : undefined;

  const tex = template({ meta, body: bodyTex, abstract: abstractTex });

  const output = opts.output ?? meta.output;
  if (output) {
    fs.writeFileSync(output, tex);
    // Plant any bundled assets the template references next to the
    // .tex so `pdflatex paper.tex` picks them up via plain
    // `\includegraphics{<name>}` without absolute paths.
    copyAssetsTo(path.dirname(output), ['orcid.png']);
  }
  return tex;
}

/** Markdown source → write LaTeX `.tex` to disk. Resolves to the path. */
export function renderTexToFile(
  srcText: string,
  output: string,
  opts: RenderTexOptions = {},
): string {
  renderTex(srcText, { ...opts, output });
  return output;
}
