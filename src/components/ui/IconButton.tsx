import { Tooltip } from './Tooltip';

interface IconButtonProps {
  active?: boolean;
  title?: string;
  'aria-label'?: string;
  'aria-keyshortcuts'?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function IconButton({
  active,
  title,
  'aria-label': ariaLabel,
  'aria-keyshortcuts': ariaKeyshortcuts,
  onClick,
  children,
  className = '',
  disabled,
}: IconButtonProps) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active !== undefined ? active : undefined}
      aria-label={ariaLabel ?? title}
      aria-keyshortcuts={ariaKeyshortcuts}
      aria-disabled={disabled}
      className={`
        flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
        active:scale-[0.93]
        ${active
          ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)] dark:shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.09] dark:hover:text-gray-200 hover:scale-[1.04]'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );

  if (title) {
    return <Tooltip content={title} position="left">{button}</Tooltip>;
  }
  return button;
}
