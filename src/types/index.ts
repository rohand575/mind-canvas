// ─── Element Types ───────────────────────────────────────────────

export type ElementType = 'rectangle' | 'diamond' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text' | 'image' | 'frame' | 'embed';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type FillStyle = 'solid' | 'hachure' | 'cross-hatch';

export type ConnectorStyle = 'straight' | 'elbow';

export type ConnectionPoint = 'n' | 's' | 'e' | 'w' | 'center';

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

export interface ConnectionBinding {
  elementId: string;
  point: ConnectionPoint;
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
  textWrap?: boolean;
  // For code elements (text with syntax highlighting)
  isCode?: boolean;
  codeLanguage?: string;
  // For image elements
  imageData?: string;
  // For embed elements
  embedUrl?: string;
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

  // ── Feature: Lock ──────────────────────────────────────────────
  /** When true, element cannot be selected or edited */
  locked?: boolean;

  // ── Feature: Grouping ──────────────────────────────────────────
  /** Elements sharing the same groupId move/select together */
  groupId?: string;

  // ── Feature: Hyperlinks ────────────────────────────────────────
  /** URL opened on Ctrl+click in select mode */
  hyperlink?: string;

  // ── Feature: Smart Connectors ──────────────────────────────────
  /** Bind arrow start to a shape's connection point */
  startBinding?: ConnectionBinding;
  /** Bind arrow end to a shape's connection point */
  endBinding?: ConnectionBinding;

  // ── Feature: Connector Style ───────────────────────────────────
  /** Routing style for arrow/line elements */
  connectorStyle?: ConnectorStyle;

  // ── Feature: Connector Labels ──────────────────────────────────
  /** Text label displayed at the midpoint of an arrow/line */
  connectorLabel?: string;

  // ── Feature: Frames ────────────────────────────────────────────
  /** Display name shown at top of a frame element */
  frameName?: string;
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

// ─── Alignment ───────────────────────────────────────────────────

export type AlignmentType = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type DistributionType = 'horizontal' | 'vertical';

// ─── Alignment Guides ────────────────────────────────────────────

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

// ─── Shape Library ───────────────────────────────────────────────

export interface LibraryItem {
  id: string;
  name: string;
  elements: CanvasElement[];
}
