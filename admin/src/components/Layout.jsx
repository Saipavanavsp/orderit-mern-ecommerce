// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/index.js';
import { useTheme, useToast } from '../context/contexts.js';
import { Icon } from './Icon.jsx';
import { Spinner } from './ui.jsx';

const NAV = [
  ['/', 'Dashboard', 'dashboard'],
  ['/analytics', 'Sales analytics', 'chart'],
  ['/orders', 'Orders', 'package'],
  ['/products', 'Products', 'tag'],
  ['/inventory', 'Inventory', 'layers'],
  ['/categories', 'Categories', 'grid'],
  ['/brands', 'Brands', 'shield'],
  ['/users', 'Users', 'users'],
  ['/reviews', 'Reviews', 'star'],
  ['/coupons', 'Coupons', 'ticket'],
];

function Sidebar({ onNavigate }) {
  return (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-line px-5">
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <div>
          <p className="font-semibold leading-tight text-fg">OrderIt</p>
          <p className="text-xs text-muted">Admin console</p>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(([to, label, icon]) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-3 rounded px-3 py-2 text-sm ${isActive ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary/20 dark:text-fg' : 'text-fg hover:bg-subtle'}`}>
              <Icon name={icon} className="h-4 w-4" /> {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        Developed by{' '}
        <a href="https://github.com/Saipavanavsp" target="_blank" rel="noreferrer" className="font-medium text-fg hover:text-primary">Sai Pavan</a>
      </p>
    </nav>
  );
}

export function AdminLayout() {
  const { user, status } = useSelector((s) => s.auth);
  const { theme, toggle } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (status !== 'ready') return <div className="flex min-h-screen items-center justify-center text-muted"><Spinner className="h-6 w-6" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-surface lg:block"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface shadow-pop"><Sidebar onNavigate={() => setOpen(false)} /></aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <button type="button" className="btn-ghost px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn-ghost px-2" onClick={toggle} aria-label="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
            <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
            <button
              type="button"
              className="btn-outline"
              onClick={async () => {
                await dispatch(logout());
                toast.success('Signed out');
                navigate('/login');
              }}
            >
              <Icon name="logout" className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
