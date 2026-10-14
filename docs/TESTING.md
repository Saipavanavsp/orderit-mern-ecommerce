# Testing

## How to run (PowerShell, from the repository root)

```powershell
npm test            # 8 Jest + Supertest suites against an in-memory MongoDB (no DB setup needed)
npm run test:all    # tests + production builds of the storefront and admin dashboard
npm run lint        # ESLint (flat config) for server, client, admin and scripts
npm run smoke       # end-to-end flow against the RUNNING app (start "npm run dev" first)
cd server; npm run test:coverage   # coverage report in server/coverage/
```

The test runner starts one real `mongod` through **mongodb-memory-server**. Each suite uses its own database, and rate limits are relaxed in `NODE_ENV=test`; lockout logic is tested directly. No `.env` file is needed for tests.

## Suites

| Suite | File | Focus |
|---|---|---|
| Auth | `server/tests/auth.test.js` | register/login validation, duplicate e-mail, NoSQL injection, HTTP-only cookies, lockout after 5 failures, refresh rotation + grace window + reuse revocation, session bootstrap, logout, admin-app RBAC and separate cookies, deactivated users, forgot/reset password via e-mail token, change password, profile, addresses, XSS stripping |
| Products | `server/tests/products.test.js` | listing, category/brand/price/rating/stock filters, sort, pagination, text search + partial-word fallback, facets, query validation, detail/404, suggestions, home sections, related products, admin CRUD + RBAC, MRP/price rules, categories and brands CRUD with in-use protection |
| Cart & shopping | `server/tests/cart.test.js` | cart totals (subtotal, 18% GST, shipping threshold), quantity increments, stock limits, invalid products, removal, coupons (percent cap, min order, expiry, usage limit, invalid), wishlist idempotency, reviews (pending → approved, rating recalculation, edit/delete, ownership) |
| Orders & payments | `server/tests/orders.test.js` | checkout validation, server-side totals with coupon, address saving, forged signature rejection, valid signature → paid + stock decrement + e-mail + notification, double payment blocked, single-use coupon, order ownership, cancellation refund + stock restore, simulated failure, COD reservation, **concurrent checkout no-oversell**, stock change after add-to-cart, payment config hides secrets |
| Admin | `server/tests/admin.test.js` | RBAC, status transition rules, COD paid on delivery, admin cancel restores stock, unpaid online orders cannot be processed, dashboard numbers, sales series, category analytics, inventory/bulk status/stock edit, CSV exports, user list/status/role, self-protection, review moderation, coupon CRUD + validation, uploads (valid PNG, wrong type, spoofed content, oversize, customer blocked) |
| AI | `server/tests/ai.test.js` | NL parser (price ranges, k/lakh, brands, ratings, sort, deals), NL search with keyword relaxation, rule-based assistant (products, shipping, returns, coupons, no-match), conversation validation, Claude path with injected fake client (catalogue grounding, unknown slugs dropped, request shape incl. `fallbacks`), fallback on API errors and refusals, co-purchase recommendations, personalised recommendations |
| Pipeline | `server/tests/pipeline.test.js` | title cleaning, INR conversion, price parsing, spec column filtering, image URL acceptance, quality gate, Kaggle CSV parsing and Flipkart normalisation |
| Docs | `server/tests/docs.test.js` | every Express route appears in the OpenAPI registry (and vice versa), Zod-generated schemas, Swagger UI + JSON served |

## Test cases (representative)

| ID | Module | Steps | Expected result | Status |
|---|---|---|---|---|
| TC-01 | Auth | Register with name "X", email "bad", password "weak" | 400 with field errors for name, email, password | Pass |
| TC-02 | Auth | Register the same e-mail twice | 409 Conflict | Pass |
| TC-03 | Auth | 5 wrong passwords, then the correct one | 423 Locked both times | Pass |
| TC-04 | Auth | Login body `{ "email": {"$gt": ""} }` | 400; injection neutralised | Pass |
| TC-05 | Auth | Rotate refresh token; replay the old one after the grace window | 401 and every session revoked | Pass |
| TC-06 | Auth | Customer logs into the admin app | 403 "Admin access only" | Pass |
| TC-07 | Auth | Forgot password → use e-mailed token twice | First succeeds, second 400 | Pass |
| TC-08 | Security | Profile name `Neha<script>alert(1)</script>` | Saved as "Neha" | Pass |
| TC-09 | Catalogue | `?category=mobiles&brand=samsung&minPrice=10000&maxPrice=20000` | Only matching active products | Pass |
| TC-10 | Catalogue | `?minPrice=500&maxPrice=100` | 400 validation error | Pass |
| TC-11 | Catalogue | Search "galax" | Regex fallback returns Galaxy phones | Pass |
| TC-12 | Catalogue | Customer calls `POST /products` | 403 | Pass |
| TC-13 | Cart | Set quantity above stock | 400 "Only N unit(s)" | Pass |
| TC-14 | Cart | Subtotal below free-shipping threshold | Shipping ₹49 | Pass |
| TC-15 | Coupon | Apply FLAT500 to a ₹2,499 cart | 400 "Add items worth ₹2,500 more" | Pass |
| TC-16 | Coupon | Re-use a single-use coupon | 400 "already used" | Pass |
| TC-17 | Payment | `PUT /orders/:id/pay` with a forged signature | 400; order unpaid; stock unchanged | Pass |
| TC-18 | Payment | Valid signed payment | Paid, processing, stock −qty, e-mail + notification | Pass |
| TC-19 | Inventory | Two buyers check out 2 units each with stock 3, concurrently | One 201, one 409; final stock 1 | Pass |
| TC-20 | Orders | Cancel a paid order | cancelled, refunded, stock restored; second cancel 400 | Pass |
| TC-21 | Admin | Mark a processing order delivered directly | 400 invalid transition | Pass |
| TC-22 | Admin | Deliver a COD order | isPaid true, paymentStatus paid | Pass |
| TC-23 | Admin | Admin deactivates themself | 400 | Pass |
| TC-24 | Reviews | Approve then reject a review | numReviews 1 then 0 | Pass |
| TC-25 | Uploads | Text bytes sent as image/png | 400 "not a valid image" | Pass |
| TC-26 | AI | "phone under 20000 with good camera" | mobiles, ≤ ₹20,000, keyword camera | Pass |
| TC-27 | AI | Claude reply cites an unknown slug | Slug dropped from product cards | Pass |
| TC-28 | AI | Claude throws or refuses | Rule-based answer returned | Pass |
| TC-29 | Docs | Add a route without documenting it | docs test fails | Pass |
| TC-30 | E2E | `npm run smoke` against the running app | All steps pass | Pass |

## Front-end verification

- `npm run build` builds both apps (code-split routes).
- The storefront and admin were also exercised in a real browser (headless Microsoft Edge driven by puppeteer-core): home, category filtering and sorting, search suggestions, NL search, product detail, login, add to cart, coupon, checkout, simulated payment, order tracking, assistant, account pages, 404, dark mode, 390 px mobile layout overflow check, and the admin flow (customer rejected at admin login, dashboard charts, ship/deliver an order, all management pages). Console errors and failed requests were collected and fixed. That script is a developer verification tool and is not part of the repository.

## Latest results

Final verification run (14 Oct 2026, Windows 11, Node 24, MongoDB 8.2):

| Check | Result |
|---|---|
| `npm test` | 8 suites, **109 tests passed**, 0 failed |
| Coverage (`server`) | 85.0% statements, 90.9% lines, 91.5% functions |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run build` | storefront and admin build successfully |
| `npm run smoke` (live stack) | **17/17 steps passed** |
| Browser run (headless Edge, both apps) | **27/27 steps passed**; the only console error is the intentional 403 from the "customer tries to log into admin" negative test |
| Image validation | 1,138 / 1,141 image URLs passed; 3 thumbnails removed; 0 products dropped |
