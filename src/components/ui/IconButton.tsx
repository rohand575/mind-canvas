import { Tooltip } from './Tooltip';

interface IconButtonProps {
  active?: boolean;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function IconButton({ active, title, onClick, children, className = '' }: IconButtonProps) {
  const button = (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
        active:scale-[0.92]
        ${active
          ? 'bg-indigo-500/[0.08] text-indigo-600 dark:bg-indigo-400/[0.12] dark:text-indigo-400'
          : 'text-gray-500 hover:bg-gray-500/[0.06] hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200'
        }
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
