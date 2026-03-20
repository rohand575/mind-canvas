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
        <div className="absolute top-0 right-full mr-3 hidden group-hover:block bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 py-2 min-w-[160px] z-50">
          <button
            onClick={handleExportPNG}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
          >
            Export as PNG
          </button>
          <button
            onClick={handleExportSVG}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
          >
            Export as SVG
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
          >
            Export as JSON
          </button>
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          <button
            onClick={handleCopyImage}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
          >
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
    </div>
  );
}
