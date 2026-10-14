import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { shopApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';

export const fetchWishlist = createAsyncThunk('wishlist/fetch', async () => (await shopApi.wishlist()).data);

export const toggleWishlist = createAsyncThunk('wishlist/toggle', async ({ productId, inWishlist }, { rejectWithValue }) => {
  try {
    const res = inWishlist ? await shopApi.removeFromWishlist(productId) : await shopApi.addToWishlist(productId);
    return res.data;
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: { products: [], ids: [], loaded: false },
  reducers: {
    resetWishlist(state) {
      state.products = [];
      state.ids = [];
      state.loaded = false;
    },
  },
  extraReducers: (b) => {
    const set = (s, a) => {
      s.products = a.payload.products;
      s.ids = a.payload.products.map((p) => p._id);
      s.loaded = true;
    };
    b.addCase(fetchWishlist.fulfilled, set).addCase(toggleWishlist.fulfilled, set);
  },
});

export const { resetWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
