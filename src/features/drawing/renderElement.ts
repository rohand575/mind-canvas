import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Options as RoughOptions } from 'roughjs/bin/core';
import type { CanvasElement } from '../../types';
import { tokenizeLine, getTokenColor, CODE_THEME_DARK, CODE_FONT, CODE_LINE_HEIGHT, CODE_PADDING, CODE_BORDER_RADIUS } from '../../utils/codeDetection';

// Cache loaded images so the render loop doesn't recreate them every frame
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const img = new Image();
  img.src = src;
  imageCache.set(src, img);
  return img.complete ? img : null;
}

/**
 * Convert our strokeStyle to rough.js strokeLineDash
 */
function getStrokeLineDash(strokeStyle: string | undefined, strokeWidth: number): number[] | undefined {
  if (!strokeStyle || strokeStyle === 'solid') return undefined;
  if (strokeStyle === 'dashed') return [8 + strokeWidth, 4 + strokeWidth];
  if (strokeStyle === 'dotted') return [2, 4 + strokeWidth];
  return undefined;
}

/**
 * Convert our fillStyle to rough.js fillStyle
 */
function getRoughFillStyle(fillStyle: string | undefined): RoughOptions['fillStyle'] {
  if (fillStyle === 'solid') return 'solid';
  if (fillStyle === 'cross-hatch') return 'cross-hatch';
  return 'hachure'; // default
}

/**
 * Renders a single element to the canvas using rough.js for hand-drawn feel.
 */
interface TextHighlightRange {
  start: number;
  length: number;
  active?: boolean;
}

interface RenderElementOptions {
  textHighlights?: TextHighlightRange[];
}

export function renderElement(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  element: CanvasElement,
  renderOptions?: RenderElementOptions,
) {
  ctx.save();
  ctx.globalAlpha = element.opacity;

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

  switch (element.type) {
    case 'rectangle': {
      const r = element.edgeRoundness || 0;
      if (r > 0) {
        // Rough.js doesn't support rounded rectangles directly, draw with path
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
        rc.path(path, options);
      } else {
        rc.rectangle(element.x, element.y, element.width, element.height, options);
      }
      break;
    }

    case 'diamond': {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const hw = element.width / 2;
      const hh = element.height / 2;
      // Diamond as a polygon (4 points: top, right, bottom, left)
      rc.polygon([
        [cx, cy - hh],     // top
        [cx + hw, cy],     // right
        [cx, cy + hh],     // bottom
        [cx - hw, cy],     // left
      ], options);
      break;
    }

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
          roughness: 0,
        });
      }
      break;

    case 'image':
      if (element.imageData) {
        const img = getCachedImage(element.imageData);
        if (img) {
          ctx.drawImage(img, element.x, element.y, element.width, element.height);
        } else {
          // Image still loading — draw placeholder
          ctx.strokeStyle = element.strokeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(element.x, element.y, element.width, element.height);
        }
      }
      break;

    case 'text':
      if (element.isCode) {
        renderCodeBlock(ctx, element, renderOptions?.textHighlights);
      } else {
        ctx.font = `${element.fontSize ?? 40}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
        ctx.textBaseline = 'top';
        const lines = (element.text ?? '').split('\n');
        const lineHeight = (element.fontSize ?? 40) * 1.3;

        if (renderOptions?.textHighlights?.length) {
          ctx.fillStyle = 'rgba(252,232,170,0.85)';
          const lineStarts = lines.reduce<number[]>((acc, _line, i) => {
            acc.push(i === 0 ? 0 : acc[i - 1] + lines[i - 1].length + 1);
            return acc;
          }, []);

          for (const highlight of renderOptions.textHighlights) {
            let remaining = highlight.length;
            let pos = highlight.start;
            for (let lineIndex = 0; lineIndex < lines.length && remaining > 0; lineIndex++) {
              const lineStart = lineStarts[lineIndex];
              const lineText = lines[lineIndex];
              const lineEnd = lineStart + lineText.length;
              if (pos > lineEnd) continue;
              const segmentStart = Math.max(pos, lineStart);
              const segmentEnd = Math.min(lineEnd, pos + remaining);
              if (segmentEnd > segmentStart) {
                const xOffset = ctx.measureText(lineText.slice(0, segmentStart - lineStart)).width;
                const highlightText = lineText.slice(segmentStart - lineStart, segmentEnd - lineStart);
                const width = ctx.measureText(highlightText).width;
                const y = element.y + lineIndex * lineHeight;
                const x = element.x + xOffset;
                ctx.fillRect(x - 2, y, width + 4, lineHeight);
              }
              remaining -= segmentEnd - segmentStart;
              pos = lineEnd + 1;
            }
          }
        }

        ctx.fillStyle = element.strokeColor;
        lines.forEach((line, i) => {
          ctx.fillText(line, element.x, element.y + i * lineHeight);
        });
      }
      break;
  }

  ctx.restore();
}

/**
 * Renders a code block with syntax highlighting, rounded background, and monospace font.
 */
function renderCodeBlock(ctx: CanvasRenderingContext2D, element: CanvasElement, highlightRanges?: TextHighlightRange[]) {
  const fontSize = element.fontSize ?? 14;
  const lineHeight = fontSize * CODE_LINE_HEIGHT;
  const lines = (element.text ?? '').split('\n');
  const language = element.codeLanguage ?? 'code';

  // Detect theme from background brightness (use dark theme by default for code)
  const theme = CODE_THEME_DARK;

  const x = element.x;
  const y = element.y;
  const w = element.width;
  const h = element.height;

  // Draw rounded background
  ctx.fillStyle = theme.background;
  ctx.beginPath();
  const r = CODE_BORDER_RADIUS;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  // Draw subtle border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw language badge
  if (language && language !== 'code') {
    ctx.font = `${Math.max(10, fontSize - 2)}px ${CODE_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillText(language, x + w - CODE_PADDING, y + 6);
    ctx.textAlign = 'left';
  }

  // Render each line with syntax highlighting
  ctx.font = `${fontSize}px ${CODE_FONT}`;
  ctx.textBaseline = 'top';

  const textX = x + CODE_PADDING;
  const textStartY = y + CODE_PADDING;

  if (highlightRanges?.length) {
    ctx.fillStyle = 'rgba(252,232,170,0.85)';
    const lineStarts = lines.reduce<number[]>((acc, _line, i) => {
      acc.push(i === 0 ? 0 : acc[i - 1] + lines[i - 1].length + 1);
      return acc;
    }, []);

    for (const highlight of highlightRanges) {
      let remaining = highlight.length;
      let pos = highlight.start;
      for (let lineIndex = 0; lineIndex < lines.length && remaining > 0; lineIndex++) {
        const lineStart = lineStarts[lineIndex];
        const lineText = lines[lineIndex];
        const lineEnd = lineStart + lineText.length;
        if (pos > lineEnd) continue;
        const segmentStart = Math.max(pos, lineStart);
        const segmentEnd = Math.min(lineEnd, pos + remaining);
        if (segmentEnd > segmentStart) {
          const xOffset = ctx.measureText(lineText.slice(0, segmentStart - lineStart)).width;
          const highlightText = lineText.slice(segmentStart - lineStart, segmentEnd - lineStart);
          const width = ctx.measureText(highlightText).width;
          const yOffset = textStartY + lineIndex * lineHeight;
          ctx.fillRect(textX + xOffset - 2, yOffset, width + 4, lineHeight);
        }
        remaining -= segmentEnd - segmentStart;
        pos = lineEnd + 1;
      }
    }
  }

  lines.forEach((line, lineIdx) => {
    const tokens = tokenizeLine(line, language);
    let cursorX = textX;
    const cursorY = textStartY + lineIdx * lineHeight;

    for (const token of tokens) {
      ctx.fillStyle = getTokenColor(token.type, theme);
      ctx.fillText(token.text, cursorX, cursorY);
      cursorX += ctx.measureText(token.text).width;
    }
  });
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
