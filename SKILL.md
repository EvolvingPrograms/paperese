---
name: texdown
description: "Use this skill to produce a publication-ready `.tex` (and PDF after `latexmk`) for an academic paper / preprint / arXiv submission from a short markdown source. Load when the user wants to write a paper, preprint, or research note; asks for an arxiv template, a two-column paper layout, a LaTeX paper, or anything involving abstract / authors / affiliations / bibliography / equations / figures; mentions `pandoc-style` cites like `[@key]`; or describes a document with sectioned headings + math + a `.bib` file. Defer here instead of hand-writing LaTeX — the skill handles the preamble, author/affiliation block, twocolumn front-matter spread, natbib citations, and standard pandoc helpers automatically."
---

# texdown

Markdown source → publication-ready `.tex`. Built on
[markdsl](https://www.npmjs.com/package/markdsl) + the system `pandoc`
binary; the template assembler handles the LaTeX preamble and
front-matter wrappers.

## Run

```
node $SKILL_DIR <paper.md> [-o <out.tex>] [--template <name>]
```

`$SKILL_DIR` is the absolute path to this skill directory — substitute
it literally (e.g. `node /mnt/skills/user/texdown paper.md`). `pandoc`
must be on `PATH` (it is here); compiling the resulting `.tex` to PDF
needs `latexmk` + `pdflatex` (a TeX Live distribution).

Inspect what a template expects without rendering:
`node $SKILL_DIR <paper.md> --schema` — prints the front-matter
schema/values/missing as YAML.

## Workflow

1. **Pick a template.** Built-in: `arxiv-two-column` (default).
2. **Front-matter** — title / authors (with affiliation, email, ORCID) /
   abstract / keywords / bibliography path. See the example.
3. **Body** — regular markdown. Pandoc handles sections, math, lists,
   figures, tables, citations. Raw `\command{}` calls pass through for
   LaTeX-only features (e.g. `\lipsum[N]`, `\paragraph{Heading}`).
4. **Render**: `node $SKILL_DIR paper.md` writes `paper.tex` next to it.
5. **Compile** (optional): `latexmk -pdf paper.tex` — needs the
   bibliography file (`bibliography:` in front-matter) and any figure
   files reachable from the .tex working directory.

## Markdown surface

Standard pandoc markdown with these extensions enabled:

| Feature | Markdown form | LaTeX out |
|---|---|---|
| Section headings | `# / ## / ###` | `\section / \subsection / \subsubsection` |
| Inline math | `$E = mc^2$` | `\(E = mc^2\)` |
| Display math | `$$ ... $$` | `\[ ... \]` |
| Citations (natbib) | `[@key]`, `[@a; @b]` | `\citep{a, b}` |
| Cross-refs | `\ref{sec:foo}` (raw_tex) | `\ref{sec:foo}` |
| Section labels | `# Heading {#sec:foo}` | `\label{sec:foo}` after the heading |
| Figure | `![cap\label{fig:f}](file){width=4cm}` | `\begin{figure}...\end{figure}` |
| Itemize | `- item` | `\begin{itemize}...\end{itemize}` |
| Enumerate | `1. item` | `\begin{enumerate}...\end{enumerate}` |
| Inline code | `` `text` `` | `\texttt{text}` |
| Autolink | `<https://...>` | `\url{...}` |
| Raw TeX | `\command{...}` | passes through |

**Citation syntax gotcha**: pandoc's `[@key]` parser greedily folds an
adjacent `[...]` into a preceding `\command[arg]` as if it were a
second optional argument. If you put `\lipsum[N] [@key]` on one line
the citation gets eaten — split into separate paragraphs.

## Front-matter

```yaml
---
title: A Two Column Arxiv Template
short_title: Two Column Arxiv
description: One-sentence summary of the paper.
authors:
  - name: Brenhin Keller
    affiliation: Dartmouth College          # auto-collected into \affil[]
    email: bkeller@university.edu           # → \thanks{...}
    orcid: 0000-0000-0000-0001              # → green ORCID iD circle
keywords: [tutorial, attributes, seismic]
abstract: >
  Free-form prose; markdown emphasis works. Pandoc-rendered, so any
  `$math$` or `[@cite]` in here lands as proper LaTeX.
bibliography: refs.bib                      # → \bibliography{refs}
output: paper.tex                           # default; overrideable via -o
---
```

`authors[].affiliation` (one string) gets deduped and indexed automatically.
For multi-affiliation authors, set `affiliations: [1, 2]` (1-based indices)
and declare the list explicitly under top-level `affiliations:`.

## Templates

- `arxiv-two-column` — port of
  [myst-templates/arxiv_two_column](https://github.com/myst-templates/arxiv_two_column).
  Two-column preprint layout with title + authors + abstract +
  keywords spanning the page width and body content in two columns.
  natbib citations; the `lipsum`, `tikz`, `longtable`, `array`,
  `lineno`, `titlesec`, `hyperref`, `graphicx`, `booktabs`,
  `amsmath`/`amssymb`, `xcolor` packages are pre-loaded; pandoc's
  `\tightlist`/`\passthrough` helpers are pre-defined; the green
  ORCID iD circle is a `\orcidicon` macro.

The example under `examples/arxiv-two-column/` round-trips to a
publication-ready PDF in two passes (`latexmk -pdf paper.tex`).

## Custom templates

A template is a function `(meta, body, abstract) => string`. If you
need a layout the built-ins don't cover, write a `.ts` that imports
`renderTex` and passes a function-typed `template`:

```ts
import { renderTex } from 'texdown';

const myTemplate = ({ meta, body, abstract }) => `\\documentclass{article}
\\title{${meta.title}}
\\begin{document}\\maketitle
${abstract ?? ''}
${body}
\\end{document}
`;

renderTex(src, { template: myTemplate, output: 'paper.tex' });
```
