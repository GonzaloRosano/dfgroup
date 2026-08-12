import { getTranslations, type Locale } from '../i18n/translations';

export type DfLine = {
  slug: 'hosting' | 'series' | 'atelier' | 'voices';
  code: string;
  full: string;
  tagline: string;
  summary: string;
  points: string[];
};

const lineStructure: { slug: DfLine['slug']; code: string; full: string }[] = [
  { slug: 'hosting', code: 'DF Hosting', full: 'Dark Feather Hosting' },
  { slug: 'series', code: 'DF Series', full: 'Dark Feather Series' },
  { slug: 'atelier', code: 'DF Atelier', full: 'Dark Feather Atelier' },
  { slug: 'voices', code: 'DF Voices', full: 'Dark Feather Voices' },
];

export function getLines(locale: Locale): DfLine[] {
  const t = getTranslations(locale);
  return lineStructure.map((line) => ({
    ...line,
    ...t.lineas[line.slug],
  }));
}

export function getLine(locale: Locale, slug: string): DfLine | undefined {
  return getLines(locale).find((line) => line.slug === slug);
}
