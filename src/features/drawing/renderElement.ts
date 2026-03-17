import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { CanvasElement } from '../../types';

/**
 * Renders a single element to the canvas using rough.js for hand-drawn feel.
 */
export function renderElement(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  element: CanvasElement,
) {
  ctx.save();
  ctx.globalAlpha = element.opacity;

  const options = {
    stroke: element.strokeColor,
    fill: element.fillColor !== 'transparent' ? element.fillColor : undefined,
    fillStyle: 'hachure' as const,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    seed: hashStringToNumber(element.id), // Consistent roughness per element
  };

  switch (element.type) {
    case 'rectangle':
      rc.rectangle(element.x, element.y, element.width, element.height, options);
      break;

    case 'ellipse':
      rc.ellipse(
        element.x + element.width / 2,
        element.y + element.height / 2,
        element.width,
        element.height,
        options,
      );
      break;

    case 'line':
      if (element.points && element.points.length >= 2) {
        const p1 = element.points[0];
        const p2 = element.points[1];
        rc.line(
          p1.x + element.x,
          p1.y + element.y,
          p2.x + element.x,
          p2.y + element.y,
          options,
        );
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

        // Draw the line
        rc.line(x1, y1, x2, y2, options);

        // Draw arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 16 + element.strokeWidth * 2;
        const headAngle = Math.PI / 6;

        const ax1 = x2 - headLen * Math.cos(angle - headAngle);
        const ay1 = y2 - headLen * Math.sin(angle - headAngle);
        const ax2 = x2 - headLen * Math.cos(angle + headAngle);
        const ay2 = y2 - headLen * Math.sin(angle + headAngle);

        rc.line(x2, y2, ax1, ay1, options);
        rc.line(x2, y2, ax2, ay2, options);
      }
      break;

    case 'freehand':
      if (element.points && element.points.length > 1) {
        const pts = element.points.map(
          (p) => [p.x + element.x, p.y + element.y] as [number, number],
        );
        rc.linearPath(pts, {
          ...options,
          roughness: 0, // Freehand already looks rough from hand movement
        });
      }
      break;

    case 'text':
      // Text doesn't use rough.js - render directly
      ctx.font = `${element.fontSize ?? 20}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
      ctx.fillStyle = element.strokeColor;
      ctx.textBaseline = 'top';
      const lines = (element.text ?? '').split('\n');
      const lineHeight = (element.fontSize ?? 20) * 1.3;
      lines.forEach((line, i) => {
        ctx.fillText(line, element.x, element.y + i * lineHeight);
      });
      break;
  }

  ctx.restore();
}

/**
 * Simple string hash for consistent rough.js seed per element
 */
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
