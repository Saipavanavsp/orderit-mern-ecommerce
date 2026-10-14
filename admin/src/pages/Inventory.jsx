import { useState } from 'react';
import { Link } from 'react-router-dom';
import { productApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useToast } from '../context/contexts.js';
import { Button, EmptyState, ErrorState, PageHeader, StatCard, Thumb } from '../components/ui.jsx';

function StockEditor({ product, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(String(product.stock));
  const [busy, setBusy] = useState(false);
  const dirty = value !== String(product.stock);
  const save = async () => {
    if (!/^\d+$/.test(value)) return toast.error('Stock must be a whole number');
    setBusy(true);
    try {
      const res = await productApi.setStock(product._id, Number(value));
      toast.success(`Stock for ${product.name.slice(0, 30)} set to ${res.data.product.stock}`);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <div className="flex items-center gap-2">
      <input className="input w-24 py-1" inputMode="numeric" aria-label={`Stock for ${product.name}`} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && dirty && save()} />
      <Button className="btn-outline py-1" loading={busy} disabled={!dirty} onClick={save}>Save</Button>
    </div>
  );
}

export default function Inventory() {
  useDocumentTitle('Inventory');
  const [threshold, setThreshold] = useState(10);
  const { data, loading, error, reload } = useAsync(() => productApi.lowStock(threshold).then((r) => r.data.products), [threshold]);
  const products = data || [];
  const out = products.filter((p) => p.stock === 0).length;

  return (
    <>
      <PageHeader title="Inventory" subtitle="Products at or below the low-stock threshold. Paid and COD orders reduce stock automatically; cancellations restore it." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard icon="alert" tone="danger" label="Out of stock" value={out} />
        <StatCard icon="layers" tone="warning" label={`Low stock (1-${threshold})`} value={products.length - out} />
        <div className="card flex flex-col justify-center p-4">
          <label htmlFor="threshold" className="text-sm text-muted">Low-stock threshold</label>
          <select id="threshold" className="input mt-1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            {[5, 10, 20, 50].map((t) => <option key={t} value={t}>{t} units</option>)}
          </select>
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Product</th><th>SKU</th><th>Status</th><th>Current stock</th><th>Update stock</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5}><div className="skeleton h-6" /></td></tr>}
                {products.map((p) => (
                  <tr key={p._id}>
                    <td><div className="flex items-center gap-3"><Thumb src={p.images?.[0]?.url} /><Link className="line-clamp-2 max-w-sm hover:text-primary" to={`/products/${p._id}`}>{p.name}</Link></div></td>
                    <td className="text-muted">{p.sku || '–'}</td>
                    <td className="text-muted">{p.isActive ? 'Active' : 'Inactive'}</td>
                    <td><span className={`rounded px-2 py-0.5 text-xs font-semibold ${p.stock === 0 ? 'bg-danger-50 text-danger' : 'bg-warning-50 text-warning'}`}>{p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</span></td>
                    <td><StockEditor product={p} onSaved={reload} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && products.length === 0 && <EmptyState icon="check" title="Everything is well stocked" />}
        </div>
      )}
    </>
  );
}
