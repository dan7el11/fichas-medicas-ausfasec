// Diálogo de confirmación propio (reemplaza window.confirm).
// Patrón provider+hook idéntico a Toast.tsx:
//   const confirm = useConfirm();
//   if (!(await confirm({ message: '¿Eliminar?', danger: true }))) return;
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Botón de confirmación en rojo para acciones destructivas */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

interface Pending {
  opts: Required<Omit<ConfirmOptions, 'danger'>> & { danger: boolean };
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>((raw) => {
    const o = typeof raw === 'string' ? { message: raw } : raw;
    return new Promise<boolean>((resolve) => {
      setPending({
        opts: {
          title: o.title ?? 'Confirmar acción',
          message: o.message,
          confirmLabel: o.confirmLabel ?? (o.danger ? 'Eliminar' : 'Confirmar'),
          cancelLabel: o.cancelLabel ?? 'Cancelar',
          danger: o.danger ?? false,
        },
        resolve,
      });
    });
  }, []);

  const cerrar = useCallback((ok: boolean) => {
    setPending((p) => { p?.resolve(ok); return null; });
  }, []);

  // Escape cierra como "cancelar"
  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [pending, cerrar]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          onClick={() => cerrar(false)}
          className="fixed inset-0 z-[9000] grid place-items-center p-6"
          style={{ background: 'rgba(13,27,42,0.55)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[420px] max-w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-start gap-3.5 p-6 pb-4">
              <span
                className="grid place-items-center w-10 h-10 rounded-full flex-shrink-0"
                style={{
                  background: pending.opts.danger ? '#fde8e8' : '#e8f0fd',
                  color: pending.opts.danger ? '#dc2626' : '#1d4fad',
                }}
              >
                <AlertTriangle size={19} />
              </span>
              <div className="min-w-0">
                <h3 className="m-0 text-[15.5px] font-extrabold tracking-tight text-slate-900">{pending.opts.title}</h3>
                <p className="mt-1.5 mb-0 text-[13.5px] leading-snug text-slate-600">{pending.opts.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => cerrar(false)}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-slate-50"
              >
                {pending.opts.cancelLabel}
              </button>
              <button
                onClick={() => cerrar(true)}
                autoFocus
                className="px-4 py-2 text-white border-none rounded-lg text-[13px] font-bold cursor-pointer"
                style={{ background: pending.opts.danger ? '#dc2626' : '#1d4fad' }}
              >
                {pending.opts.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}
