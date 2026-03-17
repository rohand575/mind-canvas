import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { useHistoryStore } from '../../store/historyStore';
import { useHistory } from '../../hooks/useHistory';
import { exportAsPNG, exportAsJSON } from '../../utils/exportCanvas';
import { IconButton } from '../ui/IconButton';
import {
  UndoIcon,
  RedoIcon,
  TrashIcon,
  DownloadIcon,
  SunIcon,
  MoonIcon,
  GridIcon,
} from './ToolIcons';

export function ActionBar() {
  const { theme, toggleTheme, showGrid, toggleGrid, zoom } = useCanvasStore();
  const { undo, redo } = useHistory();
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

  return (
    <div className="flex items-center gap-1">
      <IconButton title="Undo (Ctrl+Z)" onClick={undo} className={canUndo ? '' : 'opacity-40'}>
        <UndoIcon />
      </IconButton>
      <IconButton title="Redo (Ctrl+Shift+Z)" onClick={redo} className={canRedo ? '' : 'opacity-40'}>
        <RedoIcon />
      </IconButton>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />

      <IconButton title="Delete selected (Del)" onClick={handleDelete}>
        <TrashIcon />
      </IconButton>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />

      <IconButton title="Toggle grid (G)" onClick={toggleGrid} active={showGrid}>
        <GridIcon />
      </IconButton>

      <IconButton title="Toggle dark mode" onClick={toggleTheme}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </IconButton>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />

      {/* Export dropdown */}
      <div className="relative group">
        <IconButton title="Export">
          <DownloadIcon />
        </IconButton>
        <div className="absolute top-full right-0 mt-1 hidden group-hover:block bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] z-50">
          <button
            onClick={handleExportPNG}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Export as PNG
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Export as JSON
          </button>
        </div>
      </div>

      {/* Zoom indicator */}
      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 min-w-[40px] text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
