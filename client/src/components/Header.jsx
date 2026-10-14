// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from './Icon.jsx';
import { SearchBar } from './SearchBar.jsx';
import { logout } from '../store/authSlice.js';
import { resetCart, selectCartCount } from '../store/cartSlice.js';
import { resetWishlist } from '../store/wishlistSlice.js';
import { useTheme } from '../context/contexts.js';
import { useToast } from '../context/contexts.js';
import { useClickOutside } from '../hooks/index.js';

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="OrderIt home">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-semibold tracking-tight text-fg">OrderIt</span>
    </Link>
  );
}

function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const signOut = async () => {
    setOpen(false);
    await dispatch(logout());
    dispatch(resetCart());
    dispatch(resetWishlist());
    toast.success('You have been logged out');
    navigate('/');
  };

  const link = 'flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-subtle';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost px-2" aria-haspopup="menu" aria-expanded={open}>
        <Icon name="user" />
        <span className="hidden max-w-24 truncate lg:inline">{user.name.split(' ')[0]}</span>
        <Icon name="chevron-down" className="hidden h-4 w-4 lg:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop">
          <p className="truncate border-b border-line px-3 py-2 text-xs text-muted">{user.email}</p>
          <Link role="menuitem" to="/account" className={link} onClick={() => setOpen(false)}><Icon name="user" className="h-4 w-4" /> My profile</Link>
          <Link role="menuitem" to="/orders" className={link} onClick={() => setOpen(false)}><Icon name="package" className="h-4 w-4" /> My orders</Link>
          <Link role="menuitem" to="/wishlist" className={link} onClick={() => setOpen(false)}><Icon name="heart" className="h-4 w-4" /> Wishlist</Link>
          <button role="menuitem" type="button" className={`${link} w-full border-t border-line`} onClick={signOut}><Icon name="logout" className="h-4 w-4" /> Log out</button>
        </div>
      )}
    </div>
  );
}

export function Header({ categories }) {
  const user = useSelector((s) => s.auth.user);
  const cartCount = useSelector(selectCartCount);
  const wishCount = useSelector((s) => s.wishlist.ids.length);
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="container-page flex h-16 items-center gap-3">
        <button type="button" className="btn-ghost px-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <Logo />
        <SearchBar className="mx-2 hidden flex-1 md:block lg:mx-8" />
        <nav className="ml-auto flex items-center gap-1" aria-label="Account">
          <button type="button" onClick={toggle} className="btn-ghost px-2" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <Link to="/wishlist" className="btn-ghost relative hidden px-2 sm:inline-flex" aria-label={`Wishlist (${wishCount} items)`}>
            <Icon name="heart" />
            {wishCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-white">{wishCount}</span>}
          </Link>
          <Link to="/cart" className="btn-ghost relative px-2" aria-label={`Cart (${cartCount} items)`}>
            <Icon name="cart" />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">{cartCount}</span>}
            <span className="hidden lg:inline">Cart</span>
          </Link>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link to="/login" className="btn-primary ml-1 px-3">Log in</Link>
          )}
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <SearchBar />
      </div>
      <nav className="hidden border-t border-line md:block" aria-label="Categories">
        <ul className="container-page flex h-11 items-center gap-6 overflow-x-auto text-sm">
          <li>
            <NavLink to="/products" end className={({ isActive }) => `whitespace-nowrap font-medium ${isActive ? 'text-primary' : 'text-muted hover:text-fg'}`}>All products</NavLink>
          </li>
          {categories.map((c) => (
            <li key={c._id}>
              <NavLink to={`/category/${c.slug}`} className={({ isActive }) => `whitespace-nowrap font-medium ${isActive ? 'text-primary' : 'text-muted hover:text-fg'}`}>{c.name}</NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface p-4 shadow-pop">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button type="button" className="btn-ghost px-2" onClick={() => setMobileOpen(false)} aria-label="Close menu"><Icon name="x" /></button>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Shop by category</p>
            <ul className="space-y-1">
              <li><Link to="/products" onClick={() => setMobileOpen(false)} className="block rounded px-2 py-2 text-sm hover:bg-subtle">All products</Link></li>
              {categories.map((c) => (
                <li key={c._id}><Link to={`/category/${c.slug}`} onClick={() => setMobileOpen(false)} className="block rounded px-2 py-2 text-sm hover:bg-subtle">{c.name}</Link></li>
              ))}
            </ul>
            <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
            <ul className="space-y-1 text-sm">
              {[['/orders', 'My orders'], ['/wishlist', 'Wishlist'], ['/account', 'Profile']].map(([to, label]) => (
                <li key={to}><Link to={to} onClick={() => setMobileOpen(false)} className="block rounded px-2 py-2 hover:bg-subtle">{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}
