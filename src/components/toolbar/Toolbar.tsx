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
    bg-white/95 dark:bg-gray-900/95
    backdrop-blur-xl
    rounded-2xl
    shadow-2xl shadow-black/[0.06] dark:shadow-black/40
    ring-1 ring-black/[0.04] dark:ring-white/[0.08]
    border border-white/60 dark:border-white/[0.05]
  `;

  return (
    <>
      {/* Tools - Left side vertical */}
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 p-4 ${panelClasses}`}>
        <ToolSelector />
      </div>

      {/* Styles - Top center horizontal */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center px-3 py-2 ${panelClasses}`}>
        <StylePanel />
      </div>

      {/* Actions - Right side vertical */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 p-4 ${panelClasses}`}>
        <ActionBar />
      </div>
    </>
  );
}
