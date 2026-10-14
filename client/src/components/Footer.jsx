// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Link } from 'react-router-dom';

export function Footer({ categories }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-page grid gap-8 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-semibold text-fg">OrderIt</p>
          <p className="mt-2 max-w-xs text-muted">Everyday electronics, appliances and fashion at honest prices, delivered across India.</p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-fg">Shop</p>
          <ul className="space-y-2 text-muted">
            {categories.map((c) => (
              <li key={c._id}><Link to={`/category/${c.slug}`} className="hover:text-primary">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-fg">Your account</p>
          <ul className="space-y-2 text-muted">
            <li><Link to="/orders" className="hover:text-primary">Orders &amp; tracking</Link></li>
            <li><Link to="/wishlist" className="hover:text-primary">Wishlist</Link></li>
            <li><Link to="/account" className="hover:text-primary">Profile &amp; addresses</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-fg">Help</p>
          <ul className="space-y-2 text-muted">
            <li>Free shipping on orders above ₹999</li>
            <li>7-day easy returns</li>
            <li>Secure payments via Razorpay or COD</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} OrderIt. Designed &amp; developed by{' '}
        <a href="https://github.com/Saipavanavsp" target="_blank" rel="noreferrer" className="font-medium text-fg hover:text-primary">Sai Pavan</a>.
        BTech capstone project - product data from public datasets for educational use.
      </div>
    </footer>
  );
}
