# Datasets

**Author:** Sai Pavan ([github.com/Saipavanavsp](https://github.com/Saipavanavsp))

The catalogue (240 products, 1,379 reviews) is built from **open datasets** by a reproducible pipeline in `server/seed/pipeline/`. No website was scraped. The cleaned result is committed as `server/seed/data/products.json` and `reviews.json`, so `npm run seed` always works offline, even if the sources change or are unavailable.

## Sources

| Source | Access method | Used for | Licence / terms |
|---|---|---|---|
| **Amazon Reviews 2023** (McAuley Lab, UC San Diego) - <https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023>, project page <https://amazon-reviews-2023.github.io/> | Official Hugging Face file download URLs (`/resolve/main/raw/...jsonl`) read with HTTP Range requests; **no credentials needed** | Product metadata (title, brand/store, price, features, description, details/specifications, category path, image URLs, ratings) and review text/ratings | Released by the authors for research use. Cite: Hou, Y., Li, J., He, Z., Yan, A., Chen, X., McAuley, J. *Bridging Language and Items for Retrieval and Recommendation*, arXiv:2403.03952, 2024. |
| **Flipkart Products** (PromptCloud) - <https://www.kaggle.com/datasets/PromptCloudHQ/flipkart-products> | Official **Kaggle CLI** (`kaggle datasets download`) - optional, needs your Kaggle API token | Additional INR-priced Indian products (`npm run dataset:kaggle`) | CC BY-SA 4.0 |
| Product images | URLs from the same dataset records (Amazon CDN `m.media-amazon.com`) | Product photos | **Local / educational use only** - see "Image licensing" below |

### Why Hugging Face is the default and Kaggle is optional
Kaggle downloads require an API token tied to your account, so they can't run unattended. The Hugging Face files are public and stream without credentials, which keeps `npm run dataset:build` fully automatic. To add the Flipkart source (PowerShell):

```powershell
pip install kaggle
# kaggle.com -> Settings -> API -> "Create New Token" (downloads kaggle.json)
New-Item -ItemType Directory -Force "$env:USERPROFILE\.kaggle"
Move-Item "$env:USERPROFILE\Downloads\kaggle.json" "$env:USERPROFILE\.kaggle\kaggle.json"
npm run dataset:kaggle                       # writes server/seed/data/raw/candidates.kaggle.json
npm run dataset:build -- --skip-download     # merges it, re-cleans, re-validates images
npm run seed
```

The Kaggle normaliser (`pipeline/kaggle.js`) maps the Flipkart category tree to our categories and keeps Flipkart's INR price and MRP. It is unit-tested on synthetic rows, but was **not** run against the real Kaggle file in this build because no Kaggle token was available. Flipkart's 2016 image URLs may no longer resolve; any that fail are removed by the image validator.

## Pipeline

```
npm run dataset:build
  1. download.js        stream metadata -> rule filter -> 4x quota candidates per sub-type
                         stream reviews  -> keep reviews of candidate products only
  2. clean.js           normalise, de-duplicate, map categories, INR prices, specs, tags, pick best
  3. validateImages.js  HTTP-check every image, drop failures, write curated JSON + IMAGE_REPORT.md
npm run seed           load curated JSON into MongoDB
```

Run statistics for the committed data (October 2026):

| Source file | Records scanned | Candidates kept | Products after cleaning |
|---|---|---|---|
| `meta_Cell_Phones_and_Accessories` | 263,740 | 90 | 50 (40 phones, 10 chargers) |
| `meta_Electronics` | 193,669 | 240 | 60 |
| `meta_Appliances` (whole file) | 94,327 | 61 | 20 |
| `meta_Home_and_Kitchen` | 264,445 | 160 | 40 |
| `meta_Clothing_Shoes_and_Jewelry` | 105,697 | 280 | 70 |
| **Total** | **921,878** | **831** | **240** |

Scanning stops as soon as every sub-type has 4× its quota of candidates, or the per-file byte cap in `pipeline/config.js` is reached. Review files are scanned the same way (capped at 300-500 MB each), and only reviews of candidate products are kept.

### Category mapping (26 sub-types → 6 store categories)

| Store category | Sub-types (quota) | Dataset category path |
|---|---|---|
| Mobiles | Smartphones (40) | Cell Phones & Accessories › Cell Phones |
| Electronics | Laptops (10), Tablets (6), Headphones & Earbuds (10), Smartwatches (6), Speakers (4), Cameras (4) | Electronics › Computers & Tablets / Headphones / Wearable Technology / Portable Speakers / Camera & Photo |
| TV & Appliances | Televisions (14), Soundbars & Home Theatre (6), Washing Machines (8), Refrigerators & Freezers (8), Dishwashers & Cooking Ranges (4) | Electronics › Television & Video, Home Audio; Appliances › Laundry, Refrigerators, Ranges |
| Home Appliances | Mixers & Blenders (10), Microwaves & Ovens (7), Coffee Makers (5), Cookers & Fryers (7), Vacuum Cleaners (7), Air Care & Ironing (4) | Home & Kitchen › Small Appliances, Vacuums & Floor Care, Heating/Cooling & Air Quality |
| Fashion | Men's Clothing (14), Women's Clothing (12), Footwear (14) | Clothing, Shoes & Jewelry › Men/Women › Clothing/Shoes |
| Accessories | Watches (12), Sunglasses (5), Bags & Backpacks (8), Wallets & Belts (5), Chargers & Power Banks (10) | Clothing, Shoes & Jewelry › Watches/Accessories/Handbags/Luggage; Cell Phones & Accessories › Chargers/Power Banks |

### Cleaning rules (`download.js` quality gate + `clean.js`)

- **Remove invalid prices:** missing or unparsable prices, and prices outside a sane band for the sub-type (e.g. phones $70-1,600, T-shirts $8-250).
- **Remove blank or weak records:** titles under 15 characters, no features and no description, fewer than 2 images, fewer than 5 ratings.
- **Remove irrelevant listings:** refurbished/renewed items, cases, covers, screen protectors, replacement parts, filters, multi-packs, carrier-locked prepaid phones (title exclusion regex per sub-type).
- **Brands:** only well-known brands from a per-category whitelist; the store name is normalised to canonical casing (e.g. `SAMSUNG` → `Samsung`).
- **Duplicates:** removed by dataset id (`parent_asin`) and by the first six normalised words of the cleaned title (removes colour/size variants).
- **Irrelevant columns dropped:** only title, brand, price, features, description, details, images, ratings and category path are kept. Specification rows such as ASIN, Best Sellers Rank, UPC, "Date First Available" and "Customer Reviews" are removed; up to 12 specifications are kept.
- **Titles:** shortened at separators to about 40-100 characters; "US Version", "Factory Unlocked", "(OLD MODEL)", stray SKU fragments and unclosed brackets are removed; the brand prefix is ensured.
- **Prices (INR):** `price = USD × 83`, rounded to a "…99" price point. **MRP** is derived deterministically: a 5-35% markup from a hash of the product id. **`discountPercent = round((MRP − price) / MRP × 100)`**, also enforced by the Product model.
- **Stock:** deterministic from the product id: about 4% out of stock, 10% low stock (1-9), the rest 12-151.
- **Reviews:** HTML stripped; 25-900 characters; reviews mentioning other marketplaces, prices or free products are excluded; de-duplicated; the 8 most helpful are kept. They are seeded as *approved*, assigned to the 10 demo customers, and keep their original date and verified-purchase flag. Product rating and review count are **computed from these reviews**, exactly as the live app does after moderation.
- **Selection:** within each sub-type, candidates are ranked by review coverage, rating count and average rating; no brand may take more than ~35% of a sub-type. The two strongest products per category are marked *featured*.
- **Descriptions and specifications always come from the same record as the title**, so they are consistent with it.

## Image licensing

- Every image URL comes from the **same dataset record** as the product's title, brand and specifications, so the photo shows that exact product. No random, stock, AI-generated or cross-product images are used.
- `npm run images:validate` checks every URL (HTTP 200, `image/*` content type, ≥ 5 KB) and removes failures. Results are in [IMAGE_REPORT.md](IMAGE_REPORT.md): **1,138 of 1,141 URLs passed, 3 tiny thumbnails were removed, and no product was dropped.**
- A manual spot check of one main image per sub-type confirmed the photos match their titles.
- These images belong to the brand owners and retailers. They are referenced for **local and educational (capstone) use only**, are not re-hosted, and must not be used for a public or commercial deployment.
- **Before public deployment**, switch to licensed images:
  1. `npm run dataset:licensed-images`. This searches **Wikimedia Commons** (CC0, CC BY and CC BY-SA files only) by brand and model and writes `server/seed/data/raw/licensed-images.candidates.json` with the licence, author and source URL of each candidate.
  2. Check each candidate visually. Copy only exact matches into `server/seed/data/licensed-images.json` as `{ "<sourceId>": [{ "url", "license", "author", "sourceUrl" }] }`. You can add your own Unsplash or Pexels photos the same way, recording their licence.
  3. Set `IMAGE_SOURCE=licensed` in `server/.env` and run `npm run seed`. Only products with an approved licensed image are seeded. Show attribution where the licence requires it.

## Files

| Path | Committed | Contents |
|---|---|---|
| `server/seed/data/products.json` | yes | 240 curated products (the fallback that makes seeding always work) |
| `server/seed/data/reviews.json` | yes | 1,379 reviews keyed by dataset product id |
| `server/seed/data/licensed-images.json` | yes | approved licensed-image mapping (empty by default) |
| `server/seed/data/raw/` | no (git-ignored) | streamed candidates, raw reviews, Kaggle downloads, licensed-image candidates |
| `docs/IMAGE_REPORT.md` | yes | image validation report |
