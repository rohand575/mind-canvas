# Mind Canvas — Features Overview

A local-first infinite canvas app for diagramming, sketching, and note-taking — runs entirely in the browser with no server required.

---

## Drawing Tools

| Tool | Shortcut | Description |
|------|----------|-------------|
| Select | `V` | Click, shift-click, or drag to select |
| Hand | `H` | Pan the canvas |
| Frame | `F` | Named container regions |
| Rectangle | `R` | — |
| Diamond | `D` | — |
| Ellipse | `O` | — |
| Line | `L` | — |
| Arrow | `A` | Smart connector with snap-to-shape |
| Pencil | `P` | Freehand drawing |
| Text | `T` | Multiline text / code blocks |

---

## Styling

- **Stroke:** color (8 palette + transparent), width, style (solid / dashed / dotted)
- **Fill:** solid, hachure, cross-hatch; color picker
- **Roughness:** 0–3 (hand-drawn aesthetic via rough.js)
- **Opacity:** 0–100%
- **Edge roundness** on rectangles and diamonds
- **Font size:** 12–64px (11 presets)
- **Fonts:** Virgil (hand-drawn), monospace (code)

---

## Smart Connectors

- Arrows bind to shapes at 8 connection points (N/S/E/W + corners)
- Connectors auto-update when bound shapes move or resize
- Routing styles: straight or elbow/orthogonal
- Connector labels (text at midpoint)
- Hyperlinks on any element (`Ctrl+Click` to open)

---

## Text & Code

- Multiline text with wrapping
- Auto-detects pasted code and applies syntax highlighting
- Supports: JavaScript, Python, HTML, CSS, SQL, JSON, Java, C++, and more
- Dark/light syntax theme follows app theme

---

## Images & Embeds

- Paste images from clipboard (auto-scaled to 800px max)
- Embed URLs (iframe overlay for web content)

---

## Selection & Editing

- Box select, multi-select (`Shift+Click`), select all (`Ctrl+A`)
- Cycle elements with `Tab` / `Shift+Tab`
- Move with drag or arrow keys (1px; `Shift` = 10px)
- 8-point resize handles
- Duplicate: `Ctrl+D` | Delete: `Delete` / `Backspace`
- Snap-to-shape alignment guides while dragging

---

## Organization

| Feature | Shortcut |
|---------|----------|
| Group / Ungroup | `Ctrl+G` / `Ctrl+Shift+G` |
| Lock / Unlock | `Ctrl+L` |
| Bring Forward / To Front | `Ctrl+]` / `Ctrl+Shift+]` |
| Send Backward / To Back | `Ctrl+[` / `Ctrl+Shift+[` |
| Align (left, center, right, top, bottom) | Align bar (2+ selected) |
| Distribute horizontally / vertically | Align bar (3+ selected) |

---

## Canvas & Navigation

- **Infinite canvas** with pan (`Space+Drag`) and zoom (mouse wheel, 0.1×–5×)
- Multiple independent canvases (create, rename, delete, switch)
- Zoom to fit all (`Ctrl+1`), zoom to selection (`Ctrl+2`), reset view (`Ctrl+0`)
- Optional grid overlay (`G`) with snap-to-grid
- Mini-map for canvas overview
- Find bar (`Ctrl+F`) — searches text content across all elements

---

## Undo / Redo

- Snapshot-based history (50 states)
- `Ctrl+Z` undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo

---

## Clipboard

- `Ctrl+C` copies selected elements (and as PNG to clipboard)
- `Ctrl+V` pastes elements, images, plain text, or code — auto-detected

---

## Export

| Format | Notes |
|--------|-------|
| PNG | Transparent or with background |
| SVG | Vector, preserves hand-drawn style |
| JSON | Elements data only |
| `.mcv` project file | Full canvas state + elements |

---

## Shape Library

- Save selected elements as named reusable components
- Visual thumbnail previews
- Drag or click to insert onto canvas
- Persistent across sessions

---

## Persistence

- **Auto-save** to IndexedDB (debounced, 500ms) — no manual save needed
- Full state restored on reload: elements, pan/zoom, theme, grid
- Import/export `.mcv` project files for backup and sharing

---

## Theme & Appearance

- Dark / Light mode toggle (persisted)
- Affects canvas background, UI, code highlighting, and export background

---

## Platform

- **Web app** — React 19, TypeScript, Vite, TailwindCSS v4
- **Desktop app** — Electron build with Windows installer (NSIS)
- **PWA** — installable, works offline
- State management: Zustand | Rendering: HTML5 Canvas at 60fps

---

## Keyboard Shortcuts Reference

Press `?` in the app to open the full shortcuts dialog.
