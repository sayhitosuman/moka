
import React, { useState } from 'react';
import { X, Maximize2, Minimize2, Minus, Square } from 'lucide-react';

// --- THEME ---
export const THEME = {
  bg: 'bg-[#f4f4f5]',
  window: 'bg-[#ffffff]',
  border: 'border-black',
  shadow: 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
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
  scrollable?: boolean;
  hideChromeOnMobile?: boolean;
}

export const Window: React.FC<WindowProps> = ({
  title,
  children,
  className = '',
  icon: Icon,
  color = 'bg-white',
  onClose,
  noPadding = false,
  scrollable = !noPadding,
  hideChromeOnMobile = false,
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
    <div className={`transition-all duration-200 ${hideChromeOnMobile ? 'md:border md:border-black md:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : `border border-black ${THEME.shadow}`} ${windowClasses} bg-white ${isMinimized ? 'h-8' : ''}`}>
      {/* Title Bar */}
      <div className={`h-8 border-b border-black ${hideChromeOnMobile ? 'hidden md:flex' : 'flex'} items-center px-2 justify-between ${color} select-none shrink-0`}>
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
        <div className={`flex-1 relative bg-white min-h-0 ${noPadding ? 'flex flex-col' : 'p-4'} ${scrollable ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
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
    className={`w-full bg-[#f4f4f5] border border-black p-1.5 font-mono text-xs focus:outline-none focus:bg-[#d1b8d6] transition-colors placeholder-gray-400 rounded-md ${className}`}
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

// --- TOAST NOTIFICATIONS ---

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

  return (
    <div className={`fixed top-4 right-4 z-[200] ${bgColor} text-white px-3 py-1.5 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-black animate-slide-down flex items-center gap-2 max-w-sm`}>
      <span className="font-bold text-xs">{icon}</span>
      <span className="text-xs font-medium">{message}</span>
      <button onClick={onClose} className="ml-auto hover:bg-black/20 p-1 rounded">
        <X size={12} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-[200] space-y-2">
    {toasts.map(toast => (
      <Toast
        key={toast.id}
        message={toast.message}
        type={toast.type}
        onClose={() => removeToast(toast.id)}
      />
    ))}
  </div>
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  customClass?: string;
  maxWidth?: string;
  scrollable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  customClass,
  maxWidth = "max-w-2xl",
  scrollable = true
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fade-in"
      onClick={onClose} // Close on backdrop click
    >
      <div
        className={`${customClass || `w-full ${maxWidth} max-h-[90vh] flex flex-col animate-scale-in pointer-events-auto border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl overflow-hidden`} transition-all duration-300`}
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
      >
        <Window
          title={title || 'Detail View'}
          onClose={onClose}
          color="bg-white text-black"
          className="flex-1 min-h-0"
          noPadding
          scrollable={scrollable}
        >
          {children}
        </Window>
      </div>
    </div>
  );
};
