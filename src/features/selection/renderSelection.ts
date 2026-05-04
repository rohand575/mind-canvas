import type { CanvasElement, Bounds, AlignmentGuide } from '../../types';
import { getElementBounds } from '../../utils/geometry';
import { HANDLE_SIZE, SELECTION_PADDING } from '../../constants';

/**
 * Renders selection UI: bounding box + resize handles (or endpoint handles for lines/arrows).
 * Locked elements show a dashed border with no handles.
 * Groups render a single collective bounding box.
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  selectedElements: CanvasElement[],
) {
  if (selectedElements.length === 0) return;

  ctx.save();

  // If all selected elements share the same groupId AND there are 2+ elements,
  // also render a collective group bounding box
  const groupIds = selectedElements
    .map((el) => el.groupId)
    .filter((g): g is string => !!g);
  const allSameGroup =
    groupIds.length === selectedElements.length &&
    groupIds.length > 1 &&
    groupIds.every((g) => g === groupIds[0]);

  for (const element of selectedElements) {
    if (element.locked) {
      renderLockedSelection(ctx, element);
      continue;
    }

    if ((element.type === 'line' || element.type === 'arrow') && element.points && element.points.length > 0) {
      // Endpoint handles
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      const radius = HANDLE_SIZE / 2 + 1;
      for (const p of element.points) {
        const hx = p.x + element.x;
        const hy = p.y + element.y;
        ctx.beginPath();
        ctx.arc(hx, hy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      continue;
    }

    const bounds = getElementBounds(element);
    const padded: Bounds = {
      x: bounds.x - SELECTION_PADDING,
      y: bounds.y - SELECTION_PADDING,
      width: bounds.width + SELECTION_PADDING * 2,
      height: bounds.height + SELECTION_PADDING * 2,
    };

    // Selection border
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(padded.x, padded.y, padded.width, padded.height);

    // Resize handles
    const halfH = HANDLE_SIZE / 2;
    const handles = [
      { x: padded.x, y: padded.y },
      { x: padded.x + padded.width, y: padded.y },
      { x: padded.x, y: padded.y + padded.height },
      { x: padded.x + padded.width, y: padded.y + padded.height },
      { x: padded.x + padded.width / 2, y: padded.y },
      { x: padded.x + padded.width, y: padded.y + padded.height / 2 },
      { x: padded.x + padded.width / 2, y: padded.y + padded.height },
      { x: padded.x, y: padded.y + padded.height / 2 },
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;

    for (const h of handles) {
      ctx.fillRect(h.x - halfH, h.y - halfH, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(h.x - halfH, h.y - halfH, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  // Group collective bounding box
  if (allSameGroup) {
    const allBounds = selectedElements.map(getElementBounds);
    const minX = Math.min(...allBounds.map((b) => b.x));
    const minY = Math.min(...allBounds.map((b) => b.y));
    const maxX = Math.max(...allBounds.map((b) => b.x + b.width));
    const maxY = Math.max(...allBounds.map((b) => b.y + b.height));

    ctx.strokeStyle = 'rgba(99,102,241,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      minX - SELECTION_PADDING * 2,
      minY - SELECTION_PADDING * 2,
      maxX - minX + SELECTION_PADDING * 4,
      maxY - minY + SELECTION_PADDING * 4,
    );
    ctx.setLineDash([]);

    // "Group" badge
    ctx.fillStyle = '#6366f1';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Group', minX - SELECTION_PADDING * 2 + 4, minY - SELECTION_PADDING * 2 - 2);
  }

  ctx.restore();
}

function renderLockedSelection(ctx: CanvasRenderingContext2D, element: CanvasElement) {
  const bounds = getElementBounds(element);
  const padded: Bounds = {
    x: bounds.x - SELECTION_PADDING,
    y: bounds.y - SELECTION_PADDING,
    width: bounds.width + SELECTION_PADDING * 2,
    height: bounds.height + SELECTION_PADDING * 2,
  };

  ctx.strokeStyle = 'rgba(99,102,241,0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(padded.x, padded.y, padded.width, padded.height);
  ctx.setLineDash([]);
}

/**
 * Renders the rubber-band selection rectangle while dragging
 */
export function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
) {
  ctx.save();
  ctx.strokeStyle = '#6366f1';
  ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Renders smart alignment guide lines during drag
 */
export function renderAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  guides: AlignmentGuide[],
  viewWidth: number,
  viewHeight: number,
) {
  if (guides.length === 0) return;
  ctx.save();
  ctx.strokeStyle = '#e03131';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  for (const guide of guides) {
    if (guide.type === 'vertical') {
      ctx.beginPath();
      ctx.moveTo(guide.position, guide.start);
      ctx.lineTo(guide.position, guide.end);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(guide.start, guide.position);
      ctx.lineTo(guide.end, guide.position);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
  void viewWidth;
  void viewHeight;
}

/**
 * Renders connection point circles on shapes when drawing an arrow
 */
export function renderConnectionPoints(
  ctx: CanvasRenderingContext2D,
  elements: CanvasElement[],
  snapTarget: { elementId: string; point: string; x: number; y: number } | null,
) {
  const snapTypes = new Set(['rectangle', 'diamond', 'ellipse', 'frame', 'text', 'image']);
  ctx.save();

  for (const el of elements) {
    if (!snapTypes.has(el.type) || el.locked) continue;
    const b = {
      x: el.x, y: el.y, width: el.width, height: el.height,
    };
    const points = [
      { x: b.x + b.width / 2, y: b.y },
      { x: b.x + b.width / 2, y: b.y + b.height },
      { x: b.x + b.width, y: b.y + b.height / 2 },
      { x: b.x, y: b.y + b.height / 2 },
    ];

    for (const p of points) {
      const isSnapped = snapTarget && snapTarget.x === p.x && snapTarget.y === p.y && snapTarget.elementId === el.id;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSnapped ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSnapped ? '#6366f1' : 'rgba(99,102,241,0.25)';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  ctx.restore();
}
