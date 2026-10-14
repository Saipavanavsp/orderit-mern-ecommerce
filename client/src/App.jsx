// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadSession, sessionExpired } from './store/authSlice.js';
import { fetchCart, resetCart } from './store/cartSlice.js';
import { fetchWishlist, resetWishlist } from './store/wishlistSlice.js';
import { setSessionExpiredHandler } from './services/api.js';
import { MainLayout, AuthLayout } from './layouts/MainLayout.jsx';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Spinner } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

const Products = lazy(() => import('./pages/Products.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const MyOrders = lazy(() => import('./pages/Orders.jsx').then((m) => ({ default: m.MyOrders })));
const OrderDetail = lazy(() => import('./pages/Orders.jsx').then((m) => ({ default: m.OrderDetail })));
const OrderSuccess = lazy(() => import('./pages/Orders.jsx').then((m) => ({ default: m.OrderSuccess })));
const Login = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.ResetPassword })));

const PageLoader = () => (
  <div className="flex justify-center py-24 text-muted"><Spinner className="h-6 w-6" /></div>
);

export default function App() {
  const dispatch = useDispatch();
  const userId = useSelector((s) => s.auth.user?._id);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      dispatch(sessionExpired());
      dispatch(resetCart());
      dispatch(resetWishlist());
    });
    dispatch(loadSession());
  }, [dispatch]);

  useEffect(() => {
    if (userId) {
      dispatch(fetchCart());
      dispatch(fetchWishlist());
    }
  }, [userId, dispatch]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products mode="all" />} />
          <Route path="category/:slug" element={<Products mode="category" />} />
          <Route path="search" element={<Products mode="search" />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route element={<ProtectedRoute />}>
            <Route path="cart" element={<Cart />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="account" element={<Account />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="order-success/:id" element={<OrderSuccess />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<AuthLayout />}>
          <Route element={<GuestRoute />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
          </Route>
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password/:token" element={<ResetPassword />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
