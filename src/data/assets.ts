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
    id: 'lattice',
    kind: 'procedural',
    label: 'Rejilla wire noir (WebGL)',
    path: null,
    description:
      'Malla 3D wire noir con pulso viajero, partículas ember, trazos de pluma, parallax y bloom sutil. Generada en tiempo real con Three.js, sin texturas.',
    usedOn: '/',
  },
];

export const generatedAssets: SiteAsset[] = [];
