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
      'Pluma en grilla 2D ortográfica desde public/logo.svg: 96×106 celdas, puntos blancos #e8e6e1 visibles, animación por scroll. Panel derecho del hero.',
    usedOn: '/',
  },
];

export const generatedAssets: SiteAsset[] = [];
