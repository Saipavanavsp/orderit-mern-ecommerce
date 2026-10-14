import { Icon } from './Icon.jsx';

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

export function Field({ label, error, hint, id, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = 'primary' }) {
  const tones = { primary: 'bg-primary-50 text-primary', secondary: 'bg-secondary-50 text-secondary', warning: 'bg-warning-50 text-warning', danger: 'bg-danger-50 text-danger' };
  return (
    <div className="card flex items-start gap-4 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon name={icon} className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-fg">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'package', title, message, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted"><Icon name={icon} className="h-6 w-6" /></span>
      <p className="font-semibold text-fg">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center" role="alert">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger"><Icon name="alert" className="h-6 w-6" /></span>
      <p className="font-semibold text-fg">Could not load data</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && <button type="button" className="btn-outline mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Pagination({ meta, onChange }) {
  if (!meta || meta.pages <= 1) return null;
  const { page, pages, total, limit } = meta;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
      <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
      <div className="flex gap-2">
        <button type="button" className="btn-outline px-3 py-1" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span className="self-center">Page {page} of {pages}</span>
        <button type="button" className="btn-outline px-3 py-1" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function StatusBadge({ status, styles }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] || 'bg-subtle text-muted'}`}>{status}</span>;
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-line">
          {Array.from({ length: cols }, (__, c) => (
            <td key={c} className="px-4 py-3"><div className="skeleton h-4 w-full" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-line'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Thumb({ src, alt = '' }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-line bg-white p-0.5">
      {src ? <img src={src} alt={alt} referrerPolicy="no-referrer" className="h-full w-full object-contain" loading="lazy" /> : <Icon name="package" className="h-full w-full text-muted" />}
    </div>
  );
}
