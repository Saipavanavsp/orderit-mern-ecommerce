import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { setUser } from '../store/authSlice.js';
import { authApi, userApi } from '../services/index.js';
import { errorMessage, fieldErrors } from '../services/api.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useToast } from '../context/contexts.js';
import { useConfirm } from '../context/contexts.js';
import { AddressForm } from '../components/AddressForm.jsx';
import { Modal } from '../components/Modal.jsx';
import { Breadcrumbs, Button, EmptyState, Field } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { PasswordHint, PasswordInput } from './Auth.jsx';
import { EMPTY_ADDRESS, passwordIssues, validateAddress } from '../utils/validation.js';
import { formatDateTime } from '../utils/format.js';

function ProfileTab({ user }) {
  const dispatch = useDispatch();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await userApi.updateProfile(form);
      dispatch(setUser(res.data.user));
      setErrors({});
      toast.success('Profile updated');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="max-w-lg space-y-4" noValidate>
      <Field label="Full name" id="p-name" error={errors.name}>
        <input id="p-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Email" id="p-email" hint="Email cannot be changed.">
        <input id="p-email" className="input bg-subtle" value={user.email} disabled />
      </Field>
      <Field label="Mobile number" id="p-phone" error={errors.phone}>
        <input id="p-phone" className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <Button type="submit" loading={busy}>Save changes</Button>
    </form>
  );
}

function AddressesTab({ user }) {
  const dispatch = useDispatch();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // {id?, value}
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const errs = validateAddress(editing.value);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { _id: _ignored, ...body } = editing.value;
      const res = editing.id ? await userApi.updateAddress(editing.id, body) : await userApi.addAddress(body);
      dispatch(setUser({ ...user, addresses: res.data.addresses }));
      toast.success(editing.id ? 'Address updated' : 'Address added');
      setEditing(null);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    if (!(await confirm({ title: 'Delete address?', message: `${a.line1}, ${a.city}`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      const res = await userApi.deleteAddress(a._id);
      dispatch(setUser({ ...user, addresses: res.data.addresses }));
      toast.success('Address deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const makeDefault = async (a) => {
    const res = await userApi.updateAddress(a._id, { isDefault: true });
    dispatch(setUser({ ...user, addresses: res.data.addresses }));
  };

  return (
    <div>
      <button type="button" className="btn-outline mb-4" onClick={() => { setErrors({}); setEditing({ value: { ...EMPTY_ADDRESS, fullName: user.name, phone: user.phone || '' } }); }}>
        <Icon name="plus" className="h-4 w-4" /> Add address
      </button>
      {user.addresses.length === 0 && <EmptyState icon="map-pin" title="No saved addresses" message="Addresses you save appear here and at checkout." />}
      <ul className="grid gap-3 md:grid-cols-2">
        {user.addresses.map((a) => (
          <li key={a._id} className="card p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-fg">{a.fullName} {a.isDefault && <span className="ml-1 rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">Default</span>}</p>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => { setErrors({}); setEditing({ id: a._id, value: { ...a } }); }}>Edit</button>
                <button type="button" className="text-danger hover:underline" onClick={() => remove(a)}>Delete</button>
              </div>
            </div>
            <p className="mt-1 text-muted">{[a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</p>
            <p className="text-muted">{a.phone}</p>
            {!a.isDefault && <button type="button" className="mt-2 text-xs text-primary hover:underline" onClick={() => makeDefault(a)}>Set as default</button>}
          </li>
        ))}
      </ul>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit address' : 'Add address'} size="lg">
        {editing && (
          <>
            <AddressForm idPrefix="acct" value={editing.value} errors={errors} onChange={(value) => setEditing({ ...editing, value })} />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <Button loading={busy} onClick={save}>Save address</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function PasswordTab() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = 'Enter your current password';
    if (passwordIssues(form.newPassword).length) errs.newPassword = 'Password does not meet the requirements';
    if (form.newPassword !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed. Other devices have been signed out.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setErrors({ ...fieldErrors(err), currentPassword: err.response?.status === 400 ? errorMessage(err) : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="max-w-lg space-y-4" noValidate>
      <Field label="Current password" id="cp-current" error={errors.currentPassword}>
        <PasswordInput id="cp-current" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      </Field>
      <Field label="New password" id="cp-new" error={errors.newPassword}>
        <PasswordInput id="cp-new" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        {!errors.newPassword && <PasswordHint value={form.newPassword} />}
      </Field>
      <Field label="Confirm new password" id="cp-confirm" error={errors.confirm}>
        <PasswordInput id="cp-confirm" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      </Field>
      <Button type="submit" loading={busy}>Change password</Button>
    </form>
  );
}

function NotificationsTab() {
  const { data, loading, reload } = useAsync(() => userApi.notifications({ limit: 30 }), []);
  const list = data?.data.notifications || [];
  return (
    <div>
      {data?.data.unread > 0 && (
        <button type="button" className="btn-outline mb-4" onClick={async () => { await userApi.readAllNotifications(); reload(); }}>Mark all as read</button>
      )}
      {loading && <div className="skeleton h-20 w-full" />}
      {!loading && list.length === 0 && <EmptyState icon="bell" title="No notifications" message="Order and account updates appear here." />}
      <ul className="divide-y divide-line">
        {list.map((n) => (
          <li key={n._id} className="flex gap-3 py-3 text-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-line' : 'bg-primary'}`} aria-label={n.isRead ? 'Read' : 'Unread'} />
            <div className="flex-1">
              <p className="font-medium text-fg">{n.title}</p>
              <p className="text-muted">{n.message}</p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
            </div>
            {n.link && <Link to={n.link} className="self-center text-xs text-primary hover:underline">View</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABS = [
  ['profile', 'Profile', 'user'],
  ['addresses', 'Addresses', 'map-pin'],
  ['password', 'Change password', 'shield'],
  ['notifications', 'Notifications', 'bell'],
];

export default function Account() {
  useDocumentTitle('My account');
  const user = useSelector((s) => s.auth.user);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'profile';
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: 'My account' }]} />
      <h1 className="mb-5 text-2xl font-semibold text-fg">Hello, {user.name.split(' ')[0]}</h1>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="card flex gap-1 overflow-x-auto p-2 md:flex-col" aria-label="Account sections">
          {TABS.map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => setParams({ tab: key })} aria-current={tab === key ? 'page' : undefined} className={`flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-left text-sm ${tab === key ? 'bg-primary-50 font-medium text-primary-700' : 'text-fg hover:bg-subtle'}`}>
              <Icon name={icon} className="h-4 w-4" /> {label}
            </button>
          ))}
          <Link to="/orders" className="flex items-center gap-2 rounded px-3 py-2 text-sm text-fg hover:bg-subtle"><Icon name="package" className="h-4 w-4" /> My orders</Link>
        </nav>
        <section className="card p-5">
          {tab === 'profile' && <ProfileTab user={user} />}
          {tab === 'addresses' && <AddressesTab user={user} />}
          {tab === 'password' && <PasswordTab />}
          {tab === 'notifications' && <NotificationsTab />}
        </section>
      </div>
    </div>
  );
}
