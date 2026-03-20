import type { RoughSVG } from 'roughjs/bin/svg';
import type { Options as RoughOptions } from 'roughjs/bin/core';
import type { CanvasElement } from '../../types';

function getStrokeLineDash(strokeStyle: string | undefined, strokeWidth: number): number[] | undefined {
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
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Renders a single element as SVG nodes using rough.js
 */
export function renderElementSVG(
  rc: RoughSVG,
  parent: SVGElement,
  element: CanvasElement,
) {
  const strokeLineDash = getStrokeLineDash(element.strokeStyle, element.strokeWidth);
  const options: RoughOptions = {
    stroke: element.strokeColor,
    fill: element.fillColor !== 'transparent' ? element.fillColor : undefined,
    fillStyle: getRoughFillStyle(element.fillStyle),
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    seed: hashStringToNumber(element.id),
    ...(strokeLineDash ? { strokeLineDash } : {}),
  };

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  if (element.opacity < 1) {
    g.setAttribute('opacity', String(element.opacity));
  }
  parent.appendChild(g);

  switch (element.type) {
    case 'rectangle': {
      const r = element.edgeRoundness || 0;
      if (r > 0) {
        const x = element.x;
        const y = element.y;
        const w = element.width;
        const h = element.height;
        const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        const path = `M ${x + radius} ${y} 
          L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius}
          L ${x + w} ${y + h - radius} Q ${x + w} ${y + h} ${x + w - radius} ${y + h}
          L ${x + radius} ${y + h} Q ${x} ${y + h} ${x} ${y + h - radius}
          L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`;
        g.appendChild(rc.path(path, options));
      } else {
        g.appendChild(rc.rectangle(element.x, element.y, element.width, element.height, options));
      }
      break;
    }

    case 'diamond': {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const hw = element.width / 2;
      const hh = element.height / 2;
      g.appendChild(rc.polygon([
        [cx, cy - hh],
        [cx + hw, cy],
        [cx, cy + hh],
        [cx - hw, cy],
      ], options));
      break;
    }

    case 'ellipse':
      g.appendChild(rc.ellipse(
        element.x + element.width / 2,
        element.y + element.height / 2,
        element.width,
        element.height,
        options,
      ));
      break;

    case 'line':
      if (element.points && element.points.length >= 2) {
        const p1 = element.points[0];
        const p2 = element.points[1];
        g.appendChild(rc.line(
          p1.x + element.x, p1.y + element.y,
          p2.x + element.x, p2.y + element.y,
          options,
        ));
      }
      break;

    case 'arrow':
      if (element.points && element.points.length >= 2) {
        const p1 = element.points[0];
        const p2 = element.points[1];
        const x1 = p1.x + element.x;
        const y1 = p1.y + element.y;
        const x2 = p2.x + element.x;
        const y2 = p2.y + element.y;

        g.appendChild(rc.line(x1, y1, x2, y2, options));

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 16 + element.strokeWidth * 2;
        const headAngle = Math.PI / 6;

        const ax1 = x2 - headLen * Math.cos(angle - headAngle);
        const ay1 = y2 - headLen * Math.sin(angle - headAngle);
        const ax2 = x2 - headLen * Math.cos(angle + headAngle);
        const ay2 = y2 - headLen * Math.sin(angle + headAngle);

        g.appendChild(rc.line(x2, y2, ax1, ay1, options));
        g.appendChild(rc.line(x2, y2, ax2, ay2, options));
      }
      break;

    case 'freehand':
      if (element.points && element.points.length > 1) {
        const pts = element.points.map(
          (p) => [p.x + element.x, p.y + element.y] as [number, number],
        );
        g.appendChild(rc.linearPath(pts, { ...options, roughness: 0 }));
      }
      break;

    case 'text': {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(element.x));
      text.setAttribute('y', String(element.y));
      text.setAttribute('fill', element.strokeColor);
      text.setAttribute('font-family', "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive");
      text.setAttribute('font-size', String(element.fontSize ?? 40));
      text.setAttribute('dominant-baseline', 'hanging');

      const lines = (element.text ?? '').split('\n');
      const lineHeight = (element.fontSize ?? 40) * 1.3;
      lines.forEach((line, i) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', String(element.x));
        tspan.setAttribute('y', String(element.y + i * lineHeight));
        tspan.textContent = line;
        text.appendChild(tspan);
      });
      g.appendChild(text);
      break;
    }
  }
}
