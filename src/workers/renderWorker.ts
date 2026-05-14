/**
 * E2: Background Drawable pre-generation worker.
 *
 * The main thread sends element data here; we generate rough.js Drawable
 * objects (pure JSON — no canvas required) and post them back.  The main
 * thread stores them in its DrawableCache so the RAF loop can call
 * rc.draw(drawable) without recomputing paths every frame.
 */
import rough from 'roughjs';
import type { Options as RoughOptions } from 'roughjs/bin/core';
import type { CanvasElement } from '../types';

const gen = rough.generator();

// ─── Helpers (mirrors renderElement.ts) ─────────────────────────

function getStrokeLineDash(strokeStyle: string | undefined, strokeWidth: number) {
  if (!strokeStyle || strokeStyle === 'solid') return undefined;
  if (strokeStyle === 'dashed') return [8 + strokeWidth, 4 + strokeWidth];
  if (strokeStyle === 'dotted') return [2, 4 + strokeWidth];
  return undefined;
}

function getRoughFillStyle(fillStyle: string | undefined): RoughOptions['fillStyle'] {
  if (fillStyle === 'solid') return 'solid';
  if (fillStyle === 'cross-hatch') return 'cross-hatch';
  return 'hachure';
}

function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function computeElementHash(el: CanvasElement): string {
  const pts = el.points?.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';') ?? '';
  return [
    el.type, el.x, el.y, el.width, el.height,
    el.strokeColor, el.fillColor, el.fillStyle ?? '',
    el.strokeWidth, el.roughness, el.strokeStyle ?? '',
    el.edgeRoundness ?? 0, el.connectorStyle ?? '',
    pts,
  ].join('|');
}

function generateDrawables(el: CanvasElement) {
  const strokeLineDash = getStrokeLineDash(el.strokeStyle, el.strokeWidth);
  const options: RoughOptions = {
    stroke: el.strokeColor,
    fill: el.fillColor !== 'transparent' ? el.fillColor : undefined,
    fillStyle: getRoughFillStyle(el.fillStyle),
    strokeWidth: el.strokeWidth,
    roughness: el.roughness,
    seed: hashStringToNumber(el.id),
    ...(strokeLineDash ? { strokeLineDash } : {}),
  };

  switch (el.type) {
    case 'rectangle': {
      const r = el.edgeRoundness || 0;
      if (r > 0) {
        const { x, y, width: w, height: h } = el;
        const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        const path = `M ${x + radius} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${y + h - radius} Q ${x + w} ${y + h} ${x + w - radius} ${y + h} L ${x + radius} ${y + h} Q ${x} ${y + h} ${x} ${y + h - radius} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`;
        return [gen.path(path, options)];
      }
      return [gen.rectangle(el.x, el.y, el.width, el.height, options)];
    }

    case 'diamond': {
      const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
      const hw = el.width / 2, hh = el.height / 2;
      return [gen.polygon([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], options)];
    }

    case 'ellipse':
      return [gen.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, options)];

    case 'line':
      if (!el.points || el.points.length < 2 || el.connectorStyle === 'elbow') return null;
      return [gen.line(
        el.points[0].x + el.x, el.points[0].y + el.y,
        el.points[1].x + el.x, el.points[1].y + el.y,
        options,
      )];

    case 'arrow': {
      if (!el.points || el.points.length < 2 || el.connectorStyle === 'elbow') return null;
      const x1 = el.points[0].x + el.x, y1 = el.points[0].y + el.y;
      const x2 = el.points[1].x + el.x, y2 = el.points[1].y + el.y;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const hl = 16 + el.strokeWidth * 2, ha = Math.PI / 6;
      return [
        gen.line(x1, y1, x2, y2, options),
        gen.line(x2, y2, x2 - hl * Math.cos(angle - ha), y2 - hl * Math.sin(angle - ha), options),
        gen.line(x2, y2, x2 - hl * Math.cos(angle + ha), y2 - hl * Math.sin(angle + ha), options),
      ];
    }

    case 'freehand':
      if (!el.points || el.points.length < 2) return null;
      return [gen.linearPath(
        el.points.map(p => [p.x + el.x, p.y + el.y] as [number, number]),
        { ...options, roughness: 0 },
      )];

    default:
      return null; // text / image / embed / frame use ctx — no caching
  }
}

// ─── Message handler ─────────────────────────────────────────────

interface WorkerRequest {
  elements: CanvasElement[];
  requestId: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { elements, requestId } = e.data;
  const results: Record<string, { hash: string; drawables: unknown[] }> = {};

  for (const el of elements) {
    const drawables = generateDrawables(el);
    if (drawables) {
      results[el.id] = { hash: computeElementHash(el), drawables };
    }
  }

  self.postMessage({ requestId, results });
};
