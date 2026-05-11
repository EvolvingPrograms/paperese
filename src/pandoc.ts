// Run pandoc -t latex on a markdown body and return the LaTeX
// fragment. Paperese's whole job is template assembly around this
// fragment — pandoc does the AST → LaTeX heavy lifting (section
// headers, equations, lists, figures, tables, citations, refs).
//
// Flags enabled:
//   +tex_math_dollars   — `$E=mc^2$` and `$$...$$` carry through
//   +smart              — straight quotes / dashes typographic
//   +citations          — `[@key]` / `[@a; @b]` → \cite{a,b}
//   +footnotes          — `[^1]` → \footnote{}
//   +raw_tex            — passthrough `\latex{}` for escape hatches
//   +link_attributes    — `[text](url){.url}` and labels

import { execSync } from 'node:child_process';

const PANDOC_FROM = [
  'markdown',
  '+tex_math_dollars',
  '+smart',
  '+bracketed_spans',
  '+citations',
  '+footnotes',
  '+raw_tex',
  '+link_attributes',
].join('');

export interface RunPandocLatexOpts {
  /** Path to a BibTeX file. When set, citations resolve via natbib
   *  (`\citep{}` / `\citet{}` left in the .tex; the .bib file is the
   *  source of truth and a downstream `\bibliography{}` finalises). */
  bibFile?: string;
  /** Use citeproc to resolve citations inline (numeric or
   *  author-year per the CSL style). Set this when there's no .bib
   *  file — pandoc reads `references:` from the document's YAML
   *  front-matter. The bibliography list is appended as a
   *  `references` Div in the body. */
  citeproc?: boolean;
  /** Pre-resolved YAML front-matter to prepend before the body so
   *  citeproc can find inline `references:` entries. Pandoc reads
   *  the first YAML block of the input as document metadata. */
  yamlPreamble?: string;
}

/** Convert a markdown body to a LaTeX fragment via the system
 *  `pandoc` binary. Returns just the body LaTeX — no preamble, no
 *  `\begin{document}` — so it can be spliced into a template. */
export function runPandocLatex(body: string, opts: RunPandocLatexOpts = {}): string {
  const args = ['--from', PANDOC_FROM, '-t', 'latex', '--wrap=preserve', '--syntax-highlighting=none'];
  if (opts.bibFile) {
    // natbib: leaves \citep{} / \citet{} in the output. The
    // template's \bibliography{<file>} closes the loop.
    args.push('--natbib');
  } else if (opts.citeproc) {
    // citeproc: resolves citations inline (numeric or author-year
    // per CSL). Reads `references:` YAML from the input front-matter.
    args.push('--citeproc');
  }
  const input = opts.yamlPreamble ? `${opts.yamlPreamble}\n\n${body}` : body;
  return execSync(`pandoc ${args.map((a) => `'${a}'`).join(' ')}`, {
    input,
    encoding: 'utf8',
  });
}
