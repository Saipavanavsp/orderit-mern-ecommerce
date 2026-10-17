// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // HTTP-only auth cookies
  timeout: 60000, // free API hosts can take ~50s to wake from sleep
});

let refreshPromise = null;
let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/session'];

// Access tokens live 15 minutes; on a 401 we refresh once (shared by concurrent requests) and retry.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retried && !NO_REFRESH.some((p) => original.url?.includes(p))) {
      original._retried = true;
      try {
        refreshPromise = refreshPromise || api.post('/auth/refresh').finally(() => (refreshPromise = null));
        await refreshPromise;
        return api(original);
      } catch {
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an axios error. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) return err?.code === 'ECONNABORTED' ? 'The request timed out.' : 'Cannot reach the server. Is the API running?';
  return err.response.data?.message || fallback;
}

/** Field errors from a 400 validation response: { fieldName: message }. */
export function fieldErrors(err) {
  const list = err?.response?.data?.errors || [];
  return Object.fromEntries(list.map((e) => [e.field.split('.').pop(), e.message]));
}

const unwrap = (p) => p.then((r) => r.data);
export const get = (url, params) => unwrap(api.get(url, { params }));
export const post = (url, body) => unwrap(api.post(url, body));
export const put = (url, body) => unwrap(api.put(url, body));
export const del = (url) => unwrap(api.delete(url));
