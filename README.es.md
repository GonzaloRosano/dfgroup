<div align="center">

# 🖤 Dark Feather Group

**Sitio web público del colectivo — DF Group**

</div>

---

## Sobre el proyecto

Presencia web pública de **Dark Feather Group** (también Dark Feather / DF Group), un colectivo creativo / estudio digital que cubre diseño, desarrollo, arte y producción.

El objetivo es que quien visite el sitio entienda quiénes son, perciba la calidad del trabajo y sepa cómo iniciar una conversación o colaboración. No es una landing de una sola vista: es un sitio multi-página con identidad y estética noir-moderna propia.

---

## Qué incluye

- **Inicio** (`/`)
- **Hosting** (`/hosting`)
- **Series** (`/series`)
- **Atelier** (`/atelier`)
- **Voices** (`/voices`)
- **Grupo** (`/grupo`)
- **Contacto** (`/contacto`)
- Sitio bilingüe (`es` / `en`), ruta por defecto en producción: `/en`

---

## Stack

![Astro](https://img.shields.io/badge/Astro-BC52EE?style=flat-square&logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white)

Astro con islas de React puntuales para Three.js / WebGL. Build intencionalmente sin optimizaciones agresivas (sin minify, sourcemaps activos).

---

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Disponible en `http://localhost:4321`.

Build de producción:

```bash
pnpm build
pnpm preview
```

---

## Estructura

```
src/
├─ components/    # Bloques de UI de las distintas páginas
├─ data/          # Contenido/datos estáticos
├─ i18n/          # Traducciones es/en
├─ layouts/       # Layouts base del sitio
├─ lib/           # Utilidades
├─ pages/         # Rutas: /, /hosting, /series, /atelier, /voices, /grupo, /contacto
└─ styles/        # Estilos globales
```

---

## Deploy

[dfgroup-one.vercel.app](https://dfgroup-one.vercel.app)

## Estado

Identidad y contenido en desarrollo. Casos reales de trabajo y roster del equipo pendientes de incorporar.
