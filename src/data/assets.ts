export type SiteAsset = {
  id: string;
  kind: 'brand' | 'procedural' | 'generated';
  label: string;
  path: string | null;
  description: string;
  usedOn: string;
  license?: string;
  licenseUrl?: string;
};

export const siteAssets: SiteAsset[] = [
  {
    id: 'logo',
    kind: 'brand',
    label: 'logo.svg',
    path: '/logo.svg',
    description: 'Marca de Dark Feather Group.',
    usedOn: '/',
  },
  {
    id: 'favicon',
    kind: 'brand',
    label: 'favicon.svg',
    path: '/favicon.svg',
    description: 'Icono del sitio.',
    usedOn: '/',
  },
  {
    id: 'dot-feather',
    kind: 'procedural',
    label: 'Pluma puntillista (WebGL)',
    path: null,
    description:
      'Grilla 2D ortográfica desde logo.svg con morph por sección: pluma, círculo, ola, línea. Animación scroll + hold/hover.',
    usedOn: '/',
  },
  {
    id: 'line-icons',
    kind: 'brand',
    label: 'public/icons/*.svg',
    path: '/icons/server.svg',
    description:
      'Siluetas SVG (server, series, paint, atelier-code, microphone) rasterizadas en la misma grilla que logo.svg para los iconos de #lineas.',
    usedOn: '/#lineas',
  },
];

export const generatedAssets: SiteAsset[] = [];
