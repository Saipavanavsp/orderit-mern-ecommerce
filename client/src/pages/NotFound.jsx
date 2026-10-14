// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/index.js';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <p className="text-6xl font-semibold text-line">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-fg">We could not find that page</h1>
      <p className="mt-2 max-w-md text-sm text-muted">The link may be broken or the product may no longer be available.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-primary">Go to home</Link>
        <Link to="/products" className="btn-outline">Browse products</Link>
      </div>
    </div>
  );
}
