import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { formatPrice } from '../utils/format.js';

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({ loading, children, className = 'btn-primary', ...props }) {
  return (
    <button className={className} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, id, children }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function RatingStars({ value = 0, size = 'h-4 w-4', showValue = false, count }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative">
            <Icon name="star" className={`${size} text-line`} filled />
            {rounded >= i - 0.5 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: rounded >= i ? '100%' : '50%' }}>
                <Icon name="star" className={`${size} text-secondary`} filled />
              </span>
            )}
          </span>
        ))}
      </span>
      {showValue && <span className="text-sm font-medium text-fg">{value ? value.toFixed(1) : 'New'}</span>}
      {count !== undefined && <span className="text-sm text-muted">({count.toLocaleString('en-IN')})</span>}
    </span>
  );
}

export function RatingBadge({ value }) {
  if (!value) return <span className="text-xs text-muted">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-success px-1.5 py-0.5 text-xs font-semibold text-white">
      {value.toFixed(1)}
      <Icon name="star" className="h-3 w-3" filled />
    </span>
  );
}

export function Price({ price, mrp, discountPercent, size = 'md' }) {
  const big = size === 'lg';
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`${big ? 'text-3xl' : 'text-lg'} font-semibold text-fg`}>{formatPrice(price)}</span>
      {mrp > price && (
        <>
          <span className={`${big ? 'text-base' : 'text-sm'} text-muted line-through`}>{formatPrice(mrp)}</span>
          <span className={`${big ? 'text-base' : 'text-sm'} font-medium text-success`}>{discountPercent}% off</span>
        </>
      )}
    </div>
  );
}

export function EmptyState({ icon = 'package', title, message, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-subtle text-muted">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center" role="alert">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger">
        <Icon name="alert" className="h-6 w-6" />
      </span>
      <h3 className="font-semibold text-fg">We could not load this</h3>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" className="btn-outline mt-5" onClick={onRetry}>
          <Icon name="refresh" className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link to="/" className="hover:text-primary">Home</Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <Icon name="chevron-right" className="h-3.5 w-3.5" />
            {item.to ? (
              <Link to={item.to} className="hover:text-primary">{item.label}</Link>
            ) : (
              <span className="line-clamp-1 text-fg" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i += 1) nums.push(i);
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded border px-2 text-sm';
  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <button type="button" className={`${btn} border-line bg-surface disabled:opacity-40`} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <Icon name="chevron-left" className="h-4 w-4" />
      </button>
      {nums[0] > 1 && <span className="px-1 text-muted">…</span>}
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`${btn} ${n === page ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:bg-subtle'}`}
        >
          {n}
        </button>
      ))}
      {nums[nums.length - 1] < pages && <span className="px-1 text-muted">…</span>}
      <button type="button" className={`${btn} border-line bg-surface disabled:opacity-40`} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <Icon name="chevron-right" className="h-4 w-4" />
      </button>
    </nav>
  );
}

export function QuantitySelector({ value, max = 10, onChange, disabled }) {
  return (
    <div className="inline-flex items-center rounded border border-line bg-surface">
      <button type="button" className="px-2.5 py-1.5 text-muted hover:text-fg disabled:opacity-40" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="Decrease quantity">
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center text-sm font-medium" aria-live="polite">{value}</span>
      <button type="button" className="px-2.5 py-1.5 text-muted hover:text-fg disabled:opacity-40" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function StatusBadge({ status, styles }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] || 'bg-subtle text-muted'}`}>{status}</span>;
}

export function ProductCardSkeleton() {
  return (
    <div className="card p-3">
      <div className="skeleton aspect-square w-full" />
      <div className="skeleton mt-3 h-4 w-3/4" />
      <div className="skeleton mt-2 h-4 w-1/2" />
      <div className="skeleton mt-3 h-5 w-1/3" />
    </div>
  );
}

export function GridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
