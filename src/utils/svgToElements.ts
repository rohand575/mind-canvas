import { nanoid } from 'nanoid';
import type { CanvasElement } from '../types';

// Pixels between sampled points when converting SVG <path> to freehand
const SAMPLE_INTERVAL = 5;

// ─── Color helpers ────────────────────────────────────────────────

function resolveColor(raw: string | null | undefined, fallback: string): string {
  if (!raw || raw === 'inherit' || raw.startsWith('url(')) return fallback;
  if (raw === 'none') return 'transparent';
  return raw.trim();
}

/** Walk up the DOM (in the DOMParser document) to inherit SVG presentation attrs */
function inheritedAttr(el: Element, attr: string, fallback: string): string {
  let node: Element | null = el;
  while (node && node.tagName.toLowerCase() !== 'svg') {
    // inline style overrides attribute
    const style = node.getAttribute('style') ?? '';
    const m = style.match(new RegExp(`(?:^|;)\\s*${attr}\\s*:\\s*([^;]+)`, 'i'));
    if (m) return m[1].trim();
    const val = node.getAttribute(attr);
    if (val && val !== 'inherit') return val;
    node = node.parentElement;
  }
  return fallback;
}

function getStroke(el: Element): string {
  return resolveColor(inheritedAttr(el, 'stroke', 'none'), '#1e1e1e');
}
function getFill(el: Element): string {
  return resolveColor(inheritedAttr(el, 'fill', 'black'), '#1e1e1e');
}
function getStrokeWidth(el: Element): number {
  return Math.max(1, Math.min(6, parseFloat(inheritedAttr(el, 'stroke-width', '2')) || 2));
}
function getOpacity(el: Element): number {
  return Math.max(0, Math.min(1, parseFloat(inheritedAttr(el, 'opacity', '1')) || 1));
}
function getFontSize(el: Element): number {
  return Math.max(12, Math.min(48, parseFloat(inheritedAttr(el, 'font-size', '16')) || 16));
}

// ─── Coordinate transform ─────────────────────────────────────────

interface ViewBoxTransform {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  cx: number; // viewport center X
  cy: number; // viewport center Y
}

function tx(x: number, t: ViewBoxTransform): number {
  return x - t.vbX - t.vbW / 2 + t.cx;
}
function ty(y: number, t: ViewBoxTransform): number {
  return y - t.vbY - t.vbH / 2 + t.cy;
}

// ─── Path sampling ────────────────────────────────────────────────

/**
 * Uses the browser's SVG engine to densely sample points along an SVG path `d` attribute.
 * The hidden SVG container must already be appended to document.body.
 */
function sampleSVGPath(
  d: string,
  hiddenSVG: SVGSVGElement
): Array<{ x: number; y: number }> {
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', d);
  hiddenSVG.appendChild(pathEl);

  const total = pathEl.getTotalLength();
  if (total < 1) {
    hiddenSVG.removeChild(pathEl);
    return [];
  }

  const n = Math.max(2, Math.ceil(total / SAMPLE_INTERVAL));
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= n; i++) {
    const pt = pathEl.getPointAtLength((i / n) * total);
    pts.push({ x: pt.x, y: pt.y });
  }

  hiddenSVG.removeChild(pathEl);
  return pts;
}

// ─── Per-tag converters ───────────────────────────────────────────

function makeBase(
  el: Element,
  zIndex: number,
  now: number
) {
  const fill = getFill(el);
  const stroke = getStroke(el);
  return {
    id: nanoid(),
    strokeColor: stroke === 'transparent' ? '#1e1e1e' : stroke,
    fillColor: fill,
    strokeWidth: getStrokeWidth(el),
    roughness: 1 as const,
    opacity: getOpacity(el),
    strokeStyle: 'solid' as const,
    fillStyle: (fill === 'transparent' ? 'solid' : 'hachure') as 'solid' | 'hachure',
    edgeRoundness: 0,
    rotation: 0,
    zIndex,
    createdAt: now,
    updatedAt: now,
  };
}

function convertRect(el: Element, t: ViewBoxTransform, zIndex: number, now: number): CanvasElement | null {
  const x = parseFloat(el.getAttribute('x') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? '0');
  const w = parseFloat(el.getAttribute('width') ?? '0');
  const h = parseFloat(el.getAttribute('height') ?? '0');
  if (w <= 0 || h <= 0) return null;
  return { ...makeBase(el, zIndex, now), type: 'rectangle', x: tx(x, t), y: ty(y, t), width: w, height: h };
}

function convertCircle(el: Element, t: ViewBoxTransform, zIndex: number, now: number): CanvasElement | null {
  const cx = parseFloat(el.getAttribute('cx') ?? '0');
  const cy = parseFloat(el.getAttribute('cy') ?? '0');
  const r = parseFloat(el.getAttribute('r') ?? '0');
  if (r <= 0) return null;
  return { ...makeBase(el, zIndex, now), type: 'ellipse', x: tx(cx - r, t), y: ty(cy - r, t), width: r * 2, height: r * 2 };
}

function convertEllipse(el: Element, t: ViewBoxTransform, zIndex: number, now: number): CanvasElement | null {
  const cx = parseFloat(el.getAttribute('cx') ?? '0');
  const cy = parseFloat(el.getAttribute('cy') ?? '0');
  const rx = parseFloat(el.getAttribute('rx') ?? '0');
  const ry = parseFloat(el.getAttribute('ry') ?? '0');
  if (rx <= 0 || ry <= 0) return null;
  return { ...makeBase(el, zIndex, now), type: 'ellipse', x: tx(cx - rx, t), y: ty(cy - ry, t), width: rx * 2, height: ry * 2 };
}

function convertLine(el: Element, t: ViewBoxTransform, zIndex: number, now: number): CanvasElement | null {
  const x1 = parseFloat(el.getAttribute('x1') ?? '0');
  const y1 = parseFloat(el.getAttribute('y1') ?? '0');
  const x2 = parseFloat(el.getAttribute('x2') ?? '0');
  const y2 = parseFloat(el.getAttribute('y2') ?? '0');
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    ...makeBase(el, zIndex, now),
    roughness: 0,
    type: 'line',
    x: tx(x1, t),
    y: ty(y1, t),
    width: Math.abs(dx),
    height: Math.abs(dy),
    points: [{ x: 0, y: 0 }, { x: dx, y: dy }],
  };
}

function ptsToFreehand(
  absPoints: Array<{ x: number; y: number }>,
  el: Element,
  t: ViewBoxTransform,
  zIndex: number,
  now: number
): CanvasElement | null {
  if (absPoints.length < 2) return null;
  const minX = Math.min(...absPoints.map((p) => p.x));
  const minY = Math.min(...absPoints.map((p) => p.y));
  const maxX = Math.max(...absPoints.map((p) => p.x));
  const maxY = Math.max(...absPoints.map((p) => p.y));
  return {
    ...makeBase(el, zIndex, now),
    roughness: 0,
    fillColor: 'transparent', // freehand elements are stroke-only
    fillStyle: 'solid',
    type: 'freehand',
    x: tx(minX, t),
    y: ty(minY, t),
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    points: absPoints.map((p) => ({ x: p.x - minX, y: p.y - minY })),
  };
}

function convertPolyline(el: Element, t: ViewBoxTransform, zIndex: number, now: number, close = false): CanvasElement | null {
  const raw = el.getAttribute('points') ?? '';
  const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
  if (nums.length < 4) return null;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  if (close && pts.length > 0) pts.push(pts[0]);
  return ptsToFreehand(pts, el, t, zIndex, now);
}

function convertPath(
  el: Element,
  t: ViewBoxTransform,
  zIndex: number,
  now: number,
  hiddenSVG: SVGSVGElement
): CanvasElement | null {
  const d = el.getAttribute('d');
  if (!d) return null;
  const pts = sampleSVGPath(d, hiddenSVG);
  return ptsToFreehand(pts, el, t, zIndex, now);
}

function convertText(el: Element, t: ViewBoxTransform, zIndex: number, now: number): CanvasElement | null {
  const x = parseFloat(el.getAttribute('x') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? '0');
  const text = (el.textContent ?? '').trim();
  if (!text) return null;
  const fontSize = getFontSize(el);
  const anchor = el.getAttribute('text-anchor') ?? inheritedAttr(el, 'text-anchor', 'start');
  const estWidth = text.length * fontSize * 0.6;

  let adjustedX = x;
  if (anchor === 'middle') adjustedX = x - estWidth / 2;
  else if (anchor === 'end') adjustedX = x - estWidth;

  const fill = getFill(el);
  const textColor = fill === 'transparent' || fill === 'none'
    ? getStroke(el)
    : fill;

  return {
    id: nanoid(),
    type: 'text',
    x: tx(adjustedX, t),
    y: ty(y - fontSize, t), // SVG y is baseline; canvas y is top
    width: estWidth,
    height: fontSize * 1.4,
    text,
    fontSize,
    strokeColor: textColor === 'transparent' ? '#1e1e1e' : textColor,
    fillColor: 'transparent',
    strokeWidth: 1,
    roughness: 0,
    opacity: getOpacity(el),
    strokeStyle: 'solid',
    fillStyle: 'solid',
    edgeRoundness: 0,
    rotation: 0,
    zIndex,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Main traversal ───────────────────────────────────────────────

function processNode(
  el: Element,
  t: ViewBoxTransform,
  hiddenSVG: SVGSVGElement,
  out: CanvasElement[],
  startZIndex: number,
  now: number
) {
  const tag = el.tagName.toLowerCase().replace(/^.*:/, ''); // strip namespace prefix

  let converted: CanvasElement | null = null;
  const zIndex = startZIndex + out.length;

  switch (tag) {
    case 'rect':      converted = convertRect(el, t, zIndex, now); break;
    case 'circle':    converted = convertCircle(el, t, zIndex, now); break;
    case 'ellipse':   converted = convertEllipse(el, t, zIndex, now); break;
    case 'line':      converted = convertLine(el, t, zIndex, now); break;
    case 'polyline':  converted = convertPolyline(el, t, zIndex, now, false); break;
    case 'polygon':   converted = convertPolyline(el, t, zIndex, now, true); break;
    case 'path':      converted = convertPath(el, t, zIndex, now, hiddenSVG); break;
    case 'text':      converted = convertText(el, t, zIndex, now); break;
    case 'g':
      // Recurse into groups
      for (const child of Array.from(el.children)) {
        processNode(child, t, hiddenSVG, out, startZIndex, now);
      }
      return;
    default:
      return; // skip defs, patterns, gradients, etc.
  }

  if (converted) out.push(converted);
}

// ─── Public API ───────────────────────────────────────────────────

export function parseSVGToElements(
  svgString: string,
  viewportCenterX: number,
  viewportCenterY: number,
  startZIndex: number
): CanvasElement[] {
  const now = Date.now();

  // Create a hidden SVG in the main document so getTotalLength() works
  const hiddenSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  hiddenSVG.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:800px;height:600px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(hiddenSVG);

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    if (doc.querySelector('parsererror')) throw new Error('AI returned malformed SVG');

    const svgEl = doc.querySelector('svg');
    if (!svgEl) throw new Error('No <svg> element in AI response');

    const vbStr = svgEl.getAttribute('viewBox') ?? '0 0 800 600';
    const [vbX = 0, vbY = 0, vbW = 800, vbH = 600] = vbStr.split(/[\s,]+/).map(Number);

    const t: ViewBoxTransform = { vbX, vbY, vbW, vbH, cx: viewportCenterX, cy: viewportCenterY };
    const out: CanvasElement[] = [];

    for (const child of Array.from(svgEl.children)) {
      processNode(child, t, hiddenSVG, out, startZIndex, now);
    }

    return out;
  } finally {
    document.body.removeChild(hiddenSVG);
  }
}
