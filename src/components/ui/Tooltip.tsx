import { useState, useRef, useCallback } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, delay = 400, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };


  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {visible && content && (
        <div
          className={`absolute ${positionClasses[position]} z-[200] pointer-events-none`}
          role="tooltip"
        >
          <div className="px-3 py-2 text-[13px] font-medium text-white bg-gray-900 dark:bg-gray-800 backdrop-blur-xl rounded-xl shadow-xl shadow-black/30 ring-1 ring-white/[0.08] whitespace-nowrap animate-in fade-in zoom-in-95">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
