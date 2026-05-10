# paperese

Markdown → LaTeX assembler for academic papers. Built on
[markdsl](https://github.com/EvolvingPrograms/markdsl) (front-matter,
schema/values, marker grammar) plus a system `pandoc` for the
AST → LaTeX heavy lifting. The goal: a markdown source ~half the
size of the equivalent hand-written `.tex`, rendered into a
publication-ready preprint by `latexmk -pdf paper.tex`.

```
bun add paperese          # programmatic
npm i -g paperese         # CLI
```

You'll also need `pandoc` on `PATH`; for PDF output, a TeX
distribution (TeX Live / MacTeX) with `pdflatex` and `latexmk`.

## Quickstart

`paper.md`:

```markdown
---
title: A Two Column Arxiv Template
authors:
  - name: Brenhin Keller
    affiliation: Dartmouth College
    email: bkeller@university.edu
    orcid: 0000-0000-0000-0001
keywords: [tutorial, attributes, seismic]
abstract: >
  Morbi eu neque et enim euismod cursus sit amet sit amet elit.
  Fusce eget neque placerat, vehicula dui id, placerat velit.
bibliography: refs.bib
---

# Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

# Methods {#sec:methods}

See Section \ref{sec:methods}. Energy is $E = mc^2$, and

$$
\xi_{ij}(t) = \frac{\alpha_i(t) a^{w_t}_{ij} \beta_j(t+1)}
                  {\sum_{i,j} \alpha_i(t) a^{w_t}_{ij} \beta_j(t+1)}
$$

# Results

We confirm prior findings [@kour2014real; @kour2014fast].

![Convergence curve.\label{fig:fig1}](fig1.pdf){width=4cm}

See Figure \ref{fig:fig1}.

- one
- two
- three
```

Render and compile:

```bash
paperese paper.md          # writes paper.tex next to the source
latexmk -pdf paper.tex     # produces paper.pdf
```

Or programmatically:

```ts
import { renderTex } from 'paperese';

const tex = renderTex(srcMarkdown, {
  template: 'arxiv-two-column',  // default
  output: 'paper.tex',           // optional: write to disk
});
```

## Markdown surface

Standard pandoc markdown with the extensions paperese enables. The
body of any paper is mostly mechanical Pandoc → LaTeX, which pandoc
already does well — paperese owns the surrounding template + the
front-matter conventions.

| Source | Compiles to |
|---|---|
| `# Heading` / `## Sub` / `### Subsub` | `\section / \subsection / \subsubsection` |
| `# Heading {#sec:foo}` | `\label{sec:foo}` after the heading |
| `\ref{sec:foo}` (raw_tex passes through) | `\ref{sec:foo}` |
| `$E = mc^2$` | `\(E = mc^2\)` |
| `$$ ... $$` | `\[ ... \]` |
| `[@key]`, `[@a; @b]` | `\citep{a, b}` (natbib) |
| `[text](https://...)` / `<https://...>` | `\href{...}{text}` / `\url{...}` |
| `![cap\label{fig:f}](f.pdf){width=4cm}` | `\begin{figure}…\end{figure}` |
| `- item` | `\begin{itemize}…\end{itemize}` |
| `1. item` | `\begin{enumerate}…\end{enumerate}` |
| `**bold**` / `*italic*` / `` `code` `` | `\textbf{}` / `\emph{}` / `\texttt{}` |
| `[text]{.smallcaps}` / `[text]{.underline}` | `\textsc{text}` / `\underline{text}` |
| `\command{...}` | passes through verbatim |

**Citation syntax gotcha**: pandoc's `[@key]` parser greedily folds
an adjacent `[...]` into a preceding `\command[arg]` as if it were a
second optional argument. If you write `\lipsum[N] [@key]` on one
line the citation gets eaten. Split into separate paragraphs:

```markdown
\lipsum[8]

[@kour2014real; @kour2014fast] and see [@hadash2018estimate].
```

**Cross-references** are raw `\ref{}` for now (works via `+raw_tex`).
Pandoc's `[@key]` syntax is reserved for citations; integrating
`pandoc-crossref` for `[@sec:foo]` / `[@fig:f]` is on the todo list.

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
    is_corresponding: true

keywords: [tutorial, attributes, seismic]

abstract: >
  Free-form prose. Pandoc-rendered, so any `$math$` or `[@cite]` in
  here lands as proper LaTeX; markdown emphasis works.

bibliography: refs.bib                      # → \bibliography{refs}
output: paper.tex                           # default; overrideable via -o
---
```

`authors[].affiliation` (one string) gets deduped and indexed
automatically — common case for single-affiliation authors. For
multi-affiliation authors, declare a top-level `affiliations:` list
and reference them per-author with 1-based indices:

```yaml
authors:
  - name: Alice
    affiliations: [1, 2]
    email: alice@a.edu
  - name: Bob
    affiliations: [2]

affiliations:
  - name: Department of Genome Sciences, University X
  - name: Department of Statistics, University Y
```

## References

Two ways to provide a bibliography. Pick whichever fits your
workflow — both render the references list automatically.

### `bibliography:` (external `.bib` file)

Use this when you already have a BibTeX file. The `.tex` path uses
natbib (`\citep{}` / `\citet{}` left in source, the `.bib` resolves
at compile time); the `.docx` path uses pandoc's citeproc.

```yaml
---
bibliography: refs.bib
---

We confirm prior findings [@kour2014real; @hadash2018].
```

### `references:` (inline CSL-JSON in front-matter)

Use this when you don't have a separate `.bib` file — Claude /
agents that draft a paper inline, single-file submissions, etc.
Each entry is a CSL-JSON object (pandoc's native YAML
bibliography format). The `.tex` and `.docx` paths both fall
through to citeproc and emit the bibliography directly in the
document body.

```yaml
---
references:
  - id: kour2014real
    type: paper-conference
    title: "Real-time segmentation of on-line handwritten arabic script"
    author:
      - { family: Kour,   given: George }
      - { family: Saabne, given: Raid }
    "container-title": "Frontiers in Handwriting Recognition (ICFHR)"
    issued: { "date-parts": [[2014]] }
    page: "417-422"

  - id: hadash2018
    type: article
    title: "Estimate and replace: A novel approach to integrating deep neural networks with existing applications"
    author:
      - { family: Hadash, given: Guy }
    issued: { "date-parts": [[2018]] }
---

We confirm prior findings [@kour2014real] and the integration
approach [@hadash2018].
```

Mixing both fields isn't supported — set one or the other.
Common CSL `type` values: `article-journal`, `paper-conference`,
`book`, `chapter`, `thesis`, `webpage`, `manuscript`. Full schema:
[CSL-JSON spec](https://docs.citationstyles.org/en/stable/specification.html).

**Citation syntax gotcha** (applies to both modes): pandoc's
`[@key]` parser greedily folds an adjacent `[...]` into a
preceding `\command[arg]` as if it were a second optional argument.
If you write `\lipsum[N] [@key]` on one line the citation gets
eaten. Split into separate paragraphs.

## CLI

```
paperese <input.md> [options]

  -o, --output <path>         Override the output .tex path.
                              Default: front-matter `output:` then <name>.tex
                              next to the input.
      --template <name>       Template to use. Built-in: arxiv-two-column.
      --schema                Print front-matter schema/values/missing as
                              YAML; don't render.
  -h, --help                  Show this help.

  paperese -                  Read source from stdin. Without -o or
                              `output:`, writes to stdout.
```

Schema dump is useful for batch-prefilling values:

```bash
paperese paper.md --schema
# title: A Two Column Arxiv Template
# template: arxiv-two-column
# schema: {}
# values: {}
# missing: []
```

## Templates

| Template | Notes |
|---|---|
| `arxiv-two-column` (default) | Two-column arxiv preprint. Port of [myst-templates/arxiv_two_column](https://github.com/myst-templates/arxiv_two_column). natbib citations; `\orcidicon` macro for the green ORCID iD circle; `lipsum`, `tikz`, `longtable`, `array`, `lineno`, `titlesec`, `hyperref`, `graphicx`, `booktabs`, `amsmath`/`amssymb`, `xcolor` pre-loaded; pandoc's `\tightlist` + `\passthrough` helpers pre-defined. |

A working example lives at
[`examples/arxiv-two-column/`](./examples/arxiv-two-column/) — the
markdown source compiles end-to-end via `latexmk -pdf paper.tex`.

### Custom templates

A template is a function of `(meta, body, abstract) => string`. If
the built-ins don't fit, write your own:

```ts
import { renderTex, type TexTemplate } from 'paperese';

const myTemplate: TexTemplate = ({ meta, body, abstract }) => `\\documentclass{article}
\\title{${meta.title ?? 'Untitled'}}
\\begin{document}
\\maketitle
${abstract ? `\\begin{abstract}\n${abstract}\n\\end{abstract}` : ''}
${body}
\\end{document}
`;

renderTex(src, { template: myTemplate, output: 'paper.tex' });
```

`meta` is the parsed front-matter (including authors, keywords,
bibliography, …); `body` is the pandoc-rendered LaTeX of the
markdown body; `abstract` is the pandoc-rendered LaTeX of the
front-matter `abstract:` field, or `undefined`.

## Claude skill

`paperese` is also packaged as a Claude skill — drop the published
`plugin.zip` into a Claude Code skills directory and Claude will
defer here whenever the user asks for a paper / preprint / arxiv
submission. See [`SKILL.md`](./SKILL.md) for the descriptor and the
exact CLI Claude invokes.

## Status

Early. Today: front-matter (title/authors/abstract/keywords/bib),
section levels, math (display + inline), citations (natbib via
pandoc), figures, lists, smallcaps/underline spans, raw-LaTeX
passthrough, the arxiv-two-column template. Tomorrow:
`pandoc-crossref` integration, more templates (single-column,
journal-specific), table-in-twocolumn fix (`table*` wrapping for
pandoc's `longtable` output), markdsl/docx round-trip for
editor-friendly review copies.

## See also

- [markdsl](https://github.com/EvolvingPrograms/markdsl) — the
  pipeline framework underneath.
- [legalese](https://github.com/EvolvingPrograms/legalese) —
  sister DSL targeting `.docx` for legal documents (NDAs,
  agreements, signature blocks).

## Development

```bash
bun install
bun run typecheck
bun test
bun run build         # bundles scripts/paperese.ts → dist/paperese.js
bun run pack          # builds + zips a plugin.zip skill artifact
```
