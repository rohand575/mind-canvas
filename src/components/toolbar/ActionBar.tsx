import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { useHistoryStore } from '../../store/historyStore';
import { useHistory } from '../../hooks/useHistory';
import { exportAsPNG, exportAsJSON, exportAsSVG, copyCanvasToClipboard, importFromJSON } from '../../utils/exportCanvas';
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

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const elements = importFromJSON(text);
      if (elements) {
        saveSnapshot();
        useElementStore.getState().setElements(elements);
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
    <div className="flex flex-col gap-1">
      <IconButton title="Undo (Ctrl+Z)" onClick={undo} className={canUndo ? '' : 'opacity-40'}>
        <UndoIcon />
      </IconButton>
      <IconButton title="Redo (Ctrl+Shift+Z)" onClick={redo} className={canRedo ? '' : 'opacity-40'}>
        <RedoIcon />
      </IconButton>

      <div className="h-px w-full bg-gray-200/80 dark:bg-gray-700/80 my-1.5" />

      <IconButton title="Delete selected (Del)" onClick={handleDelete}>
        <TrashIcon />
      </IconButton>
      <IconButton title="Clear canvas" onClick={handleClearCanvas}>
        <ClearIcon />
      </IconButton>

      <div className="h-px w-full bg-gray-200/80 dark:bg-gray-700/80 my-1.5" />

      <IconButton title="Toggle grid (G)" onClick={toggleGrid} active={showGrid}>
        <GridIcon />
      </IconButton>
      <IconButton title="Toggle dark mode" onClick={toggleTheme}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </IconButton>

      <div className="h-px w-full bg-gray-200/80 dark:bg-gray-700/80 my-1.5" />

      <IconButton title="Import JSON" onClick={handleImportJSON}>
        <UploadIcon />
      </IconButton>

      {/* Export dropdown */}
      <div className="relative group">
        <IconButton title="Export">
          <DownloadIcon />
        </IconButton>
        <div className="absolute top-0 right-full mr-3 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-right bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-2 min-w-[160px] z-50 pointer-events-none group-hover:pointer-events-auto">
          <button
            onClick={handleExportPNG}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            Export as PNG
          </button>
          <button
            onClick={handleExportSVG}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            Export as SVG
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Export as JSON
          </button>
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          <button
            onClick={handleCopyImage}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy as Image
          </button>
        </div>
      </div>

      {/* Zoom indicator & zoom to fit */}
      <div className="h-px w-full bg-gray-200/80 dark:bg-gray-700/80 my-1.5" />
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
      <span className="text-xs text-gray-500 dark:text-gray-400 text-center tabular-nums font-medium py-1">
        {Math.round(zoom * 100)}%
      </span>

      <div className="h-px w-full bg-gray-200/80 dark:bg-gray-700/80 my-1.5" />
      <IconButton title="Keyboard shortcuts (?)" onClick={() => useCanvasStore.getState().toggleShortcuts()}>
        <HelpIcon />
      </IconButton>
    </div>
  );
}
