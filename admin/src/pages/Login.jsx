import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../store/index.js';
import { Button, Field } from '../components/ui.jsx';
import { useDocumentTitle } from '../hooks/index.js';

export default function Login() {
  useDocumentTitle('Admin login');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((s) => s.auth.user);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Enter your email and password');
    setBusy(true);
    setError('');
    const res = await dispatch(login(form));
    setBusy(false);
    if (login.fulfilled.match(res)) navigate(location.state?.from || '/', { replace: true });
    else setError(res.payload);
    return undefined;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <div>
            <p className="font-semibold text-fg">OrderIt</p>
            <p className="text-xs text-muted">Admin console</p>
          </div>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
          <h1 className="text-lg font-semibold text-fg">Sign in</h1>
          {error && <p className="rounded bg-danger-50 p-3 text-sm text-danger" role="alert">{error}</p>}
          <Field label="Email" id="email">
            <input id="email" type="email" autoComplete="username" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password" id="password">
            <input id="password" type="password" autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Button type="submit" className="btn-primary w-full py-2.5" loading={busy}>Sign in</Button>
          <p className="text-center text-xs text-muted">Only administrator accounts can sign in here.</p>
        </form>
      </div>
    </div>
  );
}
