import { useRef, useEffect, useCallback } from 'react';
import rough from 'roughjs';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useHistory } from '../../hooks/useHistory';
import { renderElement } from '../../features/drawing/renderElement';
import { renderGrid } from '../../features/drawing/renderGrid';
import { renderSelection, renderSelectionBox } from '../../features/selection/renderSelection';
import { hitTestElement, getResizeHandleAtPoint, normalizeBounds, getElementBounds, boundsOverlap } from '../../utils/geometry';
import { createElement } from '../../utils/createElement';
import type { CanvasElement, Point, ResizeHandle, Bounds } from '../../types';

type InteractionMode =
  | { type: 'none' }
  | { type: 'drawing'; element: CanvasElement }
  | { type: 'moving'; startX: number; startY: number; originals: Map<string, { x: number; y: number }> }
  | { type: 'resizing'; elementId: string; handle: ResizeHandle; startX: number; startY: number; original: { x: number; y: number; width: number; height: number } }
  | { type: 'selecting'; startX: number; startY: number }
  | { type: 'text-input' };

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionMode>({ type: 'none' });
  const rafRef = useRef<number>(0);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const selectionBoxRef = useRef<Bounds | null>(null);

  const { handleWheel, handleKeyDown, handleKeyUp, startPan, movePan, endPan, isSpacePressed } =
    useCanvasInteraction();
  const { saveSnapshot } = useHistory();

  // ─── Screen ↔ Canvas coordinate conversion ────────────────────
  const screenToCanvas = useCallback((clientX: number, clientY: number): Point => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    return {
      x: (clientX - offsetX) / zoom,
      y: (clientY - offsetY) / zoom,
    };
  }, []);

  // ─── Render Loop ──────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { offsetX, offsetY, zoom, showGrid, theme } = useCanvasStore.getState();
    const { elements } = useElementStore.getState();
    const { selectedIds } = useToolStore.getState();
    const isDark = theme === 'dark';

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Set canvas resolution
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = isDark ? '#1a1a2e' : '#f8f9fa';
    ctx.fillRect(0, 0, w, h);

    // Grid
    if (showGrid) {
      renderGrid(ctx, w, h, offsetX, offsetY, zoom, isDark);
    }

    // Transform for canvas pan/zoom
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    // Render elements sorted by zIndex
    const rc = rough.canvas(canvas);
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const element of sorted) {
      renderElement(rc, ctx, element);
    }

    // Render selection UI
    const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
    renderSelection(ctx, selectedElements);

    // Render selection box
    if (selectionBoxRef.current) {
      renderSelectionBox(ctx, selectionBoxRef.current);
    }

    ctx.restore();

    rafRef.current = requestAnimationFrame(render);
  }, []);

  // ─── Setup / Teardown ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
    });
    resizeObserver.observe(container);

    // Start render loop
    rafRef.current = requestAnimationFrame(render);

    // Event listeners
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [render, handleWheel, handleKeyDown, handleKeyUp]);

  // ─── Mouse Down ───────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Left click only

      // Pan takes priority
      if (startPan(e.clientX, e.clientY)) return;

      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const { activeTool, selectedIds, setSelectedIds, clearSelection, strokeColor, fillColor, strokeWidth, roughness } = useToolStore.getState();
      const { elements, addElement, getMaxZIndex, updateElement } = useElementStore.getState();

      if (activeTool === 'select') {
        // Check if clicking on a resize handle of selected element
        for (const id of selectedIds) {
          const el = elements.find((e) => e.id === id);
          if (el) {
            const handle = getResizeHandleAtPoint(canvasPoint, el);
            if (handle) {
              saveSnapshot();
              interactionRef.current = {
                type: 'resizing',
                elementId: id,
                handle,
                startX: canvasPoint.x,
                startY: canvasPoint.y,
                original: { x: el.x, y: el.y, width: el.width, height: el.height },
              };
              return;
            }
          }
        }

        // Check if clicking on an element
        // Iterate in reverse z-order to pick topmost
        const sortedDesc = [...elements].sort((a, b) => b.zIndex - a.zIndex);
        const hitElement = sortedDesc.find((el) => hitTestElement(canvasPoint, el));

        if (hitElement) {
          if (e.shiftKey) {
            // Toggle selection with shift
            if (selectedIds.includes(hitElement.id)) {
              setSelectedIds(selectedIds.filter((id) => id !== hitElement.id));
            } else {
              setSelectedIds([...selectedIds, hitElement.id]);
            }
          } else if (!selectedIds.includes(hitElement.id)) {
            setSelectedIds([hitElement.id]);
          }

          // Start moving
          saveSnapshot();
          const currentSelected = e.shiftKey
            ? useToolStore.getState().selectedIds
            : (selectedIds.includes(hitElement.id) ? selectedIds : [hitElement.id]);

          const originals = new Map<string, { x: number; y: number }>();
          for (const id of currentSelected) {
            const el = elements.find((e) => e.id === id);
            if (el) originals.set(id, { x: el.x, y: el.y });
          }
          interactionRef.current = {
            type: 'moving',
            startX: canvasPoint.x,
            startY: canvasPoint.y,
            originals,
          };
        } else {
          // Start selection box
          if (!e.shiftKey) clearSelection();
          interactionRef.current = {
            type: 'selecting',
            startX: canvasPoint.x,
            startY: canvasPoint.y,
          };
        }
      } else if (activeTool === 'text') {
        // Show text input at click position
        interactionRef.current = { type: 'text-input' };
        showTextInput(canvasPoint);
      } else {
        // Drawing mode
        saveSnapshot();
        const newZ = getMaxZIndex() + 1;
        const isLinear = activeTool === 'line' || activeTool === 'arrow' || activeTool === 'freehand';

        const newElement = createElement({
          type: activeTool,
          x: canvasPoint.x,
          y: canvasPoint.y,
          strokeColor,
          fillColor,
          strokeWidth,
          roughness,
          zIndex: newZ,
          points: isLinear ? [{ x: 0, y: 0 }] : undefined,
        });

        addElement(newElement);
        interactionRef.current = { type: 'drawing', element: newElement };
      }
    },
    [startPan, screenToCanvas, saveSnapshot],
  );

  // ─── Mouse Move ───────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (movePan(e.clientX, e.clientY)) return;

      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const interaction = interactionRef.current;
      const { updateElement } = useElementStore.getState();

      if (interaction.type === 'drawing') {
        const el = interaction.element;
        if (el.type === 'freehand') {
          // Add point to freehand path
          const elements = useElementStore.getState().elements;
          const current = elements.find((e) => e.id === el.id);
          if (current) {
            const newPoint = { x: canvasPoint.x - el.x, y: canvasPoint.y - el.y };
            updateElement(el.id, { points: [...(current.points ?? []), newPoint] });
          }
        } else if (el.type === 'line' || el.type === 'arrow') {
          // Update end point
          const endPoint = { x: canvasPoint.x - el.x, y: canvasPoint.y - el.y };
          updateElement(el.id, { points: [{ x: 0, y: 0 }, endPoint] });
        } else {
          // Update width/height for shapes
          updateElement(el.id, {
            width: canvasPoint.x - el.x,
            height: canvasPoint.y - el.y,
          });
        }
      } else if (interaction.type === 'moving') {
        const dx = canvasPoint.x - interaction.startX;
        const dy = canvasPoint.y - interaction.startY;
        for (const [id, orig] of interaction.originals) {
          updateElement(id, { x: orig.x + dx, y: orig.y + dy });
        }
      } else if (interaction.type === 'resizing') {
        const { elementId, handle, startX, startY, original } = interaction;
        const dx = canvasPoint.x - startX;
        const dy = canvasPoint.y - startY;

        let { x, y, width, height } = original;

        // Apply resize based on handle
        if (handle.includes('e')) { width += dx; }
        if (handle.includes('w')) { x += dx; width -= dx; }
        if (handle.includes('s')) { height += dy; }
        if (handle.includes('n')) { y += dy; height -= dy; }

        updateElement(elementId, { x, y, width, height });
      } else if (interaction.type === 'selecting') {
        const { startX, startY } = interaction;
        selectionBoxRef.current = normalizeBounds(
          startX, startY,
          canvasPoint.x - startX,
          canvasPoint.y - startY,
        );
      }

      // Update cursor
      updateCursor(canvasPoint, e);
    },
    [movePan, screenToCanvas],
  );

  // ─── Mouse Up ─────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    endPan();

    const interaction = interactionRef.current;

    if (interaction.type === 'drawing') {
      // Normalize negative dimensions for shapes
      const el = interaction.element;
      if (el.type === 'rectangle' || el.type === 'ellipse') {
        const { elements } = useElementStore.getState();
        const current = elements.find((e) => e.id === el.id);
        if (current) {
          const normalized = normalizeBounds(current.x, current.y, current.width, current.height);
          useElementStore.getState().updateElement(el.id, normalized);
        }
      }
      // Switch back to select after drawing
      useToolStore.getState().setActiveTool('select');
      useToolStore.getState().setSelectedIds([el.id]);
    } else if (interaction.type === 'selecting' && selectionBoxRef.current) {
      // Select all elements inside selection box
      const box = selectionBoxRef.current;
      const { elements } = useElementStore.getState();
      const selectedIds = elements
        .filter((el) => boundsOverlap(box, getElementBounds(el)))
        .map((el) => el.id);
      useToolStore.getState().setSelectedIds(selectedIds);
      selectionBoxRef.current = null;
    }

    interactionRef.current = { type: 'none' };
  }, [endPan]);

  // ─── Cursor Management ────────────────────────────────────────
  const updateCursor = useCallback((canvasPoint: Point, e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { activeTool, selectedIds } = useToolStore.getState();
    const { isPanning } = useCanvasStore.getState();

    if (isPanning || isSpacePressed.current) {
      canvas.style.cursor = 'grab';
      return;
    }

    if (activeTool !== 'select') {
      canvas.style.cursor = 'crosshair';
      return;
    }

    // Check resize handles
    const { elements } = useElementStore.getState();
    for (const id of selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (el) {
        const handle = getResizeHandleAtPoint(canvasPoint, el);
        if (handle) {
          const cursorMap: Record<ResizeHandle, string> = {
            nw: 'nwse-resize', ne: 'nesw-resize',
            sw: 'nesw-resize', se: 'nwse-resize',
            n: 'ns-resize', s: 'ns-resize',
            e: 'ew-resize', w: 'ew-resize',
          };
          canvas.style.cursor = cursorMap[handle];
          return;
        }
      }
    }

    // Check hover
    const sortedDesc = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    const hovered = sortedDesc.find((el) => hitTestElement(canvasPoint, el));
    canvas.style.cursor = hovered ? 'move' : 'default';
  }, [isSpacePressed]);

  // ─── Text Input ───────────────────────────────────────────────
  const showTextInput = useCallback((canvasPoint: Point) => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    const textarea = textInputRef.current;
    if (!textarea) return;

    textarea.style.display = 'block';
    textarea.style.left = (canvasPoint.x * zoom + offsetX) + 'px';
    textarea.style.top = (canvasPoint.y * zoom + offsetY) + 'px';
    textarea.style.fontSize = (20 * zoom) + 'px';
    textarea.value = '';
    textarea.focus();

    const finishText = () => {
      const text = textarea.value.trim();
      if (text) {
        saveSnapshot();
        const { strokeColor, strokeWidth, roughness } = useToolStore.getState();
        const newElement = createElement({
          type: 'text',
          x: canvasPoint.x,
          y: canvasPoint.y,
          text,
          strokeColor,
          strokeWidth,
          roughness,
          zIndex: useElementStore.getState().getMaxZIndex() + 1,
        });
        // Measure text width/height
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.font = `${20}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
            const lines = text.split('\n');
            const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
            newElement.width = maxWidth;
            newElement.height = lines.length * 26;
          }
        }
        useElementStore.getState().addElement(newElement);
        useToolStore.getState().setActiveTool('select');
        useToolStore.getState().setSelectedIds([newElement.id]);
      }
      textarea.style.display = 'none';
      interactionRef.current = { type: 'none' };
      textarea.removeEventListener('blur', finishText);
    };

    textarea.addEventListener('blur', finishText);
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        textarea.value = '';
        textarea.blur();
      }
      // Allow Enter for newlines, Shift+Enter or just blur to confirm
    });
  }, [saveSnapshot]);

  const { theme } = useCanvasStore();

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative ${theme === 'dark' ? 'dark' : ''}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <textarea
        ref={textInputRef}
        className="absolute hidden p-0 m-0 border-none outline-none bg-transparent resize-none overflow-hidden text-gray-900 dark:text-gray-100"
        style={{
          fontFamily: "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive",
          minWidth: '100px',
          minHeight: '30px',
          lineHeight: 1.3,
        }}
        rows={1}
      />
    </div>
  );
}
