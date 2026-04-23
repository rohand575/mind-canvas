import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { useHistoryStore } from '../../store/historyStore';
import { useHistory } from '../../hooks/useHistory';
import { exportAsPNG, exportAsJSON, exportAsSVG, copyCanvasToClipboard, exportProjectFile, importProjectFile } from '../../utils/exportCanvas';
import { getElementBounds } from '../../utils/geometry';
import { IconButton } from '../ui/IconButton';
import {
  UndoIcon,
  RedoIcon,
  TrashIcon,
  DownloadIcon,
  UploadIcon,
  ClearIcon,
  SunIcon,
  MoonIcon,
  GridIcon,
  HelpIcon,
} from './ToolIcons';

export function ActionBar() {
  const { theme, toggleTheme, showGrid, toggleGrid, zoom } = useCanvasStore();
  const { undo, redo, saveSnapshot } = useHistory();
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handle = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [exportOpen]);

  const handleDelete = () => {
    const { selectedIds, clearSelection } = useToolStore.getState();
    if (selectedIds.length > 0) {
      useElementStore.getState().removeElements(selectedIds);
      clearSelection();
    }
  };

  const handleExportPNG = () => {
    const { elements } = useElementStore.getState();
    const isDark = useCanvasStore.getState().theme === 'dark';
    exportAsPNG(elements, isDark);
  };

  const handleExportJSON = () => {
    const { elements } = useElementStore.getState();
    exportAsJSON(elements);
  };

  const handleExportSVG = () => {
    const { elements } = useElementStore.getState();
    const isDark = useCanvasStore.getState().theme === 'dark';
    exportAsSVG(elements, isDark);
  };

  const handleCopyImage = async () => {
    const { elements } = useElementStore.getState();
    const isDark = useCanvasStore.getState().theme === 'dark';
    await copyCanvasToClipboard(elements, isDark);
  };

  const handleSaveProject = () => {
    const { elements } = useElementStore.getState();
    const { offsetX, offsetY, zoom, theme, showGrid } = useCanvasStore.getState();
    exportProjectFile(elements, { offsetX, offsetY, zoom, theme, showGrid });
  };

  const handleOpenProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mcv,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = importProjectFile(text);
      if (result) {
        saveSnapshot();
        useElementStore.getState().setElements(result.elements);
        if (result.canvasState) {
          const store = useCanvasStore.getState();
          store.setOffset(result.canvasState.offsetX, result.canvasState.offsetY);
          store.setZoom(result.canvasState.zoom);
          if (result.canvasState.theme) store.setTheme(result.canvasState.theme);
          if (result.canvasState.showGrid !== undefined) {
            if (result.canvasState.showGrid !== store.showGrid) store.toggleGrid();
          }
        }
      } else {
        alert('Invalid project file');
      }
    };
    input.click();
  };

  const handleClearCanvas = () => {
    if (useElementStore.getState().elements.length === 0) return;
    if (!confirm('Clear all elements? This action can be undone with Ctrl+Z.')) return;
    saveSnapshot();
    useElementStore.getState().clearAll();
    useToolStore.getState().clearSelection();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <IconButton title="Undo (Ctrl+Z)" onClick={undo} className={canUndo ? '' : 'opacity-40'}>
        <UndoIcon />
      </IconButton>
      <IconButton title="Redo (Ctrl+Shift+Z)" onClick={redo} className={canRedo ? '' : 'opacity-40'}>
        <RedoIcon />
      </IconButton>

      <div className="h-px w-full bg-gray-950/[0.05] dark:bg-white/[0.06] my-3" />

      <IconButton title="Delete selected (Del)" onClick={handleDelete}>
        <TrashIcon />
      </IconButton>
      <IconButton title="Clear canvas" onClick={handleClearCanvas}>
        <ClearIcon />
      </IconButton>

      <div className="h-px w-full bg-gray-950/[0.05] dark:bg-white/[0.06] my-3" />

      <IconButton title="Toggle grid (G)" onClick={toggleGrid} active={showGrid}>
        <GridIcon />
      </IconButton>
      <IconButton title="Toggle dark mode" onClick={toggleTheme}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </IconButton>

      <div className="h-px w-full bg-gray-950/[0.05] dark:bg-white/[0.06] my-3" />

      <IconButton title="Open Project (.mcv)" onClick={handleOpenProject}>
        <UploadIcon />
      </IconButton>

      {/* Export dropdown */}
      <div ref={exportRef} className="relative">
        <IconButton title="Export" onClick={() => setExportOpen(!exportOpen)}>
          <DownloadIcon />
        </IconButton>
        <div className={`absolute top-0 right-full mr-3 transition-all duration-150 ease-out origin-right bg-white dark:bg-gray-900 backdrop-blur-lg rounded-2xl shadow-xl shadow-black/[0.08] dark:shadow-black/30 ring-1 ring-gray-950/[0.06] dark:ring-white/[0.08] p-2.5 min-w-[250px] z-50
          ${exportOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97] pointer-events-none'}`}>
          <span className="block px-2 pt-0.5 pb-3 text-[11px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 select-none">Export</span>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => { handleExportPNG(); setExportOpen(false); }}
              className="w-full px-2.5 py-3 text-left rounded-xl hover:bg-gray-500/[0.05] dark:hover:bg-white/[0.05] transition-colors duration-100 flex items-center gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">PNG Image</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">Raster image format</span>
              </div>
            </button>
            <button
              onClick={() => { handleExportSVG(); setExportOpen(false); }}
              className="w-full px-2.5 py-3 text-left rounded-xl hover:bg-gray-500/[0.05] dark:hover:bg-white/[0.05] transition-colors duration-100 flex items-center gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">SVG Vector</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">Scalable vector graphics</span>
              </div>
            </button>
            <button
              onClick={() => { handleExportJSON(); setExportOpen(false); }}
              className="w-full px-2.5 py-3 text-left rounded-xl hover:bg-gray-500/[0.05] dark:hover:bg-white/[0.05] transition-colors duration-100 flex items-center gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">JSON Data</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">Raw element data</span>
              </div>
            </button>
          </div>
          <div className="h-px bg-gray-950/[0.05] dark:bg-white/[0.06] my-2 mx-1" />
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => { handleSaveProject(); setExportOpen(false); }}
              className="w-full px-2.5 py-3 text-left rounded-xl hover:bg-gray-500/[0.05] dark:hover:bg-white/[0.05] transition-colors duration-100 flex items-center gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Save Project</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">.mcv project file</span>
              </div>
            </button>
            <button
              onClick={() => { handleCopyImage(); setExportOpen(false); }}
              className="w-full px-2.5 py-3 text-left rounded-xl hover:bg-gray-500/[0.05] dark:hover:bg-white/[0.05] transition-colors duration-100 flex items-center gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Copy as Image</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">Copy to clipboard</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Zoom indicator & zoom to fit */}
      <div className="h-px w-full bg-gray-950/[0.05] dark:bg-white/[0.06] my-3" />
      <IconButton
        title="Zoom to fit (Ctrl+1)"
        onClick={() => {
          const { elements } = useElementStore.getState();
          if (elements.length === 0) return;
          const allBounds = elements.map(getElementBounds);
          const minX = Math.min(...allBounds.map(b => b.x));
          const minY = Math.min(...allBounds.map(b => b.y));
          const maxX = Math.max(...allBounds.map(b => b.x + b.width));
          const maxY = Math.max(...allBounds.map(b => b.y + b.height));
          useCanvasStore.getState().zoomToBounds(
            { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            window.innerWidth, window.innerHeight,
          );
        }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </IconButton>
      <span className="text-xs text-gray-500 dark:text-gray-400 text-center tabular-nums font-medium bg-gray-100/80 dark:bg-white/[0.06] rounded-lg px-2 py-1">
        {Math.round(zoom * 100)}%
      </span>

      <div className="h-px w-full bg-gray-950/[0.05] dark:bg-white/[0.06] my-3" />
      <IconButton title="Keyboard shortcuts (?)" onClick={() => useCanvasStore.getState().toggleShortcuts()}>
        <HelpIcon />
      </IconButton>
    </div>
  );
}
