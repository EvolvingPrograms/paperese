// Template registry. Each template takes the parsed front-matter +
// the pandoc-rendered body LaTeX and returns the full `.tex` source.

import type { TexTemplate } from '../types';

export { arxivTwoColumn } from './arxiv-two-column';
import { arxivTwoColumn } from './arxiv-two-column';

export const builtInTemplates: Record<string, TexTemplate> = {
  'arxiv-two-column': arxivTwoColumn,
};
