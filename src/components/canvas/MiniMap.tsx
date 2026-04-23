import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { getElementBounds } from '../../utils/geometry';

const MM_W = 196;
const MM_H = 120;
const PAD = 10;

interface Transform {
  worldLeft: number;
  worldTop: number;
  scale: number;
  mmOffX: number;
  mmOffY: number;
}

const HIDE_DELAY = 1800; // ms of inactivity before fading out

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<Transform | null>(null);
  const isDraggingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || collapsed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { offsetX, offsetY, zoom, theme } = useCanvasStore.getState();
    const { elements } = useElementStore.getState();
    const isDark = theme === 'dark';

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== MM_W * dpr || canvas.height !== MM_H * dpr) {
      canvas.width = MM_W * dpr;
      canvas.height = MM_H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Viewport in world coords
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const vpLeft = -offsetX / zoom;
    const vpTop = -offsetY / zoom;
    const vpRight = vpLeft + vpW / zoom;
    const vpBottom = vpTop + vpH / zoom;

    // World bounds = union of all elements + viewport
    let wLeft = vpLeft, wTop = vpTop, wRight = vpRight, wBottom = vpBottom;
    for (const el of elements) {
      const b = getElementBounds(el);
      if (b.width > 0 || b.height > 0) {
        wLeft = Math.min(wLeft, b.x);
        wTop = Math.min(wTop, b.y);
        wRight = Math.max(wRight, b.x + b.width);
        wBottom = Math.max(wBottom, b.y + b.height);
      }
    }

    const margin = 0.06;
    const worldW = (wRight - wLeft) || 800;
    const worldH = (wBottom - wTop) || 600;
    wLeft -= worldW * margin;
    wTop -= worldH * margin;
    wRight += worldW * margin;
    wBottom += worldH * margin;

    const availW = MM_W - PAD * 2;
    const availH = MM_H - PAD * 2;
    const scale = Math.min(availW / (wRight - wLeft), availH / (wBottom - wTop));

    const mmOffX = PAD + (availW - (wRight - wLeft) * scale) / 2;
    const mmOffY = PAD + (availH - (wBottom - wTop) * scale) / 2;

    transformRef.current = { worldLeft: wLeft, worldTop: wTop, scale, mmOffX, mmOffY };

    const toMM = (wx: number, wy: number) => ({
      x: (wx - wLeft) * scale + mmOffX,
      y: (wy - wTop) * scale + mmOffY,
    });

    // ── Background ──────────────────────────────────────────────────
    ctx.clearRect(0, 0, MM_W, MM_H);
    ctx.fillStyle = isDark ? '#111318' : '#ffffff';
    ctx.fillRect(0, 0, MM_W, MM_H);

    // ── Dot grid ────────────────────────────────────────────────────
    const dotAlpha = isDark ? 0.055 : 0.07;
    ctx.fillStyle = isDark ? `rgba(255,255,255,${dotAlpha})` : `rgba(15,23,42,${dotAlpha})`;
    const dotSpacing = 10;
    for (let dx = PAD + 2; dx < MM_W - PAD; dx += dotSpacing) {
      for (let dy = PAD + 2; dy < MM_H - PAD; dy += dotSpacing) {
        ctx.beginPath();
        ctx.arc(dx, dy, 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Viewport fill (behind elements) ─────────────────────────────
    const vpTL = toMM(vpLeft, vpTop);
    const vpMW = (vpRight - vpLeft) * scale;
    const vpMH = (vpBottom - vpTop) * scale;

    // Inset the rect slightly so it feels less heavy
    const inset = 3;
    const rx = vpTL.x + inset;
    const ry = vpTL.y + inset;
    const rw = vpMW - inset * 2;
    const rh = vpMH - inset * 2;

    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(59,130,246,0.03)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 3);
    ctx.fill();

    // ── Elements ────────────────────────────────────────────────────
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const el of sorted) {
      const b = getElementBounds(el);
      const { x, y } = toMM(b.x, b.y);
      const w = Math.max(b.width * scale, 2);
      const h = Math.max(b.height * scale, 2);

      // Use element's actual stroke color, dimmed
      let elStroke = el.strokeColor;
      if (!elStroke || elStroke === 'transparent') {
        elStroke = isDark ? '#94a3b8' : '#475569';
      }
      const elFill = el.fillColor === 'transparent'
        ? 'transparent'
        : isDark ? 'rgba(71,85,105,0.55)' : 'rgba(148,163,184,0.4)';

      ctx.lineWidth = 0.8;
      ctx.strokeStyle = elStroke;
      ctx.globalAlpha = 0.85;

      if (el.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
        if (elFill !== 'transparent') { ctx.fillStyle = elFill; ctx.fill(); }
        ctx.stroke();
      } else if (el.type === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        if (elFill !== 'transparent') { ctx.fillStyle = elFill; ctx.fill(); }
        ctx.stroke();
      } else if (el.type === 'line' || el.type === 'arrow') {
        if (el.points && el.points.length >= 2) {
          const p0 = toMM(el.points[0].x + el.x, el.points[0].y + el.y);
          const p1 = toMM(el.points[el.points.length - 1].x + el.x, el.points[el.points.length - 1].y + el.y);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      } else if (el.type === 'freehand') {
        if (el.points && el.points.length >= 2) {
          ctx.beginPath();
          const fp0 = toMM(el.points[0].x + el.x, el.points[0].y + el.y);
          ctx.moveTo(fp0.x, fp0.y);
          for (let i = 1; i < el.points.length; i++) {
            const fp = toMM(el.points[i].x + el.x, el.points[i].y + el.y);
            ctx.lineTo(fp.x, fp.y);
          }
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.min(w * 0.12, 2.5));
        if (elFill !== 'transparent') { ctx.fillStyle = elFill; ctx.fill(); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ── Viewport outline (on top) ────────────────────────────────────
    ctx.strokeStyle = isDark ? 'rgba(139,174,252,0.45)' : 'rgba(59,130,246,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 3);
    ctx.stroke();
  }, [collapsed]);

  useEffect(() => {
    if (collapsed) return;
    draw();
    const unsubCanvas = useCanvasStore.subscribe(draw);
    const unsubElements = useElementStore.subscribe(draw);
    return () => {
      unsubCanvas();
      unsubElements();
    };
  }, [draw, collapsed]);

  // Show on movement, auto-hide after inactivity
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY);
  }, []);

  const showMap = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (collapsed) return;
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    let prev = { offsetX, offsetY, zoom };

    const unsub = useCanvasStore.subscribe((state) => {
      if (
        state.offsetX !== prev.offsetX ||
        state.offsetY !== prev.offsetY ||
        state.zoom !== prev.zoom
      ) {
        prev = { offsetX: state.offsetX, offsetY: state.offsetY, zoom: state.zoom };
        showMap();
      }
    });

    return () => {
      unsub();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [collapsed, showMap]);

  const navigate = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const t = transformRef.current;
    if (!canvas || !t) return;
    const rect = canvas.getBoundingClientRect();
    const mmX = (clientX - rect.left) * (MM_W / rect.width);
    const mmY = (clientY - rect.top) * (MM_H / rect.height);
    const worldX = (mmX - t.mmOffX) / t.scale + t.worldLeft;
    const worldY = (mmY - t.mmOffY) / t.scale + t.worldTop;
    const { zoom, setOffset } = useCanvasStore.getState();
    setOffset(
      window.innerWidth / 2 - worldX * zoom,
      window.innerHeight / 2 - worldY * zoom,
    );
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    navigate(e.clientX, e.clientY);
  }, [navigate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    navigate(e.clientX, e.clientY);
  }, [navigate]);

  const handleMouseUp = useCallback(() => { isDraggingRef.current = false; }, []);

  useEffect(() => {
    const onUp = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  const theme = useCanvasStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    // Pause hide timer while hovering
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    // Resume hide timer on leave
    scheduleHide();
  }, [scheduleHide]);

  return (
    <div
      className="absolute bottom-6 left-6 z-40 select-none"
      style={{ width: collapsed ? 'auto' : MM_W }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {collapsed ? (
        /* Collapsed: tiny ghost icon button */
        <button
          onClick={() => setCollapsed(false)}
          title="Show map"
          className={`
            w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150
            ${isDark
              ? 'bg-gray-900/70 text-slate-500 hover:text-slate-300 ring-1 ring-white/[0.07] shadow-md'
              : 'bg-white/70 text-slate-400 hover:text-slate-600 ring-1 ring-black/[0.07] shadow-md'}
          `}
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1,3 5,1 9,3 13,1 13,11 9,13 5,11 1,13" />
            <line x1="5" y1="1" x2="5" y2="11" />
            <line x1="9" y1="3" x2="9" y2="13" />
          </svg>
        </button>
      ) : (
        /* Expanded: clean borderless panel */
        <div
          className="relative"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
            transition: visible
              ? 'opacity 0.22s ease-out, transform 0.22s ease-out'
              : 'opacity 0.4s ease-in, transform 0.4s ease-in',
            pointerEvents: visible ? 'auto' : 'none',
          }}
        >
          <div
            className={`
              rounded-xl overflow-hidden
              ${isDark
                ? 'bg-[#111318]/90 ring-1 ring-white/[0.07] shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
                : 'bg-white/90 ring-1 ring-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.09)]'}
            `}
            style={{ backdropFilter: 'blur(20px)' }}
          >
            <canvas
              ref={canvasRef}
              style={{ width: MM_W, height: MM_H, display: 'block', cursor: 'crosshair' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          </div>

          {/* Collapse button — fades in on hover, top-right corner */}
          <button
            onClick={() => setCollapsed(true)}
            title="Hide map"
            className={`
              absolute top-1.5 right-1.5
              w-5 h-5 flex items-center justify-center rounded-md
              ${isDark
                ? 'bg-gray-800/80 text-slate-400 hover:text-slate-200 ring-1 ring-white/[0.08]'
                : 'bg-white/80 text-slate-400 hover:text-slate-700 ring-1 ring-black/[0.08]'}
            `}
            style={{ backdropFilter: 'blur(8px)', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="8" y2="8" />
              <line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
