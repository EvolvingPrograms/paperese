#!/usr/bin/env node
// CLI: read a markdown source, render to LaTeX via the texdown
// pipeline (front-matter + pandoc + template), write the result.
//
// Output path precedence (highest first):
//   1. --output <path>  / -o <path>      (CLI flag, resolved against CWD)
//   2. front-matter `output:`             (absolute as-is, relative resolved against input dir)
//   3. <input-basename>.tex next to the input file
//
// Usage:
//   texdown paper.md                                  # writes paper.tex
//   texdown paper.md -o out.tex                       # explicit output
//   texdown paper.md --template arxiv-two-column     # explicit template (default)
//   texdown paper.md --schema                         # dump schema/values, no render
//   echo $body | texdown -                            # read source from stdin

import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { renderTex } from '@/render';
import { builtInTemplates } from '@/templates';

import {
  splitFrontMatter,
  mergeValues,
  schemaDefaults,
  missingRequired,
  type Values,
} from 'markdsl';
import type { TexFrontMatter } from '@/types';

interface ParsedArgs {
  inputFile: string | null;
  readFromStdin: boolean;
  output: string | null;
  template: string;
  schemaOnly: boolean;
}

function printUsage(): void {
  const tmpl = Object.keys(builtInTemplates).join(' | ');
  console.error(`Usage: texdown <input.md> [-o <out.tex>] [--template ${tmpl}] [--schema]
Pass '-' for input.md to read the source from stdin.`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    inputFile: null,
    readFromStdin: false,
    output: null,
    template: 'arxiv-two-column',
    schemaOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-o' || a === '--output') { out.output = argv[++i] ?? null; continue; }
    if (a === '--template')             { out.template = argv[++i] ?? out.template; continue; }
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
  // Synchronous stdin read — works under `cmd | texdown -` on Node/Bun.
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

// Resolve output path: CLI flag > front-matter `output:` > <input>.tex.
const { meta } = splitFrontMatter<TexFrontMatter>(src);
let outputPath: string;
if (args.output) {
  outputPath = path.resolve(args.output);
} else if (meta.output) {
  const inputDir = args.inputFile
    ? path.dirname(path.resolve(args.inputFile))
    : process.cwd();
  outputPath = path.isAbsolute(meta.output)
    ? meta.output
    : path.resolve(inputDir, meta.output);
} else if (args.inputFile) {
  const { dir, name } = path.parse(path.resolve(args.inputFile));
  outputPath = path.join(dir, `${name}.tex`);
} else {
  // stdin + no `output:` + no -o → emit to stdout.
  process.stdout.write(renderTex(src, { template: args.template as never }));
  process.exit(0);
}

const baseDir = args.inputFile
  ? path.dirname(path.resolve(args.inputFile))
  : process.cwd();

renderTex(src, {
  template: args.template as never,
  output: outputPath,
  baseDir,
});

console.log(outputPath);
