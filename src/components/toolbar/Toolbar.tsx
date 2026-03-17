import { ToolSelector } from './ToolSelector';
import { StylePanel } from './StylePanel';
import { ActionBar } from './ActionBar';

/**
 * Floating toolbar at the top of the canvas.
 * Split into three sections: tools, styles, and actions.
 */
export function Toolbar() {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-3 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/80 dark:border-gray-700/80">
      <ToolSelector />
      <div className="w-px h-7 bg-gray-200 dark:bg-gray-600" />
      <StylePanel />
      <div className="w-px h-7 bg-gray-200 dark:bg-gray-600" />
      <ActionBar />
    </div>
  );
}
