# MindCanvas

A local-first drawing and diagramming tool with a hand-drawn aesthetic. Built with React, TypeScript, and rough.js.

![MindCanvas](https://img.shields.io/badge/Status-Phase%201-brightgreen)

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

- **Infinite Canvas** — Pan (Space + drag) and zoom (mouse wheel)
- **Hand-drawn Shapes** — Rectangle, ellipse, line, arrow, freehand, text (powered by rough.js)
- **Selection System** — Click to select, Shift+click for multi-select, drag to box-select
- **Resize & Move** — Drag elements to move, use handles to resize
- **Undo/Redo** — Full history stack (Ctrl+Z / Ctrl+Shift+Z)
- **Auto-save** — Canvas state persisted to IndexedDB with debounced saves
- **Export** — PNG image or JSON file
- **Dark Mode** — Toggle between light and dark themes
- **Keyboard Shortcuts** — Fast tool switching and common actions

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| R | Rectangle |
| O | Ellipse |
| L | Line |
| A | Arrow |
| P | Pencil (freehand) |
| T | Text |
| G | Toggle grid |
| Delete | Delete selected |
| Escape | Deselect / switch to select |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+D | Duplicate selected |
| Ctrl+A | Select all |
| Ctrl+0 | Reset view |

## Tech Stack

- **React** (Vite) — Fast builds, HMR
- **TypeScript** — Strict mode, full type safety
- **TailwindCSS v4** — Utility-first styling
- **rough.js** — Hand-drawn rendering engine
- **Zustand** — Lightweight state management
- **idb** — IndexedDB wrapper for persistence
- **nanoid** — Unique ID generation

## Architecture

```
src/
├── components/
│   ├── canvas/          # Main canvas component (rendering, interaction)
│   ├── toolbar/         # Tool selector, style panel, action bar
│   └── ui/              # Reusable UI primitives
├── features/
│   ├── drawing/         # Element rendering, grid rendering
│   └── selection/       # Selection box and handle rendering
├── store/               # Zustand stores (canvas, elements, tools, history)
├── hooks/               # Custom hooks (interaction, history, persistence, shortcuts)
├── utils/               # Geometry, element creation, persistence, export
├── types/               # TypeScript type definitions
└── constants/           # App-wide constants and defaults
```

### Key Design Decisions

1. **Canvas-based rendering** — HTML5 Canvas with requestAnimationFrame loop for smooth 60fps rendering. No DOM elements for shapes.

2. **Zustand stores split by domain** — `canvasStore` (pan/zoom/theme), `elementStore` (elements CRUD), `toolStore` (active tool/style/selection), `historyStore` (undo/redo stack). Clean separation of concerns.

3. **Element data model** — Every element has a uniform shape with `id`, `type`, position, dimensions, style properties, `zIndex`, and timestamps. Future-ready with `rotation` field.

4. **History via snapshots** — Full element array snapshots for undo/redo. Simple, reliable, and easy to reason about.

5. **Persistence with IndexedDB** — Auto-save on every change (debounced 500ms). Restores state on page reload.

6. **Future-proof for collaboration** — Element model includes `createdAt`/`updatedAt` timestamps. Store architecture cleanly separates local state from element data, making it straightforward to add Firebase sync or real-time collaboration in future phases.

## Future Roadmap

- **Phase 2**: Firebase Authentication + Firestore (store drawings per user, sync across devices)
- **Phase 3**: Real-time collaboration (WebSockets or Firebase Realtime)

## License

MIT
