import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api.js';

export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | OrderIt` : 'OrderIt';
  }, [title]);
}

/**
 * Loads data with loading/error state. `deps` re-trigger the request; stale responses are ignored.
 * Returns { data, loading, error, reload, setData }.
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const callId = useRef(0);

  const run = useCallback(() => {
    const id = ++callId.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    return fnRef
      .current()
      .then((data) => id === callId.current && setState({ data, loading: false, error: '' }))
      .catch((err) => id === callId.current && setState({ data: null, loading: false, error: errorMessage(err) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}

export function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
