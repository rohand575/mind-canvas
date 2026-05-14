import { ToolSelector } from './ToolSelector';
import { StylePanel } from './StylePanel';
import { ActionBar } from './ActionBar';
import { AlignBar } from './AlignBar';
import { LibraryIcon } from './ToolIcons';
import { useShapeLibraryStore } from '../../store/shapeLibraryStore';
import { ShapeLibrary } from '../ui/ShapeLibrary';

export function Toolbar() {
  const { toggleOpen, isOpen } = useShapeLibraryStore();

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
      <nav
        aria-label="Drawing tools"
        className={`absolute left-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2.5 p-5 ${panelClasses}`}
      >
        <ToolSelector />

        {/* Shape Library button at bottom of tool panel */}
        <div className="h-px w-full bg-gray-950/[0.05] dark:bg-white/[0.06] my-1" />
        <button
          title="Shape Library"
          aria-label="Shape library"
          aria-expanded={isOpen}
          onClick={toggleOpen}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 ${
            isOpen
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <LibraryIcon />
        </button>
      </nav>

      {/* Styles + Align - Top center horizontal */}
      <div
        role="toolbar"
        aria-label="Style and alignment"
        className={`absolute top-5 left-1/2 -translate-x-1/2 z-40 flex items-center px-4 py-2.5 gap-3 ${panelClasses}`}
      >
        <StylePanel />
        <AlignBar />
      </div>

      {/* Actions - Right side vertical */}
      <nav
        aria-label="Canvas actions"
        className={`absolute right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2.5 p-5 ${panelClasses}`}
      >
        <ActionBar />
      </nav>

      {/* Shape Library panel */}
      <ShapeLibrary />
    </>
  );
}
