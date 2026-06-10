import { useRef, useEffect, useCallback, useState } from 'react';
import rough from 'roughjs';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { useHistoryStore } from '../../store/historyStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useHistory } from '../../hooks/useHistory';
import { renderElement, setImageLoadCallback, type DrawableCache } from '../../features/drawing/renderElement';
import { renderGrid } from '../../features/drawing/renderGrid';
import {
  renderSelection,
  renderSelectionBox,
  renderAlignmentGuides,
  renderConnectionPoints,
} from '../../features/selection/renderSelection';
import {
  hitTestElement,
  getResizeHandleAtPoint,
  getEndpointHandleAtPoint,
  normalizeBounds,
  getElementBounds,
  boundsOverlap,
  boundsContainedIn,
  findNearestConnectionPoint,
} from '../../utils/geometry';
import { createElement } from '../../utils/createElement';
import { wrapTextToLines } from '../../utils/textWrap';
import { GRID_SIZE, CONNECTOR_SNAP_DISTANCE, ALIGNMENT_SNAP_THRESHOLD } from '../../constants';

const TEXT_WRAP_PADDING = 8;
import { ContextMenu } from './ContextMenu';
import { FindBar } from './FindBar';
import { resolveEmbed, sanitizeHyperlink, sanitizeEmbedUrl } from '../../utils/urlSafety';
import { tokenizeLine, getTokenColor, CODE_THEME_DARK, CODE_FONT } from '../../utils/codeDetection';
import type { CanvasElement, Point, ResizeHandle, Bounds, AlignmentGuide, ConnectionPoint } from '../../types';

function snapToGridValue(val: number, gridSize: number): number {
  return Math.round(val / gridSize) * gridSize;
}

// Returns true if the event was handled (caller should stop further processing).
function handleBulletListKeydown(e: KeyboardEvent, ta: HTMLTextAreaElement): boolean {
  const { selectionStart: ss, selectionEnd: se, value } = ta;

  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const lineStart = value.lastIndexOf('\n', ss - 1) + 1;
    const currentLine = value.substring(lineStart, ss);
    const m = currentLine.match(/^(\s*)-\s/);
    if (!m) return false;

    e.preventDefault();
    const indent = m[1];
    const bulletPrefix = indent + '- ';
    const lineContent = currentLine.slice(bulletPrefix.length);

    if (lineContent.trim() === '' && ss === se) {
      // Empty bullet — exit list by removing the marker
      const newVal = value.substring(0, lineStart) + indent + value.substring(lineStart + bulletPrefix.length);
      ta.value = newVal;
      ta.setSelectionRange(lineStart + indent.length, lineStart + indent.length);
    } else {
      // Continue list on the next line
      const ins = '\n' + bulletPrefix;
      const newVal = value.substring(0, ss) + ins + value.substring(se);
      ta.value = newVal;
      ta.setSelectionRange(ss + ins.length, ss + ins.length);
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    const lineStart = value.lastIndexOf('\n', ss - 1) + 1;
    const lineEnd = value.indexOf('\n', ss);
    const currentLine = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);
    const m = currentLine.match(/^(\s*)-\s/);
    if (m) {
      if (e.shiftKey) {
        if (currentLine.startsWith('  ')) {
          const newVal = value.substring(0, lineStart) + currentLine.slice(2) + value.substring(lineStart + currentLine.length);
          ta.value = newVal;
          ta.setSelectionRange(Math.max(lineStart, ss - 2), Math.max(lineStart, ss - 2));
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        const newVal = value.substring(0, lineStart) + '  ' + value.substring(lineStart);
        ta.value = newVal;
        ta.setSelectionRange(ss + 2, ss + 2);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return true;
  }

  return false;
}

function snapPoint(p: Point, snap: boolean): Point {
  if (!snap) return p;
  return { x: snapToGridValue(p.x, GRID_SIZE), y: snapToGridValue(p.y, GRID_SIZE) };
}

// ─── Z-order caches ──────────────────────────────────────────────
// Hit-testing and rendering sort all elements on every event/frame.
// Cache both sort orders keyed on the (immutable) elements array identity.
let zSortInput: CanvasElement[] | null = null;
let zSortDesc: CanvasElement[] = [];
let zSortAsc: CanvasElement[] = [];

function refreshZSortCache(elements: CanvasElement[]) {
  if (elements !== zSortInput) {
    zSortInput = elements;
    zSortAsc = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    zSortDesc = [...elements].sort((a, b) => b.zIndex - a.zIndex);
  }
}

function sortedByZDesc(elements: CanvasElement[]): CanvasElement[] {
  refreshZSortCache(elements);
  return zSortDesc;
}

function sortedByZAsc(elements: CanvasElement[]): CanvasElement[] {
  refreshZSortCache(elements);
  return zSortAsc;
}

type InteractionMode =
  | { type: 'none' }
  | { type: 'drawing'; element: CanvasElement }
  // `snapshotted` defers the undo snapshot to the first actual movement so
  // that plain clicks (select, handle-grab without drag) don't pollute history.
  | { type: 'moving'; startX: number; startY: number; originals: Map<string, { x: number; y: number }>; snapshotted: boolean }
  | { type: 'resizing'; elementId: string; handle: ResizeHandle; startX: number; startY: number; original: { x: number; y: number; width: number; height: number; fontSize?: number; points?: Point[]; text?: string; textWrap?: boolean; isCode?: boolean }; elementType: string; snapshotted: boolean }
  | { type: 'editing-point'; elementId: string; pointIndex: number; originalX: number; originalY: number; originalPoints: Point[]; snapshotted: boolean }
  | { type: 'selecting'; startX: number; startY: number }
  | { type: 'text-input' };

// Embed URL → iframe src + per-origin sandbox policy lives in urlSafety.ts

/** Compute alignment guides for elements being moved */
function computeAlignmentGuides(
  movingBounds: Bounds[],
  staticElements: CanvasElement[],
  threshold: number,
): { guides: AlignmentGuide[]; snapDx: number; snapDy: number } {
  const guides: AlignmentGuide[] = [];
  let snapDx = 0;
  let snapDy = 0;

  const movingLeft   = Math.min(...movingBounds.map(b => b.x));
  const movingRight  = Math.max(...movingBounds.map(b => b.x + b.width));
  const movingCX     = (movingLeft + movingRight) / 2;
  const movingTop    = Math.min(...movingBounds.map(b => b.y));
  const movingBottom = Math.max(...movingBounds.map(b => b.y + b.height));
  const movingCY     = (movingTop + movingBottom) / 2;

  const visExtent = { minY: movingTop - 400, maxY: movingBottom + 400, minX: movingLeft - 400, maxX: movingRight + 400 };

  for (const el of staticElements) {
    const b = getElementBounds(el);
    const sLeft   = b.x;
    const sRight  = b.x + b.width;
    const sCX     = b.x + b.width / 2;
    const sTop    = b.y;
    const sBottom = b.y + b.height;
    const sCY     = b.y + b.height / 2;

    // Vertical guides (x alignment)
    const vCandidates = [
      { pos: sLeft,  dx: sLeft - movingLeft },
      { pos: sRight, dx: sRight - movingRight },
      { pos: sCX,    dx: sCX - movingCX },
    ];
    for (const c of vCandidates) {
      if (Math.abs(c.dx) < threshold && (snapDx === 0 || Math.abs(c.dx) < Math.abs(snapDx))) {
        snapDx = c.dx;
        guides.push({ type: 'vertical', position: c.pos, start: visExtent.minY, end: visExtent.maxY });
      }
    }

    // Horizontal guides (y alignment)
    const hCandidates = [
      { pos: sTop,    dy: sTop - movingTop },
      { pos: sBottom, dy: sBottom - movingBottom },
      { pos: sCY,     dy: sCY - movingCY },
    ];
    for (const c of hCandidates) {
      if (Math.abs(c.dy) < threshold && (snapDy === 0 || Math.abs(c.dy) < Math.abs(snapDy))) {
        snapDy = c.dy;
        guides.push({ type: 'horizontal', position: c.pos, start: visExtent.minX, end: visExtent.maxX });
      }
    }
  }

  return { guides, snapDx, snapDy };
}

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

  // Smart connector snap state
  const connectionSnapRef = useRef<{ elementId: string; point: ConnectionPoint; x: number; y: number } | null>(null);
  const isDrawingArrowRef = useRef(false);

  // Alignment guide state
  const alignmentGuidesRef = useRef<AlignmentGuide[]>([]);

  // E1: per-element rough.js Drawable cache (avoids regenerating on every frame)
  const drawableCacheRef = useRef<DrawableCache>(new Map());

  // Dirty flag: the RAF loop skips all work on frames where nothing changed
  // (previously it re-rendered the full scene at 60fps even when idle).
  const needsRenderRef = useRef(true);

  // E4: active pointer tracking for pinch zoom
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchMidRef = useRef<{ x: number; y: number } | null>(null);

  // E5: live region for screen reader announcements
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Embed iframe overlay
  const embedContainerRef = useRef<HTMLDivElement>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [embedUrlEdit, setEmbedUrlEdit] = useState<{
    elementId: string; screenX: number; screenY: number; value: string;
  } | null>(null);

  // Connector label editing
  const [connectorLabelEdit, setConnectorLabelEdit] = useState<{
    elementId: string; screenX: number; screenY: number; value: string;
  } | null>(null);

  // ─── Find state ─────────────────────────────────────────────
  const findBarActiveRef = useRef(false);
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

  // E2: spawn render worker — pre-generates rough.js Drawables off main thread
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/renderWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ requestId: number; results: Record<string, { hash: string; drawables: unknown[] }> }>) => {
      const { results } = e.data;
      const cache = drawableCacheRef.current;
      // Evict stale entries (deleted elements) then merge new drawables
      const incoming = new Set(Object.keys(results));
      for (const id of cache.keys()) { if (!incoming.has(id)) cache.delete(id); }
      for (const [id, entry] of Object.entries(results)) {
        const cached = cache.get(id);
        // Only overwrite if hash changed (avoid stomping on identical in-frame entry)
        if (!cached || cached.hash !== entry.hash) {
          cache.set(id, entry as import('../../features/drawing/renderElement').DrawableEntry);
        }
      }
      needsRenderRef.current = true;
    };

    // Only send what the worker can actually cache, with only the fields it
    // reads. Previously the FULL element array — including base64 imageData
    // the worker never touches — was structured-cloned on every store
    // commit (potentially MBs per freehand-drawing mousemove).
    const CACHEABLE = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'freehand']);
    const toWorkerPayload = (elements: CanvasElement[]) =>
      elements
        .filter((el) => CACHEABLE.has(el.type) && el.connectorStyle !== 'elbow')
        .map((el) => ({
          id: el.id, type: el.type, x: el.x, y: el.y,
          width: el.width, height: el.height, points: el.points,
          strokeColor: el.strokeColor, fillColor: el.fillColor,
          fillStyle: el.fillStyle, strokeWidth: el.strokeWidth,
          roughness: el.roughness, strokeStyle: el.strokeStyle,
          edgeRoundness: el.edgeRoundness, connectorStyle: el.connectorStyle,
        })) as CanvasElement[];

    // rAF-throttled: bursts of store commits collapse into one postMessage
    let sendScheduled = false;
    const scheduleSend = () => {
      if (sendScheduled) return;
      sendScheduled = true;
      requestAnimationFrame(() => {
        sendScheduled = false;
        worker.postMessage({
          elements: toWorkerPayload(useElementStore.getState().elements),
          requestId: Date.now(),
        });
      });
    };

    const unsub = useElementStore.subscribe((state, prev) => {
      if (state.elements !== prev.elements) scheduleSend();
    });
    // Initial dispatch
    worker.postMessage({ elements: toWorkerPayload(useElementStore.getState().elements), requestId: 0 });
    return () => { worker.terminate(); unsub(); };
  }, []);

  // Dirty-flag sources: any store change or image load invalidates the frame
  useEffect(() => {
    const markDirty = () => { needsRenderRef.current = true; };
    const u1 = useElementStore.subscribe(markDirty);
    const u2 = useCanvasStore.subscribe(markDirty);
    const u3 = useToolStore.subscribe(markDirty);
    setImageLoadCallback(markDirty);
    return () => { u1(); u2(); u3(); setImageLoadCallback(null); };
  }, []);

  // ─── Find helpers ────────────────────────────────────────────
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
    const offsetX = canvas.clientWidth / 2 - (bounds.x + bounds.width / 2) * zoom;
    const offsetY = canvas.clientHeight / 2 - (bounds.y + bounds.height / 2) * zoom;
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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      openCanvasFindBar();
    }
  }, [openCanvasFindBar]);

  const escapeHtml = useCallback((value: string) => {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }, []);

  const buildCodeHighlightHtml = useCallback((text: string, language: string, query = '') => {
    const lowerQuery = query.toLowerCase();
    return text.split('\n').map((line) => {
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
      return tokens.map((token) => {
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
          if (startInToken > processed) parts.push(escapeHtml(token.text.slice(processed, startInToken)));
          parts.push(`<span style="background: rgba(252,232,170,0.8); color: ${color}">${escapeHtml(token.text.slice(startInToken, endInToken))}</span>`);
          processed = endInToken;
        }
        if (processed < token.text.length) parts.push(escapeHtml(token.text.slice(processed)));
        tokenOffset += token.text.length;
        return parts.length === 0
          ? `<span style="color: ${color}">${escapeHtml(token.text)}</span>`
          : `<span style="color: ${color}">${parts.join('')}</span>`;
      }).join('');
    }).join('\n');
  }, [escapeHtml]);

  const buildPlainTextOverlayHtml = useCallback((text: string, query: string) => {
    const lowerQuery = query.toLowerCase();
    return text.split('\n').map((line) => {
      if (!query) return escapeHtml(line);
      const lowerLine = line.toLowerCase();
      let idx = 0;
      const parts: string[] = [];
      while (idx < line.length) {
        const found = lowerLine.indexOf(lowerQuery, idx);
        if (found === -1) { parts.push(escapeHtml(line.slice(idx))); break; }
        if (found > idx) parts.push(escapeHtml(line.slice(idx, found)));
        parts.push(`<span style="background: rgba(252,232,170,0.8);">${escapeHtml(line.slice(found, found + query.length))}</span>`);
        idx = found + query.length;
      }
      return parts.join('') || '&nbsp;';
    }).join('<br>');
  }, [escapeHtml]);

  const buildEditorOverlayHtml = useCallback((value: string, query: string, code: boolean, language: string) => {
    if (code) return buildCodeHighlightHtml(value, language, query);
    if (!query) return '';
    return buildPlainTextOverlayHtml(value, query);
  }, [buildCodeHighlightHtml, buildPlainTextOverlayHtml]);

  const updateEditorOverlay = useCallback((query: string) => {
    const ta = textInputRef.current;
    if (!ta) { setEditorOverlayHtml(''); return; }
    setEditorOverlayHtml(buildEditorOverlayHtml(ta.value, query, isCodeEdit, codeLanguage));
  }, [buildEditorOverlayHtml, codeLanguage, isCodeEdit]);

  const scrollTextareaToChar = useCallback((ta: HTMLTextAreaElement, charIdx: number) => {
    const text = ta.value.substring(0, charIdx);
    const lineNumber = (text.match(/\n/g) ?? []).length;
    const lineHeight = parseFloat(ta.style.fontSize) * parseFloat(ta.style.lineHeight || '1.3');
    ta.scrollTop = Math.max(0, lineNumber * lineHeight - ta.clientHeight / 2);
  }, []);

  const openFindBar = useCallback(() => {
    findBarActiveRef.current = true;
    setFindActive(true);
    setFindMode('text');
    const ta = textInputRef.current;
    if (ta) {
      const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim();
      if (sel && !sel.includes('\n')) {
        const matches = computeFindMatches(sel, ta.value);
        setFindQuery(sel);
        setFindMatches(matches);
        setFindIdx(matches.findIndex((m) => m >= ta.selectionStart) || 0);
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
        useToolStore.getState().setSelectedIds([results[0].elementId]);
        centerCanvasElement(results[0].elementId);
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
      if (!canvasFindResults.length) return;
      const newIdx = (findIdx + 1) % canvasFindResults.length;
      setFindIdx(newIdx);
      useToolStore.getState().setSelectedIds([canvasFindResults[newIdx].elementId]);
      centerCanvasElement(canvasFindResults[newIdx].elementId);
      return;
    }
    if (!findMatches.length) return;
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
      if (!canvasFindResults.length) return;
      const newIdx = (findIdx - 1 + canvasFindResults.length) % canvasFindResults.length;
      setFindIdx(newIdx);
      useToolStore.getState().setSelectedIds([canvasFindResults[newIdx].elementId]);
      centerCanvasElement(canvasFindResults[newIdx].elementId);
      return;
    }
    if (!findMatches.length) return;
    const newIdx = (findIdx - 1 + findMatches.length) % findMatches.length;
    setFindIdx(newIdx);
    const ta = textInputRef.current;
    if (ta) {
      ta.setSelectionRange(findMatches[newIdx], findMatches[newIdx] + findQuery.length);
      scrollTextareaToChar(ta, findMatches[newIdx]);
    }
  }, [canvasFindResults, findMatches, findIdx, findMode, findQuery, centerCanvasElement, scrollTextareaToChar]);

  // ─── Coordinate conversion ───────────────────────────────────
  const screenToCanvas = useCallback((clientX: number, clientY: number): Point => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    return { x: (clientX - offsetX) / zoom, y: (clientY - offsetY) / zoom };
  }, []);

  const canvasToScreen = useCallback((x: number, y: number): Point => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    return { x: x * zoom + offsetX, y: y * zoom + offsetY };
  }, []);

  // ─── Render Loop ─────────────────────────────────────────────
  const render = useCallback(() => {
    // Idle frames are skipped entirely — re-render only when marked dirty
    if (!needsRenderRef.current) {
      rafRef.current = requestAnimationFrame(render);
      return;
    }
    needsRenderRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { offsetX, offsetY, zoom, showGrid, theme } = useCanvasStore.getState();
    const { elements } = useElementStore.getState();
    const { selectedIds, activeTool } = useToolStore.getState();
    const isDark = theme === 'dark';

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = isDark ? '#1a1a2e' : '#f8f9fa';
    ctx.fillRect(0, 0, w, h);

    if (showGrid) renderGrid(ctx, w, h, offsetX, offsetY, zoom, isDark);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    // Build text highlight map
    const highlightMap = new Map<string, { start: number; length: number; active?: boolean }[]>();
    if (findActive && findMode === 'canvas' && findQuery) {
      for (let index = 0; index < canvasFindResults.length; index++) {
        const result = canvasFindResults[index];
        const ranges = highlightMap.get(result.elementId) ?? [];
        ranges.push({ start: result.charIndex, length: findQuery.length, active: index === findIdx });
        highlightMap.set(result.elementId, ranges);
      }
    }

    if (embedContainerRef.current) {
      embedContainerRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    }

    // Viewport bounds in canvas coordinates (with margin for thick strokes / shadows)
    const CULL_MARGIN = 64;
    const viewX = -offsetX / zoom - CULL_MARGIN;
    const viewY = -offsetY / zoom - CULL_MARGIN;
    const viewW = w / zoom + CULL_MARGIN * 2;
    const viewH = h / zoom + CULL_MARGIN * 2;

    const rc = rough.canvas(canvas);
    const sorted = sortedByZAsc(elements);
    for (const element of sorted) {
      if (element.id === editingElementIdRef.current) continue;

      // E1: viewport culling — skip elements entirely outside the visible area
      const b = getElementBounds(element);
      if (b.x + b.width < viewX || b.x > viewX + viewW || b.y + b.height < viewY || b.y > viewY + viewH) continue;

      renderElement(rc, ctx, element, {
        textHighlights: highlightMap.get(element.id),
        isDark,
        drawableCache: drawableCacheRef.current,
      });
    }

    // Connection point indicators when drawing arrows
    if (isDrawingArrowRef.current && (activeTool === 'arrow' || activeTool === 'line')) {
      renderConnectionPoints(ctx, elements, connectionSnapRef.current);
    }

    // Alignment guides during move
    if (alignmentGuidesRef.current.length > 0) {
      renderAlignmentGuides(ctx, alignmentGuidesRef.current, w / zoom, h / zoom);
    }

    // Selection UI — hide selection for the container rect while typing inside it,
    // and for the element currently being edited inline
    const hiddenDuringEdit = new Set<string>();
    if (textContainerRef.current) hiddenDuringEdit.add(textContainerRef.current.id);
    if (editingElementIdRef.current) hiddenDuringEdit.add(editingElementIdRef.current);
    const selectedElements = elements.filter((el) => selectedIds.includes(el.id) && !hiddenDuringEdit.has(el.id));
    renderSelection(ctx, selectedElements);

    if (selectionBoxRef.current) renderSelectionBox(ctx, selectionBoxRef.current);

    ctx.restore();
    rafRef.current = requestAnimationFrame(render);
  }, [findActive, findMode, findQuery, canvasFindResults, findIdx]);

  // ─── Setup / Teardown ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
      needsRenderRef.current = true;
    });
    resizeObserver.observe(container);

    // Re-render once whenever this effect re-runs (find state changed, etc.)
    needsRenderRef.current = true;
    rafRef.current = requestAnimationFrame(render);
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

  // ─── Save Current Text ───────────────────────────────────────
  const saveCurrentText = useCallback(() => {
    // If an EXISTING element is being edited (showTextInputForEdit session),
    // committing is the finishEdit blur listener's job. Creating a new
    // element here would duplicate the text and leave the original element
    // permanently hidden (it stays render-skipped via editingElementIdRef).
    if (editingElementIdRef.current) return;
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
    (textarea as any).__cleanupBlur?.();
    (textarea as any).__cleanupKeydown?.();
  }, [saveSnapshot]);

  // ─── Mouse Down ──────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      needsRenderRef.current = true;
      if (e.button === 2) {
        e.preventDefault();
        const canvasPoint = screenToCanvas(e.clientX, e.clientY);
        const { elements } = useElementStore.getState();
        const sortedDesc = sortedByZDesc(elements);
        const hitElement = sortedDesc.find((el) => !el.locked && hitTestElement(canvasPoint, el)) ?? null;
        rightClickPendingRef.current = { startX: e.clientX, startY: e.clientY, hitElement };
        startRightClickPan(e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0) return;
      if (contextMenu) setContextMenu(null);
      setActiveEmbedId(null);
      saveCurrentText();

      const { activeTool, selectedIds, setSelectedIds, clearSelection, strokeColor, fillColor, strokeWidth, roughness, opacity, fontSize, strokeStyle, fillStyle, edgeRoundness } = useToolStore.getState();

      if (activeTool === 'hand') {
        startRightClickPan(e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }

      if (e.ctrlKey && activeTool === 'select') {
        e.preventDefault();

        // Ctrl+click on element with hyperlink → open URL
        const canvasPoint = screenToCanvas(e.clientX, e.clientY);
        const { elements } = useElementStore.getState();
        const sortedDesc = sortedByZDesc(elements);
        const hitEl = sortedDesc.find((el) => !el.locked && hitTestElement(canvasPoint, el));
        if (hitEl?.hyperlink) {
          // Defense in depth: only ever open validated http(s)/mailto URLs
          const safeUrl = sanitizeHyperlink(hitEl.hyperlink);
          if (safeUrl) window.open(safeUrl, '_blank', 'noopener,noreferrer');
          return;
        }

        // Otherwise pan
        startRightClickPan(e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }

      if (e.ctrlKey) {
        e.preventDefault();
        startRightClickPan(e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }

      if (startPan(e.clientX, e.clientY)) return;

      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const { elements, addElement, getMaxZIndex } = useElementStore.getState();

      if (activeTool === 'select') {
        // Check endpoint handles
        for (const id of selectedIds) {
          const el = elements.find((e) => e.id === id);
          if (el && (el.type === 'line' || el.type === 'arrow') && el.points) {
            const pointIdx = getEndpointHandleAtPoint(canvasPoint, el);
            if (pointIdx !== null) {
              interactionRef.current = {
                type: 'editing-point',
                elementId: id,
                pointIndex: pointIdx,
                originalX: el.x,
                originalY: el.y,
                originalPoints: el.points.map((p) => ({ ...p })),
                snapshotted: false,
              };
              return;
            }
          }
        }

        // Check resize handles
        for (const id of selectedIds) {
          const el = elements.find((e) => e.id === id);
          if (el) {
            const handle = getResizeHandleAtPoint(canvasPoint, el);
            if (handle) {
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
                  isCode: el.isCode,
                },
                elementType: el.type,
                snapshotted: false,
              };
              return;
            }
          }
        }

        // Click on element
        const sortedDesc = sortedByZDesc(elements);
        const hitElement = sortedDesc.find((el) => !el.locked && hitTestElement(canvasPoint, el));

        if (hitElement) {
          // Group expansion: if this element belongs to a group, select all group members
          let idsToSelect: string[];
          if (hitElement.groupId && !e.shiftKey) {
            idsToSelect = elements
              .filter(el => el.groupId === hitElement.groupId)
              .map(el => el.id);
          } else if (e.shiftKey) {
            idsToSelect = selectedIds.includes(hitElement.id)
              ? selectedIds.filter((id) => id !== hitElement.id)
              : [...selectedIds, hitElement.id];
          } else {
            idsToSelect = selectedIds.includes(hitElement.id) ? selectedIds : [hitElement.id];
          }

          setSelectedIds(idsToSelect);

          const currentSelected = idsToSelect;

          if (e.altKey) {
            // Alt-drag duplicates immediately, so the snapshot must be taken
            // now (pre-duplication), not on first move.
            saveSnapshot();
            const { duplicateElements } = useElementStore.getState();
            const duplicated = duplicateElements(currentSelected, 0, 0);
            const newIds = duplicated.map((d) => d.id);
            setSelectedIds(newIds);
            const originals = new Map<string, { x: number; y: number }>();
            for (const dup of duplicated) {
              originals.set(dup.id, { x: dup.x, y: dup.y });
            }
            interactionRef.current = { type: 'moving', startX: canvasPoint.x, startY: canvasPoint.y, originals, snapshotted: true };
          } else {
            const originals = new Map<string, { x: number; y: number }>();
            const finalElements = useElementStore.getState().elements;
            for (const id of currentSelected) {
              const el = finalElements.find((e) => e.id === id);
              if (el) originals.set(id, { x: el.x, y: el.y });
            }
            // If any selected element is a frame, also add its contained elements to originals
            for (const id of currentSelected) {
              const el = finalElements.find((e) => e.id === id);
              if (el && el.type === 'frame') {
                const frameBounds = getElementBounds(el);
                const contained = finalElements.filter(other =>
                  !currentSelected.includes(other.id) &&
                  !other.locked &&
                  boundsContainedIn(getElementBounds(other), frameBounds)
                );
                for (const c of contained) {
                  if (!originals.has(c.id)) originals.set(c.id, { x: c.x, y: c.y });
                }
              }
            }
            interactionRef.current = { type: 'moving', startX: canvasPoint.x, startY: canvasPoint.y, originals, snapshotted: false };
          }
        } else {
          if (!e.shiftKey) clearSelection();
          interactionRef.current = { type: 'selecting', startX: canvasPoint.x, startY: canvasPoint.y };
        }
      } else if (activeTool === 'text') {
        e.preventDefault();
        // If already in a text session, blur the textarea first so the current
        // finishText/finishEdit handler runs and saves before we start a new one.
        if (interactionRef.current.type === 'text-input') {
          textInputRef.current?.blur();
          // Clear the editing ref immediately so the previously-edited element
          // is never hidden during the new session — blur can fire asynchronously.
          editingElementIdRef.current = null;
        }
        const sortedDescText = sortedByZDesc(elements);
        const hitText = sortedDescText.find((el) => el.type === 'text' && !el.locked && hitTestElement(canvasPoint, el));
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

        // Smart connector: check if starting on a connection point
        let startBinding = undefined;
        if (activeTool === 'arrow' || activeTool === 'line') {
          const snap2 = findNearestConnectionPoint(canvasPoint, elements, [], CONNECTOR_SNAP_DISTANCE);
          if (snap2) {
            startBinding = { elementId: snap2.elementId, point: snap2.point };
            drawPoint.x = snap2.x;
            drawPoint.y = snap2.y;
          }
          isDrawingArrowRef.current = true;
        }

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

        if (startBinding) {
          (newElement as any).startBinding = startBinding;
        }

        addElement(newElement);
        interactionRef.current = { type: 'drawing', element: newElement };
      }
    },
    [startPan, startRightClickPan, screenToCanvas, saveSnapshot, saveCurrentText, contextMenu],
  );

  // ─── Mouse Move ──────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Interactions can mutate render-relevant refs (selection box,
      // alignment guides, connector snap) without touching any store.
      needsRenderRef.current = true;
      if (movePan(e.clientX, e.clientY)) return;

      const rawCanvasPoint = screenToCanvas(e.clientX, e.clientY);
      const snap = useCanvasStore.getState().snapToGrid;
      const canvasPoint = rawCanvasPoint;
      const interaction = interactionRef.current;
      const { updateElement, updateConnectorBindings } = useElementStore.getState();

      if (interaction.type === 'drawing') {
        const el = interaction.element;
        const snappedPoint = snapPoint(rawCanvasPoint, snap);

        if (el.type === 'freehand') {
          const current = useElementStore.getState().elements.find((e) => e.id === el.id);
          if (current) {
            const newPoint = { x: rawCanvasPoint.x - el.x, y: rawCanvasPoint.y - el.y };
            updateElement(el.id, { points: [...(current.points ?? []), newPoint] });
          }
        } else if (el.type === 'line' || el.type === 'arrow') {
          // Check for connection point snap at end
          const { elements } = useElementStore.getState();
          const snap2 = findNearestConnectionPoint(rawCanvasPoint, elements, [el.id], CONNECTOR_SNAP_DISTANCE);
          connectionSnapRef.current = snap2;
          const targetPt = snap2 ? { x: snap2.x, y: snap2.y } : snappedPoint;
          const endPoint = { x: targetPt.x - el.x, y: targetPt.y - el.y };
          updateElement(el.id, { points: [{ x: 0, y: 0 }, endPoint] });
        } else {
          updateElement(el.id, {
            width: snappedPoint.x - el.x,
            height: snappedPoint.y - el.y,
          });
        }
      } else if (interaction.type === 'moving') {
        const dx = rawCanvasPoint.x - interaction.startX;
        const dy = rawCanvasPoint.y - interaction.startY;
        // First actual movement → record the pre-move state for undo
        if (!interaction.snapshotted && (dx !== 0 || dy !== 0)) {
          saveSnapshot();
          interaction.snapshotted = true;
        }
        const { elements } = useElementStore.getState();

        // Compute alignment guides against non-moving elements
        const movingIds = new Set(interaction.originals.keys());
        const staticElements = elements.filter(el => !movingIds.has(el.id) && !el.locked);
        const movingBounds = [...interaction.originals.entries()].map(([id, orig]) => {
          const el = elements.find(e => e.id === id);
          if (!el) return { x: orig.x + dx, y: orig.y + dy, width: 0, height: 0 };
          const b = getElementBounds(el);
          return { x: b.x - el.x + orig.x + dx, y: b.y - el.y + orig.y + dy, width: b.width, height: b.height };
        });

        let finalDx = dx;
        let finalDy = dy;
        alignmentGuidesRef.current = [];

        if (!snap && staticElements.length > 0) {
          const { guides, snapDx, snapDy } = computeAlignmentGuides(movingBounds, staticElements, ALIGNMENT_SNAP_THRESHOLD);
          alignmentGuidesRef.current = guides;
          if (Math.abs(snapDx) < ALIGNMENT_SNAP_THRESHOLD) finalDx = dx + snapDx;
          if (Math.abs(snapDy) < ALIGNMENT_SNAP_THRESHOLD) finalDy = dy + snapDy;
        }

        // Single batched store commit for the whole selection (1 subscriber
        // notification per mousemove instead of N)
        const moveUpdates = new Map<string, Partial<CanvasElement>>();
        const movedShapeIds: string[] = [];
        for (const [id, orig] of interaction.originals) {
          const newPos = snap ? snapPoint({ x: orig.x + finalDx, y: orig.y + finalDy }, snap) : { x: orig.x + finalDx, y: orig.y + finalDy };
          moveUpdates.set(id, { x: newPos.x, y: newPos.y });
          const el = elements.find(e => e.id === id);
          if (el && el.type !== 'arrow' && el.type !== 'line' && el.type !== 'freehand') {
            movedShapeIds.push(id);
          }
        }
        useElementStore.getState().updateElements(moveUpdates);

        // Update any arrows bound to the moved shapes
        if (movedShapeIds.length > 0) {
          updateConnectorBindings(movedShapeIds);
        }
      } else if (interaction.type === 'resizing') {
        const { elementId, handle, startX, startY, original, elementType } = interaction;
        const dx = canvasPoint.x - startX;
        const dy = canvasPoint.y - startY;
        // First actual movement → record the pre-resize state for undo
        if (!interaction.snapshotted && (dx !== 0 || dy !== 0)) {
          saveSnapshot();
          interaction.snapshotted = true;
        }

        let { x, y, width, height } = original;
        if (handle.includes('e')) { width += dx; }
        if (handle.includes('w')) { x += dx; width -= dx; }
        if (handle.includes('s')) { height += dy; }
        if (handle.includes('n')) { y += dy; height -= dy; }

        if (elementType === 'text' && original.fontSize) {
          if (original.isCode) {
            // Code blocks: scale font size
            const scaleX = original.width > 0 ? width / original.width : 1;
            const scaleY = original.height > 0 ? height / original.height : 1;
            const scale = Math.max(0.1, Math.min(scaleX, scaleY));
            updateElement(elementId, { x, y, width, height, fontSize: Math.max(8, Math.min(200, Math.round(original.fontSize * scale))) });
          } else {
            // Regular text: word-wrap to the new width
            const constrainedWidth = Math.max(20, width);
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx && original.text) {
                ctx.font = `${original.fontSize}px 'Virgil', 'Segoe Print', 'Comic Sans MS', cursive`;
                const wrappedLines = wrapTextToLines(original.text, constrainedWidth, ctx);
                updateElement(elementId, { x, y, width: constrainedWidth, height: wrappedLines.length * Math.round(original.fontSize * 1.3), textWrap: true });
              } else {
                updateElement(elementId, { x, y, width: constrainedWidth, height: Math.max(20, height) });
              }
            }
          }
        } else if ((elementType === 'line' || elementType === 'arrow' || elementType === 'freehand') && original.points) {
          const scaleX = original.width > 0 ? Math.abs(width) / original.width : 1;
          const scaleY = original.height > 0 ? Math.abs(height) / original.height : 1;
          const origMinX = Math.min(...original.points.map(p => p.x));
          const origMinY = Math.min(...original.points.map(p => p.y));
          const scaledPoints = original.points.map(p => ({
            x: (p.x - origMinX) * scaleX + (width < 0 ? Math.abs(width) : 0),
            y: (p.y - origMinY) * scaleY + (height < 0 ? Math.abs(height) : 0),
          }));
          updateElement(elementId, { x, y, points: scaledPoints });
        } else {
          updateElement(elementId, { x, y, width, height });
        }

        // Update bindings when resizing a shape
        updateConnectorBindings([elementId]);
      } else if (interaction.type === 'editing-point') {
        const { elementId, pointIndex, originalX, originalY, originalPoints } = interaction;
        // First actual movement → record the pre-edit state for undo
        if (!interaction.snapshotted) {
          saveSnapshot();
          interaction.snapshotted = true;
        }
        const snapped = snapPoint(rawCanvasPoint, snap);
        let targetX = snapped.x;
        let targetY = snapped.y;
        if (e.shiftKey && originalPoints.length === 2) {
          const otherIdx = pointIndex === 0 ? 1 : 0;
          const anchorX = originalPoints[otherIdx].x + originalX;
          const anchorY = originalPoints[otherIdx].y + originalY;
          const ddx = targetX - anchorX;
          const ddy = targetY - anchorY;
          const angle = Math.atan2(ddy, ddx);
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(ddx, ddy);
          targetX = anchorX + Math.cos(snappedAngle) * len;
          targetY = anchorY + Math.sin(snappedAngle) * len;
        }

        // Check for connection point snap when editing endpoint
        const { elements } = useElementStore.getState();
        const el = elements.find(e => e.id === elementId);
        if (el) {
          const snap2 = findNearestConnectionPoint({ x: targetX, y: targetY }, elements, [elementId], CONNECTOR_SNAP_DISTANCE);
          if (snap2) {
            targetX = snap2.x;
            targetY = snap2.y;
            connectionSnapRef.current = snap2;
          } else {
            connectionSnapRef.current = null;
          }
        }

        const newPoints = originalPoints.map((p) => ({ ...p }));
        newPoints[pointIndex] = { x: targetX - originalX, y: targetY - originalY };
        updateElement(elementId, { points: newPoints });
      } else if (interaction.type === 'selecting') {
        const { startX, startY } = interaction;
        selectionBoxRef.current = normalizeBounds(startX, startY, canvasPoint.x - startX, canvasPoint.y - startY);
      }

      updateCursor(canvasPoint, e);
    },
    [movePan, screenToCanvas, saveSnapshot],
  );

  // ─── Mouse Up ────────────────────────────────────────────────
  const handleMouseUp = useCallback((e?: React.MouseEvent) => {
    needsRenderRef.current = true;
    endPan();
    alignmentGuidesRef.current = [];

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
      const el = interaction.element;

      // Prune degenerate elements left by click-without-drag (0×0 shapes,
      // single-point lines/arrows): invisible junk that would otherwise be
      // autosaved and pollute bounds math. Also discard the undo snapshot
      // pushed at mousedown so undo doesn't appear to be a no-op.
      // (Embeds are excluded: a click intentionally creates a min-size embed.)
      if (el.type !== 'embed') {
        const currentEl = useElementStore.getState().elements.find((e) => e.id === el.id);
        if (currentEl) {
          let degenerate = false;
          if (el.type === 'line' || el.type === 'arrow' || el.type === 'freehand') {
            const pts = currentEl.points;
            if (!pts || pts.length < 2) {
              degenerate = true;
            } else if (el.type !== 'freehand') {
              degenerate = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) < 2;
            }
          } else {
            degenerate = Math.abs(currentEl.width) < 2 && Math.abs(currentEl.height) < 2;
          }
          if (degenerate) {
            useElementStore.getState().removeElements([el.id]);
            useHistoryStore.getState().popState();
            connectionSnapRef.current = null;
            isDrawingArrowRef.current = false;
            const { lockToolMode } = useToolStore.getState();
            if (!lockToolMode) useToolStore.getState().setActiveTool('select');
            interactionRef.current = { type: 'none' };
            return;
          }
        }
      }

      // Set endBinding if snapped to connection point
      if ((el.type === 'arrow' || el.type === 'line') && connectionSnapRef.current) {
        useElementStore.getState().updateElement(el.id, {
          endBinding: { elementId: connectionSnapRef.current.elementId, point: connectionSnapRef.current.point },
        });
        connectionSnapRef.current = null;
      }

      if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond' || el.type === 'frame' || el.type === 'embed') {
        const { elements } = useElementStore.getState();
        const current = elements.find((e) => e.id === el.id);
        if (current) {
          const normalized = normalizeBounds(current.x, current.y, current.width, current.height);
          useElementStore.getState().updateElement(el.id, normalized);
        }
      }

      if (el.type === 'embed') {
        const { elements } = useElementStore.getState();
        const current = elements.find((e) => e.id === el.id);
        if (current) {
          const minW = 200, minH = 150;
          if (current.width < minW || current.height < minH) {
            useElementStore.getState().updateElement(el.id, {
              width: Math.max(current.width, minW),
              height: Math.max(current.height, minH),
            });
          }
          const { offsetX, offsetY, zoom } = useCanvasStore.getState();
          const finalW = Math.max(current.width, minW);
          const finalH = Math.max(current.height, minH);
          setEmbedUrlEdit({
            elementId: el.id,
            value: '',
            screenX: (current.x + finalW / 2) * zoom + offsetX,
            screenY: (current.y + finalH / 2) * zoom + offsetY,
          });
        }
      }

      isDrawingArrowRef.current = false;
      const { lockToolMode } = useToolStore.getState();
      if (!lockToolMode) useToolStore.getState().setActiveTool('select');
    } else if (interaction.type === 'editing-point') {
      // Set binding when editing arrow endpoint
      const { elementId, pointIndex } = interaction;
      if (connectionSnapRef.current) {
        const bindingKey = pointIndex === 0 ? 'startBinding' : 'endBinding';
        useElementStore.getState().updateElement(elementId, {
          [bindingKey]: { elementId: connectionSnapRef.current.elementId, point: connectionSnapRef.current.point },
        });
        connectionSnapRef.current = null;
      }
    } else if (interaction.type === 'selecting' && selectionBoxRef.current) {
      const box = selectionBoxRef.current;
      const { elements } = useElementStore.getState();
      const selectedIds = elements
        .filter((el) => !el.locked && boundsOverlap(box, getElementBounds(el)))
        .map((el) => el.id);
      useToolStore.getState().setSelectedIds(selectedIds);
      selectionBoxRef.current = null;
    }

    interactionRef.current = { type: 'none' };
  }, [endPan]);

  // ─── Cursor Management ───────────────────────────────────────
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
      const hovered = sortedByZDesc(textElements).find((el) => el.type === 'text' && hitTestElement(canvasPoint, el));
      canvas.style.cursor = hovered ? 'text' : 'crosshair';
      return;
    }
    if (activeTool !== 'select') {
      canvas.style.cursor = 'crosshair';
      return;
    }

    const { elements } = useElementStore.getState();
    for (const id of selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (el) {
        if ((el.type === 'line' || el.type === 'arrow') && el.points) {
          if (getEndpointHandleAtPoint(canvasPoint, el) !== null) {
            canvas.style.cursor = 'grab';
            return;
          }
        }
        const handle = getResizeHandleAtPoint(canvasPoint, el);
        if (handle) {
          const cursorMap: Record<ResizeHandle, string> = {
            nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize',
            n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
          };
          canvas.style.cursor = cursorMap[handle];
          return;
        }
      }
    }

    const sortedDesc = sortedByZDesc(elements);
    const hovered = sortedDesc.find((el) => !el.locked && hitTestElement(canvasPoint, el));

    // Show pointer cursor on elements with hyperlinks in select mode
    if (hovered?.hyperlink) {
      canvas.style.cursor = 'pointer';
      return;
    }

    canvas.style.cursor = hovered ? 'move' : 'default';
  }, [isSpacePressed]);

  // ─── Edit existing text element ──────────────────────────────
  const showTextInputForEdit = useCallback((element: CanvasElement, clickPoint?: Point) => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    const textarea = textInputRef.current;
    if (!textarea) return;

    editingElementIdRef.current = element.id;
    // Hide the element on canvas while it's being edited in the textarea
    needsRenderRef.current = true;

    const isCode = element.isCode ?? false;
    const fontFamily = isCode
      ? "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace"
      : "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive";
    const editFontSize = element.fontSize ?? (isCode ? 14 : 40);
    const editLineHeight = isCode ? 1.5 : 1.3;
    const codePad = Math.round(16 * zoom);

    isWrappedTextRef.current = element.textWrap ?? false;

    if (element.textWrap) {
      const { elements: allEls } = useElementStore.getState();
      const container = [...allEls]
        .filter(el => el.type === 'rectangle' && el.id !== element.id)
        .sort((a, b) => b.zIndex - a.zIndex)
        .find(el =>
          element.x >= el.x && element.x + element.width <= el.x + el.width &&
          element.y >= el.y && element.y <= el.y + el.height
        ) ?? null;
      textContainerRef.current = container;
      textPositionRef.current = { x: element.x, y: element.y };
    } else {
      textContainerRef.current = null;
      textPositionRef.current = null;
    }

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
    // Normalize height to browser's actual scrollHeight so the first Enter
    // expands by exactly one line instead of causing a sudden jump.
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    if (!isCode && !element.textWrap) {
      const initCanvas = canvasRef.current;
      if (initCanvas) {
        const initCtx = initCanvas.getContext('2d');
        if (initCtx) {
          initCtx.font = `${editFontSize * zoom}px ${fontFamily}`;
          const initLines = (element.text ?? '').split('\n');
          const initMaxW = Math.max(20, ...initLines.map(l => initCtx.measureText(l || ' ').width));
          textarea.style.width = (initMaxW + 20) + 'px';
        }
      }
    }
    textarea.focus();
    setIsCodeEdit(isCode);
    const lang = element.codeLanguage ?? 'code';
    setCodeLanguage(lang);
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
      for (let i = 0; i < Math.min(lineIndex, lines.length); i++) charPos += lines[i].length + 1;
      if (lineIndex < lines.length) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.font = `${editFontSize}px ${fontFamily}`;
            const relX = clickPoint.x - element.x - (isCode ? 16 : 0);
            const line = lines[lineIndex];
            for (let i = 0; i <= line.length; i++) {
              const w = ctx.measureText(line.substring(0, i)).width;
              if (w >= relX) { charPos += Math.max(0, i - 1); break; }
              if (i === line.length) charPos += line.length;
            }
          }
        }
      }
      textarea.setSelectionRange(charPos, charPos);
    } else {
      textarea.select();
    }

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
              updates.width = maxWidth + 32;
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
        if (element.textWrap && updates.height != null) {
          const container = textContainerRef.current;
          if (container) {
            const textBottom = element.y + updates.height + TEXT_WRAP_PADDING;
            if (textBottom > container.y + container.height) {
              useElementStore.getState().updateElement(container.id, {
                height: textBottom - container.y + TEXT_WRAP_PADDING,
              });
            }
          }
        }
      } else {
        useElementStore.getState().removeElements([element.id]);
      }
      textarea.style.display = 'none';
      textarea.style.width = '';
      textarea.style.height = '';
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
      textContainerRef.current = null;
      textPositionRef.current = null;
      editingElementIdRef.current = null;
      interactionRef.current = { type: 'none' };
      setIsCodeEdit(false);
      setEditorOverlayHtml('');
      findBarActiveRef.current = false;
      setFindActive(false);
      setFindQuery('');
      setFindMatches([]);
      setFindIdx(0);
      (textarea as any).__cleanupBlur?.();
      (textarea as any).__cleanupKeydown?.();
    };

    const handleBlur = (e: FocusEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest?.('[data-find-bar]')) return;
      finishEdit();
    };
    textarea.addEventListener('blur', handleBlur);
    (textarea as any).__cleanupBlur = () => textarea.removeEventListener('blur', handleBlur);

    const handleEditKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { textarea.blur(); useToolStore.getState().clearSelection(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); e.stopPropagation(); openFindBar(); return; }
      handleBulletListKeydown(e, textarea);
    };
    textarea.addEventListener('keydown', handleEditKeydown);
    (textarea as any).__cleanupKeydown = () => textarea.removeEventListener('keydown', handleEditKeydown);
  }, [saveSnapshot, openFindBar, buildCodeHighlightHtml, findActive, findQuery, updateEditorOverlay]);

  // ─── Double-Click ────────────────────────────────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      const { elements } = useElementStore.getState();
      const sortedDesc = sortedByZDesc(elements);

      // Embed element → enter interactive mode or show URL input
      const hitEmbed = sortedDesc.find((el) => el.type === 'embed' && !el.locked && hitTestElement(canvasPoint, el));
      if (hitEmbed) {
        e.preventDefault();
        if (hitEmbed.embedUrl) {
          setActiveEmbedId(hitEmbed.id);
        } else {
          const { offsetX, offsetY, zoom } = useCanvasStore.getState();
          setEmbedUrlEdit({
            elementId: hitEmbed.id,
            value: hitEmbed.embedUrl ?? '',
            screenX: (hitEmbed.x + hitEmbed.width / 2) * zoom + offsetX,
            screenY: (hitEmbed.y + hitEmbed.height / 2) * zoom + offsetY,
          });
        }
        return;
      }

      // Text element → edit
      const hitText = sortedDesc.find((el) => el.type === 'text' && !el.locked && hitTestElement(canvasPoint, el));
      if (hitText) {
        e.preventDefault();
        interactionRef.current = { type: 'text-input' };
        showTextInputForEdit(hitText, canvasPoint);
        return;
      }

      // Arrow/Line → edit connector label
      const hitArrow = sortedDesc.find((el) => (el.type === 'arrow' || el.type === 'line') && hitTestElement(canvasPoint, el));
      if (hitArrow) {
        e.preventDefault();
        const screen = canvasToScreen(
          hitArrow.x + (hitArrow.points ? hitArrow.points[1].x / 2 : 0),
          hitArrow.y + (hitArrow.points ? hitArrow.points[1].y / 2 : 0),
        );
        setConnectorLabelEdit({
          elementId: hitArrow.id,
          screenX: screen.x,
          screenY: screen.y,
          value: hitArrow.connectorLabel ?? '',
        });
        return;
      }

      // Frame → rename
      const hitFrame = sortedDesc.find((el) => el.type === 'frame' && hitTestElement(canvasPoint, el));
      if (hitFrame) {
        e.preventDefault();
        const newName = window.prompt('Frame name:', hitFrame.frameName ?? 'Frame');
        if (newName !== null) {
          useElementStore.getState().updateElement(hitFrame.id, { frameName: newName || 'Frame' });
        }
      }
    },
    [screenToCanvas, canvasToScreen, showTextInputForEdit],
  );

  // ─── Text Input ──────────────────────────────────────────────
  const showTextInput = useCallback((canvasPoint: Point) => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    const { fontSize: currentFontSize } = useToolStore.getState();
    const textarea = textInputRef.current;
    if (!textarea) return;

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
    if (findActive && findQuery) updateEditorOverlay(findQuery);

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
              if (textBottom > container.y + container.height) {
                useElementStore.getState().updateElement(container.id, { height: textBottom - container.y + TEXT_WRAP_PADDING });
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
        const { lockToolMode } = useToolStore.getState();
        if (!lockToolMode) useToolStore.getState().setActiveTool('select');
      }
      textarea.style.display = 'none';
      textarea.value = '';
      textarea.style.whiteSpace = 'pre';
      textarea.style.wordBreak = '';
      textarea.style.overflowWrap = '';
      textPositionRef.current = null;
      textContainerRef.current = null;
      isWrappedTextRef.current = false;
      editingElementIdRef.current = null;
      interactionRef.current = { type: 'none' };
      (textarea as any).__cleanupBlur?.();
      (textarea as any).__cleanupKeydown?.();
    };

    (textarea as any).__cleanupBlur?.();
    (textarea as any).__cleanupKeydown?.();

    textarea.addEventListener('blur', finishText);
    (textarea as any).__cleanupBlur = () => textarea.removeEventListener('blur', finishText);

    const handleTextKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { textarea.blur(); useToolStore.getState().clearSelection(); return; }
      handleBulletListKeydown(e, textarea);
    };
    textarea.addEventListener('keydown', handleTextKeydown);
    (textarea as any).__cleanupKeydown = () => textarea.removeEventListener('keydown', handleTextKeydown);
  }, [saveSnapshot, findActive, findQuery, updateEditorOverlay]);

  // E4: pointer event wrappers (pointer events fire for mouse + touch + pen)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm rejection: ignore large-area touch contacts (flat palm, wrist)
    if (e.pointerType === 'touch' && e.width > 70 && e.height > 70) return;

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size >= 2) {
      // Two-finger gesture → pinch-zoom mode; cancel any active drawing
      const pts = Array.from(activePointersRef.current.values());
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      lastPinchMidRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      interactionRef.current = { type: 'none' };
      endPan();
      return;
    }

    // Capture so subsequent moves/ups fire even if pointer leaves the element
    e.currentTarget.setPointerCapture(e.pointerId);
    handleMouseDown(e as unknown as React.MouseEvent<HTMLCanvasElement>);
  }, [handleMouseDown, endPan]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size >= 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (lastPinchDistRef.current !== null && lastPinchMidRef.current) {
        const scale = dist / lastPinchDistRef.current;
        const { zoom, setZoom, offsetX, offsetY, setOffset } = useCanvasStore.getState();
        setZoom(zoom * scale, midX, midY);
        setOffset(offsetX + midX - lastPinchMidRef.current.x, offsetY + midY - lastPinchMidRef.current.y);
      }
      lastPinchDistRef.current = dist;
      lastPinchMidRef.current = { x: midX, y: midY };
      return;
    }

    handleMouseMove(e as unknown as React.MouseEvent<HTMLCanvasElement>);
  }, [handleMouseMove]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
    handleMouseUp(e as unknown as React.MouseEvent<HTMLCanvasElement>);
  }, [handleMouseUp]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
    handleMouseUp(e as unknown as React.MouseEvent<HTMLCanvasElement>);
  }, [handleMouseUp]);

  const { theme } = useCanvasStore();
  const isEmpty = useElementStore((s) => s.elements.length === 0);
  const allElements = useElementStore((s) => s.elements);
  const embedElements = allElements.filter((el) => el.type === 'embed');
  const selectedIds = useToolStore((s) => s.selectedIds);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}
    >
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

      {/* Hidden keyboard-navigation instructions for screen readers */}
      <p id="canvas-instructions" className="sr-only">
        Drawing canvas. Use toolbar tools to draw. Tab or Shift+Tab cycles through elements.
        Arrow keys nudge the selection; Shift+Arrow for larger steps. Delete removes selection.
        Press ? for all keyboard shortcuts.
      </p>

      {/* E5: live region for screen-reader announcements (tool changes, etc.) */}
      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Drawing canvas"
        aria-describedby="canvas-instructions"
        tabIndex={0}
        className="w-full h-full block focus:outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
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
        style={{ fontFamily: "'Virgil', 'Segoe Print', 'Comic Sans MS', cursive", minWidth: '20px', minHeight: '1.5em', lineHeight: 1.3 }}
        onInput={(e) => {
          const ta = e.currentTarget;
          const isCodeEditLocal = isCodeEdit;
          const fontFamily = ta.style.fontFamily;
          const currentZoom = useCanvasStore.getState().zoom;
          const padding = isCodeEditLocal ? Math.round(32 * currentZoom) : 0;
          ta.style.height = 'auto';
          ta.style.height = ta.scrollHeight + 'px';
          if (isWrappedTextRef.current) {
            const container = textContainerRef.current;
            const position = textPositionRef.current;
            if (container && position) {
              const textHeightCanvas = ta.scrollHeight / currentZoom;
              const textBottom = position.y + textHeightCanvas + TEXT_WRAP_PADDING;
              const rectBottom = container.y + container.height;
              if (textBottom > rectBottom) {
                const newHeight = textBottom - container.y + TEXT_WRAP_PADDING;
                useElementStore.getState().updateElement(container.id, { height: newHeight });
                textContainerRef.current = { ...container, height: newHeight };
              }
            }
          }
          if (!isWrappedTextRef.current) {
            const lines = ta.value.split('\n');
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.font = ta.style.fontSize + ' ' + fontFamily;
                const maxWidth = Math.max(20, ...lines.map(line => ctx.measureText(line || ' ').width));
                ta.style.width = (maxWidth + 20 + padding) + 'px';
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

      {/* Connector label editor */}
      {connectorLabelEdit && (
        <input
          autoFocus
          value={connectorLabelEdit.value}
          onChange={(e) => setConnectorLabelEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
          onBlur={() => {
            if (connectorLabelEdit) {
              useElementStore.getState().updateElement(connectorLabelEdit.elementId, {
                connectorLabel: connectorLabelEdit.value.trim() || undefined,
              });
            }
            setConnectorLabelEdit(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              if (e.key === 'Enter' && connectorLabelEdit) {
                useElementStore.getState().updateElement(connectorLabelEdit.elementId, {
                  connectorLabel: connectorLabelEdit.value.trim() || undefined,
                });
              }
              setConnectorLabelEdit(null);
            }
          }}
          placeholder="Label…"
          className="absolute text-[12px] px-2 py-1 rounded-lg border border-indigo-400 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none shadow-sm z-50 min-w-[80px]"
          style={{
            left: connectorLabelEdit.screenX - 40,
            top: connectorLabelEdit.screenY - 14,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}

      {/* Embed iframe overlays — positioned with CSS transform synced to canvas */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 2, pointerEvents: 'none' }}>
        <div ref={embedContainerRef} style={{ position: 'absolute', transformOrigin: '0 0' }}>
          {embedElements.map((el) => {
            const isActive = activeEmbedId === el.id;
            const isSelected = selectedIds.includes(el.id);
            return (
              <div
                key={el.id}
                style={{
                  position: 'absolute',
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  pointerEvents: isActive ? 'all' : 'none',
                  opacity: el.opacity,
                  borderRadius: 6,
                  overflow: 'hidden',
                  outline: isSelected ? '2px solid #6366f1' : 'none',
                  outlineOffset: 2,
                  boxShadow: isActive ? '0 0 0 3px rgba(99,102,241,0.4)' : undefined,
                }}
              >
                {(() => {
                  if (!el.embedUrl) return null;
                  const embed = resolveEmbed(el.embedUrl);
                  if (!embed) return null;
                  return (
                    <iframe
                      src={embed.src}
                      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                      sandbox={embed.sandbox}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Embed URL input dialog */}
      {embedUrlEdit && (
        <div
          className="fixed z-[200] flex flex-col gap-2 p-3 rounded-2xl bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.10)] border border-black/[0.06] dark:border-white/[0.07] w-[320px]"
          style={{ left: Math.min(embedUrlEdit.screenX - 160, window.innerWidth - 336), top: Math.max(8, embedUrlEdit.screenY - 60) }}
        >
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Embed URL</span>
          <input
            autoFocus
            value={embedUrlEdit.value}
            onChange={(e) => setEmbedUrlEdit((prev) => prev ? { ...prev, value: e.target.value } : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const url = sanitizeEmbedUrl(embedUrlEdit.value) ?? undefined;
                useElementStore.getState().updateElement(embedUrlEdit.elementId, { embedUrl: url });
                if (url) setActiveEmbedId(embedUrlEdit.elementId);
                useToolStore.getState().setSelectedIds([embedUrlEdit.elementId]);
                setEmbedUrlEdit(null);
              }
              if (e.key === 'Escape') {
                setEmbedUrlEdit(null);
              }
            }}
            placeholder="https://youtube.com/watch?v=... or any URL"
            className="text-[13px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-indigo-400 w-full"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                const url = sanitizeEmbedUrl(embedUrlEdit.value) ?? undefined;
                useElementStore.getState().updateElement(embedUrlEdit.elementId, { embedUrl: url });
                if (url) setActiveEmbedId(embedUrlEdit.elementId);
                useToolStore.getState().setSelectedIds([embedUrlEdit.elementId]);
                setEmbedUrlEdit(null);
              }}
              className="flex-1 text-[12px] py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
            >
              Embed
            </button>
            <button
              onClick={() => setEmbedUrlEdit(null)}
              className="text-[12px] py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-600 dark:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
