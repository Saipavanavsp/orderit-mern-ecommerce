// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { createAsyncThunk, createSlice, isFulfilled, isPending, isRejected } from '@reduxjs/toolkit';
import { shopApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';

// Every cart mutation returns the server-computed cart (prices, coupon, totals).
const cartThunk = (type, call) =>
  createAsyncThunk(`cart/${type}`, async (arg, { rejectWithValue }) => {
    try {
      return (await call(arg)).data.cart;
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  });

export const fetchCart = cartThunk('fetch', () => shopApi.cart());
export const addToCart = cartThunk('add', ({ productId, quantity }) => shopApi.addToCart(productId, quantity));
export const updateCartItem = cartThunk('update', ({ productId, quantity }) => shopApi.updateCartItem(productId, quantity));
export const removeCartItem = cartThunk('remove', (productId) => shopApi.removeCartItem(productId));
export const applyCoupon = cartThunk('applyCoupon', (code) => shopApi.applyCoupon(code));
export const removeCoupon = cartThunk('removeCoupon', () => shopApi.removeCoupon());

const CART_THUNKS = [fetchCart, addToCart, updateCartItem, removeCartItem, applyCoupon, removeCoupon];

const cartSlice = createSlice({
  name: 'cart',
  initialState: { cart: null, loading: false, pending: {} },
  reducers: {
    resetCart(state) {
      state.cart = null;
    },
  },
  extraReducers: (b) => {
    // Specific cases first (RTK allows one case reducer per action type) ...
    b.addCase(fetchCart.pending, (s) => {
      s.loading = !s.cart;
    }).addCase(fetchCart.rejected, (s) => {
      s.loading = false;
    });
    // ... then matchers shared by every cart thunk.
    b.addMatcher(isPending(...CART_THUNKS), (s, a) => {
      s.pending[a.meta.requestId] = true;
    })
      .addMatcher(isFulfilled(...CART_THUNKS), (s, a) => {
        s.cart = a.payload;
        s.loading = false;
        delete s.pending[a.meta.requestId];
      })
      .addMatcher(isRejected(...CART_THUNKS), (s, a) => {
        delete s.pending[a.meta.requestId];
      });
  },
});

export const { resetCart } = cartSlice.actions;
export const selectCartCount = (state) => state.cart.cart?.itemCount || 0;
export const selectCartBusy = (state) => Object.keys(state.cart.pending).length > 0;
export default cartSlice.reducer;
