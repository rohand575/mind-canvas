import { useRef, useEffect, useCallback, useState } from 'react';
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
import { GRID_SIZE } from '../../constants';
import { ContextMenu } from './ContextMenu';
import type { CanvasElement, Point, ResizeHandle, Bounds } from '../../types';

function snapToGridValue(val: number, gridSize: number): number {
  return Math.round(val / gridSize) * gridSize;
}

function snapPoint(p: Point, snap: boolean): Point {
  if (!snap) return p;
  return { x: snapToGridValue(p.x, GRID_SIZE), y: snapToGridValue(p.y, GRID_SIZE) };
}

type InteractionMode =
  | { type: 'none' }
  | { type: 'drawing'; element: CanvasElement }
  | { type: 'moving'; startX: number; startY: number; originals: Map<string, { x: number; y: number }> }
  | { type: 'resizing'; elementId: string; handle: ResizeHandle; startX: number; startY: number; original: { x: number; y: number; width: number; height: number; fontSize?: number; points?: Point[] }; elementType: string }
  | { type: 'selecting'; startX: number; startY: number }
  | { type: 'text-input' };

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionMode>({ type: 'none' });
  const rafRef = useRef<number>(0);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const textPositionRef = useRef<Point | null>(null);
  const selectionBoxRef = useRef<Bounds | null>(null);
  const editingElementIdRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const { handleWheel, handleKeyDown, handleKeyUp, startPan, startRightClickPan, movePan, endPan, isSpacePressed } =
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
      if (element.id === editingElementIdRef.current) continue;
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
  // ─── Save Current Text (synchronous) ───────────────────────────
  const saveCurrentText = useCallback(() => {
    const textarea = textInputRef.current;
    const position = textPositionRef.current;
    if (!textarea || textarea.style.display === 'none' || !position) return;

    const text = textarea.value.trim();
    if (text) {
      saveSnapshot();
      const { strokeColor, strokeWidth, roughness, opacity, fontSize } = useToolStore.getState();
      const newElement = createElement({
        type: 'text',
        x: position.x,
        y: position.y,
        text,
        strokeColor,
        strokeWidth,
        roughness,
        opacity,
        fontSize,
        zIndex: useElementStore.getState().getMaxZIndex() + 1,
      });
      // Measure text width/height
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
          const lines = text.split('\n');
          const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
          newElement.width = maxWidth;
          newElement.height = lines.length * Math.round(fontSize * 1.3);
        }
      }
      useElementStore.getState().addElement(newElement);
    }
    textarea.style.display = 'none';
    textarea.value = '';
    textPositionRef.current = null;
    interactionRef.current = { type: 'none' };
    // Cleanup listeners
    (textarea as any).__cleanupBlur?.();
    (textarea as any).__cleanupKeydown?.();
  }, [saveSnapshot]);
  // ─── Mouse Down ───────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Right-click: show context menu if elements selected, otherwise pan
      if (e.button === 2) {
        e.preventDefault();
        const canvasPoint = screenToCanvas(e.clientX, e.clientY);
        const { selectedIds } = useToolStore.getState();
        const { elements } = useElementStore.getState();
        const sortedDesc = [...elements].sort((a, b) => b.zIndex - a.zIndex);
        const hitElement = sortedDesc.find((el) => hitTestElement(canvasPoint, el));
        if (hitElement || selectedIds.length > 0) {
          if (hitElement && !selectedIds.includes(hitElement.id)) {
            useToolStore.getState().setSelectedIds([hitElement.id]);
          }
          setContextMenu({ x: e.clientX, y: e.clientY });
        } else {
          startRightClickPan(e.clientX, e.clientY);
          if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        }
        return;
      }

      if (e.button !== 0) return; // Left click only

      // Close context menu on left click
      if (contextMenu) setContextMenu(null);

      // Save any active text input before starting new interaction
      saveCurrentText();

      const { activeTool, selectedIds, setSelectedIds, clearSelection, strokeColor, fillColor, strokeWidth, roughness, opacity, fontSize, strokeStyle, fillStyle, edgeRoundness } = useToolStore.getState();

      // Hand tool: always pan
      if (activeTool === 'hand') {
        startRightClickPan(e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }

      // Pan takes priority (space+drag)
      if (startPan(e.clientX, e.clientY)) return;

      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const { elements, addElement, getMaxZIndex } = useElementStore.getState();

      if (activeTool === 'select') {
        // Check if clicking on a resize handle of selected element
        for (const id of selectedIds) {
          const el = elements.find((e) => e.id === id);
          if (el) {
            const handle = getResizeHandleAtPoint(canvasPoint, el);
            if (handle) {
              saveSnapshot();
              // Get element bounds for point-based elements
              const bounds = getElementBounds(el);
              interactionRef.current = {
                type: 'resizing',
                elementId: id,
                handle,
                startX: canvasPoint.x,
                startY: canvasPoint.y,
                original: { 
                  x: bounds.x, 
                  y: bounds.y, 
                  width: bounds.width, 
                  height: bounds.height, 
                  fontSize: el.fontSize,
                  points: el.points ? el.points.map(p => ({ ...p })) : undefined
                },
                elementType: el.type,
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
        // Prevent canvas from stealing focus from the textarea
        e.preventDefault();
        // Show text input at click position
        interactionRef.current = { type: 'text-input' };
        showTextInput(canvasPoint);
      } else {
        // Drawing mode
        saveSnapshot();
        const snap = useCanvasStore.getState().snapToGrid;
        const drawPoint = activeTool === 'freehand' ? canvasPoint : snapPoint(canvasPoint, snap);
        const newZ = getMaxZIndex() + 1;
        const isLinear = activeTool === 'line' || activeTool === 'arrow' || activeTool === 'freehand';

        const newElement = createElement({
          type: activeTool as import('../../types').ElementType,
          x: drawPoint.x,
          y: drawPoint.y,
          strokeColor,
          fillColor,
          strokeWidth,
          roughness,
          opacity,
          fontSize,
          strokeStyle,
          fillStyle,
          edgeRoundness,
          zIndex: newZ,
          points: isLinear ? [{ x: 0, y: 0 }] : undefined,
        });

        addElement(newElement);
        interactionRef.current = { type: 'drawing', element: newElement };
      }
    },
    [startPan, startRightClickPan, screenToCanvas, saveSnapshot, saveCurrentText, contextMenu],
  );

  // ─── Mouse Move ───────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (movePan(e.clientX, e.clientY)) return;

      const rawCanvasPoint = screenToCanvas(e.clientX, e.clientY);
      const snap = useCanvasStore.getState().snapToGrid;
      const canvasPoint = rawCanvasPoint;
      const interaction = interactionRef.current;
      const { updateElement } = useElementStore.getState();

      if (interaction.type === 'drawing') {
        const el = interaction.element;
        const snappedPoint = snapPoint(rawCanvasPoint, snap);
        if (el.type === 'freehand') {
          // Add point to freehand path (no snapping for freehand)
          const elements = useElementStore.getState().elements;
          const current = elements.find((e) => e.id === el.id);
          if (current) {
            const newPoint = { x: rawCanvasPoint.x - el.x, y: rawCanvasPoint.y - el.y };
            updateElement(el.id, { points: [...(current.points ?? []), newPoint] });
          }
        } else if (el.type === 'line' || el.type === 'arrow') {
          // Update end point
          const endPoint = { x: snappedPoint.x - el.x, y: snappedPoint.y - el.y };
          updateElement(el.id, { points: [{ x: 0, y: 0 }, endPoint] });
        } else {
          // Update width/height for shapes
          updateElement(el.id, {
            width: snappedPoint.x - el.x,
            height: snappedPoint.y - el.y,
          });
        }
      } else if (interaction.type === 'moving') {
        const dx = rawCanvasPoint.x - interaction.startX;
        const dy = rawCanvasPoint.y - interaction.startY;
        for (const [id, orig] of interaction.originals) {
          const newPos = snapPoint({ x: orig.x + dx, y: orig.y + dy }, snap);
          updateElement(id, { x: newPos.x, y: newPos.y });
        }
      } else if (interaction.type === 'resizing') {
        const { elementId, handle, startX, startY, original, elementType } = interaction;
        const dx = canvasPoint.x - startX;
        const dy = canvasPoint.y - startY;

        let { x, y, width, height } = original;

        // Apply resize based on handle
        if (handle.includes('e')) { width += dx; }
        if (handle.includes('w')) { x += dx; width -= dx; }
        if (handle.includes('s')) { height += dy; }
        if (handle.includes('n')) { y += dy; height -= dy; }

        // For text elements, scale fontSize proportionally
        if (elementType === 'text' && original.fontSize) {
          const scaleX = original.width > 0 ? width / original.width : 1;
          const scaleY = original.height > 0 ? height / original.height : 1;
          const scale = Math.max(0.1, Math.min(scaleX, scaleY)); // Use smaller scale, min 10%
          const newFontSize = Math.round(original.fontSize * scale);
          updateElement(elementId, { x, y, width, height, fontSize: Math.max(8, Math.min(200, newFontSize)) });
        } else if ((elementType === 'line' || elementType === 'arrow' || elementType === 'freehand') && original.points) {
          // For point-based elements, scale points proportionally
          const scaleX = original.width > 0 ? Math.abs(width) / original.width : 1;
          const scaleY = original.height > 0 ? Math.abs(height) / original.height : 1;
          
          // Find the bounds of original points to calculate proper offset
          const origMinX = Math.min(...original.points.map(p => p.x));
          const origMinY = Math.min(...original.points.map(p => p.y));
          
          // Scale points relative to their bounding box origin
          const scaledPoints = original.points.map(p => ({
            x: (p.x - origMinX) * scaleX + (width < 0 ? Math.abs(width) : 0),
            y: (p.y - origMinY) * scaleY + (height < 0 ? Math.abs(height) : 0),
          }));
          
          // Update element position (to new bounding box origin) and scaled points
          updateElement(elementId, { x, y, points: scaledPoints });
        } else {
          updateElement(elementId, { x, y, width, height });
        }
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
      if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') {
        const { elements } = useElementStore.getState();
        const current = elements.find((e) => e.id === el.id);
        if (current) {
          const normalized = normalizeBounds(current.x, current.y, current.width, current.height);
          useElementStore.getState().updateElement(el.id, normalized);
        }
      }
      // Switch back to select after drawing (unless lock mode)
      const { lockToolMode } = useToolStore.getState();
      if (!lockToolMode) {
        useToolStore.getState().setActiveTool('select');
      }
    } else if (interaction.type === 'resizing' && interaction.elementType === 'text') {
      // Recalculate text dimensions based on new fontSize
      const { elements } = useElementStore.getState();
      const current = elements.find((e) => e.id === interaction.elementId);
      if (current && current.text) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const fontSize = current.fontSize ?? 40;
            ctx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
            const lines = current.text.split('\n');
            const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
            const height = lines.length * Math.round(fontSize * 1.3);
            useElementStore.getState().updateElement(interaction.elementId, { width: maxWidth, height });
          }
        }
      }
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
  const updateCursor = useCallback((canvasPoint: Point, _e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { activeTool, selectedIds } = useToolStore.getState();
    const { isPanning } = useCanvasStore.getState();

    if (activeTool === 'hand' || isPanning || isSpacePressed.current) {
      canvas.style.cursor = isPanning ? 'grabbing' : 'grab';
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

  // ─── Edit existing text element ───────────────────────────────
  const showTextInputForEdit = useCallback((element: CanvasElement, clickPoint?: Point) => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    const textarea = textInputRef.current;
    if (!textarea) return;

    editingElementIdRef.current = element.id;

    textarea.style.display = 'block';
    textarea.style.left = (element.x * zoom + offsetX) + 'px';
    textarea.style.top = (element.y * zoom + offsetY) + 'px';
    textarea.style.fontSize = ((element.fontSize ?? 40) * zoom) + 'px';
    textarea.style.color = element.strokeColor;
    textarea.value = element.text ?? '';
    textarea.focus();
    
    // Place cursor at click position instead of selecting all
    if (clickPoint) {
      const text = element.text ?? '';
      const fontSize = element.fontSize ?? 40;
      const lineHeight = fontSize * 1.3;
      const relY = clickPoint.y - element.y;
      const lineIndex = Math.max(0, Math.floor(relY / lineHeight));
      const lines = text.split('\n');
      
      // Calculate character position in the clicked line
      let charPos = 0;
      for (let i = 0; i < Math.min(lineIndex, lines.length); i++) {
        charPos += lines[i].length + 1; // +1 for newline
      }
      
      if (lineIndex < lines.length) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
            const relX = clickPoint.x - element.x;
            const line = lines[lineIndex];
            // Find character position by measuring text width
            for (let i = 0; i <= line.length; i++) {
              const w = ctx.measureText(line.substring(0, i)).width;
              if (w >= relX) {
                charPos += Math.max(0, i - 1);
                break;
              }
              if (i === line.length) charPos += line.length;
            }
          }
        }
      }
      textarea.setSelectionRange(charPos, charPos);
    } else {
      textarea.select();
    }

    // Cleanup previous listeners
    (textarea as any).__cleanupBlur?.();
    (textarea as any).__cleanupKeydown?.();

    const finishEdit = () => {
      const text = textarea.value.trim();
      saveSnapshot();
      if (text) {
        const updates: Partial<CanvasElement> = { text };
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.font = `${element.fontSize ?? 40}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
            const lines = text.split('\n');
            const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
            updates.width = maxWidth;
            updates.height = lines.length * Math.round((element.fontSize ?? 40) * 1.3);
          }
        }
        useElementStore.getState().updateElement(element.id, updates);
      } else {
        useElementStore.getState().removeElements([element.id]);
      }
      textarea.style.display = 'none';
      editingElementIdRef.current = null;
      interactionRef.current = { type: 'none' };
      // Cleanup listeners
      (textarea as any).__cleanupBlur?.();
      (textarea as any).__cleanupKeydown?.();
    };

    textarea.addEventListener('blur', finishEdit);
    (textarea as any).__cleanupBlur = () => {
      textarea.removeEventListener('blur', finishEdit);
    };

    const handleEditKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        textarea.blur();
        useToolStore.getState().clearSelection();
      }
    };
    textarea.addEventListener('keydown', handleEditKeydown);
    (textarea as any).__cleanupKeydown = () => {
      textarea.removeEventListener('keydown', handleEditKeydown);
    };
  }, [saveSnapshot]);

  // ─── Double-Click (edit existing text) ─────────────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const { elements } = useElementStore.getState();
      const sortedDesc = [...elements].sort((a, b) => b.zIndex - a.zIndex);
      const hitElement = sortedDesc.find((el) => el.type === 'text' && hitTestElement(canvasPoint, el));
      if (hitElement) {
        e.preventDefault();
        interactionRef.current = { type: 'text-input' };
        showTextInputForEdit(hitElement, canvasPoint);
      }
    },
    [screenToCanvas, showTextInputForEdit],
  );

  // ─── Text Input ───────────────────────────────────────────────
  const showTextInput = useCallback((canvasPoint: Point) => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    const { fontSize: currentFontSize } = useToolStore.getState();
    const textarea = textInputRef.current;
    if (!textarea) return;

    // Store position for later save
    textPositionRef.current = canvasPoint;

    textarea.style.display = 'block';
    textarea.style.left = (canvasPoint.x * zoom + offsetX) + 'px';
    textarea.style.top = (canvasPoint.y * zoom + offsetY) + 'px';
    textarea.style.fontSize = (currentFontSize * zoom) + 'px';
    textarea.style.color = useToolStore.getState().strokeColor;
    textarea.value = '';
    textarea.focus();

    const finishText = () => {
      const position = textPositionRef.current;
      if (!position) {
        textarea.style.display = 'none';
        interactionRef.current = { type: 'none' };
        (textarea as any).__cleanupBlur?.();
        (textarea as any).__cleanupKeydown?.();
        return;
      }
      const text = textarea.value.trim();
      if (text) {
        saveSnapshot();
        const { strokeColor, strokeWidth, roughness, opacity, fontSize } = useToolStore.getState();
        const newElement = createElement({
          type: 'text',
          x: position.x,
          y: position.y,
          text,
          strokeColor,
          strokeWidth,
          roughness,
          opacity,
          fontSize,
          zIndex: useElementStore.getState().getMaxZIndex() + 1,
        });
        // Measure text width/height
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
            const lines = text.split('\n');
            const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
            newElement.width = maxWidth;
            newElement.height = lines.length * Math.round(fontSize * 1.3);
          }
        }
        useElementStore.getState().addElement(newElement);
        // Switch back to select after text (unless lock mode)
        const { lockToolMode } = useToolStore.getState();
        if (!lockToolMode) {
          useToolStore.getState().setActiveTool('select');
        }

      }
      textarea.style.display = 'none';
      textarea.value = '';
      textPositionRef.current = null;
      interactionRef.current = { type: 'none' };
      (textarea as any).__cleanupBlur?.();
      (textarea as any).__cleanupKeydown?.();
    };

    // Clean up previous listeners before adding new ones
    (textarea as any).__cleanupBlur?.();
    (textarea as any).__cleanupKeydown?.();

    textarea.addEventListener('blur', finishText);
    (textarea as any).__cleanupBlur = () => {
      textarea.removeEventListener('blur', finishText);
    };

    const handleTextKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        textarea.blur(); // Save text and close
        useToolStore.getState().clearSelection();
      }
      // Allow Enter for newlines, just blur to confirm
    };
    textarea.addEventListener('keydown', handleTextKeydown);
    (textarea as any).__cleanupKeydown = () => {
      textarea.removeEventListener('keydown', handleTextKeydown);
    };
  }, [saveSnapshot]);

  const { theme } = useCanvasStore();
  const isEmpty = useElementStore((s) => s.elements.length === 0);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}
    >
      {/* Empty state hint */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center text-gray-400 dark:text-gray-500 select-none">
            <p className="text-lg font-medium mb-2">Start drawing!</p>
            <p className="text-sm">
              Pick a tool from the left, or press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-xs">?</kbd>{' '}
              for shortcuts
            </p>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      <textarea
        ref={textInputRef}
        className="absolute hidden p-0 m-0 border-none outline-none bg-transparent resize-none"
        style={{
          fontFamily: "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive",
          minWidth: '20px',
          minHeight: '1.5em',
          lineHeight: 1.3,
          whiteSpace: 'pre',
        }}
        onInput={(e) => {
          const ta = e.currentTarget;
          // Auto-grow height
          ta.style.height = 'auto';
          ta.style.height = ta.scrollHeight + 'px';
          // Auto-grow width based on content
          const lines = ta.value.split('\n');
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.font = ta.style.fontSize + " 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive";
              const maxWidth = Math.max(20, ...lines.map(line => ctx.measureText(line || ' ').width));
              ta.style.width = (maxWidth + 20) + 'px';
              
              // Auto-pan canvas if text extends near edge
              const taRight = parseFloat(ta.style.left) + maxWidth + 20;
              const screenRight = window.innerWidth - 80; // Leave space for right toolbar
              if (taRight > screenRight) {
                const panAmount = taRight - screenRight + 50;
                const { offsetX, offsetY } = useCanvasStore.getState();
                useCanvasStore.getState().setOffset(offsetX - panAmount, offsetY);
                ta.style.left = (parseFloat(ta.style.left) - panAmount) + 'px';
              }
            }
          }
        }}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
