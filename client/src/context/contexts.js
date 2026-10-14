// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { createContext, useContext } from 'react';

// Context objects and their hooks live here so provider files only export components (Fast Refresh).
export const ToastContext = createContext(null);
export const ConfirmContext = createContext(null);
export const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export const useConfirm = () => useContext(ConfirmContext);
export const useTheme = () => useContext(ThemeContext);
