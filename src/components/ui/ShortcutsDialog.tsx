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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-black/[0.12] dark:shadow-black/40 ring-1 ring-gray-950/[0.05] dark:ring-white/[0.1] px-10 py-8 max-w-4xl w-full mx-6 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quick reference for all available shortcuts</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="min-w-0">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                {group.title}
              </h3>
              <div className="rounded-xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 overflow-hidden">
                {group.shortcuts.map((s, idx) => (
                  <div 
                    key={s.key} 
                    className={`flex items-center justify-between gap-6 px-4 py-3 hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors ${
                      idx !== group.shortcuts.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/50' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{s.description}</span>
                    <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-[0_2px_0_0_rgba(0,0,0,0.05),inset_0_-1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.3),inset_0_-1px_0_0_rgba(255,255,255,0.05)] whitespace-nowrap">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-center text-gray-400 dark:text-gray-500">
            Press{' '}
            <kbd className="inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-mono font-semibold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-[0_2px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.3)]">
              ?
            </kbd>
            {' '}to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  );
}
