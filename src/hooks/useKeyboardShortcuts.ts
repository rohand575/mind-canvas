import { useEffect } from 'react';
import { useToolStore } from '../store/toolStore';
import { useElementStore } from '../store/elementStore';
import { useCanvasStore } from '../store/canvasStore';
import { useHistoryStore } from '../store/historyStore';
import { getElementBounds } from '../utils/geometry';
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
          const data = JSON.stringify({ type: 'mindcanvas-clipboard', elements: selected });
          navigator.clipboard.writeText(data);
        }
        return;
      }

      // Ctrl+V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          try {
            const data = JSON.parse(text);
            if (data?.type === 'mindcanvas-clipboard' && Array.isArray(data.elements)) {
              // Save snapshot for undo
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
            }
          } catch { /* invalid clipboard data */ }
        });
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
