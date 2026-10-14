// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { addToCart } from '../store/cartSlice.js';
import { toggleWishlist } from '../store/wishlistSlice.js';
import { useToast } from '../context/contexts.js';

/** Cart / wishlist actions that redirect guests to login and report results with toasts. */
export function useShopActions() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const user = useSelector((s) => s.auth.user);
  const wishlistIds = useSelector((s) => s.wishlist.ids);

  const requireLogin = useCallback(() => {
    if (user) return false;
    toast.info('Please log in to continue');
    navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
    return true;
  }, [user, toast, navigate, location]);

  const add = useCallback(
    async (product, quantity = 1, { goToCart = false } = {}) => {
      if (requireLogin()) return false;
      const res = await dispatch(addToCart({ productId: product._id, quantity }));
      if (addToCart.fulfilled.match(res)) {
        toast.success(`${product.name.length > 40 ? `${product.name.slice(0, 40)}…` : product.name} added to cart`);
        if (goToCart) navigate('/cart');
        return true;
      }
      toast.error(res.payload || 'Could not add to cart');
      return false;
    },
    [dispatch, navigate, requireLogin, toast],
  );

  const toggleWish = useCallback(
    async (product) => {
      if (requireLogin()) return;
      const inWishlist = wishlistIds.includes(product._id);
      const res = await dispatch(toggleWishlist({ productId: product._id, inWishlist }));
      if (toggleWishlist.fulfilled.match(res)) toast.success(inWishlist ? 'Removed from wishlist' : 'Saved to wishlist');
      else toast.error(res.payload || 'Could not update wishlist');
    },
    [dispatch, requireLogin, toast, wishlistIds],
  );

  return { add, toggleWish, isWished: (id) => wishlistIds.includes(id), user };
}
