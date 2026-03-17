import { Canvas } from './components/canvas/Canvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePersistence } from './hooks/usePersistence';
import { useCanvasStore } from './store/canvasStore';

export default function App() {
  const theme = useCanvasStore((s) => s.theme);

  // Global hooks
  useKeyboardShortcuts();
  usePersistence();

  return (
    <div className={`w-full h-full no-select ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="relative w-full h-full bg-gray-50 dark:bg-[#1a1a2e]">
        <Toolbar />
        <Canvas />
      </div>
    </div>
  );
}
