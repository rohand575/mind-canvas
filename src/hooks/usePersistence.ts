import { useEffect, useRef, useCallback } from 'react';
import { useElementStore } from '../store/elementStore';
import { useCanvasStore } from '../store/canvasStore';
import { useAuthStore } from '../store/authStore';
import { useDocumentStore } from '../store/documentStore';
import { saveCanvas, loadCanvas } from '../utils/persistence';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants';

/**
 * Dual-mode persistence hook:
 * - Guest users: autosave to IndexedDB (original behavior)
 * - Signed-in users with an active canvas: autosave to Firestore
 */
export function usePersistence() {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const user = useAuthStore.getState().user;
      const { currentCanvasId } = useDocumentStore.getState();

      if (user && currentCanvasId) {
        // Signed-in user with active canvas → save to Firestore
        useDocumentStore.getState().saveCurrentCanvas().catch(console.error);
      } else {
        // Guest → save to IndexedDB
        const { elements } = useElementStore.getState();
        const { offsetX, offsetY, zoom } = useCanvasStore.getState();
        saveCanvas(elements, { offsetX, offsetY, zoom }).catch(console.error);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  // Restore guest canvas from IndexedDB on mount (only if not signed in)
  useEffect(() => {
    const { initialized } = useAuthStore.getState();

    const restore = () => {
      if (useAuthStore.getState().user) {
        // Signed-in users don't auto-load from IndexedDB
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

    if (initialized) {
      restore();
    } else {
      // Wait for Firebase auth to initialize before deciding
      const unsub = useAuthStore.subscribe((state) => {
        if (state.initialized) {
          unsub();
          restore();
        }
      });
      return unsub;
    }
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
