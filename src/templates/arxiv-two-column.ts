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

/** Map a front-matter font-family name to a LaTeX font setup
 *  fragment. Common Google / OS fonts route through their established
 *  pdflatex packages; anything unrecognized falls through to a
 *  fontspec line that requires xelatex/lualatex to compile. */
function fontPackageFor(family: string | undefined): string {
  if (!family) return '';
  const f = family.trim().toLowerCase();
  // pdflatex-friendly families
  if (f === 'times' || f === 'times new roman') {
    return '\\usepackage{mathptmx}';
  }
  if (f === 'palatino' || f === 'pagella') {
    return '\\usepackage{mathpazo}';
  }
  if (f === 'helvetica' || f === 'arial') {
    return '\\usepackage{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}';
  }
  if (f === 'courier' || f === 'monospace') {
    return '\\usepackage{courier}\n\\renewcommand{\\familydefault}{\\ttdefault}';
  }
  if (f === 'libertine' || f === 'linux libertine') {
    return '\\usepackage{libertine}';
  }
  if (f === 'utopia' || f === 'fourier') {
    return '\\usepackage{fourier}';
  }
  // fontspec fallback — needs xelatex/lualatex. Authors choosing a
  // bundled-font family (EB Garamond, Crimson Pro, etc.) get this.
  return `% ${family} via fontspec — compile with xelatex or lualatex
\\usepackage{fontspec}
\\setmainfont{${family}}`;
}

/** Pick a documentclass option for the body font size. 10/11/12pt
 *  fall through to the standard article class; other integer sizes
 *  use extarticle which supports 8/9/14/17/20pt. Defaults to 11pt
 *  (paperese house default — slightly larger than upstream). */
function documentClassSize(size: number | undefined): { className: string; sizeOpt: string } {
  const s = size ?? 11;
  if ([10, 11, 12].includes(s)) return { className: 'article', sizeOpt: `${s}pt` };
  if ([8, 9, 14, 17, 20].includes(s)) return { className: 'extarticle', sizeOpt: `${s}pt` };
  // Off-grid: use extarticle's nearest legal step + an explicit
  // \fontsize override later.
  return { className: 'extarticle', sizeOpt: '12pt' };
}

export const arxivTwoColumn: TexTemplate = ({ meta, body, abstract }) => {
  const title = meta.title ?? 'Untitled';
  const declaredAuthors = (meta.authors ?? []) as Author[];
  const { authors, affiliations } = resolveAffiliations(declaredAuthors, meta.affiliations);
  const keywords = meta.keywords ?? [];
  const abstractText = abstract ?? meta.abstract;
  const style = meta.style ?? {};

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

  const { className, sizeOpt } = documentClassSize(style.size);
  const fontTex = fontPackageFor(style.font);
  // For sizes outside the 8/9/10/11/12/14/17/20 grid, set the body
  // baseline explicitly. \fontsize{N}{1.2N} = N-pt text on 1.2N-pt
  // leading (Word's default ratio).
  const offGridSize = style.size && ![8, 9, 10, 11, 12, 14, 17, 20].includes(style.size)
    ? `\\AtBeginDocument{\\fontsize{${style.size}}{${(style.size * 1.2).toFixed(0)}}\\selectfont}`
    : '';
  const headingSizes = [
    style.h1_size ? `\\titleformat*{\\section}{\\fontsize{${style.h1_size}}{${(style.h1_size * 1.2).toFixed(0)}}\\bfseries}` : '',
    style.h2_size ? `\\titleformat*{\\subsection}{\\fontsize{${style.h2_size}}{${(style.h2_size * 1.2).toFixed(0)}}\\bfseries}` : '',
  ].filter(Boolean).join('\n');

  return `\\documentclass[twocolumn,switch,${sizeOpt}]{${className}}
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
\\usepackage{lipsum}
\\usepackage{titlesec}
\\usepackage{tikz}
${fontTex}
${offGridSize}
${headingSizes}

% Green ORCID iD circle, ported from the upstream arxiv_two_column
% template. Used by the author block when a front-matter \`orcid:\`
% field is set; pre-defined here so authors don't have to import
% tikz themselves.
\\definecolor{lime}{HTML}{A6CE39}
% Drop the upstream \\hspace{-2mm} trailer — it overlaps the
% authblk-emitted affiliation superscript that follows. A small
% positive kern keeps the icon clear of the next character.
\\DeclareRobustCommand{\\orcidicon}{%
  \\begin{tikzpicture}
    \\draw[lime, fill=lime] (0,0) circle [radius=0.16]
      node[white] {{\\fontfamily{qag}\\selectfont \\tiny ID}};
    \\draw[white, fill=white] (-0.0625,0.095) circle [radius=0.007];
  \\end{tikzpicture}\\kern0.4em%
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
