import { useEffect, useRef, useCallback } from 'react';
import { useElementStore } from '../store/elementStore';
import { useCanvasStore } from '../store/canvasStore';
import { useAuthStore } from '../store/authStore';
import { useDocumentStore } from '../store/documentStore';
import { saveCanvas, loadCanvas } from '../utils/persistence';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants';

/**
 * Dual-mode persistence:
 * - Guest:       debounced autosave to IndexedDB
 * - Signed-in:   debounced autosave to Firestore via saveCurrentCanvas()
 *
 * The debounce timer is cleared and restarted on every element/canvas change,
 * so only the final state within any 500 ms window is written.
 */
export function usePersistence() {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const user = useAuthStore.getState().user;
      const { currentCanvasId } = useDocumentStore.getState();

      if (user && currentCanvasId) {
        useDocumentStore.getState().saveCurrentCanvas().catch(console.error);
      } else if (!user) {
        const { elements } = useElementStore.getState();
        const { offsetX, offsetY, zoom } = useCanvasStore.getState();
        saveCanvas(elements, { offsetX, offsetY, zoom }).catch(console.error);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  // On mount: restore guest canvas from IndexedDB (signed-in users skip this)
  useEffect(() => {
    const restore = () => {
      if (useAuthStore.getState().user) {
        isLoadedRef.current = true;
        return;
      }
      loadCanvas()
        .then((data) => {
          if (data) {
            useElementStore.getState().setElements(data.elements);
            useCanvasStore.getState().loadState(data.canvasState);
          }
          isLoadedRef.current = true;
        })
        .catch(console.error);
    };

    const { initialized } = useAuthStore.getState();
    if (initialized) {
      restore();
    } else {
      const unsub = useAuthStore.subscribe((state) => {
        if (state.initialized) { unsub(); restore(); }
      });
      return unsub;
    }
  }, []);

  // Autosave on element changes
  useEffect(() => {
    const unsub = useElementStore.subscribe(() => {
      if (isLoadedRef.current) scheduleSave();
    });
    return unsub;
  }, [scheduleSave]);

  // Autosave on canvas pan/zoom changes
  useEffect(() => {
    const unsub = useCanvasStore.subscribe(() => {
      if (isLoadedRef.current) scheduleSave();
    });
    return unsub;
  }, [scheduleSave]);
}
