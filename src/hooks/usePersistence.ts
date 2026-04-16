import { useEffect, useRef, useCallback } from 'react';
import { useElementStore } from '../store/elementStore';
import { useCanvasStore } from '../store/canvasStore';
import { useDocumentStore } from '../store/documentStore';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants';

/**
 * Local-first persistence:
 * - On mount: initialises the document store (loads canvas list from IndexedDB,
 *   opens the most recently edited canvas, or creates a default one).
 * - On change: debounced autosave to IndexedDB via saveCurrentCanvas().
 */
export function usePersistence() {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      useDocumentStore.getState().saveCurrentCanvas().catch(console.error);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  // On mount: restore canvas list and open the most recent canvas
  useEffect(() => {
    useDocumentStore
      .getState()
      .init()
      .then(() => { isLoadedRef.current = true; })
      .catch(console.error);
  }, []);

  // Autosave on element changes
  useEffect(() => {
    const unsub = useElementStore.subscribe(() => {
      if (isLoadedRef.current) scheduleSave();
    });
    return unsub;
  }, [scheduleSave]);

  // Autosave on canvas pan/zoom/theme changes
  useEffect(() => {
    const unsub = useCanvasStore.subscribe(() => {
      if (isLoadedRef.current) scheduleSave();
    });
    return unsub;
  }, [scheduleSave]);
}
