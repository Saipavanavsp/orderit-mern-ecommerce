// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { userApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useAsync, useDebounce, useDocumentTitle } from '../hooks/index.js';
import { useConfirm, useToast } from '../context/contexts.js';
import { EmptyState, ErrorState, PageHeader, Pagination, StatusBadge, TableSkeleton, Toggle } from '../components/ui.jsx';
import { formatDate, formatPrice } from '../utils/format.js';
import { ACTIVE_STYLES } from '../utils/format.js';

export default function Users() {
  useDocumentTitle('Users');
  const me = useSelector((s) => s.auth.user);
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ search: '', role: 'all', status: 'all', page: 1 });
  const search = useDebounce(f.search, 300);
  const params = { ...f, search: search || undefined, limit: 20 };
  const { data, loading, error, reload, setData } = useAsync(() => userApi.list(params), [JSON.stringify(params)]);
  const users = data?.data.users || [];
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }));

  const patchUser = (user) => setData((d) => ({ ...d, data: { ...d.data, users: d.data.users.map((u) => (u._id === user._id ? { ...u, ...user } : u)) } }));

  const toggleActive = async (u) => {
    if (u.isActive && !(await confirm({ title: `Deactivate ${u.name}?`, message: 'They will be signed out everywhere and cannot log in until reactivated.', confirmLabel: 'Deactivate', danger: true }))) return;
    try {
      const res = await userApi.setStatus(u._id, !u.isActive);
      patchUser(res.data.user);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changeRole = async (u, role) => {
    if (!(await confirm({ title: `Make ${u.name} ${role === 'admin' ? 'an admin' : 'a customer'}?`, message: role === 'admin' ? 'Admins can manage products, orders, users and coupons.' : 'They will lose access to the admin console.', confirmLabel: 'Change role' }))) return;
    try {
      const res = await userApi.setRole(u._id, role);
      patchUser(res.data.user);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Users" subtitle={data ? `${data.meta.total} accounts` : undefined} />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-3">
        <input className="input" aria-label="Search users" placeholder="Name, email or phone" value={f.search} onChange={(e) => set({ search: e.target.value })} />
        <select className="input" aria-label="Role" value={f.role} onChange={(e) => set({ role: e.target.value })}><option value="all">All roles</option><option value="customer">Customers</option><option value="admin">Admins</option></select>
        <select className="input" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="all">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>User</th><th>Phone</th><th>Joined</th><th>Orders</th><th>Spent</th><th>Role</th><th>Status</th><th>Active</th></tr></thead>
              {loading ? <TableSkeleton cols={8} /> : (
                <tbody>
                  {users.map((u) => {
                    const self = u._id === me._id;
                    return (
                      <tr key={u._id}>
                        <td><p className="font-medium">{u.name}{self && <span className="ml-1 text-xs text-muted">(you)</span>}</p><p className="text-xs text-muted">{u.email}</p></td>
                        <td className="text-muted">{u.phone || '–'}</td>
                        <td className="whitespace-nowrap text-muted">{formatDate(u.createdAt)}</td>
                        <td>{u.orders}</td>
                        <td>{formatPrice(u.totalSpent)}</td>
                        <td>
                          <select className="input w-auto py-1" aria-label={`Role for ${u.name}`} value={u.role} disabled={self} onChange={(e) => changeRole(u, e.target.value)}>
                            <option value="customer">Customer</option><option value="admin">Admin</option>
                          </select>
                        </td>
                        <td><StatusBadge status={u.isActive ? 'active' : 'inactive'} styles={ACTIVE_STYLES} /></td>
                        <td><Toggle label={`Active: ${u.name}`} checked={u.isActive} disabled={self} onChange={() => toggleActive(u)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
          {!loading && users.length === 0 && <EmptyState icon="users" title="No users found" />}
          <Pagination meta={data?.meta} onChange={(page) => setF((x) => ({ ...x, page }))} />
        </div>
      )}
    </>
  );
}
