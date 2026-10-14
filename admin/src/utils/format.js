// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPrice = (n) => inr.format(Math.round(n || 0));
export const formatAmount = (n) => inr2.format(n || 0);

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-IN', opts) : '';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const ORDER_STATUS_STYLES = {
  pending: 'bg-warning-50 text-warning',
  processing: 'bg-primary-50 text-primary-700',
  shipped: 'bg-secondary-50 text-secondary-700',
  delivered: 'bg-success-50 text-success',
  cancelled: 'bg-danger-50 text-danger',
};

export const compactINR = (v) => {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
  return `₹${v}`;
};

export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const capitalize = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

export const ACTIVE_STYLES = { active: 'bg-success-50 text-success', inactive: 'bg-subtle text-muted' };
