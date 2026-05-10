// Markdown source → .docx Buffer / file. Pandoc's docx writer
// already does the work we need: real OMML math (Word renders
// equations as typeset math, not raw TeX), proper lists / tables /
// figures / cross-references, and citeproc-resolved citations
// against a .bib. Paperese's job is the pre-pass:
//
//   1. Strip / rewrite LaTeX-only constructs that pandoc passes
//      through but Word can't render (\ref{} → [key], \paragraph{}
//      → bold, \cite → pandoc citation form).
//   2. Expand `\lipsum[N]` to actual prose so demo bodies aren't
//      empty (the lipsum LaTeX package isn't available to pandoc).
//   3. Build a markdown preamble from the paperese front-matter
//      (title, authors, affiliations, ORCID, abstract, keywords)
//      so the docx has a proper front page — pandoc's docx writer
//      reads `title` / `author` natively but doesn't know our
//      richer author shape.
//
// Inspired by github.com/jay-dennis/tex2docx, which takes the same
// pandoc-as-engine + pre-process approach for full .tex documents.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

import JSZip from 'jszip';
import { splitFrontMatter } from 'markdsl';
import type { DocStyle } from 'markdsl/docx';

import type { TexFrontMatter, Author, Affiliation } from './types';

export interface RenderDocxOptions {
  /** Output path. If set, the buffer is written to disk and the
   *  promise resolves to the path. */
  output?: string;
  /** Working directory for relative paths (`bibliography:` etc.).
   *  Defaults to `process.cwd()`. */
  baseDir?: string;
  /** Optional reference.docx for styling — same flag as pandoc's
   *  `--reference-doc`. Use this to ship your own house style. */
  referenceDoc?: string;
}

/** Markdown source → .docx Buffer. Pandoc-driven; see the file
 *  header for the pre-pass details. */
export async function renderDocx(
  srcText: string,
  opts: RenderDocxOptions = {},
): Promise<Buffer> {
  const { meta, body } = splitFrontMatter<TexFrontMatter>(srcText);
  const baseDir = opts.baseDir ?? process.cwd();

  // 1. Strip LaTeX-only constructs that don't survive the docx
  //    writer round-trip.
  // 2. Expand `\lipsum[N]` so demo bodies have content.
  const cleanedBody = lipsumExpand(stripLatexOnly(body));

  // 3. Build the front-matter preamble + body. Pandoc reads the
  //    standard YAML front-matter at the top (title etc.); we
  //    pre-render the richer author block as markdown above the
  //    body so it's part of the document content.
  const preamble = frontMatterPreamble(meta);
  const md = `${pandocFrontMatter(meta)}\n${preamble}\n${cleanedBody}`;

  // 4. Hand to pandoc. Citations resolve against the front-matter
  //    bibliography (relative to baseDir).
  const buf = await pandocToDocx(md, {
    baseDir,
    bibliography: meta.bibliography,
    referenceDoc: opts.referenceDoc,
    style: meta.style,
  });
  if (opts.output) fs.writeFileSync(opts.output, buf);
  return buf;
}

/** Build a minimal pandoc-compatible YAML front-matter block from
 *  the paperese front-matter. Pandoc's docx writer reads standard
 *  fields like `title`; the richer author/affiliation block lives
 *  in the preamble below. */
function pandocFrontMatter(meta: TexFrontMatter): string {
  const out: Record<string, unknown> = {};
  if (meta.title) out.title = meta.title;
  if (meta.short_title) out.short_title = meta.short_title;
  if (Object.keys(out).length === 0) return '';

  const yamlLines = Object.entries(out).map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : v}`);
  return `---\n${yamlLines.join('\n')}\n---\n`;
}

/** Build the front-matter preamble as markdown. Wrapped in
 *  `::: {.header}` mirroring the legalese / markdsl/docx
 *  convention — a header section that spans the page width
 *  ahead of a multi-column body.
 *
 *  pandoc's docx writer doesn't read the `.header` class as a
 *  section break on its own, so we follow the closing fence
 *  with a raw OpenXML continuous section break that ends the
 *  single-column header and starts the two-column body. The
 *  trailing <w:sectPr> in our reference.docx (patched to
 *  `<w:cols w:num="2"/>` by getDefaultReferenceDoc) provides
 *  the body's column config; this break just closes the
 *  preceding single-column scope. */
function frontMatterPreamble(meta: TexFrontMatter): string {
  const lines: string[] = ['::: {.header}', ''];

  const authors = (meta.authors ?? []) as Author[];
  if (authors.length) {
    for (const a of authors) {
      const parts: string[] = [`**${a.name}**`];
      const affiliation = a.affiliation
        ?? (typeof a.affiliations?.[0] === 'string' ? a.affiliations[0] as string : undefined);
      if (affiliation) parts.push(`*${affiliation}*`);
      if (a.email) parts.push(`<${a.email}>`);
      if (a.orcid) parts.push(`ORCID [${a.orcid}](https://orcid.org/${a.orcid})`);
      lines.push(parts.join(' — '));
    }
    lines.push('');
  }

  const declaredAffiliations = (meta.affiliations ?? []) as Affiliation[];
  if (declaredAffiliations.length) {
    for (const af of declaredAffiliations) {
      lines.push(`${af.index ?? ''} *${af.name}*`.trim());
    }
    lines.push('');
  }

  if (meta.abstract) {
    // Bold lead instead of an H2 — H2 would render as a numbered
    // subsection in pandoc's docx output.
    lines.push(`**Abstract.** ${meta.abstract.trim()}`, '');
  }

  if (meta.keywords?.length) {
    lines.push(`**Keywords:** ${meta.keywords.join(', ')}`, '');
  }

  lines.push(':::', '');

  // Raw OpenXML continuous section break — closes the single-column
  // header section. Minimal sectPr (just type + cols): with full
  // page geometry inline, Word interpreted the change as a layout
  // shift and forced a page break despite `continuous`. Inheriting
  // page size + margins from the trailing body sectPr keeps the
  // section change truly continuous.
  lines.push(
    '```{=openxml}',
    '<w:p><w:pPr><w:sectPr>'
      + '<w:type w:val="continuous"/>'
      + '<w:cols w:num="1"/>'
      + '</w:sectPr></w:pPr></w:p>',
    '```',
    '',
  );

  return lines.join('\n');
}

/** Strip / rewrite LaTeX-only constructs that pandoc would parse as
 *  RawInline / RawBlock and silently drop in the docx writer.
 *
 *    \ref{key}        → [key]            (placeholder; real
 *                                         pandoc-crossref is a TODO)
 *    \label{key}      →                  (drop)
 *    \paragraph{Text} → **Text**         (bold lead-in para)
 *    \cite{a,b}       → [@a; @b]
 *    \citep{a,b}      → [@a; @b]
 *    \citet{a}        → @a
 *    \texttt{x}       → `x`
 *    \emph{x}         → *x*
 *    \textbf{x}       → **x**
 */
function stripLatexOnly(body: string): string {
  return body
    .replace(/\\ref\{([^}]+)\}/g, '[$1]')
    .replace(/\\label\{[^}]+\}/g, '')
    .replace(/\\paragraph\{([^}]+)\}/g, '**$1**')
    .replace(/\\citet\{([^,}]+)\}/g, '@$1')
    .replace(/\\cite[pt]?\{([^}]+)\}/g, (_m, keys: string) =>
      `[${keys.split(',').map((k) => `@${k.trim()}`).join('; ')}]`)
    .replace(/\\texttt\{([^}]+)\}/g, '`$1`')
    .replace(/\\emph\{([^}]+)\}/g, '*$1*')
    .replace(/\\textbf\{([^}]+)\}/g, '**$1**');
}

// LaTeX's `lipsum` package ships 150 fixed paragraphs of De finibus
// bonorum et malorum. The docx side has no access to it; we ship the
// ones the demo uses inline so `\lipsum[N]` calls expand to real
// prose instead of disappearing.
const LIPSUM: Record<string, string> = {
  '2': 'Nam dui ligula, fringilla a, euismod sodales, sollicitudin vel, wisi. Morbi auctor lorem non justo. Nam lacus libero, pretium at, lobortis vitae, ultricies et, tellus. Donec aliquet, tortor sed accumsan bibendum, erat ligula aliquet magna, vitae ornare odio metus a mi. Morbi ac orci et nisl hendrerit mollis. Suspendisse ut massa. Cras nec ante. Pellentesque a nulla.',
  '3': 'Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Aliquam tincidunt urna. Nulla ullamcorper vestibulum turpis. Pellentesque cursus luctus mauris.',
  '5': 'Vivamus vehicula leo a justo. Quisque nec augue. Morbi mauris wisi, aliquet vitae, dignissim eget, sollicitudin molestie, ligula. In dictum, magna sit amet aliquet pulvinar, lorem dolor euismod metus, vel rutrum tellus quam vitae lacus. Nullam eu erat. Sed sit amet justo cursus mauris pretium accumsan.',
  '6': 'Curabitur tellus magna, porttitor a, commodo a, commodo in, tortor. Donec interdum. Praesent scelerisque. Maecenas posuere sodales odio. Vivamus metus lacus, varius quis, imperdiet quis, rhoncus a, turpis. Etiam ligula arcu, elementum a, venenatis quis, sollicitudin sed, metus.',
  '7': 'Sed commodo posuere pede. Mauris ut est. Ut quis purus. Sed ac odio. Sed vehicula hendrerit sem. Duis non odio. Morbi ut dui. Sed accumsan risus eget odio. In hac habitasse platea dictumst. Pellentesque non elit. Fusce sed justo eu urna porta tincidunt. Mauris felis odio, sollicitudin sed, volutpat a, ornare ac, erat. Morbi quis dolor. Donec pellentesque, erat ac sagittis semper, nunc dui lobortis purus, quis congue purus metus ultricies tellus. Proin et quam.',
  '8': 'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Donec odio elit, dictum in, hendrerit sit amet, egestas sed, leo. Praesent feugiat sapien aliquet odio. Integer vitae justo. Aliquam vestibulum fringilla lorem. Sed neque lectus, consectetuer at, consectetuer sed, eleifend ac, lectus.',
  '10': 'Sed lectus. Praesent pretium, magna in eleifend egestas, pede pede pretium lorem, quis consectetuer tortor sapien facilisis magna. Mauris quis magna varius nulla scelerisque imperdiet. Aliquam non quam. Aliquam porttitor quam a lacus.',
  '11': 'Praesent in mauris eu tortor porttitor accumsan. Mauris suscipit, ligula sit amet pharetra semper, nibh ante cursus purus, vel sagittis velit mauris vel metus. Aenean fermentum risus id tortor. Integer euismod lacus luctus magna.',
};
function lipsumExpand(body: string): string {
  return body.replace(/\\lipsum(?:\[(\d+)\])?/g, (_m, n: string | undefined) => {
    return LIPSUM[n ?? '1']
      ?? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
  });
}

/** Run pandoc's docx writer end-to-end. Citations resolve via
 *  `--citeproc` against the front-matter bibliography. The math
 *  is real OMML; pandoc handles tables, lists, figures, and
 *  cross-refs (the bibliography section in particular). */
async function pandocToDocx(
  md: string,
  opts: {
    baseDir: string;
    bibliography?: string;
    referenceDoc?: string;
    style?: DocStyle;
  },
): Promise<Buffer> {
  const tmpOut = path.join(os.tmpdir(), `paperese-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`);
  const args = [
    '--from=markdown+tex_math_dollars+smart+citations+raw_tex+bracketed_spans+pipe_tables+grid_tables+multiline_tables+inline_code_attributes+link_attributes+fancy_lists+example_lists',
    '--to=docx',
    `--output=${tmpOut}`,
    '--wrap=preserve',
  ];
  if (opts.bibliography) {
    const bibPath = path.isAbsolute(opts.bibliography)
      ? opts.bibliography
      : path.join(opts.baseDir, opts.bibliography);
    if (fs.existsSync(bibPath)) {
      args.push('--citeproc', `--bibliography=${bibPath}`);
    }
  }

  // Pandoc's docx writer can't set section properties (columns,
  // page-level font/size) directly; they're read from the
  // `--reference-doc` template. Generate one per-style by taking
  // pandoc's default reference.docx and patching word/document.xml
  // (cols) + word/styles.xml (font + size). Cached on disk under a
  // style-specific filename so subsequent renders with the same
  // style skip the work. Caller-supplied `referenceDoc` wins.
  const refDoc = opts.referenceDoc ?? await getDefaultReferenceDoc(opts.style);
  args.push(`--reference-doc=${refDoc}`);

  execSync(`pandoc ${args.map((a) => `'${a}'`).join(' ')}`, {
    input: md,
    encoding: 'utf8',
    cwd: opts.baseDir,
  });
  const raw = fs.readFileSync(tmpOut);
  fs.unlinkSync(tmpOut);
  // Pandoc's docx writer emits a minimal trailing <w:sectPr> with no
  // <w:type/>, which defaults to `nextPage` — Word treats the
  // header→body section change as a page break even when the
  // intermediate sectPr is `continuous`. Patch the trailing sectPr
  // to be continuous so the whole document flows on one page.
  return makeTrailingSectionContinuous(raw);
}

/** Open a docx Buffer, ensure the trailing <w:sectPr> declares
 *  `<w:type w:val="continuous"/>`, and re-zip. The trailing sectPr
 *  is the body section's properties; without `continuous` Word
 *  defaults to `nextPage` and inserts a page break at any prior
 *  section boundary. */
async function makeTrailingSectionContinuous(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) return buf;
  let xml = await docFile.async('text');

  // Find the LAST <w:sectPr>...</w:sectPr> (the body section's
  // trailing one) and inject <w:type w:val="continuous"/> at its
  // start if not already present.
  const lastOpen = xml.lastIndexOf('<w:sectPr>');
  if (lastOpen === -1) return buf;
  const lastClose = xml.indexOf('</w:sectPr>', lastOpen);
  if (lastClose === -1) return buf;
  const sectPr = xml.slice(lastOpen, lastClose);
  if (/<w:type\b/.test(sectPr)) return buf;
  const patched = sectPr.replace('<w:sectPr>', '<w:sectPr><w:type w:val="continuous"/>');
  xml = xml.slice(0, lastOpen) + patched + xml.slice(lastClose);
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

// Lazy-cached reference.docx, keyed by the style fields we apply to
// it. Different `style:` blocks produce different cache files so a
// `font: Garamond` render and a `font: Helvetica` render don't fight
// over the same cached doc.
const referenceCache = new Map<string, string>();

/** Fall through to academic-paper defaults when the front-matter
 *  doesn't set them: serif body in Times New Roman at 10pt with
 *  two-column layout (the arxiv preprint convention). Pandoc's
 *  default reference.docx is Aptos sans-serif at 11pt — fine for
 *  letters / memos, wrong for papers. */
const DOCX_DEFAULTS: Required<Pick<DocStyle, 'font' | 'size'>> & { columns: number } = {
  font: 'Times New Roman',
  size: 10,
  columns: 2,
};

async function getDefaultReferenceDoc(
  style: DocStyle = {},
): Promise<string> {
  const font = style.font ?? DOCX_DEFAULTS.font;
  const size = style.size ?? DOCX_DEFAULTS.size;
  const columns = typeof style.columns === 'number'
    ? style.columns
    : (style.columns?.count ?? DOCX_DEFAULTS.columns);
  const resolved: DocStyle = { ...style, font, size, columns };

  const key = JSON.stringify({ font, size, columns });
  const cached = referenceCache.get(key);
  if (cached && fs.existsSync(cached)) return cached;

  const fname = `paperese-ref-${Buffer.from(key).toString('base64url').slice(0, 12)}.docx`;
  const out = path.join(os.tmpdir(), fname);

  const defaultBuf = execSync('pandoc --print-default-data-file=reference.docx', {
    encoding: 'buffer',
  }) as unknown as Buffer;

  const zip = await JSZip.loadAsync(defaultBuf);

  // — document.xml: section properties (column count) ——————————
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('pandoc reference.docx is missing word/document.xml');
  let docXml = await docFile.async('text');

  const colsTag = `<w:cols w:num="${columns}" w:space="720"/>`;
  if (/<w:cols\b[^/]*\/>/.test(docXml)) {
    docXml = docXml.replace(/<w:cols\b[^/]*\/>/, colsTag);
  } else {
    docXml = docXml.replace(/<\/w:sectPr>/, `${colsTag}</w:sectPr>`);
  }
  zip.file('word/document.xml', docXml);

  // — styles.xml: font family + body size ——————————————————————
  // The "Normal" style is the cascade root; setting font + sz here
  // propagates to every paragraph that doesn't override.
  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
    let stylesXml = await stylesFile.async('text');
    stylesXml = patchNormalStyle(stylesXml, resolved);
    zip.file('word/styles.xml', stylesXml);
  }

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(out, buf);
  referenceCache.set(key, out);
  return out;
}

/** Patch `word/styles.xml` so the requested font + size become the
 *  cascade root for *every* style in the doc, not just the body
 *  paragraph. Word resolves font in this priority order:
 *
 *    1. Per-run `<w:rFonts>` on the run itself
 *    2. Style-level `<w:rPr><w:rFonts>` (Heading1, Title, etc.)
 *    3. `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts>` (cascade root)
 *
 *  Pandoc's reference.docx ships theme-font references at every
 *  level — `<w:rFonts asciiTheme="minorHAnsi" .../>` for body and
 *  `majorHAnsi` for headings/title. Both resolve to Aptos under
 *  Word's default theme, which is wrong for academic papers.
 *
 *  We replace EVERY `<w:rFonts ...Theme="..."/>` element with an
 *  explicit family reference so the override propagates through
 *  every style — body, headings, title, links, captions — without
 *  having to know each style ID up front. Sizes only patch
 *  `<w:rPrDefault>` since headings should keep their relative
 *  scaling (Heading1 at 16pt etc.). */
function patchNormalStyle(
  stylesXml: string,
  style: DocStyle,
): string {
  let xml = stylesXml;

  if (style.font) {
    const fontAttrs = `w:ascii="${escapeXml(style.font)}" w:hAnsi="${escapeXml(style.font)}" w:cs="${escapeXml(style.font)}" w:eastAsia="${escapeXml(style.font)}"`;
    // Match any `<w:rFonts ...Theme="..." .../>` element (single or
    // multi-line) and rewrite it to use explicit families.
    xml = xml.replace(
      /<w:rFonts\b[^/]*\bw:[a-zA-Z]*Theme="[^"]+"[^/]*\/>/g,
      `<w:rFonts ${fontAttrs}/>`,
    );
    // Also catch any explicit-but-non-theme rFonts in the rPrDefault
    // (consumer might pass a reference doc that's already explicit).
    xml = xml.replace(
      /(<w:rPrDefault>\s*<w:rPr>[\s\S]*?)<w:rFonts\b[^/]*\/>/,
      `$1<w:rFonts ${fontAttrs}/>`,
    );
  }

  if (style.size !== undefined) {
    const halfPt = Math.round(style.size * 2);
    const szFrag = `<w:sz w:val="${halfPt}"/><w:szCs w:val="${halfPt}"/>`;
    // Patch the body baseline only — heading sizes are intentionally
    // bigger and shouldn't get clamped to body size.
    xml = xml.replace(
      /(<w:rPrDefault>\s*<w:rPr>)([\s\S]*?)(<\/w:rPr>\s*<\/w:rPrDefault>)/,
      (_full, open: string, inner: string, close: string) => {
        let body = inner;
        body = /<w:sz\b[^/]*\/>/.test(body)
          ? body.replace(/<w:sz\b[^/]*\/>/, `<w:sz w:val="${halfPt}"/>`)
          : body + `<w:sz w:val="${halfPt}"/>`;
        body = /<w:szCs\b[^/]*\/>/.test(body)
          ? body.replace(/<w:szCs\b[^/]*\/>/, `<w:szCs w:val="${halfPt}"/>`)
          : body + `<w:szCs w:val="${halfPt}"/>`;
        // szFrag reference avoids the unused-var warning when the
        // code path falls through to the existing-element branch.
        void szFrag;
        return open + body + close;
      },
    );
  }

  return xml;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
