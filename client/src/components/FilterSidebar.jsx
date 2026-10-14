// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useEffect, useState } from 'react';
import { formatPrice } from '../utils/format.js';

const PRICE_BANDS = [
  [0, 1000],
  [1000, 5000],
  [5000, 15000],
  [15000, 30000],
  [30000, 60000],
  [60000, null],
];

function Section({ title, children }) {
  return (
    <fieldset className="border-b border-line py-4 last:border-0">
      <legend className="mb-3 text-sm font-semibold text-fg">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Controlled by URL params; `onChange(patch)` merges into the search params. */
export function FilterSidebar({ params, facets, onChange, onClear }) {
  const selectedBrands = (params.get('brand') || '').split(',').filter(Boolean);
  const [minPrice, setMinPrice] = useState(params.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') || '');

  useEffect(() => {
    setMinPrice(params.get('minPrice') || '');
    setMaxPrice(params.get('maxPrice') || '');
  }, [params]);

  const toggleBrand = (slug) => {
    const next = selectedBrands.includes(slug) ? selectedBrands.filter((b) => b !== slug) : [...selectedBrands, slug];
    onChange({ brand: next.join(',') || null });
  };

  const applyPrice = (e) => {
    e.preventDefault();
    onChange({ minPrice: minPrice || null, maxPrice: maxPrice || null });
  };

  const priceInvalid = minPrice && maxPrice && Number(minPrice) > Number(maxPrice);

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-semibold text-fg">Filters</h2>
        <button type="button" onClick={onClear} className="text-xs font-medium text-primary hover:underline">Clear all</button>
      </div>

      {facets?.brands?.length > 0 && (
        <Section title="Brand">
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {facets.brands.map((b) => (
              <li key={b.slug}>
                <label className="flex cursor-pointer items-center gap-2 text-fg">
                  <input type="checkbox" className="h-4 w-4 rounded border-line accent-primary" checked={selectedBrands.includes(b.slug)} onChange={() => toggleBrand(b.slug)} />
                  <span className="flex-1">{b.name}</span>
                  <span className="text-xs text-muted">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Price">
        <ul className="mb-3 space-y-1.5">
          {PRICE_BANDS.map(([lo, hi]) => {
            const active = params.get('minPrice') === String(lo || '') && params.get('maxPrice') === String(hi || '');
            return (
              <li key={lo}>
                <button
                  type="button"
                  className={`text-left hover:text-primary ${active ? 'font-semibold text-primary' : 'text-fg'}`}
                  onClick={() => onChange({ minPrice: lo ? String(lo) : null, maxPrice: hi ? String(hi) : null })}
                >
                  {hi ? `${lo ? formatPrice(lo) : 'Under'} ${lo ? '–' : ''} ${formatPrice(hi)}` : `Above ${formatPrice(lo)}`}
                </button>
              </li>
            );
          })}
        </ul>
        <form onSubmit={applyPrice} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="f-min">Minimum price</label>
          <input id="f-min" className="input px-2" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ''))} />
          <span className="text-muted">to</span>
          <label className="sr-only" htmlFor="f-max">Maximum price</label>
          <input id="f-max" className="input px-2" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))} />
          <button type="submit" className="btn-outline px-3" disabled={priceInvalid}>Go</button>
        </form>
        {priceInvalid && <p className="field-error">Min price must be below max price</p>}
        {facets?.priceRange?.max > 0 && (
          <p className="mt-2 text-xs text-muted">Range in this view: {formatPrice(facets.priceRange.min)} – {formatPrice(facets.priceRange.max)}</p>
        )}
      </Section>

      <Section title="Customer rating">
        {[4, 3].map((r) => (
          <label key={r} className="mb-2 flex cursor-pointer items-center gap-2 text-fg">
            <input type="radio" name="rating" className="h-4 w-4 accent-primary" checked={params.get('rating') === String(r)} onChange={() => onChange({ rating: String(r) })} />
            {r}★ & above
          </label>
        ))}
        {params.get('rating') && <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange({ rating: null })}>Any rating</button>}
      </Section>

      <Section title="Discount">
        {[10, 20, 30].map((d) => (
          <label key={d} className="mb-2 flex cursor-pointer items-center gap-2 text-fg">
            <input type="radio" name="discount" className="h-4 w-4 accent-primary" checked={params.get('minDiscount') === String(d)} onChange={() => onChange({ minDiscount: String(d) })} />
            {d}% or more
          </label>
        ))}
        {params.get('minDiscount') && <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange({ minDiscount: null })}>Any discount</button>}
      </Section>

      <Section title="Availability">
        <label className="flex cursor-pointer items-center gap-2 text-fg">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={params.get('inStock') === 'true'} onChange={(e) => onChange({ inStock: e.target.checked ? 'true' : null })} />
          In stock only
        </label>
      </Section>
    </div>
  );
}
