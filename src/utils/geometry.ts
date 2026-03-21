import type { Point, Bounds, CanvasElement, ResizeHandle } from '../types';
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
 * Check if a point hits an element
 */
export function hitTestElement(point: Point, element: CanvasElement, tolerance = 4): boolean {
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
    // Point-in-diamond: |px - cx| / hw + |py - cy| / hh <= 1
    const dist = Math.abs(point.x - cx) / (hw + tolerance) + Math.abs(point.y - cy) / (hh + tolerance);
    if (element.fillColor !== 'transparent') {
      return dist <= 1;
    }
    // For non-filled diamond, check if near border
    const innerDist = Math.abs(point.x - cx) / Math.max(1, hw - tolerance - element.strokeWidth) +
                      Math.abs(point.y - cy) / Math.max(1, hh - tolerance - element.strokeWidth);
    return dist <= 1 && innerDist >= 1;
  }

  // Images are always "filled" — hit anywhere inside bounds
  if (element.type === 'image') {
    return isPointInBounds(point, bounds, tolerance);
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
