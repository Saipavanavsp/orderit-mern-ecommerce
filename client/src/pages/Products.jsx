import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { catalogApi, aiApi } from '../services/index.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { ProductGrid } from '../components/ProductCard.jsx';
import { FilterSidebar } from '../components/FilterSidebar.jsx';
import { Breadcrumbs, EmptyState, ErrorState, GridSkeleton, Pagination } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { formatPrice } from '../utils/format.js';

const SORTS = [
  ['relevance', 'Relevance'],
  ['popularity', 'Popularity'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Customer rating'],
  ['newest', 'Newest first'],
  ['discount', 'Biggest discount'],
];
const FILTER_KEYS = ['brand', 'minPrice', 'maxPrice', 'rating', 'inStock', 'minDiscount', 'featured'];

// Phrases that signal a natural-language query ("phone under 20000 with good camera").
const NL_PATTERN = /\b(under|below|above|over|between|less than|more than|upto|up to|within|budget|cheapest|best|rated|stars?)\b|\b\d+\s?k\b|\d{4,}/i;

function InterpretedChips({ interpreted }) {
  if (!interpreted) return null;
  const chips = [
    interpreted.category?.[0] && `Category: ${interpreted.category[0].replace(/-and-/g, ' & ').replace(/-/g, ' ')}`,
    interpreted.subCategory && `Type: ${interpreted.subCategory}`,
    interpreted.brand?.length && `Brand: ${interpreted.brand.join(', ')}`,
    interpreted.minPrice && `Above ${formatPrice(interpreted.minPrice)}`,
    interpreted.maxPrice && `Under ${formatPrice(interpreted.maxPrice)}`,
    interpreted.rating && `${interpreted.rating}★ & above`,
    interpreted.keywords?.length && `Keywords: ${interpreted.keywords.join(', ')}`,
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50/60 p-3 text-sm">
      <p className="mb-2 font-medium text-primary-800">We understood your search as:</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => <span key={c} className="chip capitalize">{c}</span>)}
      </div>
      {interpreted.relaxed && <p className="mt-2 text-xs text-muted">No exact keyword match, showing the closest products for these filters.</p>}
    </div>
  );
}

export default function Products({ mode = 'all' }) {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const q = params.get('q') || '';
  const page = Number(params.get('page') || 1);
  const sort = params.get('sort') || 'relevance';
  const useNl = mode === 'search' && NL_PATTERN.test(q) && !params.get('exact');

  const { data: category } = useAsync(
    () => (mode === 'category' ? catalogApi.category(slug).then((r) => r.data.category) : Promise.resolve(null)),
    [mode, slug],
  );

  const key = `${mode}|${slug}|${params.toString()}`;
  const { data, loading, error, reload } = useAsync(async () => {
    if (useNl) {
      const res = await aiApi.search({ q, page, limit: 12 });
      return { products: res.data.products, meta: res.meta, interpreted: res.data.interpreted };
    }
    const query = { page, limit: 12, sort, facets: true };
    for (const k of FILTER_KEYS) if (params.get(k)) query[k] = params.get(k);
    if (mode === 'category') query.category = slug;
    else if (params.get('category')) query.category = params.get('category');
    if (q) query.search = q;
    const res = await catalogApi.products(query);
    return { products: res.data.products, meta: res.meta, facets: res.data.facets };
  }, [key]);

  const title = mode === 'category' ? category?.name || 'Category' : mode === 'search' ? `Results for “${q}”` : 'All products';
  useDocumentTitle(mode === 'search' ? `Search: ${q}` : title);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === '' ? next.delete(k) : next.set(k, v)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const clearFilters = () => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    setParams(next);
  };
  const activeFilters = FILTER_KEYS.filter((k) => params.get(k)).length;

  const sidebar = !useNl && (
    <FilterSidebar params={params} facets={data?.facets} onChange={update} onClear={clearFilters} />
  );

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={mode === 'category' ? [{ label: title }] : [{ label: mode === 'search' ? 'Search' : 'Products' }]} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{title}</h1>
          {category?.description && <p className="mt-1 max-w-2xl text-sm text-muted">{category.description}</p>}
          {data?.meta && <p className="mt-1 text-sm text-muted">{data.meta.total.toLocaleString('en-IN')} products</p>}
        </div>
        <div className="flex items-center gap-2">
          {sidebar && (
            <button type="button" className="btn-outline lg:hidden" onClick={() => setDrawer(true)}>
              <Icon name="filter" className="h-4 w-4" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
            </button>
          )}
          {!useNl && (
            <>
              <label htmlFor="sort" className="hidden text-sm text-muted sm:block">Sort by</label>
              <select id="sort" className="input w-auto" value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {useNl && (
        <p className="mb-3 text-sm text-muted">
          Smart search is on. <Link className="text-primary hover:underline" to={`/search?q=${encodeURIComponent(q)}&exact=1`}>Search for the exact words instead</Link>
        </p>
      )}
      <InterpretedChips interpreted={data?.interpreted} />

      <div className="flex gap-6">
        {sidebar && <aside className="sticky top-32 hidden max-h-[calc(100vh-9rem)] w-64 shrink-0 self-start overflow-y-auto rounded-lg border border-line bg-surface p-4 lg:block">{sidebar}</aside>}
        <div className="min-w-0 flex-1">
          {loading && <GridSkeleton count={12} />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && data?.products.length === 0 && (
            <EmptyState
              icon="search"
              title="No products match"
              message="Try removing a filter, widening the price range or searching for something more general."
              action={activeFilters ? <button type="button" className="btn-primary" onClick={clearFilters}>Clear filters</button> : <Link to="/products" className="btn-primary">Browse all products</Link>}
            />
          )}
          {!loading && !error && data?.products.length > 0 && (
            <>
              <ProductGrid products={data.products} />
              <Pagination page={page} pages={data.meta?.pages} onChange={(p) => update({ page: String(p) })} />
            </>
          )}
        </div>
      </div>

      {drawer && sidebar && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-full flex-col bg-surface shadow-pop">
            <div className="flex-1 overflow-y-auto p-4">{sidebar}</div>
            <div className="border-t border-line p-4">
              <button type="button" className="btn-primary w-full" onClick={() => setDrawer(false)}>Show {data?.meta?.total ?? ''} results</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
