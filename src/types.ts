// Front-matter shape paperese reads. Extend as templates grow.

import type { FrontMatter as MarkdslFrontMatter } from 'markdsl';
import type { DocStyle } from 'markdsl/docx';

export interface Author {
  name: string;
  affiliations?: number[] | string[];
  affiliation?: string;
  email?: string;
  orcid?: string;
  is_corresponding?: boolean;
}

export interface Affiliation {
  name: string;
  /** 1-based index used by `\affil[N]` and per-author refs. */
  index?: number;
}

export interface TexFrontMatter extends MarkdslFrontMatter {
  title?: string;
  short_title?: string;
  description?: string;
  authors?: Author[];
  affiliations?: Affiliation[];
  abstract?: string;
  keywords?: string[];
  /** Path (relative to baseDir) to a BibTeX file. When set, the
   *  LaTeX path uses natbib (`\bibliography{<file>}`); the docx path
   *  feeds it to `pandoc --citeproc`. */
  bibliography?: string;
  /** Inline references — array of CSL-JSON entries (pandoc's native
   *  YAML bibliography format). Use this when no .bib file is
   *  available; both render paths fall through to citeproc and emit
   *  the references list at the end of the document. Co-existing
   *  with `bibliography:` is allowed but ambiguous; prefer one. */
  references?: Array<Record<string, unknown>>;
  /** Output path for the rendered .tex file. */
  output?: string;
  /** Show the corner trim marks (the small L-shaped tick marks at
   *  page corners) that the upstream `preprint.sty` draws via the
   *  `background` package. Default: `false`. Set `true` to keep
   *  the upstream behaviour. */
  trim_marks?: boolean;
  /** LaTeX engine the rendered `.tex` is intended for. Defaults to
   *  `'xelatex'` — Unicode-native via `fontspec`, no `\\newunicodechar`
   *  mapping table needed. Switch to `'pdflatex'` if you specifically
   *  need that engine (older arxiv submission flows, build images
   *  without xelatex installed). The template emits a
   *  `% !TEX program = <engine>` magic comment so latexmk and modern
   *  editors pick the right binary automatically. */
  engine?: 'xelatex' | 'lualatex' | 'pdflatex';
  /** Typography overrides — font family + sizes (and any other
   *  fields markdsl's DocStyle exposes). Applied to both the .tex
   *  and .docx render paths so a single source produces the same
   *  look regardless of output format. */
  style?: DocStyle;
}

/** A paperese template: takes the parsed front-matter + the
 *  pandoc-rendered body LaTeX, returns the full `.tex` source. */
export type TexTemplate = (input: {
  meta: TexFrontMatter;
  body: string;
  abstract?: string;
}) => string;
