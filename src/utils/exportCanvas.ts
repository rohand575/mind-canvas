import rough from 'roughjs';
import type { CanvasElement } from '../types';
import { renderElement } from '../features/drawing/renderElement';
import { getElementBounds } from './geometry';

/**
 * Export elements as a PNG image
 */
export function exportAsPNG(
  elements: CanvasElement[],
  isDark: boolean,
  padding = 40,
): void {
  if (elements.length === 0) return;

  // Calculate total bounds
  const allBounds = elements.map(getElementBounds);
  const minX = Math.min(...allBounds.map(b => b.x));
  const minY = Math.min(...allBounds.map(b => b.y));
  const maxX = Math.max(...allBounds.map(b => b.x + b.width));
  const maxY = Math.max(...allBounds.map(b => b.y + b.height));

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = isDark ? '#1a1a2e' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Translate so elements are centered
  ctx.translate(-minX + padding, -minY + padding);

  const rc = rough.canvas(canvas);
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const element of sorted) {
    renderElement(rc, ctx, element);
  }

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindcanvas-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Export elements as JSON
 */
export function exportAsJSON(elements: CanvasElement[]): void {
  const data = JSON.stringify({ version: 1, elements }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindcanvas-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
