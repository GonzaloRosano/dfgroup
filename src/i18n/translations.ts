export const locales = ['es', 'en', 'pt'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

export const localeLabels: Record<Locale, string> = {
  es: 'ES',
  en: 'EN',
  pt: 'PT',
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
  pt: {
    meta: {
      description: 'DF Hosting, DF Series, DF Atelier, DF Voices.',
    },
    nav: {
      grupo: 'Grupo',
      lineas: 'Linhas',
      oficio: 'Ofício',
      contacto: 'Contato',
      inicio: 'Início',
      cta: 'Começar projeto',
      openMenu: 'Abrir menu',
      closeMenu: 'Fechar menu',
      menuLabel: 'Menu',
      menuAriaLabel: 'Menu de navegação',
      fullMenuAriaLabel: 'Menu completo',
      linesAriaLabel: 'Linhas do grupo',
      consultas: 'Consultas',
    },
    hero: {
      eyebrow: 'Dark Feather Group',
      titleLine1: 'Feito para',
      titleLine2: 'significar algo.',
      lead: 'Quatro linhas, um só ofício. Estúdio criativo noir — hosting, séries, ateliê e vozes sob uma única pena.',
      cta: 'Começar projeto',
    },
    grupo: {
      tagline: 'Sombra·Ofício·Presença',
      eyebrow: 'Grupo',
      title: 'O coletivo por trás da pena.',
      body: [
        'Trabalhamos a contraluz: menos ruído, mais atmosfera. Identidade, desenvolvimento web, arte e som — sob uma única direção, não como quatro fornecedores soltos com o mesmo logo.',
        'Não somos uma fábrica de templates nem um pitch deck com métricas infladas. Somos quatro linhas — hosting, séries, ateliê e vozes — com o mesmo idioma visual e o mesmo critério editorial.',
        'Um projeto Dark Feather se nota antes de ler o nome: uma marca que parece habitada, uma série que respira em capítulos, um site que não tem cara de template. Esse é o ofício completo.',
      ],
    },
    lineasSection: {
      eyebrow: 'Linhas',
      ariaLabel: 'Linhas do grupo',
      prev: 'Anterior',
      next: 'Próximo',
      dotAriaLabel: (code) => `Ir para ${code}`,
    },
    lineas: {
      hosting: {
        tagline: 'Infraestrutura com caráter.',
        summary:
          'Ambientes prontos para lançar sem diluir a identidade. Hosting pensado para estúdios, produtos e experiências que precisam de presença estável.',
        points: [
          'Deploys limpos para sites e apps do universo DF',
          'Ambientes de preview para revisar antes de publicar',
          'Suporte próximo, sem suporte de call center genérico',
        ],
      },
      series: {
        tagline: 'Narrativas em capítulos.',
        summary:
          'Formatos seriados para marcas e universos próprios: capítulos, temporadas e peças que se leem como uma história, não como um feed.',
        points: [
          'Arcos editoriais e ritmos de publicação',
          'Identidade visual consistente entre episódios',
          'Web, motion e peças associadas à narrativa',
        ],
      },
      atelier: {
        tagline: 'O ateliê criativo do grupo.',
        summary:
          'Design, desenvolvimento, arte e produção sob uma só luz. O núcleo onde se fabrica a atmosfera Dark Feather.',
        points: [
          'Identidade, interfaces e sistemas visuais',
          'Desenvolvimento web com Astro, React e WebGL quando é preciso',
          'Direção de arte e produção de ponta a ponta',
        ],
      },
      voices: {
        tagline: 'A atmosfera também se escuta.',
        summary:
          'Vozes, som e presença falada para marcas, séries e experiências: locução, sound design e tom verbal.',
        points: [
          'Direção de voz e tom de marca',
          'Peças sonoras para web, séries e campanhas',
          'Integração com DF Series e DF Atelier',
        ],
      },
    },
    oficio: {
      eyebrow: 'Ofício',
      title: 'Ofício com atmosfera.',
      lead: 'O que fazemos quando a pena desce ao papel — ou ao código.',
      crafts: [
        { title: 'Design', copy: 'Identidade, interfaces e sistemas com hierarquia cinematográfica.' },
        { title: 'Desenvolvimento', copy: 'Sites e experiências: Astro, React, WebGL quando a ideia pede.' },
        { title: 'Arte', copy: 'Direção de arte e motion que sustentam o mundo da marca.' },
        { title: 'Produção', copy: 'Do conceito à entrega, no ritmo de estúdio.' },
      ],
    },
    contacto: {
      eyebrow: 'Contato',
      title: 'Vamos falar.',
      lead: 'Conta pra gente qual linha te interessa e como está o projeto. Respondemos com critério, não com um bot.',
    },
    footer: {
      productos: 'Produtos',
      grupo: 'Grupo',
      sobreNosotros: 'Sobre Nós',
      contacto: 'Contato',
      privacidad: 'Privacidade',
      copyright: (year) => `© ${year} Dark Feather Group`,
    },
    privacidad: {
      title: 'Privacidade',
      lead: 'Sem formulários, sem cookies, sem analytics. A única coisa que sai daqui é uma fonte tipográfica.',
      scrollCue: 'Rolar para o conteúdo',
      section1Title: 'O que guardamos',
      section1Body:
        'Nada da sua visita. O botão de contato abre o seu próprio cliente de e-mail, e é aí que a nossa parte termina — a mensagem vai direto para o seu provedor de e-mail, nunca passa por um servidor nosso.',
      section2Title: 'Google Fonts',
      section2Body1:
        'Bricolage Grotesque e IBM Plex Sans vêm do Google Fonts. Para servi-las, seu navegador pede a tipografia a',
      section2Body2:
        ', e nesse pedido vai o seu IP. É o único dado que sai deste site para terceiros, e é administrado pelo Google — não por nós. Está tudo na',
      section2LinkText: 'política de privacidade',
      section3Title: 'Contato',
      section3Body: 'Dúvidas sobre isso? Escreva para',
      updated: (date) => `Última atualização: ${date}.`,
      updatedDate: 'agosto de 2026',
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
