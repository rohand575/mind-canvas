# Canvas — Improvement Roadmap

## Phase 3 — Core UX Enhancements

### Transform & Manipulation
- [ ] Element rotation (rotation handle + angle snapping at 15° increments)
- [ ] Element grouping/ungrouping (Ctrl+G / Ctrl+Shift+G)
- [ ] Flip horizontal/vertical for selected elements
- [ ] Multi-element alignment tools (align left/center/right, top/middle/bottom)
- [ ] Distribute spacing evenly (horizontal/vertical)
- [ ] Smart snapping with alignment guides (show guides when aligning)

### Drawing Tools
- [ ] Multi-point polylines (click to add waypoints, Enter to finish)
- [ ] Elbow connectors (right-angle arrows between shapes)
- [ ] Arrow binding to shapes (endpoints snap to shape edges)
- [ ] Eraser tool (erase parts of freehand strokes)
- [ ] Highlighter tool (semi-transparent wide strokes)
- [ ] Sticky notes (colored rectangles with auto-wrapping text)

### Text Improvements
- [ ] Text alignment (left / center / right)
- [ ] Bound text in shapes (text inside rectangle/ellipse/diamond)
- [ ] Text wrapping with configurable max width
- [ ] Font picker (Virgil, system fonts, monospace options)
- [ ] Labeled arrows (editable text at arrow midpoint)

### Image Support
- [ ] Insert images via drag & drop
- [ ] Paste images from clipboard (Ctrl+V)
- [ ] Image resize with aspect ratio lock (hold Shift)
- [ ] Crop images within canvas

## Phase 4 — Productivity Features

### Navigation & Discovery
- [ ] Command palette (Ctrl+K) — quick actions and tool switching
- [ ] Scene search (Ctrl+F) — find elements by text content
- [ ] Minimap for large canvases
- [ ] Bookmark viewports (save named zoom positions)
- [ ] Recent colors palette (last 8 used colors)

### Element Management
- [ ] Properties panel (exact dimensions, position, rotation input)
- [ ] Element hyperlinks (click to open URLs)
- [ ] Lock elements (prevent selection/editing)
- [ ] Hide/show elements (visibility toggle)
- [ ] Layer panel (visual z-order management)

### Export & Sharing
- [ ] PDF export (multi-page support)
- [ ] Copy selection as SVG/PNG to clipboard
- [ ] Shareable read-only links (with URL hash state)
- [ ] Embed mode (iframe-friendly, no toolbar)

### Templates & Libraries
- [ ] Shape libraries (save reusable element collections)
- [ ] Built-in templates (flowchart, wireframe, mind map starters)
- [ ] Import from Mermaid diagram syntax
- [ ] Import from Excalidraw JSON

## Phase 5 — Performance & Architecture

### Rendering Optimization
- [ ] Virtual rendering (only draw visible elements)
- [ ] Canvas caching for static elements
- [ ] Offscreen rendering for complex shapes
- [ ] Lazy rough.js drawable generation
- [ ] Web Worker for heavy computations (export, large file parse)

### Data & Storage
- [ ] Multiple canvas documents (project/file switcher)
- [ ] Version history with snapshots (time travel)
- [ ] Auto-backup to localStorage fallback
- [ ] Cloud sync (optional, with auth)
- [ ] Conflict resolution for concurrent edits

### Code Quality
- [ ] Unit tests for geometry utilities
- [ ] Integration tests for core interactions
- [ ] E2E tests with Playwright
- [ ] Performance benchmarks (60fps target validation)
- [ ] Storybook for UI components

## Phase 6 — Collaboration & Social

### Real-time Collaboration
- [ ] Multi-cursor presence (see other users' pointers)
- [ ] Live element sync (CRDT-based for conflict-free edits)
- [ ] User avatars and names
- [ ] Follow mode (view follows another user)
- [ ] Comments on elements

### Security
- [ ] End-to-end encryption for shared canvases
- [ ] Password-protected links
- [ ] Expiring share links

### Presentation
- [ ] Presentation mode (fullscreen, no UI)
- [ ] Laser pointer tool
- [ ] Frame-based slides (navigate between frames)
- [ ] Drawing timer/countdown overlay

## Quick Wins (Low Effort, High Impact)

- [ ] Eye dropper tool (pick colors from canvas)
- [ ] Duplicate with offset direction choice
- [ ] Touch/stylus pressure sensitivity for freehand
- [ ] Dark/light mode sync with system preference
- [ ] Canvas background color picker
- [ ] Cursor hints showing current tool
- [ ] PWA support (installable, offline capable)
- [ ] Loading skeleton for slow IndexedDB restore
- [ ] Confirmation before closing with unsaved changes
