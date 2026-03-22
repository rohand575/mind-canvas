import { useEffect } from 'react';
import { useToolStore } from '../store/toolStore';
import { useElementStore } from '../store/elementStore';
import { useCanvasStore } from '../store/canvasStore';
import { useHistoryStore } from '../store/historyStore';
import { getElementBounds } from '../utils/geometry';
import { createElement } from '../utils/createElement';
import { COLOR_PALETTE, FONT_SIZES } from '../constants';
import type { Tool } from '../types';
import { useHistory } from './useHistory';

const KEY_TOOL_MAP: Record<string, Tool> = {
  v: 'select',
  h: 'hand',
  r: 'rectangle',
  d: 'diamond',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  p: 'freehand',
  t: 'text',
};

/**
 * Get the center of the current viewport in canvas coordinates
 */
function getViewportCenter() {
  const { offsetX, offsetY, zoom } = useCanvasStore.getState();
  return {
    x: (window.innerWidth / 2 - offsetX) / zoom,
    y: (window.innerHeight / 2 - offsetY) / zoom,
  };
}

/**
 * Paste clipboard content: images, canvas elements, or plain text
 */
export async function pasteFromClipboard() {
  try {
    // Try reading clipboard items (supports images)
    const items = await navigator.clipboard.read();
    for (const item of items) {
      // Check for image types first
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const img = new Image();
          img.onload = () => {
            useHistoryStore.getState().pushState(useElementStore.getState().elements);
            const center = getViewportCenter();
            // Cap large images to 800px max dimension
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const maxDim = 800;
            if (w > maxDim || h > maxDim) {
              const scale = maxDim / Math.max(w, h);
              w = Math.round(w * scale);
              h = Math.round(h * scale);
            }
            const newElement = createElement({
              type: 'image',
              x: center.x - w / 2,
              y: center.y - h / 2,
              width: w,
              height: h,
              imageData: dataUrl,
              zIndex: useElementStore.getState().getMaxZIndex() + 1,
            });
            useElementStore.getState().addElement(newElement);
            useToolStore.getState().setActiveTool('select');
            useToolStore.getState().setSelectedIds([newElement.id]);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(blob);
        return;
      }
    }

    // No image found — fall back to text
    const text = await navigator.clipboard.readText();
    if (!text) return;

    // Try parsing as canvas clipboard data
    try {
      const data = JSON.parse(text);
      if (data?.type === 'canvas-clipboard' && Array.isArray(data.elements)) {
        useHistoryStore.getState().pushState(useElementStore.getState().elements);
        let maxZ = useElementStore.getState().getMaxZIndex();
        const newIds: string[] = [];
        for (const el of data.elements) {
          maxZ++;
          const newId = crypto.randomUUID();
          newIds.push(newId);
          useElementStore.getState().addElement({
            ...el,
            id: newId,
            x: el.x + 20,
            y: el.y + 20,
            zIndex: maxZ,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        useToolStore.getState().setSelectedIds(newIds);
        return;
      }
    } catch { /* not JSON — treat as plain text */ }

    // Paste as a text element on the canvas
    useHistoryStore.getState().pushState(useElementStore.getState().elements);
    const center = getViewportCenter();
    const { strokeColor, fontSize } = useToolStore.getState();
    const newElement = createElement({
      type: 'text',
      x: center.x,
      y: center.y,
      text,
      strokeColor,
      fontSize,
      zIndex: useElementStore.getState().getMaxZIndex() + 1,
    });
    // Measure text dimensions using an offscreen canvas
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (measureCtx) {
      measureCtx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
      const lines = text.split('\n');
      const maxWidth = Math.max(...lines.map((l) => measureCtx.measureText(l).width));
      newElement.width = maxWidth;
      newElement.height = lines.length * Math.round(fontSize * 1.3);
    }
    useElementStore.getState().addElement(newElement);
    useToolStore.getState().setActiveTool('select');
    useToolStore.getState().setSelectedIds([newElement.id]);
  } catch {
    // Clipboard API not available or permission denied — try text-only fallback
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      try {
        const data = JSON.parse(text);
        if (data?.type === 'canvas-clipboard' && Array.isArray(data.elements)) {
          useHistoryStore.getState().pushState(useElementStore.getState().elements);
          let maxZ = useElementStore.getState().getMaxZIndex();
          const newIds: string[] = [];
          for (const el of data.elements) {
            maxZ++;
            const newId = crypto.randomUUID();
            newIds.push(newId);
            useElementStore.getState().addElement({
              ...el,
              id: newId,
              x: el.x + 20,
              y: el.y + 20,
              zIndex: maxZ,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
          useToolStore.getState().setSelectedIds(newIds);
          return;
        }
      } catch { /* not JSON */ }

      useHistoryStore.getState().pushState(useElementStore.getState().elements);
      const center = getViewportCenter();
      const { strokeColor, fontSize } = useToolStore.getState();
      const newElement = createElement({
        type: 'text',
        x: center.x,
        y: center.y,
        text,
        strokeColor,
        fontSize,
        zIndex: useElementStore.getState().getMaxZIndex() + 1,
      });
      // Measure text dimensions using an offscreen canvas
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      if (measureCtx) {
        measureCtx.font = `${fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
        const lines = text.split('\n');
        const maxWidth = Math.max(...lines.map((l) => measureCtx.measureText(l).width));
        newElement.width = maxWidth;
        newElement.height = lines.length * Math.round(fontSize * 1.3);
      }
      useElementStore.getState().addElement(newElement);
      useToolStore.getState().setActiveTool('select');
      useToolStore.getState().setSelectedIds([newElement.id]);
    } catch { /* clipboard not available */ }
  }
}

/**
 * Global keyboard shortcuts handler
 */
export function useKeyboardShortcuts(onToggleShortcuts?: () => void) {
  const { undo, redo } = useHistory();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't intercept typing in inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const { activeTool, setActiveTool, selectedIds, clearSelection } = useToolStore.getState();
      const { removeElements, duplicateElements } = useElementStore.getState();

      // ? key: toggle keyboard shortcuts dialog
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        onToggleShortcuts?.();
        return;
      }

      // Tool shortcuts (only without modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = KEY_TOOL_MAP[e.key.toLowerCase()];
        if (tool) {
          setActiveTool(tool);
          return;
        }
      }

      // Stroke color shortcuts: 1-8 (no modifiers)
      const solidColors = COLOR_PALETTE.filter(c => c !== 'transparent');
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const colorIndex = parseInt(e.key, 10) - 1;
        if (colorIndex >= 0 && colorIndex < solidColors.length) {
          const color = solidColors[colorIndex];
          const { setStrokeColor } = useToolStore.getState();
          setStrokeColor(color);
          const { updateElement } = useElementStore.getState();
          for (const id of selectedIds) updateElement(id, { strokeColor: color });
          return;
        }
      }

      // Fill color shortcuts: Alt+1-8, Alt+0 for transparent
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '0') {
          e.preventDefault();
          const { setFillColor } = useToolStore.getState();
          setFillColor('transparent');
          const { updateElement } = useElementStore.getState();
          for (const id of selectedIds) updateElement(id, { fillColor: 'transparent' });
          return;
        }
        const fillIndex = parseInt(e.key, 10) - 1;
        if (fillIndex >= 0 && fillIndex < solidColors.length) {
          e.preventDefault();
          const color = solidColors[fillIndex];
          const { setFillColor } = useToolStore.getState();
          setFillColor(color);
          const { updateElement } = useElementStore.getState();
          for (const id of selectedIds) updateElement(id, { fillColor: color });
          return;
        }
      }

      // Text size shortcuts: Ctrl+Shift+< (decrease) / Ctrl+Shift+> (increase)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '<' || e.key === ',')) {
        e.preventDefault();
        const { fontSize, setFontSize } = useToolStore.getState();
        const idx = FONT_SIZES.indexOf(fontSize);
        const newIdx = idx > 0 ? idx - 1 : 0;
        const newSize = FONT_SIZES[newIdx];
        setFontSize(newSize);
        const { updateElement } = useElementStore.getState();
        for (const id of selectedIds) updateElement(id, { fontSize: newSize });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '>' || e.key === '.')) {
        e.preventDefault();
        const { fontSize, setFontSize } = useToolStore.getState();
        const idx = FONT_SIZES.indexOf(fontSize);
        const newIdx = idx < FONT_SIZES.length - 1 ? idx + 1 : FONT_SIZES.length - 1;
        const newSize = FONT_SIZES[newIdx];
        setFontSize(newSize);
        const { updateElement } = useElementStore.getState();
        for (const id of selectedIds) updateElement(id, { fontSize: newSize });
        return;
      }

      // Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        removeElements(selectedIds);
        clearSelection();
        return;
      }

      // Escape: deselect or switch to select tool
      if (e.key === 'Escape') {
        if (selectedIds.length > 0) {
          clearSelection();
        } else if (activeTool !== 'select') {
          setActiveTool('select');
        }
        return;
      }

      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        const { elements } = useElementStore.getState();
        const selected = elements.filter((el) => selectedIds.includes(el.id));
        if (selected.length > 0) {
          const data = JSON.stringify({ type: 'canvas-clipboard', elements: selected });
          navigator.clipboard.writeText(data);
        }
        return;
      }

      // Ctrl+V: Paste (images, text, or canvas elements)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteFromClipboard();
        return;
      }

      // Ctrl+D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          const duped = duplicateElements(selectedIds);
          useToolStore.getState().setSelectedIds(duped.map((el) => el.id));
        }
        return;
      }

      // Ctrl+A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = useElementStore.getState().elements.map((el) => el.id);
        useToolStore.getState().setSelectedIds(allIds);
        return;
      }

      // G: Toggle grid
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        useCanvasStore.getState().toggleGrid();
        return;
      }

      // Ctrl+0: Reset zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        useCanvasStore.getState().resetView();
        return;
      }

      // Ctrl+1: Zoom to fit all elements
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        const { elements } = useElementStore.getState();
        if (elements.length === 0) return;
        const allBounds = elements.map(getElementBounds);
        const minX = Math.min(...allBounds.map(b => b.x));
        const minY = Math.min(...allBounds.map(b => b.y));
        const maxX = Math.max(...allBounds.map(b => b.x + b.width));
        const maxY = Math.max(...allBounds.map(b => b.y + b.height));
        useCanvasStore.getState().zoomToBounds(
          { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          window.innerWidth, window.innerHeight,
        );
        return;
      }

      // Ctrl+2: Zoom to selection
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        const { selectedIds: selIds } = useToolStore.getState();
        const { elements: els } = useElementStore.getState();
        const selEls = els.filter(el => selIds.includes(el.id));
        if (selEls.length === 0) return;
        const selBounds = selEls.map(getElementBounds);
        const minX = Math.min(...selBounds.map(b => b.x));
        const minY = Math.min(...selBounds.map(b => b.y));
        const maxX = Math.max(...selBounds.map(b => b.x + b.width));
        const maxY = Math.max(...selBounds.map(b => b.y + b.height));
        useCanvasStore.getState().zoomToBounds(
          { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          window.innerWidth, window.innerHeight,
        );
        return;
      }

      // Z-ordering shortcuts (single selection only)
      if ((e.ctrlKey || e.metaKey) && selectedIds.length === 1) {
        const id = selectedIds[0];
        const { bringForward, sendBackward, bringToFront, sendToBack } = useElementStore.getState();

        // Ctrl+]: Bring forward, Ctrl+Shift+]: Bring to front
        if (e.key === ']') {
          e.preventDefault();
          if (e.shiftKey) bringToFront(id); else bringForward(id);
          return;
        }
        // Ctrl+[: Send backward, Ctrl+Shift+[: Send to back
        if (e.key === '[') {
          e.preventDefault();
          if (e.shiftKey) sendToBack(id); else sendBackward(id);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, onToggleShortcuts]);
}
