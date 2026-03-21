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
    bg-white/90 dark:bg-gray-900/90
    backdrop-blur-lg
    rounded-xl
    shadow-sm shadow-black/[0.03] dark:shadow-black/20
    ring-1 ring-gray-950/[0.05] dark:ring-white/[0.06]
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
