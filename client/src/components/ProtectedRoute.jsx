import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from './ui.jsx';
import { safeRedirect } from '../utils/redirect.js';

export function ProtectedRoute() {
  const { user, status } = useSelector((s) => s.auth);
  const location = useLocation();
  if (status !== 'ready') {
    return (
      <div className="flex justify-center py-24 text-muted"><Spinner className="h-6 w-6" /></div>
    );
  }
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

/** Keeps logged-in users away from login/register. */
export function GuestRoute() {
  const { user, status } = useSelector((s) => s.auth);
  const params = new URLSearchParams(useLocation().search);
  if (status === 'ready' && user) return <Navigate to={safeRedirect(params.get('redirect'))} replace />;
  return <Outlet />;
}
