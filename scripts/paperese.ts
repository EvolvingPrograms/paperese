#!/usr/bin/env node
// CLI: read a markdown source, render to LaTeX via the paperese
// pipeline (front-matter + pandoc + template), write the result.
//
// Output path precedence (highest first):
//   1. --output <path>  / -o <path>      (CLI flag, resolved against CWD)
//   2. front-matter `output:`             (absolute as-is, relative resolved against input dir)
//   3. <input-basename>.tex next to the input file
//
// Usage:
//   paperese paper.md                                  # writes paper.tex
//   paperese paper.md -o out.tex                       # explicit output
//   paperese paper.md --template arxiv-two-column     # explicit template (default)
//   paperese paper.md --schema                         # dump schema/values, no render
//   echo $body | paperese -                            # read source from stdin

import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { renderTex } from '@/render';
import { renderDocx } from '@/docx';
import { builtInTemplates } from '@/templates';

import {
  splitFrontMatter,
  mergeValues,
  schemaDefaults,
  missingRequired,
  type Values,
} from 'markdsl';
import type { TexFrontMatter } from '@/types';

type Format = 'tex' | 'docx';

interface ParsedArgs {
  inputFile: string | null;
  readFromStdin: boolean;
  output: string | null;
  template: string;
  format: Format;
  schemaOnly: boolean;
}

function printUsage(): void {
  const tmpl = Object.keys(builtInTemplates).join(' | ');
  console.error(`Usage: paperese <input.md> [-o <out>] [--format tex|docx] [--template ${tmpl}] [--schema]
Default format is 'tex'. Pass '-' for input.md to read the source from stdin.`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    inputFile: null,
    readFromStdin: false,
    output: null,
    template: 'arxiv-two-column',
    format: 'tex',
    schemaOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-o' || a === '--output') { out.output = argv[++i] ?? null; continue; }
    if (a === '--template')             { out.template = argv[++i] ?? out.template; continue; }
    if (a === '--format' || a === '-f') {
      const fmt = argv[++i];
      if (fmt !== 'tex' && fmt !== 'docx') {
        console.error(`Unknown format '${fmt}'. Use 'tex' or 'docx'.`);
        process.exit(1);
      }
      out.format = fmt;
      continue;
    }
    if (a === '--schema')               { out.schemaOnly = true; continue; }
    if (a === '-h' || a === '--help')   { printUsage(); process.exit(0); }
    if (a === '-')                      { out.readFromStdin = true; continue; }
    if (!out.inputFile)                 { out.inputFile = a; continue; }
    console.error(`Unexpected argument: ${a}`);
    printUsage();
    process.exit(1);
  }
  return out;
}

function readStdinSync(): string {
  // Synchronous stdin read — works under `cmd | paperese -` on Node/Bun.
  const fd = 0;
  const chunks: Buffer[] = [];
  const buf = Buffer.alloc(65536);
  let n: number;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

const args = parseArgs(process.argv.slice(2));
if (!args.inputFile && !args.readFromStdin) { printUsage(); process.exit(1); }

const src = args.readFromStdin
  ? readStdinSync()
  : fs.readFileSync(path.resolve(args.inputFile!), 'utf8');

if (!builtInTemplates[args.template]) {
  console.error(`Unknown template '${args.template}'. Built-ins: ${Object.keys(builtInTemplates).join(', ')}`);
  process.exit(1);
}

if (args.schemaOnly) {
  // Show the user what the template expects — front-matter `schema:`,
  // resolved values, and the list of unsupplied required keys. Useful
  // for batching value-collection questions.
  const { meta } = splitFrontMatter<TexFrontMatter>(src);
  const schema = meta.schema;
  const merged = mergeValues(
    schemaDefaults(schema),
    meta.values as Values | undefined,
  );
  const dump = {
    title: meta.title,
    template: args.template,
    schema: schema ?? {},
    values: merged,
    missing: missingRequired(merged, schema),
  };
  process.stdout.write(yaml.dump(dump, { lineWidth: -1 }));
  process.exit(0);
}

// Resolve output path: CLI flag > front-matter `output:` > <input>.<ext>.
// `output:` in front-matter is .tex-flavored; for docx we swap the
// extension so the same source can target both.
const { meta } = splitFrontMatter<TexFrontMatter>(src);
const ext = args.format === 'docx' ? 'docx' : 'tex';
let outputPath: string;
if (args.output) {
  outputPath = path.resolve(args.output);
} else if (meta.output) {
  const inputDir = args.inputFile
    ? path.dirname(path.resolve(args.inputFile))
    : process.cwd();
  const fmAbs = path.isAbsolute(meta.output)
    ? meta.output
    : path.resolve(inputDir, meta.output);
  // Swap the front-matter extension to match the requested format.
  outputPath = fmAbs.replace(/\.\w+$/, `.${ext}`);
} else if (args.inputFile) {
  const { dir, name } = path.parse(path.resolve(args.inputFile));
  outputPath = path.join(dir, `${name}.${ext}`);
} else if (args.format === 'tex') {
  // stdin + no `output:` + no -o + tex → emit to stdout.
  process.stdout.write(renderTex(src, { template: args.template as never }));
  process.exit(0);
} else {
  // docx is binary; refuse to spew on stdout without an explicit path.
  console.error('docx output requires an explicit -o or front-matter `output:`.');
  process.exit(1);
}

const baseDir = args.inputFile
  ? path.dirname(path.resolve(args.inputFile))
  : process.cwd();

if (args.format === 'docx') {
  await renderDocx(src, { output: outputPath, baseDir });
} else {
  renderTex(src, {
    template: args.template as never,
    output: outputPath,
    baseDir,
  });
}

console.log(outputPath);
