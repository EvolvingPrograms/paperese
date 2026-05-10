// Front-matter shape texdown reads. Extend as templates grow.

import type { FrontMatter as MarkdslFrontMatter } from 'markdsl';

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
  /** Path (relative to baseDir) to a BibTeX file consumed by `\bibliography{}`. */
  bibliography?: string;
  /** Output path for the rendered .tex file. */
  output?: string;
}

/** A texdown template: takes the parsed front-matter + the
 *  pandoc-rendered body LaTeX, returns the full `.tex` source. */
export type TexTemplate = (input: {
  meta: TexFrontMatter;
  body: string;
  abstract?: string;
}) => string;
