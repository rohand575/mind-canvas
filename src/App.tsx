import { Canvas } from './components/canvas/Canvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { ShortcutsDialog } from './components/ui/ShortcutsDialog';
import { CanvasDropdown } from './components/sidebar/CanvasDropdown';
import { MiniMap } from './components/canvas/MiniMap';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePersistence } from './hooks/usePersistence';
import { useCanvasStore } from './store/canvasStore';

export default function App() {
  const theme = useCanvasStore((s) => s.theme);
  const shortcutsOpen = useCanvasStore((s) => s.shortcutsOpen);
  const toggleShortcuts = useCanvasStore((s) => s.toggleShortcuts);
  const setShortcutsOpen = useCanvasStore((s) => s.setShortcutsOpen);

  useKeyboardShortcuts(toggleShortcuts);
  usePersistence();

  return (
    <div className={`w-full h-full no-select overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="relative w-full h-full bg-[#f4f5f7] dark:bg-[#14141f] overflow-hidden">
        <CanvasDropdown />
        <Toolbar />
        <Canvas />
        <MiniMap />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </div>
  );
}
