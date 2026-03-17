import type { Tool } from '../types';

// ─── Canvas Defaults ─────────────────────────────────────────────

export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;
export const GRID_SIZE = 20;

// ─── Element Defaults ────────────────────────────────────────────

export const DEFAULT_STROKE_COLOR = '#1e1e1e';
export const DEFAULT_FILL_COLOR = 'transparent';
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_ROUGHNESS = 1;
export const DEFAULT_OPACITY = 1;
export const DEFAULT_FONT_SIZE = 20;

// ─── Selection ───────────────────────────────────────────────────

export const HANDLE_SIZE = 8;
export const SELECTION_PADDING = 4;

// ─── Persistence ─────────────────────────────────────────────────

export const DB_NAME = 'mindcanvas-db';
export const DB_VERSION = 1;
export const STORE_NAME = 'canvases';
export const AUTOSAVE_DEBOUNCE_MS = 500;
export const DEFAULT_CANVAS_ID = 'default';

// ─── Tools ───────────────────────────────────────────────────────

export const TOOLS: { id: Tool; label: string; icon: string; shortcut: string }[] = [
  { id: 'select', label: 'Select', icon: 'cursor', shortcut: 'V' },
  { id: 'rectangle', label: 'Rectangle', icon: 'square', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', icon: 'circle', shortcut: 'O' },
  { id: 'line', label: 'Line', icon: 'line', shortcut: 'L' },
  { id: 'arrow', label: 'Arrow', icon: 'arrow', shortcut: 'A' },
  { id: 'freehand', label: 'Pencil', icon: 'pencil', shortcut: 'P' },
  { id: 'text', label: 'Text', icon: 'text', shortcut: 'T' },
];

// ─── Colors ──────────────────────────────────────────────────────

export const COLOR_PALETTE = [
  '#1e1e1e', '#e03131', '#2f9e44', '#1971c2',
  '#f08c00', '#6741d9', '#0c8599', '#e64980',
  'transparent',
];

export const STROKE_WIDTHS = [1, 2, 3, 4, 6];
export const ROUGHNESS_LEVELS = [0, 1, 2, 3];
