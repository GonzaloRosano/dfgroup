export type GeneratedStill = {
  kind: 'generated';
  id: string;
  src: string;
  alt: string;
  caption: string;
  usedOn: string | null;
};

export type ThirdPartyStill = {
  kind: 'third-party';
  id: string;
  src: string;
  alt: string;
  caption: string;
  usedOn: string | null;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
};

export type Still = GeneratedStill | ThirdPartyStill;

export const generatedStills: GeneratedStill[] = [
  {
    kind: 'generated',
    id: 'atelier-workbench',
    src: '/images/atelier-workbench.jpg',
    alt: 'Banco de trabajo en penumbra, con pluma negra, tinta y papel bajo una sola luz.',
    caption: 'Imagen generada',
    usedOn: '/atelier',
  },
  {
    kind: 'generated',
    id: 'hosting-servers',
    src: '/images/hosting-servers.jpg',
    alt: 'Pasillo oscuro de racks, con luces mínimas sobre el suelo negro.',
    caption: 'Imagen generada',
    usedOn: '/hosting',
  },
  {
    kind: 'generated',
    id: 'series-screening',
    src: '/images/series-screening.jpg',
    alt: 'Sala de proyección vacía, haz de luz sobre una pantalla en humo.',
    caption: 'Imagen generada',
    usedOn: '/series',
  },
  {
    kind: 'generated',
    id: 'voices-microphone',
    src: '/images/voices-microphone.jpg',
    alt: 'Micrófono de condensador en un estudio a oscuras, bajo un foco duro.',
    caption: 'Imagen generada',
    usedOn: '/voices',
  },
  {
    kind: 'generated',
    id: 'grupo-asphalt',
    src: '/images/grupo-asphalt.jpg',
    alt: 'Asfalto mojado de noche, con una pluma negra y el reflejo de un farol.',
    caption: 'Imagen generada',
    usedOn: '/',
  },
];


export const thirdPartyStills: ThirdPartyStill[] = [
  {
    kind: 'third-party',
    id: 'dark-town',
    src: '/images/credits/dark-town-cherednychenko.jpg',
    alt: 'Calle mojada de noche en Toronto, con siluetas cruzando bajo la lluvia.',
    caption: 'Imagen CC0 - Illia Cherednychenko',
    usedOn: '/grupo',
    author: 'Illia Cherednychenko',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.es',
    source: 'https://commons.wikimedia.org/wiki/File:Dark_town_(Unsplash).jpg',
  },
];

export const stills: Still[] = [...generatedStills, ...thirdPartyStills];

export function stillForPath(pathname: string): Still | undefined {
  const path = pathname.replace(/\/$/, '') || '/';
  return stills.find((still) => still.usedOn === path);
}
