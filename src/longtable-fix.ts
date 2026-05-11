// Pandoc's LaTeX writer always emits `\begin{longtable}` for
// tables. longtable is full-page-width and can't render inside a
// `\twocolumn` column — it errors out at compile time. Convert
// each longtable block to a column-fitting `\begin{table}` +
// `\begin{tabular}` pair instead. The transform is purely textual:
//
//   \begin{longtable}[]{@{}llll@{}}      →  \begin{table}[t]\centering\caption{...}\begin{tabular}{@{}llll@{}}
//   \caption{...}\tabularnewline
//   \toprule\noalign{}                   →  \toprule
//   ... header row ...
//   \midrule\noalign{}                   →  \midrule
//   \endfirsthead
//   ... duplicated header for page break ...
//   \endhead
//   \bottomrule\noalign{}                →  \bottomrule
//   \endlastfoot
//   ... body rows ...
//   \end{longtable}                      →  \end{tabular}\end{table}
//
// The duplicated header (between `\endfirsthead` and `\endhead`) and
// the firsthead/head/lastfoot directives are dropped — they're
// pagination machinery longtable needs, table+tabular doesn't.

const BEGIN = '\\begin{longtable}';
const END = '\\end{longtable}';

// Parse a balanced `{...}` group starting at `tex[start]` (which must be `{`).
// Returns the substring including the braces and the index just past it. Returns
// null if the braces don't balance. Handles arbitrary nesting — pandoc emits
// column specs like `p{(\linewidth - 6\tabcolsep) * \real{0.2500}}` with deep
// nesting that a fixed-depth regex can't capture.
function readBalancedBraces(tex: string, start: number): { text: string; end: number } | null {
  if (tex[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < tex.length; i++) {
    const c = tex[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { text: tex.slice(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

/** Rewrite every `\\begin{longtable}…\\end{longtable}` block in a
 *  pandoc-emitted LaTeX fragment to a column-fitting
 *  `\\begin{table}…\\begin{tabular}…\\end{tabular}\\end{table}` pair. */
export function longtableToTable(tex: string): string {
  let out = '';
  let cursor = 0;
  while (cursor < tex.length) {
    const beginIdx = tex.indexOf(BEGIN, cursor);
    if (beginIdx === -1) {
      out += tex.slice(cursor);
      break;
    }
    out += tex.slice(cursor, beginIdx);
    let i = beginIdx + BEGIN.length;

    // Optional `[...]` placement argument.
    if (tex[i] === '[') {
      const close = tex.indexOf(']', i);
      if (close === -1) { out += tex.slice(beginIdx); break; }
      i = close + 1;
    }

    // Balanced `{colSpec}` — may contain arbitrarily nested braces.
    const spec = readBalancedBraces(tex, i);
    if (!spec) { out += tex.slice(beginIdx); break; }
    const colSpec = spec.text;
    i = spec.end;

    // Skip leading whitespace before body.
    while (i < tex.length && /\s/.test(tex[i]!)) i++;

    const endIdx = tex.indexOf(END, i);
    if (endIdx === -1) { out += tex.slice(beginIdx); break; }
    let body = tex.slice(i, endIdx);
    cursor = endIdx + END.length;

    out += rewriteLongtable(colSpec, body);
  }
  return out;
}

function rewriteLongtable(colSpec: string, body: string): string {
    // Pull the optional \caption{...}\tabularnewline that pandoc
    // emits at the top of the longtable body and hoist it above
    // the tabular so it labels the float.
    let caption = '';
    body = body.replace(/^\s*\\caption\{([\s\S]*?)\}\s*(?:\\label\{([^}]*)\})?\s*\\tabularnewline\s*/, (_m, cap: string, lbl: string | undefined) => {
      caption = `\\caption{${cap}}` + (lbl ? `\\label{${lbl}}` : '');
      return '';
    });

    // Drop the longtable pagination machinery: \toprule\noalign,
    // \midrule\noalign, \bottomrule\noalign markers (keep the rules
    // themselves) and the \endfirsthead / \endhead / \endlastfoot
    // directives + the duplicate header block between them.
    body = body
      .replace(/\\noalign\{\}/g, '')
      // First strip the duplicate-header block when both bookends exist…
      .replace(/\\endfirsthead\s*[\s\S]*?\\endhead/g, '')
      // …then mop up any remaining standalone directives. Pandoc sometimes
      // emits just `\endhead` (or just `\endfirsthead`) with no matching
      // partner depending on caption / header shape, and any survivor will
      // pull longtable internals (\LT@echunk, \LT@max@sel) into a tabular
      // and break the build.
      .replace(/\\endfirsthead\b/g, '')
      .replace(/\\endhead\b/g, '')
      .replace(/\\endlastfoot\b/g, '');

    // After stripping pagination, longtable's `\bottomrule` sits BEFORE the
    // body rows (it lived in the foot block). Move it to the end so the
    // tabular renders header / rule / body / rule like a normal table.
    const hasBottom = /\\bottomrule/.test(body);
    if (hasBottom) {
      body = body.replace(/\\bottomrule\s*/g, '');
      body = body.replace(/\s*$/, '\n\\bottomrule\n');
    }

    return `\\begin{table}[t]\n\\centering\n${caption}\n\\begin{tabular}${colSpec}${body}\\end{tabular}\n\\end{table}`;
}
