import { useState } from 'react';
import { reviewApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useAsync, useDebounce, useDocumentTitle } from '../hooks/index.js';
import { useConfirm, useToast } from '../context/contexts.js';
import { EmptyState, ErrorState, PageHeader, Pagination, StatusBadge, Thumb } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { capitalize, formatDate } from '../utils/format.js';

const STYLES = { pending: 'bg-warning-50 text-warning', approved: 'bg-success-50 text-success', rejected: 'bg-danger-50 text-danger' };

export default function Reviews() {
  useDocumentTitle('Review moderation');
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ status: 'pending', rating: '', search: '', page: 1 });
  const search = useDebounce(f.search, 300);
  const params = { status: f.status, rating: f.rating || undefined, search: search || undefined, page: f.page, limit: 15 };
  const { data, loading, error, reload } = useAsync(() => reviewApi.list(params), [JSON.stringify(params)]);
  const reviews = data?.data.reviews || [];
  const counts = data?.data.counts || {};
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }));

  const act = async (r, status) => {
    try {
      await reviewApi.setStatus(r._id, status);
      toast.success(`Review ${status}`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (r) => {
    if (!(await confirm({ title: 'Delete review?', message: 'This permanently removes the review and updates the product rating.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await reviewApi.remove(r._id);
      toast.success('Review deleted');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Review moderation" subtitle="Only approved reviews are shown in the store and count towards ratings." />
      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {['pending', 'approved', 'rejected', 'all'].map((s) => (
          <button key={s} type="button" role="tab" aria-selected={f.status === s} onClick={() => set({ status: s })} className={`chip ${f.status === s ? 'border-primary bg-primary text-white' : 'hover:bg-subtle'}`}>
            {capitalize(s)}{counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2">
        <input className="input" aria-label="Search reviews" placeholder="Search review text" value={f.search} onChange={(e) => set({ search: e.target.value })} />
        <select className="input" aria-label="Rating" value={f.rating} onChange={(e) => set({ rating: e.target.value })}>
          <option value="">Any rating</option>{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} star</option>)}
        </select>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>}
      {!loading && !error && reviews.length === 0 && <div className="card"><EmptyState icon="star" title="Nothing to moderate" message="No reviews match this filter." /></div>}
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r._id} className="card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <Thumb src={r.product?.images?.[0]?.url} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-fg">{r.product?.name || 'Deleted product'}</p>
                <p className="text-xs text-muted">{r.user?.name} · {r.user?.email} · {formatDate(r.createdAt)}{r.isVerifiedPurchase ? ' · Verified purchase' : ''}</p>
              </div>
              <StatusBadge status={r.status} styles={STYLES} />
            </div>
            <div className="mt-3 text-sm">
              <p className="flex items-center gap-1 font-medium text-fg">
                {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" filled className={`h-4 w-4 ${i < r.rating ? 'text-secondary' : 'text-line'}`} />)}
                <span className="ml-2">{r.title}</span>
              </p>
              <p className="mt-1 text-fg">{r.comment}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status !== 'approved' && <button type="button" className="btn-primary py-1" onClick={() => act(r, 'approved')}><Icon name="check" className="h-4 w-4" /> Approve</button>}
              {r.status !== 'rejected' && <button type="button" className="btn-outline py-1" onClick={() => act(r, 'rejected')}>Reject</button>}
              <button type="button" className="btn-ghost py-1 text-danger" onClick={() => remove(r)}><Icon name="trash" className="h-4 w-4" /> Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {data?.meta && <div className="card mt-4"><Pagination meta={data.meta} onChange={(page) => setF((x) => ({ ...x, page }))} /></div>}
    </>
  );
}
