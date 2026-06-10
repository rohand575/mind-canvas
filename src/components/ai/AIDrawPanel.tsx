import { useEffect, useRef, useState } from 'react';
import { useAIStore } from '../../store/aiStore';
import { useElementStore } from '../../store/elementStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useHistoryStore } from '../../store/historyStore';
import { generateDrawing, type AIMode } from '../../utils/aiDrawService';
import { getElementBounds } from '../../utils/geometry';

export function AIDrawPanel() {
  const { isOpen, setOpen, apiKey, setApiKey } = useAIStore();
  const [mode, setMode] = useState<AIMode>('draw');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempKey, setTempKey] = useState('');
  const [showKeySection, setShowKeySection] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const hasKey = !!apiKey;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen && hasKey) {
      setTimeout(() => promptRef.current?.focus(), 50);
    }
    if (isOpen && !hasKey) {
      setShowKeySection(true);
    }
    if (!isOpen) {
      setError(null);
      setShowKeySection(false);
      setShowKey(false);
      setPrompt('');
    }
  }, [isOpen, hasKey]);

  const handleSaveKey = () => {
    const trimmed = tempKey.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setTempKey('');
    setShowKeySection(false);
    setTimeout(() => promptRef.current?.focus(), 50);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !apiKey || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { offsetX, offsetY, zoom } = useCanvasStore.getState();
      const cx = (window.innerWidth / 2 - offsetX) / zoom;
      const cy = (window.innerHeight / 2 - offsetY) / zoom;
      const startZ = useElementStore.getState().getMaxZIndex() + 1;

      const newElements = await generateDrawing(prompt, apiKey, cx, cy, startZ, mode);

      useHistoryStore.getState().pushState(useElementStore.getState().elements);
      useElementStore.getState().setElements([
        ...useElementStore.getState().elements,
        ...newElements,
      ]);

      // Zoom to fit the newly added elements
      const allBounds = newElements.map(getElementBounds);
      const minX = Math.min(...allBounds.map((b) => b.x));
      const minY = Math.min(...allBounds.map((b) => b.y));
      const maxX = Math.max(...allBounds.map((b) => b.x + b.width));
      const maxY = Math.max(...allBounds.map((b) => b.y + b.height));
      useCanvasStore.getState().zoomToBounds(
        { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        window.innerWidth,
        window.innerHeight,
        80
      );

      setPrompt('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (mode === 'diagram') {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerate();
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
    }
  };

  if (!isOpen) return null;

  const panelClasses = `
    absolute bottom-6 left-1/2 -translate-x-1/2 z-50
    ${mode === 'diagram' ? 'w-[640px]' : 'w-[520px]'} max-w-[calc(100vw-2.5rem)]
    bg-white/[0.98] dark:bg-gray-900/[0.98]
    backdrop-blur-xl
    rounded-2xl
    shadow-[0_16px_48px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)]
    dark:shadow-[0_16px_48px_rgba(0,0,0,0.6),0_4px_12px_rgba(0,0,0,0.3)]
    border border-black/[0.06] dark:border-white/[0.07]
    overflow-hidden
    transition-all duration-200
  `;

  return (
    <div ref={panelRef} className={panelClasses} role="dialog" aria-label="AI Draw">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <SparklesIcon />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">AI Draw</span>
          <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500">Powered by GPT-4o</span>
        </div>
        <div className="flex items-center gap-1">
          {hasKey && (
            <button
              onClick={() => setShowKeySection(!showKeySection)}
              title="Change API key"
              className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              API key
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-black/[0.05] dark:border-white/[0.06] bg-gray-50/60 dark:bg-white/[0.02]">
        <button
          onClick={() => { setMode('draw'); setError(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
            mode === 'draw'
              ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-black/[0.06] dark:border-white/[0.1]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
          </svg>
          Draw
        </button>
        <button
          onClick={() => { setMode('diagram'); setError(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
            mode === 'diagram'
              ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-black/[0.06] dark:border-white/[0.1]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="8" y="16" width="8" height="5" rx="1"/><line x1="6.5" y1="8" x2="6.5" y2="12"/><line x1="17.5" y1="8" x2="17.5" y2="12"/><line x1="6.5" y1="12" x2="17.5" y2="12"/><line x1="12" y1="12" x2="12" y2="16"/>
          </svg>
          Diagram
        </button>
        {mode === 'diagram' && (
          <span className="ml-2 text-[11px] text-indigo-500 dark:text-indigo-400">
            Paste any text — logic, rules, or process
          </span>
        )}
      </div>

      {/* API key section */}
      {(showKeySection || !hasKey) && (
        <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02]">
          <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-2">
            OpenAI API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                placeholder={hasKey ? '••••••••••••••••' : 'sk-...'}
                className="w-full h-9 rounded-xl px-3 pr-9 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/[0.1] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showKey
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={!tempKey.trim()}
              className="h-9 px-4 rounded-xl text-[13px] font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              Save
            </button>
          </div>
          {!hasKey && (
            <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
              Your key is stored locally and never sent anywhere except OpenAI.
            </p>
          )}
        </div>
      )}

      {/* Prompt area */}
      {hasKey && (
        <div className="px-4 py-3">
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'diagram'
              ? 'Paste your rules, logic, or process description here…\nGPT-4o will analyze it and generate a flowchart or infographic.'
              : 'Describe what to draw… e.g. "a house with a door and two windows"'
            }
            rows={mode === 'diagram' ? 8 : 2}
            disabled={loading}
            className="w-full resize-y rounded-xl px-3 py-2.5 text-[13px] bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition disabled:opacity-60"
          />

          {/* Error */}
          {error && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-[12px] text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {mode === 'diagram' ? 'Ctrl+Enter to generate · Enter for new line' : 'Enter to generate · Shift+Enter for new line'}
            </span>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="h-8 px-4 rounded-xl text-[13px] font-medium bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_2px_8px_rgba(99,102,241,0.35)] flex items-center gap-2 flex-shrink-0"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {mode === 'diagram' ? 'Analyzing…' : 'Drawing…'}
                </>
              ) : (
                <>
                  <SparklesIcon />
                  {mode === 'diagram' ? 'Generate Diagram' : 'Generate'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
          <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
            {mode === 'diagram' ? 'Analyzing and building diagram…' : 'Generating your drawing…'}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {mode === 'diagram' ? 'Complex diagrams may take 10–20 seconds' : 'This usually takes a few seconds'}
          </p>
        </div>
      )}
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69H21l-4.94 3.59a1 1 0 0 0-.36 1.12L17.58 20 12 16.27 6.42 20l1.88-5.84a1 1 0 0 0-.36-1.12L3 9.45h6.17a1 1 0 0 0 .95-.69L12 3z"/>
    </svg>
  );
}
