import { GRID_SIZE } from '../../constants';

/**
 * Renders a dot grid background that moves with canvas pan and scales with zoom.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
  isDark: boolean,
) {
  const scaledGrid = GRID_SIZE * zoom;
  if (scaledGrid < 5) return; // Don't render if grid is too small

  const startX = (offsetX % scaledGrid);
  const startY = (offsetY % scaledGrid);

  ctx.save();
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';

  const dotSize = Math.max(1, zoom * 1.5);

  for (let x = startX; x < width; x += scaledGrid) {
    for (let y = startY; y < height; y += scaledGrid) {
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
