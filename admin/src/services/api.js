import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

// "X-Client-App: admin" makes the API use separate admin cookies, so a customer session in the
// storefront never leaks into the dashboard (both apps share the localhost cookie jar).
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 20000,
  headers: { 'X-Client-App': 'admin' },
});

let refreshPromise = null;
let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};
const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/session'];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retried && !NO_REFRESH.some((p) => original.url?.includes(p))) {
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

export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) return 'Cannot reach the server. Is the API running on port 5001?';
  return err.response.data?.message || fallback;
}

export function fieldErrors(err) {
  const list = err?.response?.data?.errors || [];
  return Object.fromEntries(list.map((e) => [e.field, e.message]));
}

const unwrap = (p) => p.then((r) => r.data);
export const get = (url, params) => unwrap(api.get(url, { params }));
export const post = (url, body) => unwrap(api.post(url, body));
export const put = (url, body) => unwrap(api.put(url, body));
export const patch = (url, body) => unwrap(api.patch(url, body));
export const del = (url) => unwrap(api.delete(url));

/** Downloads an authenticated file (CSV export) via a Blob. */
export async function download(url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const name = res.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
