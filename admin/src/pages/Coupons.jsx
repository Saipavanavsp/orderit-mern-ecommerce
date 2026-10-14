import { useState } from 'react';
import { couponApi } from '../services/index.js';
import { errorMessage, fieldErrors } from '../services/api.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useConfirm, useToast } from '../context/contexts.js';
import { Modal } from '../components/Modal.jsx';
import { Button, EmptyState, ErrorState, Field, PageHeader, Pagination, StatusBadge, TableSkeleton, Toggle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { formatDate, formatPrice, toDateInput } from '../utils/format.js';

const STYLES = { active: 'bg-success-50 text-success', expired: 'bg-subtle text-muted', inactive: 'bg-warning-50 text-warning' };
const blank = () => ({ code: '', description: '', discountType: 'percent', discountValue: '', minOrderValue: '0', maxDiscount: '0', expiresAt: toDateInput(Date.now() + 30 * 86400000), usageLimit: '0', perUserLimit: '1', isActive: true });

function CouponForm({ initial, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^[A-Za-z0-9]{3,20}$/.test(form.code)) errs.code = '3-20 letters or numbers';
    if (!(Number(form.discountValue) > 0)) errs.discountValue = 'Enter a value above 0';
    if (form.discountType === 'percent' && Number(form.discountValue) > 90) errs.discountValue = 'Max 90%';
    if (!form.expiresAt) errs.expiresAt = 'Choose an expiry date';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const body = {
      code: form.code, description: form.description, discountType: form.discountType, discountValue: Number(form.discountValue),
      minOrderValue: Number(form.minOrderValue || 0), maxDiscount: Number(form.maxDiscount || 0), expiresAt: `${form.expiresAt}T23:59:59`,
      usageLimit: Number(form.usageLimit || 0), perUserLimit: Number(form.perUserLimit || 0), isActive: form.isActive,
    };
    try {
      const res = form._id ? await couponApi.update(form._id, body) : await couponApi.create(body);
      toast.success(res.message);
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Code" id="c-code" error={errors.code}><input id="c-code" className="input uppercase" maxLength={20} value={form.code} onChange={set('code')} /></Field>
      <Field label="Type" id="c-type">
        <select id="c-type" className="input" value={form.discountType} onChange={set('discountType')}><option value="percent">Percentage</option><option value="flat">Flat amount (₹)</option></select>
      </Field>
      <Field label={form.discountType === 'percent' ? 'Discount (%)' : 'Discount (₹)'} id="c-val" error={errors.discountValue}><input id="c-val" className="input" inputMode="numeric" value={form.discountValue} onChange={set('discountValue')} /></Field>
      <Field label="Max discount (₹, 0 = no cap)" id="c-max" error={errors.maxDiscount}><input id="c-max" className="input" inputMode="numeric" value={form.maxDiscount} onChange={set('maxDiscount')} disabled={form.discountType === 'flat'} /></Field>
      <Field label="Minimum order (₹)" id="c-min" error={errors.minOrderValue}><input id="c-min" className="input" inputMode="numeric" value={form.minOrderValue} onChange={set('minOrderValue')} /></Field>
      <Field label="Expires on" id="c-exp" error={errors.expiresAt}><input id="c-exp" type="date" className="input" value={form.expiresAt} onChange={set('expiresAt')} /></Field>
      <Field label="Total uses (0 = unlimited)" id="c-lim"><input id="c-lim" className="input" inputMode="numeric" value={form.usageLimit} onChange={set('usageLimit')} /></Field>
      <Field label="Uses per customer (0 = unlimited)" id="c-pu"><input id="c-pu" className="input" inputMode="numeric" value={form.perUserLimit} onChange={set('perUserLimit')} /></Field>
      <Field label="Description" id="c-desc" className="sm:col-span-2"><input id="c-desc" className="input" maxLength={200} value={form.description} onChange={set('description')} /></Field>
      <label className="flex items-center gap-3 text-sm text-fg sm:col-span-2"><Toggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /> Active</label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
        <Button type="submit" loading={busy}>Save coupon</Button>
      </div>
    </form>
  );
}

export default function Coupons() {
  useDocumentTitle('Coupons');
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ status: 'all', page: 1 });
  const [editing, setEditing] = useState(null);
  const { data, loading, error, reload } = useAsync(() => couponApi.list({ ...f, limit: 20 }), [f.status, f.page]);
  const coupons = data?.data.coupons || [];

  const remove = async (c) => {
    if (!(await confirm({ title: `Delete ${c.code}?`, message: 'Customers will no longer be able to use it.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await couponApi.remove(c._id);
      toast.success('Coupon deleted');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const state = (c) => (c.isExpired ? 'expired' : c.isActive ? 'active' : 'inactive');

  return (
    <>
      <PageHeader title="Coupons" actions={<button type="button" className="btn-primary" onClick={() => setEditing(blank())}><Icon name="plus" className="h-4 w-4" /> New coupon</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'active', 'inactive', 'expired'].map((s) => (
          <button key={s} type="button" aria-pressed={f.status === s} onClick={() => setF({ status: s, page: 1 })} className={`chip capitalize ${f.status === s ? 'border-primary bg-primary text-white' : 'hover:bg-subtle'}`}>{s}</button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expires</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              {loading ? <TableSkeleton cols={7} /> : (
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c._id}>
                      <td><p className="font-semibold">{c.code}</p><p className="max-w-xs truncate text-xs text-muted">{c.description}</p></td>
                      <td>{c.discountType === 'percent' ? `${c.discountValue}%${c.maxDiscount ? ` (max ${formatPrice(c.maxDiscount)})` : ''}` : formatPrice(c.discountValue)}</td>
                      <td>{c.minOrderValue ? formatPrice(c.minOrderValue) : '–'}</td>
                      <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                      <td className="whitespace-nowrap">{formatDate(c.expiresAt)}</td>
                      <td><StatusBadge status={state(c)} styles={STYLES} /></td>
                      <td className="whitespace-nowrap text-right">
                        <button type="button" className="btn-ghost px-2" aria-label={`Edit ${c.code}`} onClick={() => setEditing({ ...c, expiresAt: toDateInput(c.expiresAt), discountValue: String(c.discountValue), minOrderValue: String(c.minOrderValue), maxDiscount: String(c.maxDiscount), usageLimit: String(c.usageLimit), perUserLimit: String(c.perUserLimit) })}><Icon name="edit" className="h-4 w-4" /></button>
                        <button type="button" className="btn-ghost px-2 text-danger" aria-label={`Delete ${c.code}`} onClick={() => remove(c)}><Icon name="trash" className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {!loading && coupons.length === 0 && <EmptyState icon="ticket" title="No coupons" message="Create a coupon to run a promotion." />}
          <Pagination meta={data?.meta} onChange={(page) => setF((x) => ({ ...x, page }))} />
        </div>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.code}` : 'New coupon'} size="lg">
        {editing && <CouponForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>
    </>
  );
}
