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
import { wrapTextToLines } from '../../utils/textWrap';
import { GRID_SIZE } from '../../constants';

const TEXT_WRAP_PADDING = 8;
import { ContextMenu } from './ContextMenu';
import { FindBar } from './FindBar';
import { tokenizeLine, getTokenColor, CODE_THEME_DARK, CODE_FONT } from '../../utils/codeDetection';
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
  | { type: 'resizing'; elementId: string; handle: ResizeHandle; startX: number; startY: number; original: { x: number; y: number; width: number; height: number; fontSize?: number; points?: Point[]; text?: string; textWrap?: boolean }; elementType: string }
  | { type: 'selecting'; startX: number; startY: number }
  | { type: 'text-input' };

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionMode>({ type: 'none' });
  const rafRef = useRef<number>(0);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const textPositionRef = useRef<Point | null>(null);
  const textContainerRef = useRef<CanvasElement | null>(null);
  const isWrappedTextRef = useRef(false);
  const selectionBoxRef = useRef<Bounds | null>(null);
  const editingElementIdRef = useRef<string | null>(null);
  const rightClickPendingRef = useRef<{ startX: number; startY: number; hitElement: CanvasElement | null } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // ─── Find state / mode ───────────────────────────────────────
  const findBarActiveRef = useRef(false); // mirrors findActive, readable in closures
  const [findActive, setFindActive] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMode, setFindMode] = useState<'text' | 'canvas'>('text');
  const [findMatches, setFindMatches] = useState<number[]>([]);
  const [canvasFindResults, setCanvasFindResults] = useState<{ elementId: string; charIndex: number }[]>([]);
  const [findIdx, setFindIdx] = useState(0);
  const [isCodeEdit, setIsCodeEdit] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('code');
  const [editorOverlayHtml, setEditorOverlayHtml] = useState('');

  const { handleWheel, handleKeyDown, handleKeyUp, startPan, startRightClickPan, movePan, endPan, isSpacePressed } =
    useCanvasInteraction();
  const { saveSnapshot } = useHistory();

  // ─── Find helpers ─────────────────────────────────────────────
  const computeFindMatches = useCallback((query: string, text: string): number[] => {
    if (!query) return [];
    const result: number[] = [];
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    let idx = 0;
    while (idx < lower.length) {
      const found = lower.indexOf(q, idx);
      if (found === -1) break;
      result.push(found);
      idx = found + 1;
    }
    return result;
  }, []);

  const computeCanvasFindResults = useCallback((query: string) => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    const { elements } = useElementStore.getState();
    const results: { elementId: string; charIndex: number }[] = [];
    for (const element of elements) {
      if (!element.text) continue;
      const text = element.text.toLowerCase();
      let idx = 0;
      while (idx < text.length) {
        const found = text.indexOf(lowerQuery, idx);
        if (found === -1) break;
        results.push({ elementId: element.id, charIndex: found });
        idx = found + 1;
      }
    }
    return results;
  }, []);

  const centerCanvasElement = useCallback((elementId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const element = useElementStore.getState().elements.find((el) => el.id === elementId);
    if (!element) return;

    const bounds = getElementBounds(element);
    const { zoom } = useCanvasStore.getState();
    const viewWidth = canvas.clientWidth;
    const viewHeight = canvas.clientHeight;
    const offsetX = viewWidth / 2 - (bounds.x + bounds.width / 2) * zoom;
    const offsetY = viewHeight / 2 - (bounds.y + bounds.height / 2) * zoom;
    useCanvasStore.getState().setOffset(offsetX, offsetY);
  }, []);

  const openCanvasFindBar = useCallback(() => {
    findBarActiveRef.current = true;
    setFindActive(true);
    setFindMode('canvas');
    setFindQuery('');
    setFindMatches([]);
    setCanvasFindResults([]);
    setFindIdx(0);
  }, []);

  const handleGlobalFindKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      openCanvasFindBar();
    }
  }, [openCanvasFindBar]);

  const escapeHtml = useCallback((value: string) => {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }, []);

  const buildCodeHighlightHtml = useCallback((text: string, language: string, query = '') => {
    const lowerQuery = query.toLowerCase();
    return text
      .split('\n')
      .map((line) => {
        const tokens = tokenizeLine(line, language);

        const matchRanges: { start: number; end: number }[] = [];
        if (query) {
          const lowerLine = line.toLowerCase();
          let idx = 0;
          while (idx < lowerLine.length) {
            const found = lowerLine.indexOf(lowerQuery, idx);
            if (found === -1) break;
            matchRanges.push({ start: found, end: found + query.length });
            idx = found + query.length;
          }
        }

        let tokenOffset = 0;
        return tokens
          .map((token) => {
            const color = getTokenColor(token.type, CODE_THEME_DARK);
            if (!query || matchRanges.length === 0) {
              tokenOffset += token.text.length;
              return `<span style="color: ${color}">${escapeHtml(token.text)}</span>`;
            }

            const parts: string[] = [];
            let processed = 0;
            for (const range of matchRanges) {
              if (range.end <= tokenOffset || range.start >= tokenOffset + token.text.length) continue;
              const startInToken = Math.max(0, range.start - tokenOffset);
              const endInToken = Math.min(token.text.length, range.end - tokenOffset);
              if (startInToken > processed) {
                parts.push(escapeHtml(token.text.slice(processed, startInToken)));
              }
              const inner = escapeHtml(token.text.slice(startInToken, endInToken));
              parts.push(`<span style="background: rgba(252,232,170,0.8); color: ${color}">${inner}</span>`);
              processed = endInToken;
            }
            if (processed < token.text.length) {
              parts.push(escapeHtml(token.text.slice(processed)));
            }
            tokenOffset += token.text.length;
            if (parts.length === 0) {
              return `<span style="color: ${color}">${escapeHtml(token.text)}</span>`;
            }
            return `<span style="color: ${color}">${parts.join('')}</span>`;
          })
          .join('');
      })
      .join('\n');
  }, [escapeHtml]);

  const buildPlainTextOverlayHtml = useCallback((text: string, query: string) => {
    const lowerQuery = query.toLowerCase();
    return text
      .split('\n')
      .map((line) => {
        if (!query) return escapeHtml(line);
        const lowerLine = line.toLowerCase();
        let idx = 0;
        const parts: string[] = [];
        while (idx < line.length) {
          const found = lowerLine.indexOf(lowerQuery, idx);
          if (found === -1) {
            parts.push(escapeHtml(line.slice(idx)));
            break;
          }
          if (found > idx) {
            parts.push(escapeHtml(line.slice(idx, found)));
          }
          parts.push(`<span style="background: rgba(252,232,170,0.8);">${escapeHtml(line.slice(found, found + query.length))}</span>`);
          idx = found + query.length;
        }
        return parts.join('') || '&nbsp;';
      })
      .join('<br>');
  }, [escapeHtml]);

  const buildEditorOverlayHtml = useCallback((value: string, query: string, code: boolean, language: string) => {
    if (code) {
      return buildCodeHighlightHtml(value, language, query);
    }
    if (!query) return '';
    return buildPlainTextOverlayHtml(value, query);
  }, [buildCodeHighlightHtml, buildPlainTextOverlayHtml]);

  const updateEditorOverlay = useCallback((query: string) => {
    const ta = textInputRef.current;
    if (!ta) {
      setEditorOverlayHtml('');
      return;
    }
    setEditorOverlayHtml(buildEditorOverlayHtml(ta.value, query, isCodeEdit, codeLanguage));
  }, [buildEditorOverlayHtml, codeLanguage, isCodeEdit]);

  const scrollTextareaToChar = useCallback((ta: HTMLTextAreaElement, charIdx: number) => {
    // Estimate the line the character is on and scroll to it
    const text = ta.value.substring(0, charIdx);
    const lineNumber = (text.match(/\n/g) ?? []).length;
    const lineHeight = parseFloat(ta.style.fontSize) * parseFloat(ta.style.lineHeight || '1.3');
    ta.scrollTop = Math.max(0, lineNumber * lineHeight - ta.clientHeight / 2);
  }, []);

  const openFindBar = useCallback(() => {
    findBarActiveRef.current = true;
    setFindActive(true);
    setFindMode('text');
    // Populate initial query from textarea selection if text is selected
    const ta = textInputRef.current;
    if (ta) {
      const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim();
      if (sel && !sel.includes('\n')) {
        const matches = computeFindMatches(sel, ta.value);
        setFindQuery(sel);
        setFindMatches(matches);
        const ci = matches.findIndex((m) => m >= ta.selectionStart);
        setFindIdx(ci >= 0 ? ci : 0);
        return;
      }
    }
    setFindQuery('');
    setFindMatches([]);
    setCanvasFindResults([]);
    setFindIdx(0);
  }, [computeFindMatches]);

  const closeFindBar = useCallback(() => {
    findBarActiveRef.current = false;
    setFindActive(false);
    setFindQuery('');
    setFindMatches([]);
    setCanvasFindResults([]);
    setFindIdx(0);
    textInputRef.current?.focus();
  }, []);

  const handleFindQueryChange = useCallback((query: string) => {
    setFindQuery(query);
    updateEditorOverlay(query);
    if (findMode === 'canvas') {
      const results = computeCanvasFindResults(query);
      setCanvasFindResults(results);
      setFindIdx(0);
      if (results.length > 0) {
        const first = results[0];
        useToolStore.getState().setSelectedIds([first.elementId]);
        centerCanvasElement(first.elementId);
      }
      return;
    }

    const ta = textInputRef.current;
    const matches = computeFindMatches(query, ta?.value ?? '');
    setFindMatches(matches);
    setFindIdx(0);
    if (ta && matches.length > 0) {
      ta.setSelectionRange(matches[0], matches[0] + query.length);
      scrollTextareaToChar(ta, matches[0]);
    }
  }, [computeFindMatches, computeCanvasFindResults, findMode, scrollTextareaToChar, centerCanvasElement, updateEditorOverlay]);

  const handleFindNext = useCallback(() => {
    if (findMode === 'canvas') {
      if (canvasFindResults.length === 0) return;
      const newIdx = (findIdx + 1) % canvasFindResults.length;
      setFindIdx(newIdx);
      const result = canvasFindResults[newIdx];
      useToolStore.getState().setSelectedIds([result.elementId]);
      centerCanvasElement(result.elementId);
      return;
    }

    if (findMatches.length === 0) return;
    const newIdx = (findIdx + 1) % findMatches.length;
    setFindIdx(newIdx);
    const ta = textInputRef.current;
    if (ta) {
      ta.setSelectionRange(findMatches[newIdx], findMatches[newIdx] + findQuery.length);
      scrollTextareaToChar(ta, findMatches[newIdx]);
    }
  }, [canvasFindResults, findMatches, findIdx, findMode, findQuery, centerCanvasElement, scrollTextareaToChar]);

  const handleFindPrev = useCallback(() => {
    if (findMode === 'canvas') {
      if (canvasFindResults.length === 0) return;
      const newIdx = (findIdx - 1 + canvasFindResults.length) % canvasFindResults.length;
      setFindIdx(newIdx);
      const result = canvasFindResults[newIdx];
      useToolStore.getState().setSelectedIds([result.elementId]);
      centerCanvasElement(result.elementId);
      return;
    }

    if (findMatches.length === 0) return;
    const newIdx = (findIdx - 1 + findMatches.length) % findMatches.length;
    setFindIdx(newIdx);
    const ta = textInputRef.current;
    if (ta) {
      ta.setSelectionRange(findMatches[newIdx], findMatches[newIdx] + findQuery.length);
      scrollTextareaToChar(ta, findMatches[newIdx]);
    }
  }, [canvasFindResults, findMatches, findIdx, findMode, findQuery, centerCanvasElement, scrollTextareaToChar]);

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
    const highlightMap = new Map<string, { start: number; length: number; active?: boolean }[]>();
    if (findActive && findMode === 'canvas' && findQuery) {
      for (let index = 0; index < canvasFindResults.length; index++) {
        const result = canvasFindResults[index];
        const ranges = highlightMap.get(result.elementId) ?? [];
        ranges.push({
          start: result.charIndex,
          length: findQuery.length,
          active: index === findIdx,
        });
        highlightMap.set(result.elementId, ranges);
      }
    }
    const rc = rough.canvas(canvas);
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const element of sorted) {
      if (element.id === editingElementIdRef.current) continue;
      renderElement(rc, ctx, element, { textHighlights: highlightMap.get(element.id) });
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
  }, [findActive, findMode, findQuery, canvasFindResults, findIdx]);

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
    window.addEventListener('keydown', handleGlobalFindKeyDown);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleGlobalFindKeyDown);
    };
  }, [render, handleWheel, handleKeyDown, handleKeyUp, handleGlobalFindKeyDown]);
  // ─── Save Current Text (synchronous) ───────────────────────────
  const saveCurrentText = useCallback(() => {
    const textarea = textInputRef.current;
    const position = textPositionRef.current;
    if (!textarea || textarea.style.display === 'none' || !position) return;

    const text = textarea.value.trim();
    if (text) {
      saveSnapshot();
      const { strokeColor, strokeWidth, roughness, opacity, fontSize } = useToolStore.getState();
      const container = textContainerRef.current;
      const elementX = container ? container.x + TEXT_WRAP_PADDING : position.x;
      const newElement = createElement({
        type: 'text',
        x: elementX,
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
          if (container) {
            const wrapWidth = Math.max(20, container.width - TEXT_WRAP_PADDING * 2);
            const wrappedLines = wrapTextToLines(text, wrapWidth, ctx);
            newElement.width = wrapWidth;
            newElement.height = wrappedLines.length * Math.round(fontSize * 1.3);
            newElement.textWrap = true;
            const textBottom = position.y + newElement.height + TEXT_WRAP_PADDING;
            const rectBottom = container.y + container.height;
            if (textBottom > rectBottom) {
              useElementStore.getState().updateElement(container.id, {
                height: textBottom - container.y + TEXT_WRAP_PADDING,
              });
            }
          } else {
            const lines = text.split('\n');
            const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
            newElement.width = maxWidth;
            newElement.height = lines.length * Math.round(fontSize * 1.3);
          }
        }
      }
      useElementStore.getState().addElement(newElement);
    }
    textarea.style.display = 'none';
    textarea.value = '';
    textarea.style.whiteSpace = 'pre';
    textarea.style.wordBreak = '';
    textarea.style.overflowWrap = '';
    textPositionRef.current = null;
    textContainerRef.current = null;
    isWrappedTextRef.current = false;
    interactionRef.current = { type: 'none' };
    // Cleanup listeners
    (textarea as any).__cleanupBlur?.();
    (textarea as any).__cleanupKeydown?.();
  }, [saveSnapshot]);
  // ─── Mouse Down ───────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Right-click: always start pan; show context menu on mouseup only if mouse didn't move
      if (e.button === 2) {
        e.preventDefault();
        const canvasPoint = screenToCanvas(e.clientX, e.clientY);
        const { elements } = useElementStore.getState();
        const sortedDesc = [...elements].sort((a, b) => b.zIndex - a.zIndex);
        const hitElement = sortedDesc.find((el) => hitTestElement(canvasPoint, el)) ?? null;
        rightClickPendingRef.current = { startX: e.clientX, startY: e.clientY, hitElement };
        startRightClickPan(e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
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

      // Ctrl+left-click: pan (same as right-click drag)
      if (e.ctrlKey) {
        e.preventDefault();
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
                  points: el.points ? el.points.map(p => ({ ...p })) : undefined,
                  text: el.text,
                  textWrap: el.textWrap,
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
        // If clicking on an existing text element, open it for editing
        const sortedDescText = [...elements].sort((a, b) => b.zIndex - a.zIndex);
        const hitText = sortedDescText.find((el) => el.type === 'text' && hitTestElement(canvasPoint, el));
        interactionRef.current = { type: 'text-input' };
        if (hitText) {
          showTextInputForEdit(hitText, canvasPoint);
        } else {
          showTextInput(canvasPoint);
        }
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

        // For text elements, handle resize
        if (elementType === 'text' && original.fontSize) {
          if (original.textWrap && original.text) {
            // Wrapped text: fix width, recalculate height from wrapped lines
            const constrainedWidth = Math.max(20, width);
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.font = `${original.fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
                const wrappedLines = wrapTextToLines(original.text, constrainedWidth, ctx);
                const newHeight = wrappedLines.length * Math.round(original.fontSize * 1.3);
                updateElement(elementId, { x, y, width: constrainedWidth, height: newHeight });
              } else {
                updateElement(elementId, { x, y, width: Math.max(20, width), height });
              }
            }
          } else {
            // Non-wrapped text: scale fontSize proportionally
            const scaleX = original.width > 0 ? width / original.width : 1;
            const scaleY = original.height > 0 ? height / original.height : 1;
            const scale = Math.max(0.1, Math.min(scaleX, scaleY));
            const newFontSize = Math.round(original.fontSize * scale);
            updateElement(elementId, { x, y, width, height, fontSize: Math.max(8, Math.min(200, newFontSize)) });
          }
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
  const handleMouseUp = useCallback((e?: React.MouseEvent) => {
    endPan();

    // Right-click: show context menu only if mouse barely moved (was a click, not a drag)
    if (rightClickPendingRef.current) {
      const { startX, startY, hitElement } = rightClickPendingRef.current;
      rightClickPendingRef.current = null;
      if (e?.button === 2) {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx < 4 && dy < 4 && hitElement) {
          const { selectedIds } = useToolStore.getState();
          if (!selectedIds.includes(hitElement.id)) {
            useToolStore.getState().setSelectedIds([hitElement.id]);
          }
          setContextMenu({ x: e.clientX, y: e.clientY });
          return;
        }
      }
    }

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

    if (activeTool === 'text') {
      const { elements: textElements } = useElementStore.getState();
      const sortedDescText = [...textElements].sort((a, b) => b.zIndex - a.zIndex);
      const hoveredText = sortedDescText.find((el) => el.type === 'text' && hitTestElement(canvasPoint, el));
      canvas.style.cursor = hoveredText ? 'text' : 'crosshair';
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

    const isCode = element.isCode ?? false;
    const fontFamily = isCode
      ? "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace"
      : "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive";
    const editFontSize = element.fontSize ?? (isCode ? 14 : 40);
    const editLineHeight = isCode ? 1.5 : 1.3;

    const codePad = Math.round(16 * zoom);
    isWrappedTextRef.current = element.textWrap ?? false;

    textarea.style.display = 'block';
    textarea.style.left = (element.x * zoom + offsetX) + 'px';
    textarea.style.top = (element.y * zoom + offsetY) + 'px';
    textarea.style.fontSize = (editFontSize * zoom) + 'px';
    textarea.style.fontFamily = fontFamily;
    textarea.style.lineHeight = String(editLineHeight);
    textarea.style.color = isCode ? 'transparent' : element.strokeColor;
    textarea.style.caretColor = isCode ? '#cdd6f4' : element.strokeColor;
    textarea.style.width = ((element.width ?? 200) * zoom) + 'px';
    textarea.style.height = ((element.height ?? 100) * zoom) + 'px';

    if (element.textWrap && !isCode) {
      textarea.style.whiteSpace = 'pre-wrap';
      textarea.style.wordBreak = 'break-word';
      textarea.style.overflowWrap = 'break-word';
    } else {
      textarea.style.whiteSpace = 'pre';
      textarea.style.wordBreak = '';
      textarea.style.overflowWrap = '';
    }

    if (isCode) {
      textarea.style.background = 'transparent';
      textarea.style.borderRadius = '8px';
      textarea.style.padding = codePad + 'px';
      textarea.style.boxSizing = 'border-box';
      textarea.style.textShadow = 'none';
    }
      textarea.value = element.text ?? '';
      textarea.focus();
      setIsCodeEdit(isCode);
      const lang = element.codeLanguage ?? 'code';
      setCodeLanguage(lang);
      // Always build the overlay immediately — updateEditorOverlay uses stale isCodeEdit state
      if (isCode) {
        setEditorOverlayHtml(buildCodeHighlightHtml(element.text ?? '', lang, findActive && findQuery ? findQuery : ''));
      } else if (findActive && findQuery) {
        updateEditorOverlay(findQuery);
      }

      if (clickPoint) {
        const text = element.text ?? '';
        const lineHeight = editFontSize * editLineHeight;
        const relY = clickPoint.y - element.y - (isCode ? 16 : 0);
        const lineIndex = Math.max(0, Math.floor(relY / lineHeight));
        const lines = text.split('\n');

        let charPos = 0;
        for (let i = 0; i < Math.min(lineIndex, lines.length); i++) {
          charPos += lines[i].length + 1;
        }

        if (lineIndex < lines.length) {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.font = `${editFontSize}px ${fontFamily}`;
              const relX = clickPoint.x - element.x - (isCode ? 16 : 0);
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
            if (isCode) {
              ctx.font = `${editFontSize}px ${fontFamily}`;
              const lines = text.split('\n');
              const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
              updates.width = maxWidth + 32; // CODE_PADDING * 2
              updates.height = lines.length * Math.round(editFontSize * 1.5) + 32;
            } else if (element.textWrap) {
              ctx.font = `${element.fontSize ?? 40}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
              const wrapWidth = element.width > 0 ? element.width : 200;
              const wrappedLines = wrapTextToLines(text, wrapWidth, ctx);
              updates.width = wrapWidth;
              updates.height = wrappedLines.length * Math.round((element.fontSize ?? 40) * 1.3);
              updates.textWrap = true;
            } else {
              ctx.font = `${element.fontSize ?? 40}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
              const lines = text.split('\n');
              const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
              updates.width = maxWidth;
              updates.height = lines.length * Math.round((element.fontSize ?? 40) * 1.3);
            }
          }
        }
        useElementStore.getState().updateElement(element.id, updates);
      } else {
        useElementStore.getState().removeElements([element.id]);
      }
      textarea.style.display = 'none';
      textarea.style.width = '';
      textarea.style.height = '';
      // Reset code-specific styles
      if (isCode) {
        textarea.style.background = 'transparent';
        textarea.style.borderRadius = '';
        textarea.style.padding = '';
        textarea.style.boxSizing = '';
        textarea.style.fontFamily = "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive";
        textarea.style.color = '';
        textarea.style.caretColor = '';
      }
      textarea.style.lineHeight = '1.3';
      textarea.style.whiteSpace = 'pre';
      textarea.style.wordBreak = '';
      textarea.style.overflowWrap = '';
      isWrappedTextRef.current = false;
      editingElementIdRef.current = null;
      interactionRef.current = { type: 'none' };
      setIsCodeEdit(false);
      setEditorOverlayHtml('');
      // Reset find bar state
      findBarActiveRef.current = false;
      setFindActive(false);
      setFindQuery('');
      setFindMatches([]);
      setFindIdx(0);
      // Cleanup listeners
      (textarea as any).__cleanupBlur?.();
      (textarea as any).__cleanupKeydown?.();
    };

    const handleBlur = (e: FocusEvent) => {
      // Don't close the editor if focus moved into the find bar
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest?.('[data-find-bar]')) return;
      finishEdit();
    };
    textarea.addEventListener('blur', handleBlur);
    (textarea as any).__cleanupBlur = () => {
      textarea.removeEventListener('blur', handleBlur);
    };

    const handleEditKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        textarea.blur();
        useToolStore.getState().clearSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Open in-element find bar
        e.preventDefault();
        e.stopPropagation();
        openFindBar();
      }
    };
    textarea.addEventListener('keydown', handleEditKeydown);
    (textarea as any).__cleanupKeydown = () => {
      textarea.removeEventListener('keydown', handleEditKeydown);
    };
  }, [saveSnapshot, openFindBar]);

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

    // Detect if click is inside a rectangle — use topmost one
    const { elements } = useElementStore.getState();
    const rectContainer = [...elements]
      .filter(el => el.type === 'rectangle')
      .sort((a, b) => b.zIndex - a.zIndex)
      .find(el =>
        canvasPoint.x > el.x && canvasPoint.x < el.x + el.width &&
        canvasPoint.y > el.y && canvasPoint.y < el.y + el.height
      ) ?? null;

    textContainerRef.current = rectContainer;
    isWrappedTextRef.current = rectContainer !== null;

    // Store position for later save
    textPositionRef.current = canvasPoint;

    textarea.style.display = 'block';
    textarea.style.fontSize = (currentFontSize * zoom) + 'px';
    textarea.style.color = useToolStore.getState().strokeColor;
    textarea.value = '';

    if (rectContainer) {
      const wrapWidth = Math.max(20, rectContainer.width - TEXT_WRAP_PADDING * 2);
      textarea.style.left = (rectContainer.x * zoom + offsetX + TEXT_WRAP_PADDING * zoom) + 'px';
      textarea.style.top = (canvasPoint.y * zoom + offsetY) + 'px';
      textarea.style.width = (wrapWidth * zoom) + 'px';
      textarea.style.whiteSpace = 'pre-wrap';
      textarea.style.wordBreak = 'break-word';
      textarea.style.overflowWrap = 'break-word';
    } else {
      textarea.style.left = (canvasPoint.x * zoom + offsetX) + 'px';
      textarea.style.top = (canvasPoint.y * zoom + offsetY) + 'px';
      textarea.style.width = '';
      textarea.style.whiteSpace = 'pre';
      textarea.style.wordBreak = '';
      textarea.style.overflowWrap = '';
    }

    textarea.focus();
    if (findActive && findQuery) {
      updateEditorOverlay(findQuery);
    }

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
        const container = textContainerRef.current;
        const elementX = container ? container.x + TEXT_WRAP_PADDING : position.x;
        const newElement = createElement({
          type: 'text',
          x: elementX,
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
            if (container) {
              const wrapWidth = Math.max(20, container.width - TEXT_WRAP_PADDING * 2);
              const wrappedLines = wrapTextToLines(text, wrapWidth, ctx);
              newElement.width = wrapWidth;
              newElement.height = wrappedLines.length * Math.round(fontSize * 1.3);
              newElement.textWrap = true;
              // Expand container if text overflows vertically
              const textBottom = position.y + newElement.height + TEXT_WRAP_PADDING;
              const rectBottom = container.y + container.height;
              if (textBottom > rectBottom) {
                useElementStore.getState().updateElement(container.id, {
                  height: textBottom - container.y + TEXT_WRAP_PADDING,
                });
              }
            } else {
              const lines = text.split('\n');
              const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
              newElement.width = maxWidth;
              newElement.height = lines.length * Math.round(fontSize * 1.3);
            }
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
      textarea.style.whiteSpace = 'pre';
      textarea.style.wordBreak = '';
      textarea.style.overflowWrap = '';
      textPositionRef.current = null;
      textContainerRef.current = null;
      isWrappedTextRef.current = false;
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
      {findActive && (
        <FindBar
          query={findQuery}
          currentIdx={findIdx}
          totalMatches={findMode === 'canvas' ? canvasFindResults.length : findMatches.length}
          onQueryChange={handleFindQueryChange}
          onNext={handleFindNext}
          onPrev={handleFindPrev}
          onClose={closeFindBar}
        />
      )}
      {(isCodeEdit || editorOverlayHtml) && (
        <div
          className="absolute pointer-events-none overflow-hidden rounded-lg"
          style={{
            left: textInputRef.current?.style.left,
            top: textInputRef.current?.style.top,
            width: textInputRef.current?.style.width,
            height: textInputRef.current?.style.height,
            fontFamily: isCodeEdit ? CODE_FONT : textInputRef.current?.style.fontFamily,
            fontSize: textInputRef.current?.style.fontSize,
            lineHeight: textInputRef.current?.style.lineHeight,
            padding: textInputRef.current?.style.padding,
            whiteSpace: 'pre-wrap',
            background: isCodeEdit ? '#1e1e2e' : 'transparent',
            color: isCodeEdit ? undefined : 'transparent',
            overflow: 'hidden',
          }}
        >
          <pre
            className="m-0 p-0"
            style={{
              margin: 0,
              fontFamily: isCodeEdit ? CODE_FONT : textInputRef.current?.style.fontFamily,
              fontSize: textInputRef.current?.style.fontSize,
              lineHeight: textInputRef.current?.style.lineHeight,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              minHeight: '100%',
              color: isCodeEdit ? undefined : 'transparent',
            }}
            dangerouslySetInnerHTML={{ __html: editorOverlayHtml || (isCodeEdit ? '<br />' : '') }}
          />
        </div>
      )}
      <textarea
        ref={textInputRef}
        className="absolute hidden p-0 m-0 border-none outline-none bg-transparent resize-none"
        style={{
          fontFamily: "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive",
          minWidth: '20px',
          minHeight: '1.5em',
          lineHeight: 1.3,
        }}
        onInput={(e) => {
          const ta = e.currentTarget;
          const isCodeEditLocal = isCodeEdit;
          const fontFamily = ta.style.fontFamily;
          const currentZoom = useCanvasStore.getState().zoom;
          const padding = isCodeEditLocal ? Math.round(32 * currentZoom) : 0;
          
          // Auto-grow height
          ta.style.height = 'auto';
          ta.style.height = ta.scrollHeight + 'px';

          if (!isWrappedTextRef.current) {
            // Auto-grow width based on content (non-wrapped only)
            const lines = ta.value.split('\n');
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.font = ta.style.fontSize + ' ' + fontFamily;
                const maxWidth = Math.max(20, ...lines.map(line => ctx.measureText(line || ' ').width));
                ta.style.width = (maxWidth + 20 + padding) + 'px';

                // Auto-pan canvas if text extends near edge
                const taRight = parseFloat(ta.style.left) + maxWidth + 20 + padding;
                const screenRight = window.innerWidth - 80;
                if (taRight > screenRight) {
                  const panAmount = taRight - screenRight + 50;
                  const { offsetX, offsetY } = useCanvasStore.getState();
                  useCanvasStore.getState().setOffset(offsetX - panAmount, offsetY);
                  ta.style.left = (parseFloat(ta.style.left) - panAmount) + 'px';
                }
              }
            }
          }

          if (isCodeEdit) {
            setEditorOverlayHtml(buildCodeHighlightHtml(ta.value, codeLanguage, findActive && findQuery ? findQuery : ''));
          } else if (findActive && findQuery) {
            updateEditorOverlay(findQuery);
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
