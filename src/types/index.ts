// ─── Element Types ───────────────────────────────────────────────

export type ElementType = 'rectangle' | 'diamond' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text' | 'image';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type FillStyle = 'solid' | 'hachure' | 'cross-hatch';

export type Tool = 'select' | 'hand' | ElementType;

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
  textWrap?: boolean; // wrap text at element.width
  // For code elements (text with syntax highlighting)
  isCode?: boolean;
  codeLanguage?: string;
  // For image elements
  imageData?: string;
  // Style
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  strokeStyle: StrokeStyle;
  fillStyle: FillStyle;
  edgeRoundness: number;
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

// ─── Canvas Document (multi-canvas) ──────────────────────────────

export interface CanvasDocumentMeta {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
}

export interface CanvasDocument extends CanvasDocumentMeta {
  elements: CanvasElement[];
  canvasState: CanvasState & {
    theme?: Theme;
    showGrid?: boolean;
  };
}

// ─── Export ──────────────────────────────────────────────────────

export interface ExportOptions {
  format: 'png' | 'json' | 'svg';
  background: boolean;
  padding: number;
}
