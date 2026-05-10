# texdown

Markdown → LaTeX assembler. Built on [markdsl](https://github.com/EvolvingPrograms/markdsl) and a
system `pandoc` for the AST → LaTeX heavy lifting.

The goal: write a markdown source ~half the size of the equivalent
hand-written `.tex` and get a publication-ready paper out the other
side. Front-matter declares title / authors / affiliations / abstract
/ keywords / bibliography; the body is regular markdown with pandoc's
extensions for math (`$E=mc^2$`), citations (`[@key]`), figures and
tables.

## Usage

```ts
import { renderTex } from 'texdown';

const tex = renderTex(srcMarkdown, {
  template: 'arxiv-two-column',  // default
  output: 'paper.tex',           // optional: write to disk
});
```

`pdflatex paper.tex` (or `latexmk -pdf paper.tex`) compiles to PDF.
The `arxiv-two-column` template uses `natbib`; make sure the
bibliography file declared in front-matter is reachable from where
you run `pdflatex`.

## Templates

- `arxiv-two-column` — port of
  [myst-templates/arxiv_two_column](https://github.com/myst-templates/arxiv_two_column).
  Two-column preprint with title / authors / abstract / keywords
  spanning the page width and body content in two columns.

Custom templates are functions of `(meta, body, abstract) => string`
— register your own and pass it as `template`.

## Status

Early. Today: front-matter / authors / abstract / sections / math /
citations / lists / inline figures / tables. Tomorrow: `pandoc-crossref`
integration for `[@sec:foo]` cross-references, more templates, math
to docx via markdsl/docx for editor-friendly review copies.
