// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';

export const loadSession = createAsyncThunk(
  'auth/loadSession',
  async () => {
    try {
      return (await authApi.session()).data.user; // null for guests (always HTTP 200)
    } catch {
      return null;
    }
  },
  // Never run two session bootstraps at once (React StrictMode mounts effects twice in dev).
  { condition: (_, { getState }) => getState().auth.status !== 'loading' },
);

export const login = createAsyncThunk('auth/login', async (body, { rejectWithValue }) => {
  try {
    return (await authApi.login(body)).data.user;
  } catch (err) {
    return rejectWithValue({ message: errorMessage(err), status: err.response?.status });
  }
});

export const register = createAsyncThunk('auth/register', async (body, { rejectWithValue }) => {
  try {
    return (await authApi.register(body)).data.user;
  } catch (err) {
    const errors = err.response?.data?.errors || [];
    return rejectWithValue({ message: errorMessage(err), fields: Object.fromEntries(errors.map((e) => [e.field, e.message])) });
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } catch {
    // session may already be gone; clear local state anyway
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'idle' }, // idle -> loading -> ready
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
    },
    sessionExpired(state) {
      state.user = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(loadSession.pending, (s) => {
      s.status = 'loading';
    })
      .addCase(loadSession.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'ready';
      })
      .addCase(login.fulfilled, (s, a) => {
        s.user = a.payload;
      })
      .addCase(register.fulfilled, (s, a) => {
        s.user = a.payload;
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
      });
  },
});

export const { setUser, sessionExpired } = authSlice.actions;
export default authSlice.reducer;
