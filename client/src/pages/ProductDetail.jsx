// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalogApi } from '../services/index.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useShopActions } from '../hooks/useShopActions.js';
import { ImageGallery } from '../components/ImageGallery.jsx';
import { Reviews } from '../components/Reviews.jsx';
import { ProductRail } from '../components/ProductCard.jsx';
import { Breadcrumbs, Button, ErrorState, Price, QuantitySelector, RatingStars } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import NotFound from './NotFound.jsx';

function StockStatus({ stock, isLowStock }) {
  if (stock === 0) return <p className="font-medium text-danger">Out of stock</p>;
  if (isLowStock) return <p className="font-medium text-warning">Hurry, only {stock} left in stock</p>;
  return <p className="font-medium text-success">In stock</p>;
}

function DetailSkeleton() {
  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-2">
      <div className="skeleton aspect-square w-full" />
      <div className="space-y-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-8 w-full" />
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton h-24 w-full" />
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: product, loading, error, reload } = useAsync(() => catalogApi.product(slug).then((r) => r.data.product), [slug]);
  const { data: related } = useAsync(() => catalogApi.related(slug).then((r) => r.data.products), [slug]);
  const { add, toggleWish, isWished } = useShopActions();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  useDocumentTitle(product?.name);

  if (loading) return <DetailSkeleton />;
  if (error?.toLowerCase().includes('not found')) return <NotFound />;
  if (error) return <div className="container-page py-10"><ErrorState message={error} onRetry={reload} /></div>;

  const out = product.stock === 0;
  const maxQty = Math.min(10, product.stock);
  const wished = isWished(product._id);
  const handleAdd = async (goToCart) => {
    setBusy(true);
    await add(product, qty, { goToCart });
    setBusy(false);
  };

  return (
    <div className="container-page py-6 pb-28 md:pb-6">
      <Breadcrumbs
        items={[
          { label: product.category?.name, to: `/category/${product.category?.slug}` },
          { label: product.name },
        ]}
      />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="md:sticky md:top-32 md:self-start">
          <ImageGallery images={product.images} name={product.name} />
        </div>
        <div>
          <Link to={`/products?brand=${product.brand?.slug}`} className="text-sm font-medium uppercase tracking-wide text-secondary hover:underline">{product.brand?.name}</Link>
          <h1 className="mt-1 text-2xl font-semibold leading-snug text-fg">{product.name}</h1>
          <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm hover:underline">
            <RatingStars value={product.rating} showValue count={product.numReviews} />
          </a>
          <div className="mt-5 border-t border-line pt-5">
            <Price price={product.price} mrp={product.mrp} discountPercent={product.discountPercent} size="lg" />
            <p className="mt-1 text-xs text-muted">Inclusive of all charges except GST, added at checkout</p>
          </div>
          <div className="mt-4 text-sm"><StockStatus stock={product.stock} isLowStock={product.isLowStock} /></div>

          {!out && (
            <div className="mt-5 hidden items-center gap-3 md:flex">
              <span className="text-sm text-muted">Quantity</span>
              <QuantitySelector value={qty} max={maxQty} onChange={setQty} />
            </div>
          )}
          <div className="mt-5 hidden gap-3 md:flex">
            <Button className="btn-primary flex-1 py-3" loading={busy} disabled={out} onClick={() => handleAdd(false)}>
              <Icon name="cart" className="h-4 w-4" /> Add to cart
            </Button>
            <Button className="btn-secondary flex-1 py-3" disabled={out || busy} onClick={() => handleAdd(true)}>Buy now</Button>
            <button type="button" onClick={() => toggleWish(product)} className={`btn-outline px-3 ${wished ? 'text-danger' : ''}`} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wished}>
              <Icon name="heart" filled={wished} />
            </button>
          </div>

          <ul className="mt-6 grid gap-3 rounded-lg border border-line bg-surface p-4 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2"><Icon name="truck" className="h-5 w-5 text-primary" /> {product.price >= 999 ? 'Free delivery' : 'Delivery ₹49'}</li>
            <li className="flex items-center gap-2"><Icon name="refresh" className="h-5 w-5 text-primary" /> 7-day returns</li>
            <li className="flex items-center gap-2"><Icon name="shield" className="h-5 w-5 text-primary" /> Secure payment</li>
          </ul>

          {product.highlights?.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 font-semibold text-fg">Highlights</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-fg">
                {product.highlights.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </section>
          )}
          <section className="mt-6">
            <h2 className="mb-2 font-semibold text-fg">Description</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-fg">{product.description}</p>
          </section>
          {product.specifications?.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 font-semibold text-fg">Specifications</h2>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-sm">
                  <tbody>
                    {product.specifications.map((s) => (
                      <tr key={s.label} className="border-b border-line last:border-0">
                        <th scope="row" className="w-2/5 bg-subtle px-3 py-2 text-left font-medium text-muted">{s.label}</th>
                        <td className="px-3 py-2 text-fg">{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      <Reviews product={product} />
      <ProductRail title="You may also like" products={related} />

      {/* Sticky add-to-cart on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-surface p-3 md:hidden">
        <button type="button" onClick={() => toggleWish(product)} className={`btn-outline px-3 ${wished ? 'text-danger' : ''}`} aria-label="Wishlist">
          <Icon name="heart" filled={wished} />
        </button>
        <Button className="btn-outline flex-1" loading={busy} disabled={out} onClick={() => handleAdd(false)}>Add to cart</Button>
        <Button className="btn-primary flex-1" disabled={out || busy} onClick={() => handleAdd(true)}>{out ? 'Out of stock' : 'Buy now'}</Button>
      </div>
    </div>
  );
}
