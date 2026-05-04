import { ToolSelector } from './ToolSelector';
import { StylePanel } from './StylePanel';
import { ActionBar } from './ActionBar';

export function Toolbar() {
  const panelClasses = `
    bg-white/98 dark:bg-gray-900/98
    backdrop-blur-xl
    rounded-2xl
    shadow-[0_8px_28px_rgba(0,0,0,0.09),0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]
    border border-black/[0.06] dark:border-white/[0.07]
  `;

  return (
    <>
      {/* Tools - Left side vertical */}
      <div className={`absolute left-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2.5 p-5 ${panelClasses}`}>
        <ToolSelector />
      </div>

      {/* Styles - Top center horizontal */}
      <div className={`absolute top-5 left-1/2 -translate-x-1/2 z-40 flex items-center px-4 py-2.5 ${panelClasses}`}>
        <StylePanel />
      </div>

      {/* Actions - Right side vertical */}
      <div className={`absolute right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2.5 p-5 ${panelClasses}`}>
        <ActionBar />
      </div>
    </>
  );
}
