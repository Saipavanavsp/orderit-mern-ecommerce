# Presentation Outline (15-18 slides, ~15 minutes)

**Author:** Sai Pavan

| # | Slide | Content | Visual |
|---|---|---|---|
| 1 | Title | OrderIt - MERN e-commerce platform with intelligent product discovery; presented by Sai Pavan, guide, department, year | Logo + storefront screenshot |
| 2 | Problem | Expensive, insecure DIY stores; weak keyword search; fake demo catalogues | Three icons with one line each |
| 3 | Objectives | 8 objectives from the report (secure API, two apps, payments, inventory, AI, data pipeline, tests) | Checklist |
| 4 | Scope | In scope vs out of scope | Two-column table |
| 5 | Architecture | Browser apps → security middleware → routes/controllers/services → MongoDB; external Claude, Razorpay, Cloudinary, SMTP | Architecture Mermaid diagram |
| 6 | Database | 11 collections, key relations, indexes (text index, unique keys) | ER diagram |
| 7 | Security | Cookie JWT + refresh rotation, lockout, RBAC, sanitisation, rate limits, HMAC verification | Layered "defence in depth" graphic |
| 8 | Customer journey (demo) | Home → NL search → product → cart + coupon → checkout → pay → track | 6 screenshots in a strip |
| 9 | Checkout & inventory | Server-side pricing, atomic stock decrement, cancellation restore, concurrency test result | Sequence diagram |
| 10 | Admin dashboard (demo) | KPIs, revenue chart, order status update, review moderation, coupons, CSV export | Dashboard screenshot |
| 11 | AI 1 - Shopping assistant | Retrieval → Claude with catalogue context → `[[slug]]` validation → product cards; rule-based fallback | Chat screenshot + flow |
| 12 | AI 2 & 3 - Recommendations & NL search | Scoring formula with reasons; query → filters example | Formula + "interpreted as" chips |
| 13 | Data pipeline | Hugging Face streaming → cleaning rules → INR conversion → image validation → seed; counts per category | Pipeline diagram + IMAGE_REPORT numbers |
| 14 | Testing | 8 suites, test count, key cases (forged signature, race condition, token reuse), smoke test output | Terminal screenshot |
| 15 | Results | Endpoints, products, test results, Lighthouse/performance notes | Metric tiles |
| 16 | Deployment | Atlas + Render + Vercel, Docker; cookie and CORS settings | Deployment diagram |
| 17 | Future work | Webhooks/refunds, courier tracking, GST invoices, embeddings, PWA | Roadmap |
| 18 | Conclusion & Q&A | Key learnings; thank you | - |

**Live demo script (3 minutes):** log in as `aarav.sharma@example.com`; search "phone under 30000 with good camera"; open a product, show the specs, reviews and "You may also like"; add to cart, apply `WELCOME10`, check out and pay with the test dialog; switch to the admin app (`admin@shopverse.com`), mark the order shipped then delivered; return to the storefront and show the order tracker; ask the assistant "best rated headphones".
