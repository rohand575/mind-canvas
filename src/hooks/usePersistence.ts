import { useEffect, useRef, useCallback } from 'react';
import { useElementStore } from '../store/elementStore';
import { useCanvasStore } from '../store/canvasStore';
import { saveCanvas, loadCanvas } from '../utils/persistence';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants';

/**
 * Hook that auto-saves canvas state to IndexedDB with debouncing,
 * and restores it on mount.
 */
export function usePersistence() {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const { elements } = useElementStore.getState();
      const { offsetX, offsetY, zoom } = useCanvasStore.getState();
      saveCanvas(elements, { offsetX, offsetY, zoom }).catch(console.error);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  // Restore on mount
  useEffect(() => {
    loadCanvas()
      .then((data) => {
        if (data) {
          useElementStore.getState().setElements(data.elements);
          useCanvasStore.getState().loadState(data.canvasState);
        }
        isLoadedRef.current = true;
      })
      .catch(console.error);
  }, []);

  // Subscribe to element changes for auto-save
  useEffect(() => {
    const unsub = useElementStore.subscribe(() => {
      if (isLoadedRef.current) debouncedSave();
    });
    return unsub;
  }, [debouncedSave]);

  // Subscribe to canvas state changes for auto-save
  useEffect(() => {
    const unsub = useCanvasStore.subscribe(
      (state) => {
        if (isLoadedRef.current) debouncedSave();
        return [state.offsetX, state.offsetY, state.zoom];
      },
    );
    return unsub;
  }, [debouncedSave]);
}
