import type { Point, Bounds, CanvasElement, ResizeHandle, ConnectionPoint } from '../types';
import { HANDLE_SIZE } from '../constants';

/**
 * Get the bounding box of an element
 */
export function getElementBounds(element: CanvasElement): Bounds {
  if (element.type === 'freehand' && element.points) {
    const xs = element.points.map(p => p.x + element.x);
    const ys = element.points.map(p => p.y + element.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  if ((element.type === 'line' || element.type === 'arrow') && element.points) {
    const xs = element.points.map(p => p.x + element.x);
    const ys = element.points.map(p => p.y + element.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

/**
 * Check if a point is inside a bounding box
 */
export function isPointInBounds(point: Point, bounds: Bounds, padding = 0): boolean {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}

/**
 * Check if inner bounds are fully contained within outer bounds
 */
export function boundsContainedIn(inner: Bounds, outer: Bounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Check if a point hits an element
 */
export function hitTestElement(point: Point, element: CanvasElement, tolerance = 4): boolean {
  // Locked elements are not hit-testable
  if (element.locked) return false;

  const bounds = getElementBounds(element);

  if (element.type === 'line' || element.type === 'arrow') {
    if (!element.points || element.points.length < 2) return false;
    // Check distance from point to line segment
    const p1 = { x: element.points[0].x + element.x, y: element.points[0].y + element.y };
    const p2 = { x: element.points[1].x + element.x, y: element.points[1].y + element.y };
    return distanceToLineSegment(point, p1, p2) <= tolerance + element.strokeWidth;
  }

  if (element.type === 'freehand' && element.points) {
    // Check if point is near any segment of the freehand path
    for (let i = 0; i < element.points.length - 1; i++) {
      const p1 = { x: element.points[i].x + element.x, y: element.points[i].y + element.y };
      const p2 = { x: element.points[i + 1].x + element.x, y: element.points[i + 1].y + element.y };
      if (distanceToLineSegment(point, p1, p2) <= tolerance + element.strokeWidth) {
        return true;
      }
    }
    return false;
  }

  // Diamond hit test
  if (element.type === 'diamond') {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const hw = Math.abs(element.width) / 2;
    const hh = Math.abs(element.height) / 2;
    if (hw === 0 || hh === 0) return false;
    const dist = Math.abs(point.x - cx) / (hw + tolerance) + Math.abs(point.y - cy) / (hh + tolerance);
    if (element.fillColor !== 'transparent') {
      return dist <= 1;
    }
    const innerDist = Math.abs(point.x - cx) / Math.max(1, hw - tolerance - element.strokeWidth) +
                      Math.abs(point.y - cy) / Math.max(1, hh - tolerance - element.strokeWidth);
    return dist <= 1 && innerDist >= 1;
  }

  // Images and text are always "filled" — hit anywhere inside bounds
  if (element.type === 'image' || element.type === 'text') {
    return isPointInBounds(point, bounds, tolerance);
  }

  // Frame: hit on border only (not inside)
  if (element.type === 'frame') {
    const borderTolerance = tolerance + 3;
    return (
      isPointInBounds(point, bounds, borderTolerance) &&
      !isPointInBounds(point, {
        x: bounds.x + borderTolerance,
        y: bounds.y + borderTolerance,
        width: Math.max(0, bounds.width - 2 * borderTolerance),
        height: Math.max(0, bounds.height - 2 * borderTolerance),
      })
    );
  }

  // For filled shapes, check if inside bounds
  if (element.fillColor !== 'transparent') {
    return isPointInBounds(point, bounds, tolerance);
  }

  // For non-filled shapes, check if near border
  return (
    isPointInBounds(point, bounds, tolerance) &&
    !isPointInBounds(point, {
      x: bounds.x + tolerance + element.strokeWidth,
      y: bounds.y + tolerance + element.strokeWidth,
      width: Math.max(0, bounds.width - 2 * (tolerance + element.strokeWidth)),
      height: Math.max(0, bounds.height - 2 * (tolerance + element.strokeWidth)),
    })
  );
}

/**
 * Distance from a point to a line segment
 */
function distanceToLineSegment(point: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(point.x - p1.x, point.y - p1.y);
  }

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;

  return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * Get resize handle at a given point for an element
 */
export function getResizeHandleAtPoint(
  point: Point,
  element: CanvasElement,
): ResizeHandle | null {
  // Line/arrow elements use endpoint handles instead of bounding-box handles
  if (element.type === 'line' || element.type === 'arrow') {
    return null;
  }

  const bounds = getElementBounds(element);
  const halfHandle = HANDLE_SIZE / 2;
  const handles: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: 'nw', x: bounds.x, y: bounds.y },
    { handle: 'ne', x: bounds.x + bounds.width, y: bounds.y },
    { handle: 'sw', x: bounds.x, y: bounds.y + bounds.height },
    { handle: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { handle: 'n', x: bounds.x + bounds.width / 2, y: bounds.y },
    { handle: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    { handle: 'w', x: bounds.x, y: bounds.y + bounds.height / 2 },
    { handle: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
  ];

  for (const h of handles) {
    if (
      Math.abs(point.x - h.x) <= halfHandle + 2 &&
      Math.abs(point.y - h.y) <= halfHandle + 2
    ) {
      return h.handle;
    }
  }

  return null;
}

/**
 * Get the index of an endpoint handle at the given point for line/arrow elements.
 */
export function getEndpointHandleAtPoint(
  point: Point,
  element: CanvasElement,
): number | null {
  if (element.type !== 'line' && element.type !== 'arrow') return null;
  if (!element.points || element.points.length === 0) return null;

  const radius = HANDLE_SIZE / 2 + 3;
  for (let i = 0; i < element.points.length; i++) {
    const p = element.points[i];
    const hx = p.x + element.x;
    const hy = p.y + element.y;
    if (Math.hypot(point.x - hx, point.y - hy) <= radius) {
      return i;
    }
  }
  return null;
}

/**
 * Normalize bounds so width/height are always positive
 */
export function normalizeBounds(x: number, y: number, width: number, height: number): Bounds {
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

/**
 * Check if two rectangles overlap (for multi-select)
 */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Snap a value to the nearest grid point
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

// ─── Connection Points ────────────────────────────────────────────

/**
 * Get the absolute canvas coordinates of a connection point on a shape element
 */
export function getConnectionPointAbsolute(element: CanvasElement, point: ConnectionPoint): Point {
  const b = getElementBounds(element);
  switch (point) {
    case 'n':      return { x: b.x + b.width / 2, y: b.y };
    case 's':      return { x: b.x + b.width / 2, y: b.y + b.height };
    case 'e':      return { x: b.x + b.width, y: b.y + b.height / 2 };
    case 'w':      return { x: b.x, y: b.y + b.height / 2 };
    case 'center': return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
}

/**
 * All 5 connection points for a shape element as absolute coordinates
 */
export function getAllConnectionPoints(element: CanvasElement): Array<{ point: ConnectionPoint; x: number; y: number }> {
  const b = getElementBounds(element);
  return [
    { point: 'n',      x: b.x + b.width / 2, y: b.y },
    { point: 's',      x: b.x + b.width / 2, y: b.y + b.height },
    { point: 'e',      x: b.x + b.width,      y: b.y + b.height / 2 },
    { point: 'w',      x: b.x,                y: b.y + b.height / 2 },
    { point: 'center', x: b.x + b.width / 2, y: b.y + b.height / 2 },
  ];
}

/**
 * Find the nearest connection point within snapDistance of cursor,
 * excluding elements in excludeIds (e.g., the arrow being drawn).
 * Returns null if nothing is close enough.
 */
export function findNearestConnectionPoint(
  cursor: Point,
  elements: CanvasElement[],
  excludeIds: string[],
  snapDistance: number,
): { elementId: string; point: ConnectionPoint; x: number; y: number } | null {
  const snapTypes: ElementType[] = ['rectangle', 'diamond', 'ellipse', 'frame', 'text', 'image'];
  let bestDist = snapDistance;
  let best: { elementId: string; point: ConnectionPoint; x: number; y: number } | null = null;

  for (const el of elements) {
    if (excludeIds.includes(el.id)) continue;
    if (el.locked) continue;
    if (!snapTypes.includes(el.type)) continue;

    for (const cp of getAllConnectionPoints(el)) {
      const d = Math.hypot(cursor.x - cp.x, cursor.y - cp.y);
      if (d < bestDist) {
        bestDist = d;
        best = { elementId: el.id, point: cp.point, x: cp.x, y: cp.y };
      }
    }
  }

  return best;
}

// needed for type narrowing above
type ElementType = import('../types').ElementType;
