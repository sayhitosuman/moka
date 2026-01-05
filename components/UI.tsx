
import React, { useState } from 'react';
import { X, Maximize2, Minimize2, Minus, Square } from 'lucide-react';

// --- THEME ---
export const THEME = {
  bg: 'bg-[#f4f4f5]',
  window: 'bg-[#ffffff]',
  border: 'border-black',
  shadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
  accent: 'bg-[#d1b8d6]', // Purple
  blue: 'bg-[#a6cade]',   // Blue
  green: 'bg-[#b8d6c6]',  // Green
};

// --- COMPONENTS ---

interface WindowProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  icon?: any;
  color?: string;
  onClose?: () => void;
  customMaximizeClass?: string;
  noPadding?: boolean;
}

export const Window: React.FC<WindowProps> = ({
  title,
  children,
  className = '',
  icon: Icon,
  color = 'bg-white',
  onClose,
  noPadding = false,
  customMaximizeClass
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (isMaximized) setIsMaximized(false);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (isMinimized) setIsMinimized(false);
  };

  const windowClasses = isMaximized
    ? (customMaximizeClass || 'fixed inset-4 z-50 flex flex-col animate-fade-in')
    : `relative flex flex-col ${className}`;

  return (
    <div className={`transition-all duration-200 border border-black ${THEME.shadow} ${windowClasses} bg-white ${isMinimized ? 'h-8' : ''}`}>
      {/* Title Bar */}
      <div className={`h-8 border-b border-black flex items-center px-2 justify-between ${color} select-none shrink-0`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} />}
          <span className="font-bold text-xs uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={toggleMinimize} className="hover:bg-black hover:text-white p-0.5 transition-colors" title="Minimize">
            <Minus size={12} />
          </button>
          <button onClick={toggleMaximize} className="hover:bg-black hover:text-white p-0.5 transition-colors" title="Maximize">
            {isMaximized ? <Minimize2 size={12} /> : <Square size={10} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="hover:bg-black hover:text-white p-0.5 transition-colors ml-2 border-l border-black pl-2">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className={`flex-1 relative bg-white min-h-0 ${noPadding ? 'flex flex-col overflow-hidden' : 'p-4 overflow-y-auto custom-scrollbar'}`}>
          {children}
        </div>
      )}
    </div>
  );
};

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: (e: any) => void;
  active?: boolean;
  variant?: 'default' | 'primary';
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  active,
  variant = 'default',
  className = '',
  disabled = false
}) => {
  const bg = active ? THEME.blue : variant === 'primary' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50';
  const text = variant === 'primary' ? 'text-white' : 'text-black';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 text-xs font-bold border border-black transition-all 
        active:translate-y-[2px] active:translate-x-[2px] active:shadow-none
        shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
        ${bg} ${text} ${className}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
};

export const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full bg-[#f4f4f5] border-b border-black p-2 font-mono text-xs focus:outline-none focus:bg-[#d1b8d6] transition-colors placeholder-gray-400 ${className}`}
  />
);

interface BadgeProps {
  children?: React.ReactNode;
  color?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, color = THEME.accent }) => (
  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold border border-black ${color}`}>
    {children}
  </span>
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  customClass?: string;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  customClass,
  maxWidth = "max-w-2xl"
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      onClick={onClose} // Close on backdrop click
    >
      <div
        className={customClass || `w-full ${maxWidth} max-h-[90vh] flex flex-col animate-slide-up pointer-events-auto shadow-2xl`}
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
      >
        <Window
          title={title || 'Detail View'}
          onClose={onClose}
          color="bg-white"
          className="flex-1 min-h-0"
        >
          {children}
        </Window>
      </div>
    </div>
  );
};
