// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../components/Icon.jsx';
import { ToastContext } from './contexts.js';


const STYLES = {
  success: { bar: 'bg-success', icon: 'check', iconClass: 'text-success' },
  error: { bar: 'bg-danger', icon: 'alert', iconClass: 'text-danger' },
  info: { bar: 'bg-primary', icon: 'info', iconClass: 'text-primary' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === 'error' ? 5000 : 3000);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:right-4 sm:top-20 sm:items-end" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const s = STYLES[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                role={t.type === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
              >
                <span className={`w-1 ${s.bar}`} />
                <div className="flex flex-1 items-start gap-2 p-3 text-sm">
                  <Icon name={s.icon} className={`mt-0.5 h-4 w-4 shrink-0 ${s.iconClass}`} />
                  <p className="flex-1 text-fg">{t.message}</p>
                  <button type="button" onClick={() => dismiss(t.id)} className="text-muted hover:text-fg" aria-label="Dismiss">
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
