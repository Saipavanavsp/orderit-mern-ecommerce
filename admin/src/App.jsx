// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loadSession, sessionExpired } from './store/index.js';
import { setSessionExpiredHandler } from './services/api.js';
import { AdminLayout } from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const ProductForm = lazy(() => import('./pages/ProductForm.jsx'));
const OrdersList = lazy(() => import('./pages/Orders.jsx').then((m) => ({ default: m.OrdersList })));
const OrderDetail = lazy(() => import('./pages/Orders.jsx').then((m) => ({ default: m.OrderDetail })));
const Users = lazy(() => import('./pages/Users.jsx'));
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const Coupons = lazy(() => import('./pages/Coupons.jsx'));
const Inventory = lazy(() => import('./pages/Inventory.jsx'));
const Categories = lazy(() => import('./pages/Taxonomy.jsx').then((m) => ({ default: m.Categories })));
const Brands = lazy(() => import('./pages/Taxonomy.jsx').then((m) => ({ default: m.Brands })));

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-semibold text-line">404</p>
      <p className="mt-3 text-fg">This admin page does not exist.</p>
      <Link to="/" className="btn-primary mt-5">Back to dashboard</Link>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  useEffect(() => {
    setSessionExpiredHandler(() => dispatch(sessionExpired()));
    dispatch(loadSession());
  }, [dispatch]);

  return (
    <Suspense fallback={<div className="flex justify-center py-24 text-muted"><Spinner className="h-6 w-6" /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductForm />} />
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="users" element={<Users />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="categories" element={<Categories />} />
          <Route path="brands" element={<Brands />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
