// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { Price, RatingBadge } from './ui.jsx';
import { useShopActions } from '../hooks/useShopActions.js';

export function ProductImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-subtle text-muted ${className}`}>
        <Icon name="package" className="h-10 w-10" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`product-img ${className}`}
    />
  );
}

function ProductCardBase({ product }) {
  const { add, toggleWish, isWished } = useShopActions();
  const [adding, setAdding] = useState(false);
  const wished = isWished(product._id);
  const out = product.stock === 0;

  return (
    <article className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <button
        type="button"
        onClick={() => toggleWish(product)}
        className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface ${wished ? 'text-danger' : 'text-muted hover:text-fg'}`}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wished}
      >
        <Icon name="heart" className="h-4 w-4" filled={wished} />
      </button>
      <Link to={`/product/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square bg-white p-4">
          <ProductImage src={product.images?.[0]?.url} alt={product.images?.[0]?.alt || product.name} />
          {product.discountPercent >= 10 && !out && (
            <span className="absolute left-2 top-2 rounded bg-primary-50 px-1.5 py-0.5 text-xs font-semibold text-primary-700">
              {product.discountPercent}% off
            </span>
          )}
          {out && (
            <span className="absolute inset-x-0 bottom-0 bg-slate-800/75 py-1 text-center text-xs font-medium text-white">Out of stock</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          {product.brand?.name && <p className="text-xs font-medium uppercase tracking-wide text-muted">{product.brand.name}</p>}
          <h3 className="line-clamp-2 text-sm text-fg group-hover:text-primary">{product.name}</h3>
          <div className="flex items-center gap-2">
            <RatingBadge value={product.rating} />
            {product.numReviews > 0 && <span className="text-xs text-muted">({product.numReviews})</span>}
          </div>
          <div className="mt-auto pt-1">
            <Price price={product.price} mrp={product.mrp} discountPercent={product.discountPercent} />
          </div>
          {product.isLowStock && <p className="text-xs font-medium text-warning">Only {product.stock} left</p>}
        </div>
      </Link>
      <div className="px-3 pb-3">
        <button
          type="button"
          className="btn-outline w-full"
          disabled={out || adding}
          onClick={async () => {
            setAdding(true);
            await add(product);
            setAdding(false);
          }}
        >
          <Icon name="cart" className="h-4 w-4" />
          {out ? 'Unavailable' : adding ? 'Adding…' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

export const ProductCard = memo(ProductCardBase);

export function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  );
}

export function ProductRail({ title, products, to }) {
  if (!products?.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-semibold text-fg">{title}</h2>
        {to && (
          <Link to={to} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View all <Icon name="chevron-right" className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {products.slice(0, 8).map((p) => (
          <div key={p._id} className="w-44 shrink-0 snap-start sm:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
