import { useEffect } from 'react';
import { useToolStore } from '../store/toolStore';
import { useElementStore } from '../store/elementStore';
import { useCanvasStore } from '../store/canvasStore';
import type { Tool } from '../types';
import { useHistory } from './useHistory';

const KEY_TOOL_MAP: Record<string, Tool> = {
  v: 'select',
  r: 'rectangle',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  p: 'freehand',
  t: 'text',
};

/**
 * Global keyboard shortcuts handler
 */
export function useKeyboardShortcuts() {
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
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);
}
