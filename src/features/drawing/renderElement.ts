import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Drawable } from 'roughjs/bin/core';
import type { Options as RoughOptions } from 'roughjs/bin/core';
import type { CanvasElement } from '../../types';
import { tokenizeLine, getTokenColor, CODE_THEME_DARK, CODE_FONT, CODE_LINE_HEIGHT, CODE_PADDING, CODE_BORDER_RADIUS } from '../../utils/codeDetection';
import { wrapTextToLines } from '../../utils/textWrap';

// Module-level generator — stateless, safe to reuse across frames
const gen = rough.generator();

// ─── Drawable cache ───────────────────────────────────────────────
export interface DrawableEntry { hash: string; drawables: Drawable[] }
export type DrawableCache = Map<string, DrawableEntry>;

/** Stable hash of all visual properties that affect rough.js output */
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

/** Draw from cache, generating and storing the Drawable on miss. */
function drawWithCache(
  rc: RoughCanvas,
  cache: DrawableCache | undefined,
  element: CanvasElement,
  generate: () => Drawable[],
): void {
  if (!cache) {
    for (const d of generate()) rc.draw(d);
    return;
  }
  const hash = computeElementHash(element);
  const cached = cache.get(element.id);
  let drawables: Drawable[];
  if (cached && cached.hash === hash) {
    drawables = cached.drawables;
  } else {
    drawables = generate();
    cache.set(element.id, { hash, drawables });
  }
  for (const d of drawables) rc.draw(d);
}

const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const img = new Image();
  img.src = src;
  imageCache.set(src, img);
  return img.complete ? img : null;
}

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

interface TextHighlightRange {
  start: number;
  length: number;
  active?: boolean;
}

interface RenderElementOptions {
  textHighlights?: TextHighlightRange[];
  isDark?: boolean;
  drawableCache?: DrawableCache;
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
      drawWithCache(rc, renderOptions?.drawableCache, element, () => {
        const r = element.edgeRoundness || 0;
        if (r > 0) {
          const x = element.x, y = element.y, w = element.width, h = element.height;
          const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
          const path = `M ${x + radius} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${y + h - radius} Q ${x + w} ${y + h} ${x + w - radius} ${y + h} L ${x + radius} ${y + h} Q ${x} ${y + h} ${x} ${y + h - radius} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`;
          return [gen.path(path, options)];
        }
        return [gen.rectangle(element.x, element.y, element.width, element.height, options)];
      });
      break;
    }

    case 'frame': {
      renderFrame(ctx, element, renderOptions?.isDark);
      break;
    }

    case 'diamond': {
      drawWithCache(rc, renderOptions?.drawableCache, element, () => {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const hw = element.width / 2;
        const hh = element.height / 2;
        return [gen.polygon([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], options)];
      });
      break;
    }

    case 'ellipse':
      drawWithCache(rc, renderOptions?.drawableCache, element, () => [
        gen.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width, element.height, options),
      ]);
      break;

    case 'line':
      if (element.points && element.points.length >= 2) {
        if (element.connectorStyle === 'elbow') {
          renderElbowConnector(rc, ctx, element, options, false);
        } else {
          drawWithCache(rc, renderOptions?.drawableCache, element, () => {
            const p1 = element.points![0], p2 = element.points![1];
            return [gen.line(p1.x + element.x, p1.y + element.y, p2.x + element.x, p2.y + element.y, options)];
          });
        }
        renderConnectorLabel(ctx, element);
      }
      break;

    case 'arrow':
      if (element.points && element.points.length >= 2) {
        if (element.connectorStyle === 'elbow') {
          renderElbowConnector(rc, ctx, element, options, true);
        } else {
          drawWithCache(rc, renderOptions?.drawableCache, element, () => {
            const p1 = element.points![0], p2 = element.points![1];
            const x1 = p1.x + element.x, y1 = p1.y + element.y;
            const x2 = p2.x + element.x, y2 = p2.y + element.y;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = 16 + element.strokeWidth * 2;
            const ha = Math.PI / 6;
            return [
              gen.line(x1, y1, x2, y2, options),
              gen.line(x2, y2, x2 - headLen * Math.cos(angle - ha), y2 - headLen * Math.sin(angle - ha), options),
              gen.line(x2, y2, x2 - headLen * Math.cos(angle + ha), y2 - headLen * Math.sin(angle + ha), options),
            ];
          });
        }
        renderConnectorLabel(ctx, element);
      }
      break;

    case 'freehand':
      if (element.points && element.points.length > 1) {
        drawWithCache(rc, renderOptions?.drawableCache, element, () => {
          const pts = element.points!.map(p => [p.x + element.x, p.y + element.y] as [number, number]);
          return [gen.linearPath(pts, { ...options, roughness: 0 })];
        });
      }
      break;

    case 'image':
      if (element.imageData) {
        const img = getCachedImage(element.imageData);
        if (img) {
          ctx.drawImage(img, element.x, element.y, element.width, element.height);
        } else {
          ctx.strokeStyle = element.strokeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(element.x, element.y, element.width, element.height);
        }
      }
      break;

    case 'embed': {
      renderEmbedPlaceholder(ctx, element, renderOptions?.isDark);
      break;
    }

    case 'text':
      if (element.isCode) {
        renderCodeBlock(ctx, element, renderOptions?.textHighlights);
      } else {
        const fontSize = element.fontSize ?? 40;
        ctx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
        ctx.textBaseline = 'top';
        const lineHeight = fontSize * 1.3;

        const rawText = element.text ?? '';
        const lines = element.textWrap && element.width > 0
          ? wrapTextToLines(rawText, element.width, ctx)
          : rawText.split('\n');

        if (!element.textWrap && renderOptions?.textHighlights?.length) {
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

  // Render hyperlink icon overlay
  if (element.hyperlink) {
    renderHyperlinkIcon(ctx, element);
  }

  // Render lock icon overlay
  if (element.locked) {
    renderLockIcon(ctx, element);
  }

  ctx.restore();
}

// ─── Elbow connector ─────────────────────────────────────────────

function renderElbowConnector(
  rc: RoughCanvas,
  _ctx: CanvasRenderingContext2D,
  element: CanvasElement,
  options: RoughOptions,
  withArrowhead: boolean,
) {
  if (!element.points || element.points.length < 2) return;
  const p1 = element.points[0];
  const p2 = element.points[1];
  const x1 = p1.x + element.x;
  const y1 = p1.y + element.y;
  const x2 = p2.x + element.x;
  const y2 = p2.y + element.y;

  // Route: (x1,y1) → (midX, y1) → (midX, y2) → (x2, y2)
  const midX = (x1 + x2) / 2;

  rc.line(x1, y1, midX, y1, options);
  rc.line(midX, y1, midX, y2, options);
  rc.line(midX, y2, x2, y2, options);

  if (withArrowhead) {
    // Arrowhead at (x2, y2) pointing in final segment direction
    const angle = Math.atan2(y2 - y2, x2 - midX); // horizontal final segment
    const finalAngle = x2 >= midX ? 0 : Math.PI;
    const headLen = 16 + element.strokeWidth * 2;
    const headAngle = Math.PI / 6;

    rc.line(
      x2, y2,
      x2 - headLen * Math.cos(finalAngle - headAngle),
      y2 - headLen * Math.sin(finalAngle - headAngle),
      options,
    );
    rc.line(
      x2, y2,
      x2 - headLen * Math.cos(finalAngle + headAngle),
      y2 - headLen * Math.sin(finalAngle + headAngle),
      options,
    );
    void angle;
  }
}

// ─── Connector label ─────────────────────────────────────────────

function renderConnectorLabel(ctx: CanvasRenderingContext2D, element: CanvasElement) {
  if (!element.connectorLabel || !element.points || element.points.length < 2) return;

  const p1 = element.points[0];
  const p2 = element.points[1];
  const midX = (p1.x + element.x + p2.x + element.x) / 2;
  const midY = (p1.y + element.y + p2.y + element.y) / 2;

  const fontSize = 13;
  ctx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const textWidth = ctx.measureText(element.connectorLabel).width;
  const pad = 4;
  const bgW = textWidth + pad * 2;
  const bgH = fontSize + pad * 2;

  // White background pill
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(midX - bgW / 2, midY - bgH / 2, bgW, bgH, 4);
  ctx.fill();

  ctx.strokeStyle = 'rgba(99,102,241,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.stroke();

  ctx.fillStyle = element.strokeColor;
  ctx.fillText(element.connectorLabel, midX, midY);
  ctx.textAlign = 'left';
}

// ─── Frame ───────────────────────────────────────────────────────

function renderFrame(ctx: CanvasRenderingContext2D, element: CanvasElement, isDark = false) {
  const { x, y, width, height } = element;

  // Frame border: dashed
  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  // Frame background: very subtle tint
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';
  ctx.fillRect(x, y, width, height);

  // Frame label above top-left
  const name = element.frameName || 'Frame';
  const labelSize = 12;
  ctx.font = `600 ${labelSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = isDark ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)';
  ctx.fillText(name, x + 4, y - 3);

  ctx.restore();
}

// ─── Lock icon ───────────────────────────────────────────────────

function renderLockIcon(ctx: CanvasRenderingContext2D, element: CanvasElement) {
  const bounds = {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };

  const iconX = bounds.x + bounds.width - 18;
  const iconY = bounds.y + 2;
  const size = 14;

  ctx.save();
  ctx.fillStyle = 'rgba(99,102,241,0.85)';
  ctx.beginPath();
  ctx.roundRect(iconX - 2, iconY - 2, size + 4, size + 4, 3);
  ctx.fill();

  // Simple padlock path
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#fff';

  // Shackle
  ctx.beginPath();
  ctx.arc(iconX + size / 2, iconY + 4, 3.5, Math.PI, 0);
  ctx.stroke();

  // Body
  ctx.fillRect(iconX + 1, iconY + 5, size - 2, size - 7);
  ctx.restore();
}

// ─── Hyperlink icon ──────────────────────────────────────────────

function renderHyperlinkIcon(ctx: CanvasRenderingContext2D, element: CanvasElement) {
  if (element.type === 'line' || element.type === 'arrow' || element.type === 'freehand') return;

  const iconX = element.x + 2;
  const iconY = element.y + element.height - 16;

  ctx.save();
  ctx.strokeStyle = '#1971c2';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);

  // Chain link icon: two overlapping rounded rectangles
  const w = 10;
  const h = 6;
  ctx.beginPath();
  ctx.roundRect(iconX, iconY + 2, w, h, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(iconX + 5, iconY, w, h, 2);
  ctx.stroke();

  ctx.restore();
}

// ─── Code block ──────────────────────────────────────────────────

function renderCodeBlock(ctx: CanvasRenderingContext2D, element: CanvasElement, highlightRanges?: TextHighlightRange[]) {
  const fontSize = element.fontSize ?? 14;
  const lineHeight = fontSize * CODE_LINE_HEIGHT;
  const lines = (element.text ?? '').split('\n');
  const language = element.codeLanguage ?? 'code';

  const theme = CODE_THEME_DARK;

  const x = element.x;
  const y = element.y;
  const w = element.width;
  const h = element.height;

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

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (language && language !== 'code') {
    ctx.font = `${Math.max(10, fontSize - 2)}px ${CODE_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillText(language, x + w - CODE_PADDING, y + 6);
    ctx.textAlign = 'left';
  }

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

// ─── Embed placeholder ───────────────────────────────────────────

function renderEmbedPlaceholder(ctx: CanvasRenderingContext2D, element: CanvasElement, isDark = false) {
  const { x, y, width: w, height: h } = element;
  if (w <= 0 || h <= 0) return;

  ctx.save();

  // Card background
  ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  // Card border
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();

  // Browser chrome header bar
  const headerH = Math.min(28, h * 0.15);
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, headerH, [6, 6, 0, 0]);
  ctx.fill();

  // Separator line under header
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + headerH);
  ctx.lineTo(x + w, y + headerH);
  ctx.stroke();

  // Traffic-light dots
  const dotY = y + headerH / 2;
  const dotColors = ['#ff5f57', '#febc2e', '#28c840'];
  dotColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 10 + i * 14, dotY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // URL pill in header
  if (w > 120 && element.embedUrl) {
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const pillW = Math.min(w - 80, 200);
    const pillH = headerH - 8;
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - pillW / 2, y + 4, pillW, pillH, 3);
    ctx.fill();

    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
    ctx.font = `10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    let urlText = element.embedUrl.replace(/^https?:\/\//, '');
    while (ctx.measureText(urlText).width > pillW - 8 && urlText.length > 8) {
      urlText = urlText.slice(0, -4) + '...';
    }
    ctx.fillText(urlText, x + w / 2, y + headerH / 2);
    ctx.textAlign = 'left';
  }

  // Center play icon (only when there's enough space)
  if (h > headerH + 40) {
    const bodyH = h - headerH;
    const cx = x + w / 2;
    const cy = y + headerH + bodyH / 2;
    const iconR = Math.min(24, bodyH * 0.25, w * 0.15);

    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
    ctx.beginPath();
    ctx.arc(cx, cy, iconR + 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(cx - iconR * 0.4, cy - iconR * 0.6);
    ctx.lineTo(cx + iconR * 0.7, cy);
    ctx.lineTo(cx - iconR * 0.4, cy + iconR * 0.6);
    ctx.closePath();
    ctx.fill();

    // "Click to interact" hint
    if (element.embedUrl && h > 100) {
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)';
      ctx.font = `11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('Double-click to interact', cx, cy + iconR + 18);
      ctx.textAlign = 'left';
    } else if (!element.embedUrl) {
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)';
      ctx.font = `11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('Double-click to add URL', cx, cy + iconR + 18);
      ctx.textAlign = 'left';
    }
  }

  ctx.restore();
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
