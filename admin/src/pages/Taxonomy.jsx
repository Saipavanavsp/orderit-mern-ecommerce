import { useState } from 'react';
import { catalogApi } from '../services/index.js';
import { errorMessage, fieldErrors } from '../services/api.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useConfirm, useToast } from '../context/contexts.js';
import { Modal } from '../components/Modal.jsx';
import { Button, EmptyState, ErrorState, Field, PageHeader, StatusBadge, Thumb, Toggle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { ACTIVE_STYLES } from '../utils/format.js';

/** Shared CRUD screen for categories and brands. */
function TaxonomyPage({ kind }) {
  const isCategory = kind === 'category';
  const label = isCategory ? 'Category' : 'Brand';
  useDocumentTitle(isCategory ? 'Categories' : 'Brands');
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useAsync(
    () => (isCategory ? catalogApi.categories().then((r) => r.data.categories) : catalogApi.brands().then((r) => r.data.brands)),
    [kind],
  );
  const { data: categories } = useAsync(() => (isCategory ? Promise.resolve([]) : catalogApi.categories().then((r) => r.data.categories)), [kind]);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const open = (item) => {
    setErrors({});
    setEditing(
      item
        ? { ...item, subCategories: (item.subCategories || []).join(', '), categories: (item.categories || []).map((c) => c._id || c) }
        : { name: '', description: '', image: '', logo: '', subCategories: '', sortOrder: 0, categories: [], isActive: true },
    );
  };

  const save = async () => {
    if (editing.name.trim().length < (isCategory ? 2 : 1)) return setErrors({ name: 'Name is required' });
    setBusy(true);
    const body = isCategory
      ? { name: editing.name, description: editing.description, image: editing.image, sortOrder: Number(editing.sortOrder) || 0, isActive: editing.isActive, subCategories: editing.subCategories.split(',').map((s) => s.trim()).filter(Boolean) }
      : { name: editing.name, description: editing.description, logo: editing.logo, isActive: editing.isActive, categories: editing.categories };
    try {
      const api = isCategory ? [catalogApi.updateCategory, catalogApi.createCategory] : [catalogApi.updateBrand, catalogApi.createBrand];
      const res = editing._id ? await api[0](editing._id, body) : await api[1](body);
      toast.success(res.message);
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const remove = async (item) => {
    if (!(await confirm({ title: `Delete ${item.name}?`, message: item.productCount ? `${item.productCount} products use it, so it cannot be deleted until they are moved.` : 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await (isCategory ? catalogApi.deleteCategory(item._id) : catalogApi.deleteBrand(item._id));
      toast.success(`${label} deleted`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title={isCategory ? 'Categories' : 'Brands'} subtitle={data ? `${data.length} ${isCategory ? 'categories' : 'brands'}` : undefined} actions={<button type="button" className="btn-primary" onClick={() => open(null)}><Icon name="plus" className="h-4 w-4" /> Add {label.toLowerCase()}</button>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{label}</th><th>{isCategory ? 'Sub-categories' : 'Categories'}</th><th>Active products</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5}><div className="skeleton h-6" /></td></tr>}
                {data?.map((item) => (
                  <tr key={item._id}>
                    <td><div className="flex items-center gap-3">{isCategory && <Thumb src={item.image} />}<div><p className="font-medium">{item.name}</p><p className="text-xs text-muted">/{item.slug}</p></div></div></td>
                    <td className="max-w-xs text-muted"><span className="line-clamp-2">{isCategory ? item.subCategories?.join(', ') || '–' : item.categories?.map((c) => c.name).join(', ') || '–'}</span></td>
                    <td>{item.productCount}</td>
                    <td><StatusBadge status={item.isActive ? 'active' : 'inactive'} styles={ACTIVE_STYLES} /></td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" className="btn-ghost px-2" aria-label={`Edit ${item.name}`} onClick={() => open(item)}><Icon name="edit" className="h-4 w-4" /></button>
                      <button type="button" className="btn-ghost px-2 text-danger" aria-label={`Delete ${item.name}`} onClick={() => remove(item)}><Icon name="trash" className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && data?.length === 0 && <EmptyState title={`No ${isCategory ? 'categories' : 'brands'} yet`} />}
        </div>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.name}` : `Add ${label.toLowerCase()}`}>
        {editing && (
          <div className="space-y-4">
            <Field label="Name" id="t-name" error={errors.name}><input id="t-name" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description" id="t-desc"><textarea id="t-desc" rows={3} className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            {isCategory ? (
              <>
                <Field label="Image URL" id="t-img"><input id="t-img" className="input" value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} /></Field>
                <Field label="Sub-categories (comma separated)" id="t-sub"><input id="t-sub" className="input" value={editing.subCategories} onChange={(e) => setEditing({ ...editing, subCategories: e.target.value })} /></Field>
                <Field label="Sort order" id="t-sort"><input id="t-sort" className="input" inputMode="numeric" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} /></Field>
              </>
            ) : (
              <fieldset>
                <legend className="label">Sells in categories</legend>
                <div className="grid grid-cols-2 gap-2">
                  {categories?.map((c) => (
                    <label key={c._id} className="flex items-center gap-2 text-sm text-fg">
                      <input type="checkbox" className="accent-primary" checked={editing.categories.includes(c._id)} onChange={(e) => setEditing({ ...editing, categories: e.target.checked ? [...editing.categories, c._id] : editing.categories.filter((x) => x !== c._id) })} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="flex items-center gap-3 text-sm text-fg"><Toggle label="Active" checked={editing.isActive} onChange={(v) => setEditing({ ...editing, isActive: v })} /> Active</label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <Button loading={busy} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export const Categories = () => <TaxonomyPage kind="category" />;
export const Brands = () => <TaxonomyPage kind="brand" />;
