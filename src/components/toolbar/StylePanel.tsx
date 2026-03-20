import { useState, useRef, useEffect } from 'react';
import { useToolStore } from '../../store/toolStore';
import { useElementStore } from '../../store/elementStore';
import { COLOR_PALETTE, ROUGHNESS_LEVELS, STROKE_STYLES, FILL_STYLES } from '../../constants';
import type { StrokeStyle, FillStyle } from '../../types';

const ROUGHNESS_LABELS = ['None', 'Low', 'Medium', 'High'];

// ─── Popover ────────────────────────────────────────────────────────

function Popover({
  trigger,
  children,
  align = 'left',
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'center';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute top-full mt-2.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/12 dark:shadow-black/40 border border-gray-200/70 dark:border-gray-700/50 p-3 z-50 min-w-max ${
            align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Segment Group ──────────────────────────────────────────────────

function SegmentGroup<T extends string | number>({
  options,
  value,
  onChange,
  renderOption,
  title,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  renderOption: (opt: T, active: boolean) => React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex bg-gray-100/80 dark:bg-gray-800/80 rounded-xl p-1 gap-0.5" title={title}>
      {options.map((opt) => (
        <button
          key={String(opt)}
          onClick={() => onChange(opt)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 ${
            value === opt
              ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          {renderOption(opt, value === opt)}
        </button>
      ))}
    </div>
  );
}

// ─── Color Swatch ───────────────────────────────────────────────────

function ColorSwatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const isTransparent = color === 'transparent';
  return (
    <button
      onClick={onClick}
      title={isTransparent ? 'No fill' : color}
      className={`w-7 h-7 rounded-lg transition-all duration-150 flex-shrink-0 ${
        active
          ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-gray-800 scale-105'
          : 'hover:scale-110 hover:shadow-md'
      }`}
      style={{
        backgroundColor: isTransparent ? undefined : color,
        backgroundImage: isTransparent
          ? 'repeating-conic-gradient(#d1d5db 0% 25%, transparent 0% 50%)'
          : undefined,
        backgroundSize: isTransparent ? '6px 6px' : undefined,
        border: isTransparent ? '1.5px dashed #9ca3af' : undefined,
      }}
    />
  );
}

// ─── Popover Section Label ──────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 select-none">
      {children}
    </span>
  );
}

// ─── Divider ────────────────────────────────────────────────────────

function Divider() {
  return <div className="w-px h-8 bg-gray-200/80 dark:bg-gray-700/60 mx-1 flex-shrink-0" />;
}

// ─── Trigger Button ─────────────────────────────────────────────────

function TriggerBtn({
  title,
  children,
  active,
}: {
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className={`h-11 px-2.5 rounded-xl flex items-center gap-2 transition-all duration-150 cursor-pointer ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

// ─── Main StylePanel ────────────────────────────────────────────────

export function StylePanel() {
  const {
    strokeColor, setStrokeColor,
    fillColor, setFillColor,
    strokeWidth, setStrokeWidth,
    roughness, setRoughness,
    opacity, setOpacity,
    fontSize, setFontSize,
    strokeStyle, setStrokeStyle,
    fillStyle, setFillStyle,
    edgeRoundness, setEdgeRoundness,
    lockToolMode, setLockToolMode,
    activeTool, selectedIds,
  } = useToolStore();

  const elements = useElementStore((s) => s.elements);
  const hasTextSelected = selectedIds.some((id) => elements.find((el) => el.id === id)?.type === 'text');

  const applyToSelected = (updates: Record<string, unknown>) => {
    const { updateElement } = useElementStore.getState();
    for (const id of selectedIds) updateElement(id, updates);
  };

  const STROKE_WIDTH_OPTS = [1, 2, 4] as const;

  return (
    <div className="flex items-center gap-1.5">
      {/* ── Colors ── */}
      <div className="flex items-center gap-0.5">
        {/* Stroke Color */}
        <Popover
          trigger={
            <TriggerBtn title="Stroke color">
              <div
                className="w-6 h-6 rounded-md shadow-sm border-2 border-white dark:border-gray-700"
                style={{ backgroundColor: strokeColor }}
              />
            </TriggerBtn>
          }
        >
          <div className="flex flex-col gap-2">
            <Label>Stroke color</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {COLOR_PALETTE.filter(c => c !== 'transparent').map((color) => (
                <ColorSwatch
                  key={`s-${color}`}
                  color={color}
                  active={strokeColor === color}
                  onClick={() => { setStrokeColor(color); applyToSelected({ strokeColor: color }); }}
                />
              ))}
            </div>
          </div>
        </Popover>

        {/* Fill Color */}
        <Popover
          trigger={
            <TriggerBtn title="Fill color">
              <div
                className="w-6 h-6 rounded-md shadow-sm border-2 border-white dark:border-gray-700"
                style={{
                  backgroundColor: fillColor === 'transparent' ? undefined : fillColor,
                  backgroundImage: fillColor === 'transparent'
                    ? 'repeating-conic-gradient(#d1d5db 0% 25%, transparent 0% 50%)'
                    : undefined,
                  backgroundSize: fillColor === 'transparent' ? '5px 5px' : undefined,
                }}
              />
            </TriggerBtn>
          }
        >
          <div className="flex flex-col gap-2">
            <Label>Fill color</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_PALETTE.map((color) => (
                <ColorSwatch
                  key={`f-${color}`}
                  color={color}
                  active={fillColor === color}
                  onClick={() => { setFillColor(color); applyToSelected({ fillColor: color }); }}
                />
              ))}
            </div>
          </div>
        </Popover>
      </div>

      <Divider />

      {/* ── Stroke Width ── */}
      <SegmentGroup
        title="Stroke width"
        options={STROKE_WIDTH_OPTS}
        value={(STROKE_WIDTH_OPTS.includes(strokeWidth as 1 | 2 | 4) ? strokeWidth : 2) as 1 | 2 | 4}
        onChange={(w) => { setStrokeWidth(w); applyToSelected({ strokeWidth: w }); }}
        renderOption={(w) => (
          <div className="flex items-center justify-center w-4 h-4">
            <div className="bg-current rounded-full" style={{ width: `${Math.max(w * 2.5, 3)}px`, height: `${Math.max(w * 2.5, 3)}px` }} />
          </div>
        )}
      />

      {/* ── Stroke Style ── */}
      <SegmentGroup
        title="Stroke style"
        options={STROKE_STYLES}
        value={strokeStyle}
        onChange={(s) => { setStrokeStyle(s as StrokeStyle); applyToSelected({ strokeStyle: s }); }}
        renderOption={(s) => (
          <svg width="20" height="4" viewBox="0 0 20 4" className="flex-shrink-0">
            <line
              x1="0" y1="2" x2="20" y2="2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={s === 'dashed' ? '4 3' : s === 'dotted' ? '1.5 3' : undefined}
            />
          </svg>
        )}
      />

      <Divider />

      {/* ── Fill Style ── */}
      <SegmentGroup
        title="Fill pattern"
        options={FILL_STYLES}
        value={fillStyle}
        onChange={(f) => { setFillStyle(f as FillStyle); applyToSelected({ fillStyle: f }); }}
        renderOption={(f) => (
          <svg width="16" height="16" viewBox="0 0 14 14" className="flex-shrink-0">
            {f === 'solid' && (
              <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" opacity="0.5" />
            )}
            {f === 'hachure' && (
              <g stroke="currentColor" strokeWidth="1.2" opacity="0.6">
                <rect x="2" y="2" width="10" height="10" rx="2" fill="none" />
                <line x1="3" y1="8" x2="8" y2="3" /><line x1="3" y1="12" x2="12" y2="3" /><line x1="6" y1="12" x2="12" y2="6" />
              </g>
            )}
            {f === 'cross-hatch' && (
              <g stroke="currentColor" strokeWidth="1.2" opacity="0.6">
                <rect x="2" y="2" width="10" height="10" rx="2" fill="none" />
                <line x1="3" y1="8" x2="8" y2="3" /><line x1="6" y1="12" x2="12" y2="6" />
                <line x1="6" y1="3" x2="12" y2="8" /><line x1="3" y1="6" x2="8" y2="12" />
              </g>
            )}
          </svg>
        )}
      />

      {/* ── Corners ── */}
      <SegmentGroup
        title="Corner radius"
        options={[0, 8, 16] as const}
        value={edgeRoundness as 0 | 8 | 16}
        onChange={(r) => { setEdgeRoundness(r); applyToSelected({ edgeRoundness: r }); }}
        renderOption={(r) => (
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="12" height="12" rx={r === 0 ? 0 : r === 8 ? 3 : 6} />
          </svg>
        )}
      />

      <Divider />

      {/* ── Roughness ── */}
      <Popover
        trigger={
          <TriggerBtn title="Roughness">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12c2-3 4 2 6-1s4 3 6 0 4-2 6 1" />
            </svg>
            <span className="text-xs tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">{roughness}</span>
          </TriggerBtn>
        }
      >
        <div className="flex flex-col gap-2 w-36">
          <Label>Roughness</Label>
          <div className="flex flex-col gap-0.5">
            {ROUGHNESS_LEVELS.map((r, i) => (
              <button
                key={r}
                onClick={() => { setRoughness(r); applyToSelected({ roughness: r }); }}
                className={`h-8 px-2.5 rounded-lg flex items-center gap-2.5 transition-all duration-150 ${
                  roughness === r
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="w-4 text-center font-bold text-xs">{r}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{ROUGHNESS_LABELS[i]}</span>
              </button>
            ))}
          </div>
        </div>
      </Popover>

      {/* ── Opacity ── */}
      <Popover
        trigger={
          <TriggerBtn title="Opacity">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" opacity="0.4" />
              <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" opacity="0.35" />
            </svg>
            <span className="text-xs tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
              {Math.round(opacity * 100)}%
            </span>
          </TriggerBtn>
        }
      >
        <div className="flex flex-col gap-2.5 w-44">
          <Label>Opacity</Label>
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={opacity}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setOpacity(v);
              applyToSelected({ opacity: v });
            }}
            className="w-full h-1.5 accent-indigo-500 cursor-pointer rounded-full bg-gray-200 dark:bg-gray-700 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
            <span>0%</span>
            <span className="font-semibold text-gray-600 dark:text-gray-300">{Math.round(opacity * 100)}%</span>
            <span>100%</span>
          </div>
        </div>
      </Popover>

      <Divider />

      {/* ── Lock ── */}
      <button
        title={lockToolMode ? 'Tool locked (click to unlock)' : 'Lock tool (keep active after drawing)'}
        onClick={() => setLockToolMode(!lockToolMode)}
        className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-150 ${
          lockToolMode
            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {lockToolMode ? (
            <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
          ) : (
            <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>
          )}
        </svg>
      </button>

      {/* ── Font Size (text tool / text selected) ── */}
      {(activeTool === 'text' || hasTextSelected) && (
        <>
          <Divider />
          <Popover
            trigger={
              <TriggerBtn title="Font size">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 20h4m4 0h4m-8 0L12 4l4 16m-6.5-6h5" />
                </svg>
                <span className="text-xs tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">{fontSize}</span>
              </TriggerBtn>
            }
          >
            <div className="flex flex-col gap-2">
              <Label>Font size</Label>
              <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setFontSize(s); applyToSelected({ fontSize: s }); }}
                    className={`h-7 px-2.5 rounded-md flex items-center text-sm transition-all duration-150 ${
                      fontSize === s
                        ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            </div>
          </Popover>
        </>
      )}
    </div>
  );
}
