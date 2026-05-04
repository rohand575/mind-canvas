import { useEffect, useRef, useState } from 'react';
import { useShapeLibraryStore } from '../../store/shapeLibraryStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistory } from '../../hooks/useHistory';
import type { LibraryItem, CanvasElement } from '../../types';
import { getElementBounds } from '../../utils/geometry';

function renderThumbnail(elements: CanvasElement[], isDark: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (!ctx || elements.length === 0) return canvas.toDataURL();

  // Compute bounds
  const allBounds = elements.map(getElementBounds);
  const minX = Math.min(...allBounds.map(b => b.x));
  const minY = Math.min(...allBounds.map(b => b.y));
  const maxX = Math.max(...allBounds.map(b => b.x + b.width));
  const maxY = Math.max(...allBounds.map(b => b.y + b.height));
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const pad = 8;
  const scaleX = (canvas.width - pad * 2) / w;
  const scaleY = (canvas.height - pad * 2) / h;
  const scale = Math.min(scaleX, scaleY, 1);
  const offsetX = pad + (canvas.width - pad * 2 - w * scale) / 2 - minX * scale;
  const offsetY = pad + (canvas.height - pad * 2 - h * scale) / 2 - minY * scale;

  ctx.fillStyle = isDark ? '#1a1a2e' : '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  for (const el of elements) {
    ctx.strokeStyle = el.strokeColor;
    ctx.fillStyle = el.fillColor !== 'transparent' ? el.fillColor : 'transparent';
    ctx.lineWidth = el.strokeWidth;

    if (el.type === 'rectangle' || el.type === 'frame') {
      if (el.fillColor !== 'transparent') ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    } else if (el.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
      if (el.fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
    } else if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(el.x + el.points[0].x, el.y + el.points[0].y);
      ctx.lineTo(el.x + el.points[1].x, el.y + el.points[1].y);
      ctx.stroke();
    } else if (el.type === 'text' && el.text) {
      ctx.fillStyle = el.strokeColor;
      ctx.font = `${Math.max(8, (el.fontSize ?? 14) * scale)}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(el.text.split('\n')[0], el.x, el.y);
    }
  }

  ctx.restore();
  return canvas.toDataURL();
}

interface LibraryItemCardProps {
  item: LibraryItem;
  isDark: boolean;
  onInsert: (item: LibraryItem) => void;
  onRemove: (id: string) => void;
}

function LibraryItemCard({ item, isDark, onInsert, onRemove }: LibraryItemCardProps) {
  const [thumbnail] = useState(() => renderThumbnail(item.elements, isDark));

  return (
    <div className="group relative flex flex-col gap-1">
      <button
        onClick={() => onInsert(item)}
        className="w-full aspect-[3/2] rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08] hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors duration-150 bg-gray-50 dark:bg-gray-800"
        title={`Insert "${item.name}"`}
      >
        <img src={thumbnail} alt={item.name} className="w-full h-full object-contain" />
      </button>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate flex-1">{item.name}</span>
        <button
          onClick={() => onRemove(item.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 text-xs px-1"
          title="Remove from library"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ShapeLibrary() {
  const { items, isOpen, setOpen, removeItem, addItem } = useShapeLibraryStore();
  const { saveSnapshot } = useHistory();
  const panelRef = useRef<HTMLDivElement>(null);
  const { theme } = useCanvasStore();
  const isDark = theme === 'dark';
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setOpen]);

  const handleInsert = (item: LibraryItem) => {
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    const cx = (window.innerWidth / 2 - offsetX) / zoom;
    const cy = (window.innerHeight / 2 - offsetY) / zoom;

    // Compute center of the library item's elements
    const allBounds = item.elements.map(getElementBounds);
    const minX = Math.min(...allBounds.map(b => b.x));
    const minY = Math.min(...allBounds.map(b => b.y));
    const maxX = Math.max(...allBounds.map(b => b.x + b.width));
    const maxY = Math.max(...allBounds.map(b => b.y + b.height));
    const itemCX = (minX + maxX) / 2;
    const itemCY = (minY + maxY) / 2;
    const dx = cx - itemCX;
    const dy = cy - itemCY;

    saveSnapshot();
    let maxZ = useElementStore.getState().getMaxZIndex();
    const newIds: string[] = [];
    for (const el of item.elements) {
      maxZ++;
      const newId = crypto.randomUUID();
      newIds.push(newId);
      const now = Date.now();
      useElementStore.getState().addElement({
        ...el,
        id: newId,
        x: el.x + dx,
        y: el.y + dy,
        zIndex: maxZ,
        groupId: undefined,
        startBinding: undefined,
        endBinding: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    useToolStore.getState().setSelectedIds(newIds);
    setOpen(false);
  };

  const handleSaveSelected = () => {
    const { selectedIds } = useToolStore.getState();
    const { elements } = useElementStore.getState();
    const selected = elements.filter(el => selectedIds.includes(el.id));
    if (selected.length === 0) return;
    const name = saveName.trim() || `Shape ${items.length + 1}`;
    addItem(name, selected);
    setSaveName('');
    setShowSaveForm(false);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-20 left-5 z-50 w-64 bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.5)] border border-black/[0.06] dark:border-white/[0.07] flex flex-col max-h-[400px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Shape Library</span>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Save form */}
      {showSaveForm ? (
        <div className="px-4 pb-3 flex gap-2">
          <input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveSelected();
              if (e.key === 'Escape') setShowSaveForm(false);
            }}
            placeholder="Name (optional)"
            className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button
            onClick={handleSaveSelected}
            className="px-3 py-1.5 text-[12px] bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowSaveForm(true)}
            className="w-full text-[12px] py-1.5 px-3 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            + Save selection to library
          </button>
        </div>
      )}

      <div className="h-px bg-gray-100 dark:bg-white/[0.06] mx-3" />

      {/* Items grid */}
      <div className="overflow-y-auto flex-1 p-3">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[12px] text-gray-400 dark:text-gray-500">No saved shapes yet.</p>
            <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Select elements and click Save.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <LibraryItemCard
                key={item.id}
                item={item}
                isDark={isDark}
                onInsert={handleInsert}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
