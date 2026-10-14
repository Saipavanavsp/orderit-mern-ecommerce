// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, productApi, uploadApi } from '../services/index.js';
import { errorMessage, fieldErrors } from '../services/api.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useToast } from '../context/contexts.js';
import { Button, ErrorState, Field, PageHeader, Toggle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

const EMPTY = {
  name: '', sku: '', brand: '', category: '', subCategory: '', description: '', price: '', mrp: '', stock: '',
  images: [], specifications: [], highlights: [], tags: [], isFeatured: false, isActive: true,
};

function validate(f) {
  const e = {};
  if (f.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
  if (!f.brand) e.brand = 'Choose a brand';
  if (!f.category) e.category = 'Choose a category';
  if (f.description.trim().length < 10) e.description = 'Description must be at least 10 characters';
  if (!(Number(f.price) > 0)) e.price = 'Enter a price greater than 0';
  if (!(Number(f.mrp) > 0)) e.mrp = 'Enter the MRP';
  else if (Number(f.mrp) < Number(f.price)) e.mrp = 'MRP must be at least the selling price';
  if (f.stock === '' || Number(f.stock) < 0 || !Number.isInteger(Number(f.stock))) e.stock = 'Enter a whole number, 0 or more';
  if (!f.images.length) e.images = 'Add at least one image';
  return e;
}

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  useDocumentTitle(isNew ? 'Add product' : 'Edit product');
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const { data: lookups } = useAsync(() => Promise.all([catalogApi.categories(), catalogApi.brands()]).then(([c, b]) => ({ categories: c.data.categories, brands: b.data.brands })), []);
  const existing = useAsync(() => (isNew ? Promise.resolve(null) : productApi.get(id).then((r) => r.data.product)), [id]);

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setForm({
      ...EMPTY,
      ...p,
      sku: p.sku || '',
      brand: p.brand?._id || '',
      category: p.category?._id || '',
      price: String(p.price),
      mrp: String(p.mrp),
      stock: String(p.stock),
    });
  }, [existing.data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const subCategories = lookups?.categories.find((c) => c._id === form.category)?.subCategories || [];
  const discount = Number(form.mrp) > Number(form.price) && Number(form.price) > 0 ? Math.round(((form.mrp - form.price) / form.mrp) * 100) : 0;

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const res = await uploadApi.images(files);
      setForm((f) => ({ ...f, images: [...f.images, ...res.data.images.map((i) => ({ url: i.url, alt: f.name }))].slice(0, 8) }));
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addImageUrl = () => {
    if (!/^https?:\/\//.test(imageUrl.trim())) return toast.error('Enter a full image URL (https://...)');
    setForm((f) => ({ ...f, images: [...f.images, { url: imageUrl.trim(), alt: f.name }].slice(0, 8) }));
    setImageUrl('');
    return undefined;
  };

  const save = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('Please fix the highlighted fields');
    setSaving(true);
    const body = {
      name: form.name, brand: form.brand, category: form.category, subCategory: form.subCategory, description: form.description,
      price: Number(form.price), mrp: Number(form.mrp), stock: Number(form.stock),
      images: form.images.map(({ url, alt }) => ({ url, alt: alt || form.name })),
      specifications: form.specifications.filter((s) => s.label.trim() && s.value.trim()).map(({ label, value }) => ({ label, value })),
      highlights: form.highlights.filter((h) => h.trim()),
      tags: form.tags.filter(Boolean),
      isFeatured: form.isFeatured, isActive: form.isActive,
      ...(form.sku ? { sku: form.sku } : {}),
    };
    try {
      if (isNew) await productApi.create(body);
      else await productApi.update(id, body);
      toast.success(isNew ? 'Product created' : 'Product saved');
      navigate('/products');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  if (existing.error) return <ErrorState message={existing.error} onRetry={existing.reload} />;
  if (!isNew && existing.loading) return <div className="skeleton h-96" />;

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        title={isNew ? 'Add product' : 'Edit product'}
        subtitle={!isNew ? form.name : undefined}
        actions={
          <>
            <Link to="/products" className="btn-outline">Cancel</Link>
            <Button type="submit" loading={saving}>{isNew ? 'Create product' : 'Save changes'}</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold text-fg">Basic information</h2>
            <Field label="Product name" id="name" error={errors.name}><input id="name" className="input" value={form.name} onChange={set('name')} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Category" id="category" error={errors.category}>
                <select id="category" className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subCategory: '' }))}>
                  <option value="">Select</option>
                  {lookups?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Sub-category" id="sub">
                <input id="sub" className="input" list="subcats" value={form.subCategory} onChange={set('subCategory')} />
                <datalist id="subcats">{subCategories.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="Brand" id="brand" error={errors.brand}>
                <select id="brand" className="input" value={form.brand} onChange={set('brand')}>
                  <option value="">Select</option>
                  {lookups?.brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description" id="desc" error={errors.description}><textarea id="desc" rows={6} className="input" value={form.description} onChange={set('description')} /></Field>
            <Field label="Highlights (one per line)" id="hl">
              <textarea id="hl" rows={3} className="input" value={form.highlights.join('\n')} onChange={(e) => setForm((f) => ({ ...f, highlights: e.target.value.split('\n') }))} />
            </Field>
            <Field label="Tags (comma separated)" id="tags" hint="Used for search and recommendations, e.g. 5g, amoled, gaming">
              <input id="tags" className="input" value={form.tags.join(', ')} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(',').map((t) => t.trim().toLowerCase()) }))} />
            </Field>
          </section>

          <section className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg">Images</h2>
              <span className="text-xs text-muted">{form.images.length}/8 · JPG, PNG or WEBP up to 2 MB</span>
            </div>
            {errors.images && <p className="field-error">{errors.images}</p>}
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {form.images.map((img, i) => (
                <li key={`${img.url}-${i}`} className="group relative aspect-square rounded border border-line bg-white p-1">
                  <img src={img.url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-[10px] font-medium text-white">Main</span>}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))} className="absolute right-1 top-1 rounded bg-surface p-1 text-danger shadow" aria-label="Remove image"><Icon name="x" className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" id="file" onChange={(e) => upload(e.target.files)} />
              <Button type="button" className="btn-outline" loading={uploading} onClick={() => fileRef.current?.click()}><Icon name="upload" className="h-4 w-4" /> Upload images</Button>
              <input className="input flex-1" placeholder="…or paste an image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <button type="button" className="btn-outline" onClick={addImageUrl}>Add URL</button>
            </div>
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-semibold text-fg">Specifications</h2>
            {form.specifications.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder="Label (e.g. Display)" value={s.label} aria-label="Specification label" onChange={(e) => setForm((f) => ({ ...f, specifications: f.specifications.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} />
                <input className="input" placeholder="Value (e.g. 6.6 inch AMOLED)" value={s.value} aria-label="Specification value" onChange={(e) => setForm((f) => ({ ...f, specifications: f.specifications.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))} />
                <button type="button" className="btn-ghost px-2 text-danger" onClick={() => setForm((f) => ({ ...f, specifications: f.specifications.filter((_, j) => j !== i) }))} aria-label="Remove specification"><Icon name="trash" className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" className="btn-outline" onClick={() => setForm((f) => ({ ...f, specifications: [...f.specifications, { label: '', value: '' }] }))}><Icon name="plus" className="h-4 w-4" /> Add specification</button>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold text-fg">Pricing &amp; inventory</h2>
            <Field label="Selling price (₹)" id="price" error={errors.price}><input id="price" className="input" inputMode="decimal" value={form.price} onChange={set('price')} /></Field>
            <Field label="MRP (₹)" id="mrp" error={errors.mrp} hint={discount ? `${discount}% discount shown to customers` : undefined}><input id="mrp" className="input" inputMode="decimal" value={form.mrp} onChange={set('mrp')} /></Field>
            <Field label="Stock" id="stock" error={errors.stock}><input id="stock" className="input" inputMode="numeric" value={form.stock} onChange={set('stock')} /></Field>
            <Field label="SKU (optional)" id="sku" error={errors.sku}><input id="sku" className="input uppercase" value={form.sku} onChange={set('sku')} /></Field>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold text-fg">Visibility</h2>
            <label className="flex items-center justify-between text-sm text-fg">Active (visible in store) <Toggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /></label>
            <label className="flex items-center justify-between text-sm text-fg">Featured on home page <Toggle label="Featured" checked={form.isFeatured} onChange={(v) => setForm((f) => ({ ...f, isFeatured: v }))} /></label>
          </section>
        </div>
      </div>
    </form>
  );
}
