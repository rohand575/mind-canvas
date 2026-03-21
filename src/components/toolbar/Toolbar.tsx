import { ToolSelector } from './ToolSelector';
import { StylePanel } from './StylePanel';
import { ActionBar } from './ActionBar';

/**
 * Floating toolbar layout:
 * - Tools: vertical bar on the left
 * - Styles: horizontal bar at top center
 * - Actions: vertical bar on the right
 */
export function Toolbar() {
  const panelClasses = `
    bg-white/80 dark:bg-gray-900/80 
    backdrop-blur-xl 
    rounded-2xl 
    shadow-xl shadow-black/10 dark:shadow-black/30
    border border-gray-200/50 dark:border-gray-700/50
    transition-all duration-200
    hover:bg-white/95 dark:hover:bg-gray-900/95
    hover:shadow-2xl hover:shadow-black/15 dark:hover:shadow-black/40
  `;

  return (
    <>
      {/* Tools - Left side vertical */}
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5 p-3 ${panelClasses}`}>
        <ToolSelector />
      </div>

      {/* Styles - Top center horizontal */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center px-2 py-1.5 ${panelClasses}`}>
        <StylePanel />
      </div>

      {/* Actions - Right side vertical */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5 p-3 ${panelClasses}`}>
        <ActionBar />
      </div>
    </>
  );
}
