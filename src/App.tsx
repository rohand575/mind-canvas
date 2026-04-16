import { Canvas } from './components/canvas/Canvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { ShortcutsDialog } from './components/ui/ShortcutsDialog';
import { Sidebar } from './components/sidebar/Sidebar';
import { MiniMap } from './components/canvas/MiniMap';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePersistence } from './hooks/usePersistence';
import { useCanvasStore } from './store/canvasStore';

export default function App() {
  const theme = useCanvasStore((s) => s.theme);
  const shortcutsOpen = useCanvasStore((s) => s.shortcutsOpen);
  const toggleShortcuts = useCanvasStore((s) => s.toggleShortcuts);
  const setShortcutsOpen = useCanvasStore((s) => s.setShortcutsOpen);
  const toggleSidebar = useCanvasStore((s) => s.toggleSidebar);

  useKeyboardShortcuts(toggleShortcuts);
  usePersistence();

  return (
    <div className={`w-full h-full no-select overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="relative w-full h-full bg-gray-50 dark:bg-[#1a1a2e] overflow-hidden">
        {/* Top-left: hamburger menu */}
        <div className="absolute top-4 left-4 z-40">
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg shadow-sm shadow-black/[0.03] dark:shadow-black/20 ring-1 ring-gray-950/[0.05] dark:ring-white/[0.06] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-150"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        <Sidebar />
        <Toolbar />
        <Canvas />
        <MiniMap />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </div>
  );
}
