import { useState, useCallback } from 'react';
import { Canvas } from './components/canvas/Canvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { ShortcutsDialog } from './components/ui/ShortcutsDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePersistence } from './hooks/usePersistence';
import { useCanvasStore } from './store/canvasStore';

export default function App() {
  const theme = useCanvasStore((s) => s.theme);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const toggleShortcuts = useCallback(() => setShortcutsOpen((v) => !v), []);

  // Global hooks
  useKeyboardShortcuts(toggleShortcuts);
  usePersistence();

  return (
    <div className={`w-full h-full no-select overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="relative w-full h-full bg-gray-50 dark:bg-[#1a1a2e] overflow-hidden">
        <Toolbar />
        <Canvas />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </div>
  );
}
