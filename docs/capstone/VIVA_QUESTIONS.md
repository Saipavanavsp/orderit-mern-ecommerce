# Viva Questions and Answers (25)

**Author:** Sai Pavan

**1. What is the MERN stack and why did you choose it?**
MongoDB, Express, React and Node.js. One language (JavaScript) runs across the whole stack, JSON flows end to end, the npm ecosystem is large, and MongoDB's flexible documents suit product data whose specifications vary by category (a phone and a shirt have different attributes).

**2. Explain the backend architecture.**
Route → middleware → controller → service → model. Routes declare the URL, the auth requirement and the Zod schema. Controllers only translate HTTP to service calls. Services hold the business logic (pricing, inventory, coupons, payments). Mongoose models define schemas, indexes and hooks. Errors are thrown as `ApiError` and formatted by one central error handler.

**3. How does authentication work?**
On login the server issues two JWTs in HTTP-only cookies: a 15-minute access token and a 7-day refresh token whose cookie path is limited to `/api/v1/auth`. The refresh token's SHA-256 hash is stored on the user. `/auth/refresh` rotates it, and replaying an old token revokes every session (theft detection). HTTP-only cookies cannot be read by JavaScript, which protects them from XSS theft.

**4. Why cookies instead of localStorage?**
localStorage is readable by any script on the page, so a single XSS bug leaks the token. HTTP-only cookies are sent automatically and cannot be read by scripts. CSRF risk is reduced with `SameSite`, a strict CORS allow-list and JSON-only state-changing endpoints.

**5. How is the admin session kept separate from the customer session on localhost?**
Cookies are scoped to the host, not the port, so both apps would share them. The admin app sends `X-Client-App: admin`, and the server reads and writes differently named cookies (`oi_admin_access`, `oi_admin_refresh`). Customer accounts are refused at admin login.

**6. How are passwords stored?**
With bcrypt at 12 salt rounds (4 in tests for speed) in a pre-save hook. The field has `select: false` and is stripped from `toJSON`. Password changes set `passwordChangedAt`, which invalidates older access tokens.

**7. What is account lockout?**
`failedLoginAttempts` increments on each wrong password. At 5, `lockUntil` is set 15 minutes ahead and login returns HTTP 423 even with the right password. A successful login resets the counter. Combined with the rate limiter (10 login attempts per 15 minutes per IP), this slows brute-force attacks.

**8. List the security measures.**
Helmet headers, a CORS allow-list, rate limiting, express-mongo-sanitize (blocks `$`-operator injection), XSS filtering of all input strings, Zod validation, bcrypt, rotated HTTP-only JWTs, RBAC, Razorpay HMAC verification with timing-safe comparison, upload MIME, magic-byte and size checks, a 1 MB body limit, no stack traces in production, secrets in `.env`, and a protected `?redirect=` to prevent open redirects.

**9. How do you verify a Razorpay payment?**
Razorpay returns `order_id`, `payment_id` and `signature`. The server computes `HMAC_SHA256(order_id + "|" + payment_id, key_secret)` and compares it using `crypto.timingSafeEqual`. Only on a match is the order marked paid. The amount is always taken from our stored order, never from the client.

**10. How does payment work without Razorpay keys?**
A simulator issues a `sim_order_…` id. The "test payment" dialog calls `/payments/simulate`, which returns a payment id signed with `PAYMENT_SIMULATION_SECRET`, and then the normal `/orders/:id/pay` verification runs. The same code path is exercised in both modes.

**11. How do you prevent overselling?**
Each order line is decremented with a conditional atomic update, `updateOne({_id, stock: {$gte: qty}}, {$inc: {stock: -qty}})`. If any line fails, the lines already decremented are rolled back. A test runs two checkouts at once for the last units: exactly one succeeds and the other gets 409.

**12. When is stock decremented and restored?**
For online orders, after the payment signature is verified. For COD, when the order is placed. `inventoryReserved` records it, and cancellation restores stock exactly once. If stock disappears between order creation and payment, the order is cancelled and marked for refund instead of overselling.

**13. Why does the server compute totals instead of the client?**
The client could be tampered with. The cart and checkout re-price every line from the database, re-validate the coupon and compute GST and shipping in a single `computeTotals` function. The client only displays the result.

**14. How do coupons work?**
Each coupon has percent or flat discount, minimum order, maximum discount, start and expiry dates, a total usage limit and a per-user limit. Validation returns a specific reason on failure. Redemption is an atomic update guarded by `usedCount < usageLimit`, and cancellation releases the coupon.

**15. Explain the product search.**
A weighted MongoDB text index covers name (10), tags (6), sub-category (4) and description (1), and is sorted by `textScore` for relevance. Text search needs whole words, so when it finds nothing the service falls back to a regex across name, tags, sub-category and brand, which handles partial words like "galax". Facets (brand counts, price range) are computed with aggregation.

**16. How does natural-language search work?**
A rule-based parser extracts price constraints ("under 20k", "between 30000 and 1 lakh"), rating ("4 star"), sort intent ("cheapest"), discount ("deals"), category keywords and brand names found in the catalogue. The remaining meaningful words become text-search keywords. If those keywords match nothing, the filters are kept and the keywords dropped, and the UI shows how the query was interpreted.

**17. How does the AI assistant avoid recommending products you don't sell?**
Retrieval-augmented generation: the server first finds up to 8 candidate products and passes only those to Claude inside a `<catalog>` block. The system prompt forbids inventing products. Claude must cite products as `[[slug]]`, and the server keeps only slugs it supplied. The API key stays on the server. Errors and refusals fall back to a rule-based engine.

**18. How are recommendations computed?**
A content-based score over same category and sub-category, brand, tag Jaccard similarity and price-band closeness, plus a co-purchase signal from an aggregation over non-cancelled orders that contain the product. Each recommendation returns its reasons (e.g. "similar price", "frequently bought together").

**19. Where does the product data come from, and how do you ensure images match?**
From the open Amazon Reviews 2023 dataset on Hugging Face, streamed with HTTP Range requests and filtered to known brands and our six categories. Each product's images come from the same record as its title and specifications. Every URL is checked for HTTP 200, an `image/*` content type and a minimum size, and failures are dropped and listed in `docs/IMAGE_REPORT.md`. Dataset images are for educational use; `IMAGE_SOURCE=licensed` swaps in licensed images before public launch.

**20. How did you clean the dataset?**
Records were dropped for duplicates (by id and by normalised title), missing or out-of-range prices, missing brand, fewer than two images, few ratings, or blank descriptions, and for listings that are refurbished, cases or replacement parts. Titles were shortened and brand casing normalised. Irrelevant specification columns (rank, ASIN) were removed. USD was converted to INR price points, MRP derived, and `discountPercent` computed. Reviews with marketplace references were filtered out.

**21. Why are review ratings computed from your database instead of the dataset's average?**
Consistency: the live app recalculates rating and `numReviews` from approved reviews after every moderation action, so seeded products follow the same rule. The real review texts and ratings are seeded and assigned to demo customer accounts.

**22. How did you test the system?**
With Jest + Supertest against mongodb-memory-server, which uses a real `mongod`, so no external database is needed. The suites cover the business rules (lockout, token reuse, forged signatures, concurrency, coupon edge cases, moderation and rating, CSV, spoofed uploads, AI grounding with an injected fake client) plus a test that every route is documented. An end-to-end smoke script runs against the live stack.

**23. What does Redux Toolkit do in the front-end?**
It holds global state (auth user, cart, wishlist) with slices and async thunks. Every cart mutation returns the server's recomputed cart, which replaces the state, so the UI never calculates prices. An Axios interceptor refreshes the access token once on a 401 (shared by concurrent requests) and retries.

**24. How is the UI made responsive and accessible?**
Tailwind with a flat, muted design-token palette (CSS variables for light and dark), mobile filter drawer, sticky header and mobile add-to-cart bar, skeleton loaders, empty and error states, toasts, confirmation dialogs, labelled inputs, ARIA roles for menus, dialogs and tabs, keyboard navigation in search suggestions, visible focus rings, and a table view for every chart.

**25. How would you deploy and scale it?**
MongoDB Atlas, the API on Render or Railway, and both front-ends on Vercel or Netlify, with `COOKIE_SECURE=true`, `SameSite=None` and production CORS origins (see DEPLOYMENT.md). Docker images and docker-compose are included. To scale: run stateless API instances behind a load balancer, use Cloudinary for uploads, Redis for rate limits, caching and queues, and a replica set for transactions and read scaling.
