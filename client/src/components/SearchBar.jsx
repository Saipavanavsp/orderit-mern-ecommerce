import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { catalogApi } from '../services/index.js';
import { useClickOutside, useDebounce } from '../hooks/index.js';
import { formatPrice } from '../utils/format.js';

export function SearchBar({ className = '', onDone }) {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [active, setActive] = useState(-1);
  const debounced = useDebounce(query.trim(), 200);
  const navigate = useNavigate();
  const boxRef = useRef(null);
  useClickOutside(boxRef, () => setOpen(false));

  useEffect(() => {
    let cancelled = false;
    if (debounced.length < 2) {
      setData(null);
      return undefined;
    }
    catalogApi
      .suggestions(debounced)
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const items = data
    ? [
        ...data.products.map((p) => ({ type: 'product', label: p.name, sub: formatPrice(p.price), image: p.image, to: `/product/${p.slug}` })),
        ...data.categories.map((c) => ({ type: 'category', label: c.name, sub: 'Category', to: `/category/${c.slug}` })),
        ...data.brands.map((b) => ({ type: 'brand', label: b.name, sub: 'Brand', to: `/products?brand=${b.slug}` })),
      ]
    : [];

  const go = (to) => {
    setOpen(false);
    setActive(-1);
    navigate(to);
    onDone?.();
  };

  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(items[active].to);
    const q = query.trim();
    if (q) go(`/search?q=${encodeURIComponent(q)}`);
    return undefined;
  };

  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submit} role="search">
        <label htmlFor="site-search" className="sr-only">Search products</label>
        <input
          id="site-search"
          type="search"
          value={query}
          autoComplete="off"
          placeholder='Search, or try "phone under 20000 with good camera"'
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="input h-10 pr-10"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
        />
        <button type="submit" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded text-muted hover:text-primary" aria-label="Search">
          <Icon name="search" className="h-4 w-4" />
        </button>
      </form>
      {open && items.length > 0 && (
        <ul id="search-suggestions" role="listbox" className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop">
          {items.map((item, i) => (
            <li key={`${item.type}-${item.to}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(item.to)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-subtle' : 'hover:bg-subtle'}`}
              >
                {item.image ? (
                  <img src={item.image} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded bg-white object-contain" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-subtle text-muted">
                    <Icon name={item.type === 'category' ? 'grid' : 'tag'} className="h-4 w-4" />
                  </span>
                )}
                <span className="line-clamp-1 flex-1 text-fg">{item.label}</span>
                <span className="shrink-0 text-xs text-muted">{item.sub}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-line">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)} className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-subtle">
              See all results for “{query.trim()}”
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
