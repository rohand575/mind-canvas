import { useEffect } from 'react';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Tools',
    shortcuts: [
      { key: 'V', description: 'Select' },
      { key: 'H', description: 'Hand / Pan' },
      { key: 'R', description: 'Rectangle' },
      { key: 'D', description: 'Diamond' },
      { key: 'O', description: 'Ellipse' },
      { key: 'L', description: 'Line' },
      { key: 'A', description: 'Arrow' },
      { key: 'P', description: 'Pencil (freehand)' },
      { key: 'T', description: 'Text' },
    ],
  },
  {
    title: 'Styles',
    shortcuts: [
      { key: '1–8', description: 'Set stroke color' },
      { key: 'Alt+1–8', description: 'Set fill color' },
      { key: 'Alt+0', description: 'Transparent fill' },
      { key: 'Ctrl+Shift+<', description: 'Decrease text size' },
      { key: 'Ctrl+Shift+>', description: 'Increase text size' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { key: 'Ctrl+Z', description: 'Undo' },
      { key: 'Ctrl+Shift+Z', description: 'Redo' },
      { key: 'Ctrl+C', description: 'Copy' },
      { key: 'Ctrl+V', description: 'Paste' },
      { key: 'Ctrl+D', description: 'Duplicate' },
      { key: 'Ctrl+A', description: 'Select all' },
      { key: 'Delete', description: 'Delete selected' },
      { key: 'Escape', description: 'Deselect / Switch to Select' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { key: 'G', description: 'Toggle grid' },
      { key: 'Ctrl+0', description: 'Reset zoom' },
      { key: 'Ctrl+1', description: 'Zoom to fit' },
      { key: 'Scroll', description: 'Zoom in/out' },
      { key: 'Space+Drag', description: 'Pan canvas' },
      { key: 'Right-click Drag', description: 'Pan canvas' },
    ],
  },
  {
    title: 'Layers',
    shortcuts: [
      { key: 'Ctrl+]', description: 'Bring forward' },
      { key: 'Ctrl+[', description: 'Send backward' },
      { key: 'Ctrl+Shift+]', description: 'Bring to front' },
      { key: 'Ctrl+Shift+[', description: 'Send to back' },
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl shadow-black/[0.08] dark:shadow-black/30 ring-1 ring-gray-950/[0.05] dark:ring-white/[0.08] p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{group.title}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s.description}</span>
                    <kbd className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-center text-gray-400 dark:text-gray-500">Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">?</kbd> to toggle this dialog</p>
      </div>
    </div>
  );
}
