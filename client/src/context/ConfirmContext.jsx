// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useCallback, useRef, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { ConfirmContext } from './contexts.js';


/** const confirm = useConfirm(); if (await confirm({ title, message, confirmLabel, danger })) { ... } */
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(opts);
      }),
    [],
  );

  const close = (result) => {
    resolver.current?.(result);
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={Boolean(options)} onClose={() => close(false)} title={options?.title || 'Are you sure?'} size="sm">
        <p className="text-sm text-muted">{options?.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => close(false)}>
            {options?.cancelLabel || 'Cancel'}
          </button>
          <button type="button" className={options?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)} autoFocus>
            {options?.confirmLabel || 'Confirm'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
