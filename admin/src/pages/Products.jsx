// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi, productApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useAsync, useDebounce, useDocumentTitle } from '../hooks/index.js';
import { useConfirm, useToast } from '../context/contexts.js';
import { Button, EmptyState, ErrorState, PageHeader, Pagination, StatusBadge, TableSkeleton, Thumb } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { formatPrice } from '../utils/format.js';
import { ACTIVE_STYLES } from '../utils/format.js';

export default function Products() {
  useDocumentTitle('Products');
  const toast = useToast();
  const confirm = useConfirm();
  const [filters, setFilters] = useState({ search: '', category: '', brand: '', status: 'all', stock: 'all', sort: 'newest', page: 1 });
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const search = useDebounce(filters.search, 300);
  const { data: lookups } = useAsync(() => Promise.all([catalogApi.categories(), catalogApi.brands()]).then(([c, b]) => ({ categories: c.data.categories, brands: b.data.brands })), []);
  const params = { ...filters, search: search || undefined, category: filters.category || undefined, brand: filters.brand || undefined, limit: 20 };
  const { data, loading, error, reload } = useAsync(() => productApi.list(params), [JSON.stringify(params)]);
  const products = data?.data.products || [];
  const set = (patch) => {
    setSelected([]);
    setFilters((f) => ({ ...f, page: 1, ...patch }));
  };

  const allSelected = products.length > 0 && products.every((p) => selected.includes(p._id));
  const toggleAll = () => setSelected(allSelected ? [] : products.map((p) => p._id));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulk = async (isActive) => {
    setBusy(true);
    try {
      const res = await productApi.bulkStatus(selected, isActive);
      toast.success(res.message);
      setSelected([]);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!(await confirm({ title: 'Delete product?', message: `"${p.name}" and its reviews will be permanently deleted. Past orders keep their copy.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await productApi.remove(p._id);
      toast.success('Product deleted');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={data ? `${data.meta.total} products` : undefined}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => productApi.exportCsv().catch((e) => toast.error(errorMessage(e)))}><Icon name="download" className="h-4 w-4" /> Export CSV</button>
            <Link to="/products/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Add product</Link>
          </>
        }
      />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="lg:col-span-2"><span className="sr-only">Search</span>
          <input className="input" placeholder="Search name, SKU or tag" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
        </label>
        <label><span className="sr-only">Category</span>
          <select className="input" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">All categories</option>
            {lookups?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </label>
        <label><span className="sr-only">Brand</span>
          <select className="input" value={filters.brand} onChange={(e) => set({ brand: e.target.value })}>
            <option value="">All brands</option>
            {lookups?.brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </label>
        <label><span className="sr-only">Status</span>
          <select className="input" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="all">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </label>
        <label><span className="sr-only">Stock</span>
          <select className="input" value={filters.stock} onChange={(e) => set({ stock: e.target.value })}>
            <option value="all">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </select>
        </label>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary-100 bg-primary-50 px-4 py-2 text-sm dark:bg-primary/20">
          <span className="font-medium text-fg">{selected.length} selected</span>
          <Button className="btn-outline py-1" loading={busy} onClick={() => bulk(true)}>Activate</Button>
          <Button className="btn-outline py-1" disabled={busy} onClick={() => bulk(false)}>Deactivate</Button>
          <button type="button" className="text-muted hover:text-fg" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"><input type="checkbox" aria-label="Select all" className="accent-primary" checked={allSelected} onChange={toggleAll} /></th>
                  <th>Product</th><th>Category</th>
                  <th><button type="button" onClick={() => set({ sort: filters.sort === 'price_asc' ? 'price_desc' : 'price_asc' })}>Price ↕</button></th>
                  <th><button type="button" onClick={() => set({ sort: filters.sort === 'stock_asc' ? 'stock_desc' : 'stock_asc' })}>Stock ↕</button></th>
                  <th>Rating</th><th>Status</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              {loading ? <TableSkeleton cols={8} /> : (
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id}>
                      <td><input type="checkbox" aria-label={`Select ${p.name}`} className="accent-primary" checked={selected.includes(p._id)} onChange={() => toggle(p._id)} /></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Thumb src={p.images?.[0]?.url} />
                          <div className="min-w-0">
                            <Link to={`/products/${p._id}`} className="line-clamp-1 max-w-xs font-medium hover:text-primary">{p.name}</Link>
                            <p className="text-xs text-muted">{p.brand?.name}{p.sku ? ` · ${p.sku}` : ''}{p.isFeatured ? ' · Featured' : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{p.category?.name}</td>
                      <td className="whitespace-nowrap">{formatPrice(p.price)}{p.discountPercent > 0 && <span className="block text-xs text-muted">{p.discountPercent}% off {formatPrice(p.mrp)}</span>}</td>
                      <td><span className={p.stock === 0 ? 'font-semibold text-danger' : p.isLowStock ? 'font-semibold text-warning' : ''}>{p.stock}</span></td>
                      <td>{p.rating ? `${p.rating.toFixed(1)} (${p.numReviews})` : '–'}</td>
                      <td><StatusBadge status={p.isActive ? 'active' : 'inactive'} styles={ACTIVE_STYLES} /></td>
                      <td className="whitespace-nowrap text-right">
                        <Link to={`/products/${p._id}`} className="btn-ghost px-2" aria-label={`Edit ${p.name}`}><Icon name="edit" className="h-4 w-4" /></Link>
                        <button type="button" className="btn-ghost px-2 text-danger" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}><Icon name="trash" className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {!loading && products.length === 0 && <EmptyState icon="search" title="No products found" message="Adjust the filters or add a new product." />}
          <Pagination meta={data?.meta} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
      )}
    </>
  );
}
