// pt (Português) translations are drafted below but not wired into routing
// yet — re-add 'pt' here (and to astro.config.mjs's i18n.locales) to bring
// the /pt/ routes back once that's ready to ship.
export const locales = ['es', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

export const localeLabels: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

type LineContent = {
  tagline: string;
  summary: string;
  points: string[];
};

type Translation = {
  meta: {
    description: string;
  };
  nav: {
    grupo: string;
    lineas: string;
    oficio: string;
    contacto: string;
    inicio: string;
    cta: string;
    openMenu: string;
    closeMenu: string;
    menuLabel: string;
    menuAriaLabel: string;
    fullMenuAriaLabel: string;
    linesAriaLabel: string;
    consultas: string;
    language: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    cta: string;
  };
  grupo: {
    tagline: string;
    eyebrow: string;
    title: string;
    body: string[];
  };
  lineasSection: {
    eyebrow: string;
    ariaLabel: string;
    prev: string;
    next: string;
    dotAriaLabel: (code: string) => string;
  };
  lineas: Record<'hosting' | 'series' | 'atelier' | 'voices', LineContent>;
  oficio: {
    eyebrow: string;
    title: string;
    lead: string;
    crafts: { title: string; copy: string }[];
  };
  contacto: {
    eyebrow: string;
    title: string;
    lead: string;
  };
  footer: {
    productos: string;
    grupo: string;
    sobreNosotros: string;
    contacto: string;
    privacidad: string;
    copyright: (year: number) => string;
  };
  privacidad: {
    title: string;
    lead: string;
    scrollCue: string;
    section1Title: string;
    section1Body: string;
    section2Title: string;
    section2Body1: string;
    section2Body2: string;
    section2LinkText: string;
    section3Title: string;
    section3Body: string;
    updated: (date: string) => string;
    updatedDate: string;
  };
};

export const translations: Record<Locale, Translation> = {
  es: {
    meta: {
      description: 'DF Hosting, DF Series, DF Atelier, DF Voices.',
    },
    nav: {
      grupo: 'Grupo',
      lineas: 'Líneas',
      oficio: 'Oficio',
      contacto: 'Contacto',
      inicio: 'Inicio',
      cta: 'Empezar proyecto',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      menuLabel: 'Menú',
      menuAriaLabel: 'Menú de navegación',
      fullMenuAriaLabel: 'Menú completo',
      linesAriaLabel: 'Líneas del grupo',
      consultas: 'Consultas',
      language: 'Idioma',
    },
    hero: {
      eyebrow: 'Dark Feather Group',
      titleLine1: 'Diseñado para',
      titleLine2: 'significar algo.',
      lead: 'Cuatro líneas, un mismo oficio. Estudio creativo noir — hosting, series, taller y voces bajo una sola pluma.',
      cta: 'Empezar proyecto',
    },
    grupo: {
      tagline: 'Sombra·Oficio·Presencia',
      eyebrow: 'Grupo',
      title: 'El colectivo detrás de la pluma.',
      body: [
        'Trabajamos a contraluz: menos ruido, más atmósfera. Identidad, desarrollo web, arte y sonido — bajo una sola dirección, no como cuatro proveedores sueltos con el mismo logo.',
        'No somos una fábrica de plantillas ni un pitch deck con métricas infladas. Somos cuatro líneas — hosting, series, taller y voces — con el mismo idioma visual y el mismo criterio editorial.',
        'Un proyecto de Dark Feather se nota antes de leer el nombre: una marca que parece habitada, una serie que respira en capítulos, un sitio que no huele a plantilla. Ese es el oficio completo.',
      ],
    },
    lineasSection: {
      eyebrow: 'Líneas',
      ariaLabel: 'Líneas del grupo',
      prev: 'Anterior',
      next: 'Siguiente',
      dotAriaLabel: (code) => `Ir a ${code}`,
    },
    lineas: {
      hosting: {
        tagline: 'Infraestructura con carácter.',
        summary:
          'Entornos listos para lanzar sin diluir la identidad. Hosting pensado para estudios, productos y experiencias que necesitan presencia estable.',
        points: [
          'Despliegues limpios para sitios y apps del universo DF',
          'Entornos de preview para revisar antes de publicar',
          'Soporte cercano, sin soporte-call-center genérico',
        ],
      },
      series: {
        tagline: 'Narrativas en capítulos.',
        summary:
          'Formatos seriales para marcas y universos propios: capítulos, temporadas y piezas que se leen como una historia, no como un feed.',
        points: [
          'Arcos editoriales y ritmos de publicación',
          'Identidad visual consistente entre episodios',
          'Web, motion y piezas asociadas al relato',
        ],
      },
      atelier: {
        tagline: 'El taller creativo del grupo.',
        summary:
          'Diseño, desarrollo, arte y producción bajo una sola luz. El núcleo donde se fabrica la atmósfera Dark Feather.',
        points: [
          'Identidad, interfaces y sistemas visuales',
          'Desarrollo web con Astro, React y WebGL cuando hace falta',
          'Dirección de arte y producción de punta a punta',
        ],
      },
      voices: {
        tagline: 'La atmósfera también se escucha.',
        summary:
          'Voces, sonido y presencia hablada para marcas, series y experiencias: locución, sound design y tono verbal.',
        points: [
          'Dirección de voz y tono de marca',
          'Piezas sonoras para web, series y campañas',
          'Integración con DF Series y DF Atelier',
        ],
      },
    },
    oficio: {
      eyebrow: 'Oficio',
      title: 'Oficio con atmósfera.',
      lead: 'Lo que hacemos cuando la pluma baja al papel — o al código.',
      crafts: [
        { title: 'Diseño', copy: 'Identidad, interfaces y sistemas con jerarquía cinematográfica.' },
        { title: 'Desarrollo', copy: 'Webs y experiencias: Astro, React, WebGL cuando la idea lo pide.' },
        { title: 'Arte', copy: 'Dirección de arte y motion que sostienen el mundo de la marca.' },
        { title: 'Producción', copy: 'De concepto a entrega, con ritmo de estudio.' },
      ],
    },
    contacto: {
      eyebrow: 'Contacto',
      title: 'Hablemos.',
      lead: 'Contanos qué línea te interesa y cómo suena el proyecto. Respondemos con criterio, no con un bot.',
    },
    footer: {
      productos: 'Productos',
      grupo: 'Grupo',
      sobreNosotros: 'Sobre Nosotros',
      contacto: 'Contacto',
      privacidad: 'Privacidad',
      copyright: (year) => `© ${year} Dark Feather Group`,
    },
    privacidad: {
      title: 'Privacidad',
      lead: 'Sin formularios, sin cookies, sin analítica. Lo único que sale de acá es una fuente tipográfica.',
      scrollCue: 'Bajar al contenido',
      section1Title: 'Qué guardamos',
      section1Body:
        'Nada de tu visita. El botón de contacto abre tu propio cliente de correo y ahí termina nuestra parte — el mensaje va directo a tu proveedor de email, nunca pasa por un servidor nuestro.',
      section2Title: 'Google Fonts',
      section2Body1:
        'Bricolage Grotesque e IBM Plex Sans vienen de Google Fonts. Para servirlas, tu navegador le pide la tipografía a',
      section2Body2:
        ', y en ese pedido va tu IP. Es el único dato que sale de este sitio hacia un tercero, y lo maneja Google — no nosotros. Está todo en su',
      section2LinkText: 'política de privacidad',
      section3Title: 'Contacto',
      section3Body: '¿Dudas sobre esto? Escribinos a',
      updated: (date) => `Última actualización: ${date}.`,
      updatedDate: 'agosto de 2026',
    },
  },
  en: {
    meta: {
      description: 'DF Hosting, DF Series, DF Atelier, DF Voices.',
    },
    nav: {
      grupo: 'Group',
      lineas: 'Lines',
      oficio: 'Craft',
      contacto: 'Contact',
      inicio: 'Home',
      cta: 'Start a project',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      menuLabel: 'Menu',
      menuAriaLabel: 'Navigation menu',
      fullMenuAriaLabel: 'Full menu',
      linesAriaLabel: 'Group lines',
      consultas: 'Inquiries',
      language: 'Language',
    },
    hero: {
      eyebrow: 'Dark Feather Group',
      titleLine1: 'Designed to',
      titleLine2: 'mean something.',
      lead: 'Four lines, one craft. Noir creative studio — hosting, series, atelier and voices under a single feather.',
      cta: 'Start a project',
    },
    grupo: {
      tagline: 'Shadow·Craft·Presence',
      eyebrow: 'Group',
      title: 'The collective behind the feather.',
      body: [
        "We work against the light: less noise, more atmosphere. Identity, web development, art and sound — under one direction, not as four loose vendors sharing a logo.",
        "We're not a template factory or a pitch deck with inflated metrics. We're four lines — hosting, series, atelier and voices — sharing one visual language and one editorial standard.",
        'A Dark Feather project shows before you read the name: a brand that feels inhabited, a series that breathes in chapters, a site that never smells like a template. That\'s the full craft.',
      ],
    },
    lineasSection: {
      eyebrow: 'Lines',
      ariaLabel: 'Group lines',
      prev: 'Previous',
      next: 'Next',
      dotAriaLabel: (code) => `Go to ${code}`,
    },
    lineas: {
      hosting: {
        tagline: 'Infrastructure with character.',
        summary:
          'Environments ready to launch without diluting identity. Hosting built for studios, products and experiences that need a stable presence.',
        points: [
          'Clean deploys for sites and apps across the DF universe',
          'Preview environments to review before publishing',
          'Close support — no generic call-center support',
        ],
      },
      series: {
        tagline: 'Narratives in chapters.',
        summary:
          'Serial formats for brands and worlds of their own: chapters, seasons and pieces that read like a story, not a feed.',
        points: [
          'Editorial arcs and publishing rhythms',
          'Consistent visual identity across episodes',
          'Web, motion and pieces tied to the story',
        ],
      },
      atelier: {
        tagline: "The group's creative workshop.",
        summary:
          'Design, development, art and production under one light. The core where the Dark Feather atmosphere gets made.',
        points: [
          'Identity, interfaces and visual systems',
          'Web development with Astro, React and WebGL when it calls for it',
          'Art direction and production, start to finish',
        ],
      },
      voices: {
        tagline: 'Atmosphere you can also hear.',
        summary:
          'Voices, sound and spoken presence for brands, series and experiences: voiceover, sound design and verbal tone.',
        points: [
          'Voice direction and brand tone',
          'Sound pieces for web, series and campaigns',
          'Integration with DF Series and DF Atelier',
        ],
      },
    },
    oficio: {
      eyebrow: 'Craft',
      title: 'Craft with atmosphere.',
      lead: 'What we do when the feather comes down to paper — or to code.',
      crafts: [
        { title: 'Design', copy: 'Identity, interfaces and systems with cinematic hierarchy.' },
        { title: 'Development', copy: 'Sites and experiences: Astro, React, WebGL when the idea calls for it.' },
        { title: 'Art', copy: 'Art direction and motion that hold up the brand\'s world.' },
        { title: 'Production', copy: 'From concept to delivery, at studio pace.' },
      ],
    },
    contacto: {
      eyebrow: 'Contact',
      title: "Let's talk.",
      lead: "Tell us which line you're into and how the project sounds. We reply with judgment, not a bot.",
    },
    footer: {
      productos: 'Products',
      grupo: 'Group',
      sobreNosotros: 'About Us',
      contacto: 'Contact',
      privacidad: 'Privacy',
      copyright: (year) => `© ${year} Dark Feather Group`,
    },
    privacidad: {
      title: 'Privacy',
      lead: 'No forms, no cookies, no analytics. The only thing that leaves here is a typeface.',
      scrollCue: 'Scroll to content',
      section1Title: 'What we keep',
      section1Body:
        "Nothing from your visit. The contact button opens your own email client, and that's where our part ends — the message goes straight to your email provider, never through a server of ours.",
      section2Title: 'Google Fonts',
      section2Body1:
        'Bricolage Grotesque and IBM Plex Sans come from Google Fonts. To serve them, your browser requests the typeface from',
      section2Body2:
        ", and your IP goes along with that request. It's the only data that leaves this site to a third party, and Google handles it — not us. It's all in their",
      section2LinkText: 'privacy policy',
      section3Title: 'Contact',
      section3Body: 'Questions about this? Write to us at',
      updated: (date) => `Last updated: ${date}.`,
      updatedDate: 'August 2026',
    },
  },
};

export function getTranslations(locale: Locale): Translation {
  return translations[locale];
}

export function localizedPath(locale: Locale, path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${locale}${cleanPath ? `/${cleanPath}` : ''}`;
}
