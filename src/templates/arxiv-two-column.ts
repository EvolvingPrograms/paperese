// Two-column arxiv preprint template. Direct port of
// myst-templates/arxiv_two_column/template.tex with the
// jtex/jinja substitutions replaced by template-literal expansions.
//
// What the template ships:
//   - twocolumn article class with arXiv-style preprint preamble
//   - \title / \author / \affil block (with optional ORCID)
//   - title + abstract + keywords spanning both columns at the top
//   - body content in two columns
//   - natbib bibliography at the end (if `bibliography:` is set in
//     front-matter)

import type { TexTemplate, Author, Affiliation } from '../types';

function escapeTex(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/** Build the `\author{}` + `\affil{}` block. Authors carry
 *  affiliation indices (1-based); affiliations get one `\affil[N]`
 *  entry each. Falls back to a single un-numbered author if no
 *  affiliations are declared. */
function authorBlock(authors: Author[], affiliations: Affiliation[]): string {
  const lines: string[] = [
    '\\usepackage{authblk}',
    '\\renewcommand*{\\Authfont}{\\bfseries}',
    '',
  ];

  for (const a of authors) {
    const affilIdx = Array.isArray(a.affiliations) && a.affiliations.length
      ? a.affiliations.join(',')
      : '';
    const thanks = a.email ? `\\thanks{\\texttt{${escapeTex(a.email)}}}` : '';
    const orcid = a.orcid
      ? `\\href{https://orcid.org/${a.orcid}}{\\orcidicon}`
      : '';
    lines.push(`\\author[${affilIdx}${thanks}]{${escapeTex(a.name)}${orcid}}`);
  }

  for (const af of affiliations) {
    lines.push(`\\affil[${af.index ?? 1}]{${escapeTex(af.name)}}`);
  }

  return lines.join('\n');
}

/** Resolve affiliations from authors. If the front-matter declares
 *  `affiliations:` directly, use that. Otherwise, collect each
 *  author's `.affiliation` string, dedupe in encounter order, and
 *  rewrite per-author refs to 1-based indices into that list. */
function resolveAffiliations(authors: Author[], declared?: Affiliation[]): {
  authors: Author[];
  affiliations: Affiliation[];
} {
  if (declared && declared.length) {
    return {
      authors,
      affiliations: declared.map((a, i) => ({ ...a, index: a.index ?? i + 1 })),
    };
  }

  const seen = new Map<string, number>();
  const out: Affiliation[] = [];
  const rewritten: Author[] = authors.map((a) => {
    const name = a.affiliation ?? '';
    if (!name) return { ...a, affiliations: [] };
    let idx = seen.get(name);
    if (idx === undefined) {
      idx = out.length + 1;
      seen.set(name, idx);
      out.push({ name, index: idx });
    }
    return { ...a, affiliations: [idx] };
  });
  return { authors: rewritten, affiliations: out };
}

export const arxivTwoColumn: TexTemplate = ({ meta, body, abstract }) => {
  const title = meta.title ?? 'Untitled';
  const declaredAuthors = (meta.authors ?? []) as Author[];
  const { authors, affiliations } = resolveAffiliations(declaredAuthors, meta.affiliations);
  const keywords = meta.keywords ?? [];
  const abstractText = abstract ?? meta.abstract;

  const authorTex = authors.length ? authorBlock(authors, affiliations) : '';
  const abstractTex = abstractText
    ? `\\begin{abstract}\n${abstractText}\n\\end{abstract}`
    : '';
  const keywordsTex = keywords.length
    ? `\\keywords{${keywords.map(escapeTex).join(', ')}}`
    : '';
  const bibTex = meta.bibliography
    ? `\\bibliography{${meta.bibliography.replace(/\.bib$/, '')}}`
    : '';

  return `\\documentclass[twocolumn,switch]{article}
\\usepackage{preprint}
\\usepackage{hyperref}
\\usepackage[numbers,square]{natbib}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{amsmath,amssymb}
\\usepackage{longtable}
\\usepackage{array}
\\usepackage{lineno}
\\usepackage{titlesec}
\\usepackage{tikz}

% Green ORCID iD circle, ported from the upstream arxiv_two_column
% template. Used by the author block when a front-matter \`orcid:\`
% field is set; pre-defined here so authors don't have to import
% tikz themselves.
\\definecolor{lime}{HTML}{A6CE39}
\\DeclareRobustCommand{\\orcidicon}{%
  \\begin{tikzpicture}
    \\draw[lime, fill=lime] (0,0) circle [radius=0.16]
      node[white] {{\\fontfamily{qag}\\selectfont \\tiny ID}};
    \\draw[white, fill=white] (-0.0625,0.095) circle [radius=0.007];
  \\end{tikzpicture}\\hspace{-2mm}%
}

\\hypersetup{colorlinks=true, linkcolor=purple, urlcolor=blue, citecolor=cyan, anchorcolor=black}

\\bibliographystyle{unsrtnat}

\\titlespacing\\section{0pt}{12pt plus 3pt minus 3pt}{1pt plus 1pt minus 1pt}
\\titlespacing\\subsection{0pt}{10pt plus 3pt minus 3pt}{1pt plus 1pt minus 1pt}
\\titlespacing\\subsubsection{0pt}{8pt plus 3pt minus 3pt}{1pt plus 1pt minus 1pt}

% Pandoc helpers — \\tightlist is emitted on collapsed itemize/enumerate
% blocks; \\passthrough wraps inline code with smart quotes preserved.
\\providecommand{\\tightlist}{\\setlength{\\itemsep}{0pt}\\setlength{\\parskip}{0pt}}
\\providecommand{\\passthrough}[1]{#1}

\\title{${escapeTex(title)}}

${authorTex}

\\begin{document}

\\twocolumn[\\begin{@twocolumnfalse}
\\maketitle
${abstractTex}
${keywordsTex}
\\vspace{0.5cm}
\\end{@twocolumnfalse}]

${body}

${bibTex}

\\end{document}
`;
};
