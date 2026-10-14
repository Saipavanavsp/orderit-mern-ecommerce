// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { configureStore, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';

export const loadSession = createAsyncThunk(
  'auth/load',
  async () => {
    try {
      const { user } = (await authApi.session()).data;
      return user?.role === 'admin' ? user : null;
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
    return rejectWithValue(errorMessage(err, 'Login failed'));
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } catch {
    // already logged out
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'idle' },
  reducers: {
    sessionExpired(s) {
      s.user = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(loadSession.pending, (s) => {
      s.status = 'loading';
    });
    b.addCase(loadSession.fulfilled, (s, a) => {
      s.user = a.payload;
      s.status = 'ready';
    })
      .addCase(login.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'ready';
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
      });
  },
});

export const { sessionExpired } = authSlice.actions;
export const store = configureStore({ reducer: { auth: authSlice.reducer } });
