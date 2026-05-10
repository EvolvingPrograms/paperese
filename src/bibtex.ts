// Serialize front-matter `references:` (YAML, BibTeX-shape) into a
// real BibTeX (.bib) file. Lets paperese ship documents with their
// references inline in front-matter while keeping the LaTeX render
// path on natbib (numeric `[1]` / `[2]` citations, hyperlinked,
// identical to a hand-written .bib).
//
// The mapping is 1:1 — each YAML entry becomes one BibTeX entry:
//
//   - id: kour2014real          →  @inproceedings{kour2014real,
//     type: inproceedings           ...
//     title: Real-time …
//     author: Kour, George and Saabne, Raid
//     booktitle: Frontiers …
//     pages: 417--422
//     year: 2014
//     organization: IEEE
//
// `id` and `type` are special (entry key / entry type); every other
// field maps to a BibTeX `field = {value}` line.

export interface BibEntry {
  id: string;
  type: string;
  [field: string]: unknown;
}

const SKIP = new Set(['id', 'type']);

/** Serialize an array of front-matter reference entries to a
 *  BibTeX (.bib) document string. Round-trips through pandoc /
 *  natbib without further processing. */
export function referencesToBibtex(refs: ReadonlyArray<Record<string, unknown>>): string {
  const out: string[] = [];
  for (const raw of refs) {
    const entry = raw as BibEntry;
    if (!entry.id || !entry.type) continue;
    const type = String(entry.type);
    const id = String(entry.id);
    const fields: string[] = [];
    for (const [k, v] of Object.entries(entry)) {
      if (SKIP.has(k) || v === undefined || v === null) continue;
      fields.push(`  ${k}={${formatValue(v)}}`);
    }
    out.push(`@${type}{${id},\n${fields.join(',\n')}\n}`);
  }
  return out.join('\n\n') + '\n';
}

/** Format a YAML value as a BibTeX field body. Numbers stringify;
 *  arrays of strings join with ` and ` (BibTeX author/editor
 *  convention); everything else `String(...)`s. */
function formatValue(v: unknown): string {
  if (Array.isArray(v)) {
    return v.map((x) => String(x)).join(' and ');
  }
  return String(v);
}
