import type { CanvasElement, Bounds } from '../../types';
import { getElementBounds } from '../../utils/geometry';
import { HANDLE_SIZE, SELECTION_PADDING } from '../../constants';

/**
 * Renders selection UI: bounding box + resize handles
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  selectedElements: CanvasElement[],
) {
  if (selectedElements.length === 0) return;

  ctx.save();

  for (const element of selectedElements) {
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
      { x: padded.x + padded.width / 2, y: padded.y + padded.height },
      { x: padded.x, y: padded.y + padded.height / 2 },
      { x: padded.x + padded.width, y: padded.y + padded.height / 2 },
    ];

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;

    for (const h of handles) {
      ctx.fillRect(h.x - halfH, h.y - halfH, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(h.x - halfH, h.y - halfH, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  ctx.restore();
}

/**
 * Renders a selection rectangle while dragging
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
