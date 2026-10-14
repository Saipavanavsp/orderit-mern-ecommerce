import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login, register } from '../store/authSlice.js';
import { fetchCart } from '../store/cartSlice.js';
import { fetchWishlist } from '../store/wishlistSlice.js';
import { authApi } from '../services/index.js';
import { errorMessage, fieldErrors } from '../services/api.js';
import { useDocumentTitle } from '../hooks/index.js';
import { useToast } from '../context/contexts.js';
import { Logo } from '../components/Header.jsx';
import { Button, Field } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { isEmail, passwordIssues } from '../utils/validation.js';
import { safeRedirect } from '../utils/redirect.js';

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-4 text-center text-sm text-muted">{footer}</p>}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className="input pr-10" autoComplete={autoComplete} value={value} onChange={onChange} />
      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        <Icon name={show ? 'eye-off' : 'eye'} className="h-4 w-4" />
      </button>
    </div>
  );
}

function PasswordHint({ value }) {
  const issues = passwordIssues(value);
  if (!value) return <p className="mt-1 text-xs text-muted">At least 8 characters with upper & lower case letters and a number.</p>;
  return issues.length ? <p className="mt-1 text-xs text-warning">Add {issues.join(', ')}.</p> : <p className="mt-1 text-xs text-success">Strong enough.</p>;
}

export function Login() {
  useDocumentTitle('Log in');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    if (!form.password) errs.password = 'Enter your password';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await dispatch(login(form));
    setBusy(false);
    if (login.fulfilled.match(res)) {
      dispatch(fetchCart());
      dispatch(fetchWishlist());
      toast.success(`Welcome back, ${res.payload.name.split(' ')[0]}`);
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } else setFormError(res.payload?.message || 'Login failed');
  };

  return (
    <AuthCard title="Log in to OrderIt" subtitle="Track orders, save your wishlist and check out faster." footer={<>New here? <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect'))}` : ''}`} className="font-medium text-primary hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <p className="rounded bg-danger-50 p-3 text-sm text-danger" role="alert">{formError}</p>}
        <Field label="Email" id="email" error={errors.email}>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" id="password" error={errors.password}>
          <PasswordInput id="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="text-right text-sm"><Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link></div>
        <Button type="submit" className="btn-primary w-full py-2.5" loading={busy}>Log in</Button>
      </form>
    </AuthCard>
  );
}

export function Register() {
  useDocumentTitle('Create account');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your name';
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) errs.phone = 'Enter a valid 10-digit mobile number';
    if (passwordIssues(form.password).length) errs.password = 'Password does not meet the requirements';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { confirm: _c, ...body } = form;
    const res = await dispatch(register(body));
    setBusy(false);
    if (register.fulfilled.match(res)) {
      dispatch(fetchCart());
      toast.success('Account created. Welcome to OrderIt!');
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } else {
      setErrors(res.payload?.fields || {});
      setFormError(res.payload?.message || 'Registration failed');
    }
  };

  return (
    <AuthCard title="Create your account" footer={<>Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <p className="rounded bg-danger-50 p-3 text-sm text-danger" role="alert">{formError}</p>}
        <Field label="Full name" id="name" error={errors.name}>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" id="email" error={errors.email}>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Mobile number (optional)" id="phone" error={errors.phone}>
          <input id="phone" className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Password" id="password" error={errors.password}>
          <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          {!errors.password && <PasswordHint value={form.password} />}
        </Field>
        <Field label="Confirm password" id="confirm" error={errors.confirm}>
          <PasswordInput id="confirm" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        <Button type="submit" className="btn-primary w-full py-2.5" loading={busy}>Create account</Button>
      </form>
    </AuthCard>
  );
}

export function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) return setError('Enter a valid email address');
    setBusy(true);
    setError('');
    try {
      setSent((await authApi.forgotPassword(email)).message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <AuthCard title="Reset your password" subtitle="Enter your account email and we will send you a reset link." footer={<Link to="/login" className="text-primary hover:underline">Back to log in</Link>}>
      {sent ? (
        <p className="rounded bg-success-50 p-3 text-sm text-success" role="status">{sent}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" id="email" error={error}>
            <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="btn-primary w-full py-2.5" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword() {
  useDocumentTitle('Choose a new password');
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (passwordIssues(form.password).length) errs.password = 'Password does not meet the requirements';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await authApi.resetPassword(token, form.password);
      toast.success('Password updated. Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" footer={<Link to="/forgot-password" className="text-primary hover:underline">Request a new link</Link>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && <p className="rounded bg-danger-50 p-3 text-sm text-danger" role="alert">{errors.form}</p>}
        <Field label="New password" id="password" error={errors.password}>
          <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {!errors.password && <PasswordHint value={form.password} />}
        </Field>
        <Field label="Confirm new password" id="confirm" error={errors.confirm}>
          <PasswordInput id="confirm" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <Button type="submit" className="btn-primary w-full py-2.5" loading={busy}>Update password</Button>
      </form>
    </AuthCard>
  );
}

export { PasswordInput, PasswordHint };
