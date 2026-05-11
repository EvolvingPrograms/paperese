import { describe, expect, test } from 'bun:test';
import { longtableToTable } from '../src/longtable-fix';

describe('longtableToTable', () => {
  test('rewrites simple longtable to table+tabular', () => {
    const input = `\\begin{longtable}[]{@{}llll@{}}
\\toprule\\noalign{}
A & B & C & D \\\\
\\midrule\\noalign{}
\\endhead
1 & 2 & 3 & 4 \\\\
\\bottomrule\\noalign{}
\\endlastfoot
\\end{longtable}`;
    const out = longtableToTable(input);
    expect(out).toContain('\\begin{table}[H]');
    expect(out).toContain('\\begin{tabular}{@{}llll@{}}');
    expect(out).not.toContain('longtable');
    expect(out).not.toContain('\\endhead');
  });

  test('handles deeply nested braces in column spec', () => {
    const input = `\\begin{longtable}[]{@{}
  >{\\raggedright\\arraybackslash}p{(\\linewidth - 6\\tabcolsep) * \\real{0.2500}}
  >{\\raggedleft\\arraybackslash}p{(\\linewidth - 6\\tabcolsep) * \\real{0.2500}}@{}}
\\toprule\\noalign{}
A & B \\\\
\\midrule\\noalign{}
\\endhead
1 & 2 \\\\
\\bottomrule\\noalign{}
\\endlastfoot
\\end{longtable}`;
    const out = longtableToTable(input);
    expect(out).toContain('\\begin{tabular}{@{}');
    expect(out).toContain('\\real{0.2500}');
    expect(out).not.toContain('\\begin{longtable}');
    expect(out).not.toContain('\\end{longtable}');
  });

  test('hoists caption above tabular', () => {
    const input = `\\begin{longtable}[]{@{}ll@{}}
\\caption{My table}\\label{tab:x}\\tabularnewline
\\toprule\\noalign{}
A & B \\\\
\\midrule\\noalign{}
\\endhead
1 & 2 \\\\
\\bottomrule\\noalign{}
\\endlastfoot
\\end{longtable}`;
    const out = longtableToTable(input);
    const capIdx = out.indexOf('\\caption{My table}');
    const tabIdx = out.indexOf('\\begin{tabular}');
    expect(capIdx).toBeGreaterThan(-1);
    expect(tabIdx).toBeGreaterThan(capIdx);
    expect(out).toContain('\\label{tab:x}');
  });
});
