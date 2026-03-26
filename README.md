# Instagram Motion Engine

TouchDesigner-inspirierte Motion-Engine fuer animierte Instagram-Posts.

## Features

- Layer-System fuer Shape, Text, Logo und Image
- Timeline mit FPS, Dauer, Loop und Playhead
- Pro Layer eigene Modulatoren fuer Position, Scale, Rotation und Opacity
- Eingebaute Logo-Library
- Export als PNG und JPG

## Lokaler Start

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Netlify

Netlify ist bereits ueber `netlify.toml` vorbereitet:

- Build command: `npm run build`
- Publish directory: `dist`
