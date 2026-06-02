import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};

const STYLES: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50 text-green-900',
  error:   'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info:    'border-blue-200 bg-blue-50 text-blue-900',
};

function ToastItem({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-md text-sm max-w-sm w-full animate-[slideIn_0.2s_ease] ${STYLES[item.type]}`}
      style={{ animation: 'slideIn 0.2s ease' }}
    >
      <span className="text-base flex-shrink-0 mt-0.5">{ICONS[item.type]}</span>
      <span className="flex-1 leading-snug">{item.message}</span>
      <button
        onClick={onClose}
        className="text-current opacity-40 hover:opacity-70 bg-transparent border-none cursor-pointer text-base leading-none flex-shrink-0 mt-0.5"
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portal-style fixed container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(item => (
          <div key={item.id} className="pointer-events-auto">
            <ToastItem item={item} onClose={() => remove(item.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const { toast } = useContext(ToastContext);
  return {
    success: (msg: string) => toast('success', msg),
    error:   (msg: string) => toast('error', msg),
    warning: (msg: string) => toast('warning', msg),
    info:    (msg: string) => toast('info', msg),
  };
}
