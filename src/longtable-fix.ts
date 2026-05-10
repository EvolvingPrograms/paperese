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

// colSpec allows one level of nested braces so pandoc's `{@{}llll@{}}` parses
// as a single group rather than terminating at the inner `}`.
const LONGTABLE_RE = /\\begin\{longtable\}(\[[^\]]*\])?(\{(?:[^{}]|\{[^{}]*\})*\})\s*([\s\S]*?)\\end\{longtable\}/g;

/** Rewrite every `\\begin{longtable}…\\end{longtable}` block in a
 *  pandoc-emitted LaTeX fragment to a column-fitting
 *  `\\begin{table}…\\begin{tabular}…\\end{tabular}\\end{table}` pair. */
export function longtableToTable(tex: string): string {
  return tex.replace(LONGTABLE_RE, (_full, _opt: string | undefined, colSpec: string, body: string) => {
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
  });
}
