import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice.js';
import cart from './cartSlice.js';
import wishlist from './wishlistSlice.js';

export const store = configureStore({ reducer: { auth, cart, wishlist } });
