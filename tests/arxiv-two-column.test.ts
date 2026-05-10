// Smoke test for the arxiv-two-column pipeline. Renders the example
// markdown source and asserts that the resulting .tex carries the
// structural pieces a reader would expect to compile.

import { test, expect, describe } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

import { renderTex } from '@/render';

const EXAMPLE_DIR = path.resolve(import.meta.dir, '..', 'examples/arxiv-two-column');
const SRC = fs.readFileSync(path.join(EXAMPLE_DIR, 'paper.md'), 'utf8');

describe('arxiv-two-column template', () => {
  const tex = renderTex(SRC);

  test('opens with twocolumn article class + arxiv preamble', () => {
    expect(tex).toContain('\\documentclass[twocolumn,switch]{article}');
    expect(tex).toContain('\\usepackage{preprint}');
    expect(tex).toContain('\\usepackage[numbers,square]{natbib}');
  });

  test('emits title from front-matter', () => {
    expect(tex).toContain('\\title{A Two Column Arxiv Template}');
  });

  test('emits author + affiliation block', () => {
    expect(tex).toContain('\\author');
    expect(tex).toContain('Brenhin Keller');
    expect(tex).toContain('\\affil[1]{Dartmouth College}');
  });

  test('wraps title + abstract in a twocolumnfalse spread', () => {
    expect(tex).toContain('\\twocolumn[\\begin{@twocolumnfalse}');
    expect(tex).toContain('\\maketitle');
    expect(tex).toContain('\\begin{abstract}');
    expect(tex).toContain('\\end{@twocolumnfalse}]');
  });

  test('emits keywords', () => {
    expect(tex).toContain('\\keywords{');
    expect(tex).toContain('tutorial');
  });

  test('section / subsection / subsubsection from markdown headings', () => {
    expect(tex).toContain('\\section{Introduction}');
    expect(tex).toContain('\\subsection{Headings: second level}');
    expect(tex).toContain('\\subsubsection{Headings: third level}');
  });

  test('display math equation is wrapped in a LaTeX math env', () => {
    // Pandoc emits `\[ ... \]` for `$$...$$` blocks by default.
    expect(tex).toMatch(/\\\[[\s\S]+\\frac\{[\s\S]+\\\]/);
  });

  test('inline math passes through', () => {
    // Pandoc's LaTeX writer emits `\(...\)` for inline math (the
    // canonical TeX form) rather than `$...$`. Either round-trips
    // through pdflatex; we just verify the source survived.
    expect(tex).toMatch(/\\\(E = mc\^2\\\)/);
  });

  test('citations use natbib citep', () => {
    // With --natbib, `[@key]` becomes `\citep{key}`.
    expect(tex).toContain('\\citep{');
    expect(tex).toMatch(/\\citep\{[^}]*kour2014real[^}]*\}/);
  });

  test('bibliography directive references the .bib', () => {
    expect(tex).toContain('\\bibliography{refs}');
  });

  test('document closes', () => {
    expect(tex).toContain('\\end{document}');
  });
});

describe('size comparison', () => {
  test('markdown source is shorter than the upstream LaTeX example', () => {
    const upstreamTexLines = 80; // approximate from main.tex (~2.2 KB)
    const mdLines = SRC.split('\n').length;
    // The markdown source should be meaningfully shorter than the
    // hand-written LaTeX example. Loose bound — failing this means
    // we've grown too much boilerplate.
    expect(mdLines).toBeLessThan(upstreamTexLines);
  });
});
