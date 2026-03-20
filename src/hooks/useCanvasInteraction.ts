import { useCallback, useRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';

/**
 * Hook for pan (space+drag) and zoom (mouse wheel) on the canvas.
 */
export function useCanvasInteraction() {
  const isSpacePressed = useRef(false);
  const isPanningRef = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom (trackpad) or Ctrl+scroll: zoom
      const { setZoom, zoom } = useCanvasStore.getState();
      const delta = -e.deltaY * 0.002; // Smooth zoom
      setZoom(zoom * (1 + delta), e.clientX, e.clientY);
    } else {
      // Two-finger trackpad scroll or regular scroll: pan
      const { offsetX, offsetY, setOffset } = useCanvasStore.getState();
      setOffset(offsetX - e.deltaX, offsetY - e.deltaY);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      isSpacePressed.current = true;
      useCanvasStore.getState().setIsPanning(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      isSpacePressed.current = false;
      isPanningRef.current = false;
      useCanvasStore.getState().setIsPanning(false);
    }
  }, []);

  const startPan = useCallback((clientX: number, clientY: number): boolean => {
    if (isSpacePressed.current) {
      isPanningRef.current = true;
      lastPos.current = { x: clientX, y: clientY };
      return true;
    }
    return false;
  }, []);

  const startRightClickPan = useCallback((clientX: number, clientY: number) => {
    isPanningRef.current = true;
    lastPos.current = { x: clientX, y: clientY };
    useCanvasStore.getState().setIsPanning(true);
  }, []);

  const movePan = useCallback((clientX: number, clientY: number): boolean => {
    if (isPanningRef.current) {
      const dx = clientX - lastPos.current.x;
      const dy = clientY - lastPos.current.y;
      const { offsetX, offsetY, setOffset } = useCanvasStore.getState();
      setOffset(offsetX + dx, offsetY + dy);
      lastPos.current = { x: clientX, y: clientY };
      return true;
    }
    return false;
  }, []);

  const endPan = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      useCanvasStore.getState().setIsPanning(false);
    }
  }, []);

  return {
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    startPan,
    startRightClickPan,
    movePan,
    endPan,
    isSpacePressed,
  };
}
