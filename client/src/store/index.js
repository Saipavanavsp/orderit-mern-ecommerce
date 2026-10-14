// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice.js';
import cart from './cartSlice.js';
import wishlist from './wishlistSlice.js';

export const store = configureStore({ reducer: { auth, cart, wishlist } });
