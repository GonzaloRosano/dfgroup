<div align="center">

# 🖤 Dark Feather Group

**Public collective website — DF Group**

</div>

![Screenshot](https://raw.githubusercontent.com/GonzaloRosano/dfgroup/master/docs/screenshot.webp)

---

## About the project

Public web presence for **Dark Feather Group** (also Dark Feather / DF Group), a creative collective / digital studio covering design, development, art, and production.

The goal is for visitors to understand who they are, sense the quality of the craft, and know how to start a conversation or collaboration. This isn't a single-view landing page, it's a multi-page site with its own noir-modern identity and aesthetic.

---

## What's included

- **Home** (`/`)
- **Hosting** (`/hosting`)
- **Series** (`/series`)
- **Atelier** (`/atelier`)
- **Voices** (`/voices`)
- **Group** (`/grupo`)
- **Contact** (`/contacto`)
- Bilingual site (`es` / `en`), default route in production: `/en`

---

## Tech Stack

![Astro](https://img.shields.io/badge/Astro-BC52EE?style=flat-square&logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white)

Astro with specific React islands for Three.js / WebGL. Build intentionally unoptimized (no minification, sourcemaps enabled).

---

## Getting started

```bash
pnpm install
pnpm dev
```

Available at `http://localhost:4321`.

Production build:

```bash
pnpm build
pnpm preview
```

---

## Structure

```
src/
├─ components/    # UI blocks for the different pages
├─ data/          # Static content/data
├─ i18n/          # es/en translations
├─ layouts/       # Base site layouts
├─ lib/           # Utilities
├─ pages/         # Routes: /, /hosting, /series, /atelier, /voices, /grupo, /contacto
└─ styles/        # Global styles
```

---

## Deploy

[dfgroup-one.vercel.app](https://dfgroup-one.vercel.app)

## Status

Identity and content in progress. Real case work and team roster still to be added.
