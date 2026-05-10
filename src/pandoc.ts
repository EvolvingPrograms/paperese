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

/** Convert a markdown body to a LaTeX fragment via the system
 *  `pandoc` binary. Returns just the body LaTeX — no preamble, no
 *  `\begin{document}` — so it can be spliced into a template. */
export function runPandocLatex(body: string, opts: { bibFile?: string } = {}): string {
  const args = ['--from', PANDOC_FROM, '-t', 'latex', '--wrap=preserve'];
  if (opts.bibFile) {
    // With --natbib pandoc emits \citep{}/\citet{} commands instead
    // of \hyperlink, leaving the .bib file as the source of truth
    // (the arxiv template uses natbib).
    args.push('--natbib');
  }
  return execSync(`pandoc ${args.map((a) => `'${a}'`).join(' ')}`, {
    input: body,
    encoding: 'utf8',
  });
}
