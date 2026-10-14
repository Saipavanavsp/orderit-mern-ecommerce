import request from 'supertest';
import { app, API, PASSWORD, closeTestDb, connectTestDb, createUserAgent } from './helpers/setup.js';
import { User } from '../models/User.js';
import { getOutbox } from '../services/email.service.js';

beforeAll(() => connectTestDb('auth'));
afterAll(() => closeTestDb());

const cookieNamesOf = (res) => (res.headers['set-cookie'] || []).map((c) => c.split('=')[0]);

describe('Auth: register & login', () => {
  const creds = { name: 'Riya Kapoor', email: 'riya@test.com', password: 'Strong@123' };

  test('registers a user and sets HTTP-only auth cookies', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(creds);
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('riya@test.com');
    expect(res.body.data.user.password).toBeUndefined();
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/oi_access=/);
    expect(cookies).toMatch(/oi_refresh=/);
    expect(cookies).toMatch(/HttpOnly/);
  });

  test('rejects duplicate email', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(creds);
    expect(res.status).toBe(409);
  });

  test('rejects weak password and invalid email with field errors', async () => {
    const res = await request(app).post(`${API}/auth/register`).send({ name: 'X', email: 'bad', password: 'weak' });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  test('logs in with valid credentials and reads /auth/me', async () => {
    const agent = request.agent(app);
    const login = await agent.post(`${API}/auth/login`).send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
    const me = await agent.get(`${API}/auth/me`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.name).toBe('Riya Kapoor');
  });

  test('rejects wrong password with a generic message', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: creds.email, password: 'Wrong@123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('blocks NoSQL injection in login', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  test('requires authentication for /auth/me', async () => {
    const res = await request(app).get(`${API}/auth/me`);
    expect(res.status).toBe(401);
  });
});

describe('Auth: account lockout', () => {
  test('locks the account after 5 failed attempts', async () => {
    await User.create({ name: 'Lock Me', email: 'lock@test.com', password: PASSWORD });
    for (let i = 0; i < 4; i += 1) {
      const r = await request(app).post(`${API}/auth/login`).send({ email: 'lock@test.com', password: 'Nope@1234' });
      expect(r.status).toBe(401);
    }
    const fifth = await request(app).post(`${API}/auth/login`).send({ email: 'lock@test.com', password: 'Nope@1234' });
    expect(fifth.status).toBe(423);
    const correct = await request(app).post(`${API}/auth/login`).send({ email: 'lock@test.com', password: PASSWORD });
    expect(correct.status).toBe(423);
  });
});

describe('Auth: refresh token rotation & logout', () => {
  test('rotates refresh token and detects reuse', async () => {
    await User.create({ name: 'Rot User', email: 'rot@test.com', password: PASSWORD });
    const login = await request(app).post(`${API}/auth/login`).send({ email: 'rot@test.com', password: PASSWORD });
    const refreshCookie = login.headers['set-cookie'].find((c) => c.startsWith('oi_refresh=')).split(';')[0];

    const first = await request(app).post(`${API}/auth/refresh`).set('Cookie', refreshCookie);
    expect(first.status).toBe(200);
    expect(cookieNamesOf(first)).toEqual(expect.arrayContaining(['oi_access', 'oi_refresh']));

    // A parallel request (second tab / StrictMode) replaying it within the grace window still works.
    const parallel = await request(app).post(`${API}/auth/refresh`).set('Cookie', refreshCookie);
    expect(parallel.status).toBe(200);

    // After the grace window, replaying the rotated token is treated as theft: all sessions revoked.
    const stale = await User.findOne({ email: 'rot@test.com' }).select('+refreshTokens');
    stale.refreshTokens.forEach((t) => {
      if (t.replacedAt) t.replacedAt = new Date(Date.now() - 60_000);
    });
    await stale.save();
    const replay = await request(app).post(`${API}/auth/refresh`).set('Cookie', refreshCookie);
    expect(replay.status).toBe(401);
    const user = await User.findOne({ email: 'rot@test.com' }).select('+refreshTokens');
    expect(user.refreshTokens).toHaveLength(0);
  });

  test('logout clears cookies', async () => {
    const { agent } = await createUserAgent();
    const res = await agent.post(`${API}/auth/logout`);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'].join(';')).toMatch(/oi_access=;/);
    expect((await agent.get(`${API}/auth/me`)).status).toBe(401);
  });
});

describe('Auth: session bootstrap', () => {
  test('guests get 200 with user null (no 401 on page load)', async () => {
    const res = await request(app).get(`${API}/auth/session`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toBeNull();
  });

  test('restores the session from the refresh cookie when the access cookie is missing', async () => {
    await User.create({ name: 'Sess User', email: 'sess@test.com', password: PASSWORD });
    const login = await request(app).post(`${API}/auth/login`).send({ email: 'sess@test.com', password: PASSWORD });
    const refresh = login.headers['set-cookie'].find((c) => c.startsWith('oi_refresh=')).split(';')[0];
    const res = await request(app).get(`${API}/auth/session`).set('Cookie', refresh);
    expect(res.body.data.user.email).toBe('sess@test.com');
    expect(res.headers['set-cookie'].join(';')).toMatch(/oi_access=/);
  });
});

describe('Auth: role based access', () => {
  test('admin app login is refused for customers and uses separate cookies for admins', async () => {
    await User.create({ name: 'Cust', email: 'cust@test.com', password: PASSWORD });
    await User.create({ name: 'Boss', email: 'boss@test.com', password: PASSWORD, role: 'admin' });
    const cust = await request(app)
      .post(`${API}/auth/login`)
      .set('X-Client-App', 'admin')
      .send({ email: 'cust@test.com', password: PASSWORD });
    expect(cust.status).toBe(403);
    const admin = await request(app)
      .post(`${API}/auth/login`)
      .set('X-Client-App', 'admin')
      .send({ email: 'boss@test.com', password: PASSWORD });
    expect(admin.status).toBe(200);
    expect(cookieNamesOf(admin)).toEqual(expect.arrayContaining(['oi_admin_access', 'oi_admin_refresh']));
  });

  test('deactivated users cannot log in', async () => {
    await User.create({ name: 'Gone', email: 'gone@test.com', password: PASSWORD, isActive: false });
    const res = await request(app).post(`${API}/auth/login`).send({ email: 'gone@test.com', password: PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('Auth: password reset & change', () => {
  test('forgot password sends a reset link and reset works once', async () => {
    await User.create({ name: 'Forget', email: 'forget@test.com', password: PASSWORD });
    const res = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'forget@test.com' });
    expect(res.status).toBe(200);
    const mail = getOutbox().filter((m) => m.to === 'forget@test.com').pop();
    const token = mail.text.match(/reset-password\/([a-f0-9]{64})/)[1];

    const reset = await request(app).post(`${API}/auth/reset-password/${token}`).send({ password: 'NewPass@456' });
    expect(reset.status).toBe(200);
    const again = await request(app).post(`${API}/auth/reset-password/${token}`).send({ password: 'NewPass@789' });
    expect(again.status).toBe(400);
    const login = await request(app).post(`${API}/auth/login`).send({ email: 'forget@test.com', password: 'NewPass@456' });
    expect(login.status).toBe(200);
  });

  test('forgot password does not reveal unknown emails', async () => {
    const res = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'nobody@test.com' });
    expect(res.status).toBe(200);
  });

  test('change password requires the current password', async () => {
    const { agent } = await createUserAgent({ email: 'change@test.com' });
    const bad = await agent.put(`${API}/auth/change-password`).send({ currentPassword: 'x', newPassword: 'Another@123' });
    expect(bad.status).toBe(400);
    const ok = await agent
      .put(`${API}/auth/change-password`)
      .send({ currentPassword: PASSWORD, newPassword: 'Another@123' });
    expect(ok.status).toBe(200);
    expect((await agent.get(`${API}/auth/me`)).status).toBe(200);
  });
});

describe('Users: profile & addresses', () => {
  test('updates profile and manages addresses', async () => {
    const { agent } = await createUserAgent();
    const p = await agent.put(`${API}/users/me`).send({ name: 'Updated Name', phone: '9876543210' });
    expect(p.status).toBe(200);
    expect(p.body.data.user.name).toBe('Updated Name');
    const address = {
      fullName: 'Updated Name', phone: '9876543210', line1: '12 MG Road', city: 'Bengaluru',
      state: 'Karnataka', postalCode: '560001',
    };
    const add = await agent.post(`${API}/users/me/addresses`).send(address);
    expect(add.status).toBe(201);
    expect(add.body.data.addresses[0].isDefault).toBe(true);
    const id = add.body.data.addresses[0]._id;
    const del = await agent.delete(`${API}/users/me/addresses/${id}`);
    expect(del.body.data.addresses).toHaveLength(0);
  });

  test('strips script tags from input (XSS)', async () => {
    const { agent } = await createUserAgent();
    const res = await agent.put(`${API}/users/me`).send({ name: 'Neha<script>alert(1)</script>' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Neha');
  });
});
