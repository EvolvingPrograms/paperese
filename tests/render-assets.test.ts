import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import { assetPath } from '../src/assets';
import { runPandocLatex } from '../src/pandoc';

describe('bundled assets', () => {
  test('preprint.sty is shipped in assets/', () => {
    const p = assetPath('preprint.sty');
    expect(fs.existsSync(p)).toBe(true);
  });
});

describe('pandoc body output', () => {
  test('fenced code blocks render as verbatim, not Shaded/Highlighting', () => {
    const md = '```python\nprint("hi")\n```\n';
    const tex = runPandocLatex(md);
    expect(tex).not.toContain('\\begin{Shaded}');
    expect(tex).not.toContain('\\begin{Highlighting}');
    expect(tex).toContain('\\begin{verbatim}');
  });
});
