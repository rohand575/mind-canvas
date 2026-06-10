import type {
  CanvasElement,
  ElementType,
  Point,
  StrokeStyle,
  FillStyle,
  ConnectorStyle,
  ConnectionBinding,
  ConnectionPoint,
} from '../types';
import {
  DEFAULT_STROKE_COLOR,
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_ROUGHNESS,
  DEFAULT_OPACITY,
  DEFAULT_STROKE_STYLE,
  DEFAULT_FILL_STYLE,
  DEFAULT_EDGE_ROUNDNESS,
} from '../constants';

/**
 * Validation/coercion for element data coming from OUTSIDE the app
 * (imported .mcv/.json files, clipboard JSON). Untrusted numeric fields
 * would otherwise NaN-poison geometry math (Math.min over bounds), break
 * rendering, and then get autosaved — permanently corrupting the canvas.
 *
 * Invalid elements are dropped; recoverable fields are coerced/defaulted.
 */

const ELEMENT_TYPES: ReadonlySet<string> = new Set([
  'rectangle', 'diamond', 'ellipse', 'line', 'arrow',
  'freehand', 'text', 'image', 'frame', 'embed',
]);
const STROKE_STYLES_SET: ReadonlySet<string> = new Set(['solid', 'dashed', 'dotted']);
const FILL_STYLES_SET: ReadonlySet<string> = new Set(['solid', 'hachure', 'cross-hatch']);
const CONNECTOR_STYLES_SET: ReadonlySet<string> = new Set(['straight', 'elbow']);
const CONNECTION_POINTS_SET: ReadonlySet<string> = new Set(['n', 's', 'e', 'w', 'center']);

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function points(value: unknown): Point[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: Point[] = [];
  for (const p of value) {
    if (
      p && typeof p === 'object' &&
      typeof (p as Point).x === 'number' && Number.isFinite((p as Point).x) &&
      typeof (p as Point).y === 'number' && Number.isFinite((p as Point).y)
    ) {
      out.push({ x: (p as Point).x, y: (p as Point).y });
    } else {
      return undefined; // one bad point invalidates the path
    }
  }
  return out.length > 0 ? out : undefined;
}

function binding(value: unknown): ConnectionBinding | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const b = value as Partial<ConnectionBinding>;
  if (typeof b.elementId !== 'string') return undefined;
  if (typeof b.point !== 'string' || !CONNECTION_POINTS_SET.has(b.point)) return undefined;
  return { elementId: b.elementId, point: b.point as ConnectionPoint };
}

/**
 * Sanitize a single raw element. Returns null if it cannot be salvaged.
 */
export function sanitizeElement(raw: unknown): CanvasElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const el = raw as Record<string, unknown>;

  if (typeof el.id !== 'string' || el.id.length === 0) return null;
  if (typeof el.type !== 'string' || !ELEMENT_TYPES.has(el.type)) return null;

  const x = el.x;
  const y = el.y;
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;

  const type = el.type as ElementType;
  const pts = points(el.points);

  // Linear elements are meaningless without at least 2 valid points
  if ((type === 'line' || type === 'arrow' || type === 'freehand') && (!pts || pts.length < 2)) {
    return null;
  }

  const now = Date.now();
  const sanitized: CanvasElement = {
    id: el.id,
    type,
    x,
    y,
    width: num(el.width, 0),
    height: num(el.height, 0),
    points: pts,
    text: str(el.text),
    fontSize: el.fontSize !== undefined ? Math.max(4, Math.min(400, num(el.fontSize, 16))) : undefined,
    textWrap: bool(el.textWrap),
    isCode: bool(el.isCode),
    codeLanguage: str(el.codeLanguage),
    imageData: str(el.imageData),
    embedUrl: str(el.embedUrl),
    strokeColor: str(el.strokeColor) ?? DEFAULT_STROKE_COLOR,
    fillColor: str(el.fillColor) ?? DEFAULT_FILL_COLOR,
    strokeWidth: Math.max(0, Math.min(50, num(el.strokeWidth, DEFAULT_STROKE_WIDTH))),
    roughness: Math.max(0, Math.min(10, num(el.roughness, DEFAULT_ROUGHNESS))),
    opacity: Math.max(0, Math.min(1, num(el.opacity, DEFAULT_OPACITY))),
    strokeStyle: (STROKE_STYLES_SET.has(el.strokeStyle as string) ? el.strokeStyle : DEFAULT_STROKE_STYLE) as StrokeStyle,
    fillStyle: (FILL_STYLES_SET.has(el.fillStyle as string) ? el.fillStyle : DEFAULT_FILL_STYLE) as FillStyle,
    edgeRoundness: Math.max(0, Math.min(100, num(el.edgeRoundness, DEFAULT_EDGE_ROUNDNESS))),
    rotation: num(el.rotation, 0),
    zIndex: num(el.zIndex, 0),
    createdAt: num(el.createdAt, now),
    updatedAt: num(el.updatedAt, now),
    locked: bool(el.locked),
    groupId: str(el.groupId),
    hyperlink: str(el.hyperlink),
    startBinding: binding(el.startBinding),
    endBinding: binding(el.endBinding),
    connectorStyle: CONNECTOR_STYLES_SET.has(el.connectorStyle as string)
      ? (el.connectorStyle as ConnectorStyle)
      : undefined,
    connectorLabel: str(el.connectorLabel),
    frameName: str(el.frameName),
  };

  return sanitized;
}

/**
 * Sanitize an array of raw elements: invalid entries are dropped and
 * duplicate ids are regenerated (corrupt files / double-imports).
 */
export function sanitizeElements(raw: unknown): CanvasElement[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CanvasElement[] = [];
  for (const item of raw) {
    const el = sanitizeElement(item);
    if (!el) continue;
    if (seen.has(el.id)) {
      el.id = crypto.randomUUID();
    }
    seen.add(el.id);
    out.push(el);
  }
  return out;
}

/**
 * Clone elements for paste/duplicate: fresh ids, remapped group ids, and
 * connector bindings remapped when the bound shape is part of the same
 * clone set (cleared otherwise — never left pointing at the originals).
 */
export function cloneElementsForPaste(
  source: CanvasElement[],
  offsetX: number,
  offsetY: number,
  startZIndex: number,
): CanvasElement[] {
  const idMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();
  const now = Date.now();

  for (const el of source) {
    idMap.set(el.id, crypto.randomUUID());
  }

  let z = startZIndex;
  return source.map((el) => {
    let newGroupId = el.groupId;
    if (el.groupId) {
      if (!groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, crypto.randomUUID());
      newGroupId = groupIdMap.get(el.groupId);
    }

    const remapBinding = (b: ConnectionBinding | undefined): ConnectionBinding | undefined => {
      if (!b) return undefined;
      const mapped = idMap.get(b.elementId);
      return mapped ? { elementId: mapped, point: b.point } : undefined;
    };

    z += 1;
    return {
      ...el,
      id: idMap.get(el.id)!,
      x: el.x + offsetX,
      y: el.y + offsetY,
      zIndex: z,
      groupId: newGroupId,
      startBinding: remapBinding(el.startBinding),
      endBinding: remapBinding(el.endBinding),
      createdAt: now,
      updatedAt: now,
    };
  });
}
