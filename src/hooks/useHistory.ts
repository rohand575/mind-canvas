import { useCallback, useRef } from 'react';
import { useElementStore } from '../store/elementStore';
import { useHistoryStore } from '../store/historyStore';

/**
 * Hook that bridges element store with history store for undo/redo.
 */
export function useHistory() {
  const isUndoRedoRef = useRef(false);

  const saveSnapshot = useCallback(() => {
    if (isUndoRedoRef.current) return;
    const { elements } = useElementStore.getState();
    useHistoryStore.getState().pushState(elements);
  }, []);

  const undo = useCallback(() => {
    const { past, future } = useHistoryStore.getState();
    if (past.length === 0) return;

    const currentElements = useElementStore.getState().elements;
    const previous = past[past.length - 1];

    isUndoRedoRef.current = true;
    useHistoryStore.setState({
      past: past.slice(0, -1),
      future: [...future, currentElements.map((e) => ({ ...e }))],
    });
    useElementStore.getState().setElements(previous);
    isUndoRedoRef.current = false;
  }, []);

  const redo = useCallback(() => {
    const { past, future } = useHistoryStore.getState();
    if (future.length === 0) return;

    const currentElements = useElementStore.getState().elements;
    const next = future[future.length - 1];

    isUndoRedoRef.current = true;
    useHistoryStore.setState({
      past: [...past, currentElements.map((e) => ({ ...e }))],
      future: future.slice(0, -1),
    });
    useElementStore.getState().setElements(next);
    isUndoRedoRef.current = false;
  }, []);

  return { saveSnapshot, undo, redo };
}
