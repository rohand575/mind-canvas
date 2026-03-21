import { useEffect, useRef, useState } from 'react';
import { useToolStore } from '../../store/toolStore';
import { useElementStore } from '../../store/elementStore';
import { useHistory } from '../../hooks/useHistory';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { saveSnapshot } = useHistory();

  // Bounds checking - adjust position if menu would overflow viewport
  const [position, setPosition] = useState({ x, y });
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let newX = x;
    let newY = y;
    if (x + rect.width > window.innerWidth - padding) {
      newX = window.innerWidth - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight - padding) {
      newY = window.innerHeight - rect.height - padding;
    }
    if (newX !== x || newY !== y) {
      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const selectedIds = useToolStore((s) => s.selectedIds);
  const singleSelected = selectedIds.length === 1 ? selectedIds[0] : null;

  const handleCopy = () => {
    const { elements } = useElementStore.getState();
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length > 0) {
      const data = JSON.stringify({ type: 'mindcanvas-clipboard', elements: selected });
      navigator.clipboard.writeText(data);
    }
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (data?.type === 'mindcanvas-clipboard' && Array.isArray(data.elements)) {
        saveSnapshot();
        let maxZ = useElementStore.getState().getMaxZIndex();
        const newIds: string[] = [];
        for (const el of data.elements) {
          maxZ++;
          const newId = crypto.randomUUID();
          newIds.push(newId);
          useElementStore.getState().addElement({
            ...el,
            id: newId,
            x: el.x + 20,
            y: el.y + 20,
            zIndex: maxZ,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        useToolStore.getState().setSelectedIds(newIds);
      }
    } catch { /* clipboard not available */ }
    onClose();
  };

  const handleDuplicate = () => {
    if (selectedIds.length > 0) {
      saveSnapshot();
      const duped = useElementStore.getState().duplicateElements(selectedIds);
      useToolStore.getState().setSelectedIds(duped.map((el) => el.id));
    }
    onClose();
  };

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      saveSnapshot();
      useElementStore.getState().removeElements(selectedIds);
      useToolStore.getState().clearSelection();
    }
    onClose();
  };

  const handleBringForward = () => {
    if (singleSelected) useElementStore.getState().bringForward(singleSelected);
    onClose();
  };

  const handleSendBackward = () => {
    if (singleSelected) useElementStore.getState().sendBackward(singleSelected);
    onClose();
  };

  const handleBringToFront = () => {
    if (singleSelected) useElementStore.getState().bringToFront(singleSelected);
    onClose();
  };

  const handleSendToBack = () => {
    if (singleSelected) useElementStore.getState().sendToBack(singleSelected);
    onClose();
  };

  const menuItemClass = 'w-[calc(100%-8px)] mx-1 px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-500/[0.06] dark:hover:bg-white/[0.06] transition-colors duration-100 flex items-center justify-between';
  const shortcutClass = 'text-xs text-gray-400 dark:text-gray-500 ml-4';

  return (
    <div
      ref={menuRef}
      className="fixed bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg rounded-xl shadow-lg shadow-black/[0.06] dark:shadow-black/25 ring-1 ring-gray-950/[0.05] dark:ring-white/[0.08] py-1.5 min-w-[200px] z-[100] animate-in fade-in zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      {selectedIds.length > 0 && (
        <>
          <button onClick={handleCopy} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
            Copy <span className={shortcutClass}>Ctrl+C</span>
          </button>
          <button onClick={handlePaste} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
            Paste <span className={shortcutClass}>Ctrl+V</span>
          </button>
          <button onClick={handleDuplicate} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
            Duplicate <span className={shortcutClass}>Ctrl+D</span>
          </button>
          <div className="h-px bg-gray-950/[0.04] dark:bg-white/[0.06] my-1 mx-3" />
          <button onClick={handleDelete} className={menuItemClass + ' text-red-600 dark:text-red-400'}>
            Delete <span className={shortcutClass}>Del</span>
          </button>
        </>
      )}
      {!selectedIds.length && (
        <button onClick={handlePaste} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
          Paste <span className={shortcutClass}>Ctrl+V</span>
        </button>
      )}
      {singleSelected && (
        <>
          <div className="h-px bg-gray-950/[0.04] dark:bg-white/[0.06] my-1 mx-3" />
          <button onClick={handleBringToFront} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
            Bring to front <span className={shortcutClass}>Ctrl+Shift+]</span>
          </button>
          <button onClick={handleBringForward} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
            Bring forward <span className={shortcutClass}>Ctrl+]</span>
          </button>
          <button onClick={handleSendBackward} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
            Send backward <span className={shortcutClass}>Ctrl+[</span>
          </button>
          <button onClick={handleSendToBack} className={menuItemClass + ' text-gray-700 dark:text-gray-300'}>
            Send to back <span className={shortcutClass}>Ctrl+Shift+[</span>
          </button>
        </>
      )}
    </div>
  );
}
