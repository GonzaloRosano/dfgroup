export type DfLine = {
  slug: 'hosting' | 'series' | 'atelier' | 'voices';
  code: string;
  full: string;
  tagline: string;
  summary: string;
  points: string[];
};

export const lines: DfLine[] = [
  {
    slug: 'hosting',
    code: 'DF Hosting',
    full: 'Dark Feather Hosting',
    tagline: 'Infraestructura con carácter.',
    summary:
      'Entornos listos para lanzar sin diluir la identidad. Hosting pensado para estudios, productos y experiencias que necesitan presencia estable.',
    points: [
      'Despliegues limpios para sitios y apps del universo DF',
      'Entornos de preview para revisar antes de publicar',
      'Soporte cercano, sin soporte-call-center genérico',
    ],
  },
  {
    slug: 'series',
    code: 'DF Series',
    full: 'Dark Feather Series',
    tagline: 'Narrativas en capítulos.',
    summary:
      'Formatos seriales para marcas y universos propios: capítulos, temporadas y piezas que se leen como una historia, no como un feed.',
    points: [
      'Arcos editoriales y ritmos de publicación',
      'Identidad visual consistente entre episodios',
      'Web, motion y piezas asociadas al relato',
    ],
  },
  {
    slug: 'atelier',
    code: 'DF Atelier',
    full: 'Dark Feather Atelier',
    tagline: 'El taller creativo del grupo.',
    summary:
      'Diseño, desarrollo, arte y producción bajo una sola luz. El núcleo donde se fabrica la atmósfera Dark Feather.',
    points: [
      'Identidad, interfaces y sistemas visuales',
      'Desarrollo web con Astro, React y WebGL cuando hace falta',
      'Dirección de arte y producción de punta a punta',
    ],
  },
  {
    slug: 'voices',
    code: 'DF Voices',
    full: 'Dark Feather Voices',
    tagline: 'La atmósfera también se escucha.',
    summary:
      'Voces, sonido y presencia hablada para marcas, series y experiencias: locución, sound design y tono verbal.',
    points: [
      'Dirección de voz y tono de marca',
      'Piezas sonoras para web, series y campañas',
      'Integración con DF Series y DF Atelier',
    ],
  },
];

export function getLine(slug: string): DfLine | undefined {
  return lines.find((line) => line.slug === slug);
}
