# Deployment Guide

OrderIt is three deployables: the **API** (`server/`), the **customer storefront** (`client/`) and the **admin dashboard** (`admin/`), plus a **MongoDB** database. All URLs, ports and secrets come from environment variables; nothing is hard-coded.

Recommended free/low-cost stack: **MongoDB Atlas** (database) + **Render** or **Railway** (API) + **Vercel** or **Netlify** (client and admin).

---

## 1. MongoDB Atlas

1. Create a free M0 cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a user with a strong password (role: *Read and write to any database*).
3. **Network Access** → add the egress IPs of your API host (Render/Railway publish them), or `0.0.0.0/0` for a short demo only.
4. **Connect → Drivers** → copy the URI and add the database name:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shopverse?retryWrites=true&w=majority`
5. Seed it once from your machine (PowerShell):

   ```powershell
   # temporarily point the seeder at Atlas
   $env:MONGO_URI = "mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shopverse"
   npm run seed
   Remove-Item Env:MONGO_URI
   ```

## 2. API on Render (or Railway)

**Render:** New → *Web Service* → connect the repository.

| Setting | Value |
|---|---|
| Root directory | `server` |
| Runtime | Node 20 |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |

Environment variables (Render → Environment):

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Render injects this; leave unset or `5001` |
| `MONGO_URI` | Atlas URI from step 1 |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | two different 64+ character random strings: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | `https://orderit.vercel.app` (your storefront URL) |
| `ADMIN_URL` | `https://orderit-admin.vercel.app` |
| `CORS_ORIGINS` | `https://orderit.vercel.app,https://orderit-admin.vercel.app` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` (front-ends and API are on different sites) |
| `PAYMENT_SIMULATION_SECRET` | random string |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay **test** keys (optional) |
| `ANTHROPIC_API_KEY` | optional; enables the Claude-powered assistant |
| `CLOUDINARY_*` | recommended in production (Render's disk is ephemeral) |
| `SMTP_*`, `MAIL_FROM` | optional; e-mails are logged to the console otherwise |
| `IMAGE_SOURCE` | `licensed` before public launch (see docs/DATASETS.md) |
| `LOG_FORMAT` | `combined` |

**Railway:** New project → *Deploy from repo* → set *Root directory* `server`, start command `npm start`, add the same variables. Railway sets `PORT` automatically.

> The API sets `trust proxy` in production so rate limiting and secure cookies work behind the platform's proxy.

## 3. Storefront and admin on Vercel (or Netlify)

Create **two** projects from the same repository.

| Setting | Storefront | Admin |
|---|---|---|
| Root directory | `client` | `admin` |
| Framework preset | Vite | Vite |
| Build command | `npm run build` | `npm run build` |
| Output directory | `dist` | `dist` |
| Env `VITE_API_URL` | `https://<your-api>.onrender.com/api/v1` | same |

Single-page-app routing is already configured, so deep links such as `/product/<slug>` work:

- **Vercel**: `client/vercel.json` and `admin/vercel.json` rewrite every path to `index.html`.
- **Netlify**: `client/public/_redirects` and `admin/public/_redirects` contain `/*  /index.html  200`.

## 4. Production cookies and CORS

- Cookies are `HttpOnly`, and in production must be `Secure` with `SameSite=None` because the front-ends (vercel.app) and API (onrender.com) are different sites. Set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none`.
- With a shared parent domain (e.g. `shop.example.com`, `admin.example.com`, `api.example.com`) you can use `COOKIE_SAMESITE=lax` and optionally `COOKIE_DOMAIN=.example.com`.
- `CORS_ORIGINS` must list the exact front-end origins (scheme + host, no trailing slash). Requests from other origins receive no CORS headers and are blocked by the browser.
- Stack traces are never returned when `NODE_ENV=production`.

## 5. Docker (optional, any VPS)

```powershell
Copy-Item .env.example .env      # edit secrets first
docker compose up --build -d
docker compose exec api node seed/seedData.js
```

Services: `mongo` (27017), `api` (5001), `client` (5173 → nginx), `admin` (5174 → nginx). Put a TLS-terminating reverse proxy (Caddy, Nginx, Traefik) in front for real deployments.

## 6. Pre-deploy checklist

- [ ] `npm run lint` → 0 errors; `npm test` → all suites pass; `npm run build` succeeds.
- [ ] New JWT secrets (not the `.env.example` values), different for access and refresh.
- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none` (or `lax` on a shared domain).
- [ ] `CORS_ORIGINS`, `CLIENT_URL`, `ADMIN_URL` set to the real HTTPS URLs.
- [ ] Atlas network access restricted; database user has least privilege.
- [ ] Admin password changed from the documented demo password (`admin@shopverse.com`).
- [ ] Cloudinary configured (uploads survive restarts).
- [ ] `IMAGE_SOURCE=licensed` with approved images, or dataset images removed, before **public** launch.
- [ ] Razorpay live keys only after KYC; webhook/signature secret stored as an environment variable.
- [ ] SMTP configured so order and password-reset e-mails are delivered.
- [ ] Health check `/api/v1/health` returns `"database": "connected"`.
- [ ] Demo seed data replaced or clearly labelled.
