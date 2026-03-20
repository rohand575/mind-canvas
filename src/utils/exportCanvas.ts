import rough from 'roughjs';
import type { CanvasElement } from '../types';
import { renderElement } from '../features/drawing/renderElement';
import { renderElementSVG } from '../features/drawing/renderElementSVG';
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

/**
 * Import elements from a JSON string. Returns the elements array or null if invalid.
 */
export function importFromJSON(jsonString: string): CanvasElement[] | null {
  try {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.elements)) return null;
    // Basic validation: every element must have an id and type
    for (const el of data.elements) {
      if (typeof el.id !== 'string' || typeof el.type !== 'string') return null;
    }
    return data.elements as CanvasElement[];
  } catch {
    return null;
  }
}

/**
 * Export elements as an SVG file
 */
export function exportAsSVG(
  elements: CanvasElement[],
  isDark: boolean,
  padding = 40,
): void {
  if (elements.length === 0) return;

  const allBounds = elements.map(getElementBounds);
  const minX = Math.min(...allBounds.map(b => b.x));
  const minY = Math.min(...allBounds.map(b => b.y));
  const maxX = Math.max(...allBounds.map(b => b.x + b.width));
  const maxY = Math.max(...allBounds.map(b => b.y + b.height));

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', isDark ? '#1a1a2e' : '#ffffff');
  svg.appendChild(bg);

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${-minX + padding}, ${-minY + padding})`);
  svg.appendChild(g);

  const rc = rough.svg(svg);
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const element of sorted) {
    renderElementSVG(rc, g, element);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mindcanvas-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy canvas content to clipboard as a PNG image
 */
export async function copyCanvasToClipboard(
  elements: CanvasElement[],
  isDark: boolean,
  padding = 40,
): Promise<boolean> {
  if (elements.length === 0) return false;

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

  ctx.fillStyle = isDark ? '#1a1a2e' : '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.translate(-minX + padding, -minY + padding);

  const rc = rough.canvas(canvas);
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const element of sorted) {
    renderElement(rc, ctx, element);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(false); return; }
      navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]).then(() => resolve(true)).catch(() => resolve(false));
    }, 'image/png');
  });
}
