// Public surface for paperese. Two render targets:
//   * renderTex (default) — Markdown → publication-ready .tex,
//     compiled with `latexmk -pdf`.
//   * renderDocx           — Markdown → .docx Buffer for editor-
//     friendly review copies (single-column, front-matter
//     preamble, citeproc-resolved citations).
// Both built on markdsl + a system pandoc.

export * from './types';
export * from './render';
export * from './docx';
export * from './pandoc';
export * from './templates';
