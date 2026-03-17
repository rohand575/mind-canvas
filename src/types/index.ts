// ─── Element Types ───────────────────────────────────────────────

export type ElementType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text';

export type Tool = 'select' | ElementType;

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  // For line/arrow/freehand: array of points relative to element origin
  points?: Point[];
  // For text elements
  text?: string;
  fontSize?: number;
  // Style
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  // Transform
  rotation: number;
  // Layering
  zIndex: number;
  // Metadata (future-ready for collaboration)
  createdAt: number;
  updatedAt: number;
}

// ─── Canvas State ────────────────────────────────────────────────

export interface CanvasState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

// ─── History ─────────────────────────────────────────────────────

export interface HistoryEntry {
  elements: CanvasElement[];
  timestamp: number;
}

// ─── Resize Handles ──────────────────────────────────────────────

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

// ─── Theme ───────────────────────────────────────────────────────

export type Theme = 'light' | 'dark';

// ─── Export ──────────────────────────────────────────────────────

export interface ExportOptions {
  format: 'png' | 'json';
  background: boolean;
  padding: number;
}
