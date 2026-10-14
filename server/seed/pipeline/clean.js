// Step 2 - clean & normalise candidates into our product shape and pick the best per category.
// Input: raw/candidates.json, raw/reviews.raw.json  ->  Output: raw/products.cleaned.json
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAW_DIR, RULES, USD_TO_INR } from './config.js';
import { canonicalBrand, ruleKey } from './download.js';

// Deterministic pseudo-random in [0,1) from the source id, so re-runs give identical data.
const rand = (id, salt = '') => crypto.createHash('md5').update(`${id}:${salt}`).digest().readUInt32BE(0) / 2 ** 32;

const INVISIBLE = new RegExp('[\\u200e\\u200f\\u00a0]', 'g'); // LRM, RLM, NBSP from marketplace text
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, '').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
const truncateWords = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')}…`);

/** "SAMSUNG Galaxy S23 Ultra, Factory Unlocked Android..., 256GB" -> "Samsung Galaxy S23 Ultra". */
export function cleanTitle(title, brand) {
  let t = stripHtml(title).replace(/[®™©]/g, '').replace(/\s*\[[^\]]*\]\s*/g, ' ');
  t = t.replace(/\s*\((?:not for (?:usa|us) market|no us warranty|global version)[^)]*\)/gi, '');
  const parts = t.split(/\s*(?:,|\||\s-\s|\s–\s|\s—\s|;|\s\/\s)\s*/);
  let name = parts[0];
  for (const p of parts.slice(1)) {
    if (name.length >= 40 || `${name}, ${p}`.length > 100) break;
    name = `${name}, ${p}`;
  }
  name = name
    .replace(/\s*\((?:renewed|international version|us version|old model|[\d]{4} model)[^)]*\)/gi, '')
    .replace(/\b(?:US Version|International Version|Factory Unlocked|Retail Packaging)\b/gi, '')
    .replace(/\s+\S*#\S*/g, '') // stray SKU fragments like "EGC007CHC#"
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (name.length > 110) name = truncateWords(name, 108).replace(/…$/, '');
  // Drop a dangling, unclosed "(..." left by truncation
  if ((name.match(/\(/g) || []).length > (name.match(/\)/g) || []).length) name = name.slice(0, name.lastIndexOf('(')).trim();
  name = name.replace(/[\s,:;-]+$/, '');
  // canonical brand casing and prefix
  const re = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  name = re.test(name) ? name.replace(re, brand) : `${brand} ${name}`;
  return name.replace(/\s+/g, ' ').trim();
}

const SPEC_SKIP = /asin|best sellers|customer reviews|date first|discontinued|rank|upc|ean|manufacturer recommended|batteries required|department|item model number$|^manufacturer$|country of origin|package dimensions|import|global trade/i;

export function cleanSpecs(details, brand) {
  const specs = [{ label: 'Brand', value: brand }];
  for (const [k, v] of Object.entries(details || {})) {
    if (specs.length >= 12) break;
    if (SPEC_SKIP.test(k) || k.toLowerCase() === 'brand') continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const value = stripHtml(String(v));
    const label = stripHtml(k).replace(/\s+/g, ' ');
    if (!value || value.length > 140 || label.length > 60) continue;
    specs.push({ label, value });
  }
  return specs;
}

const TAG_WORDS = ['5g', 'wireless', 'bluetooth', 'noise cancelling', 'noise canceling', 'gaming', '4k', 'oled', 'qled', 'amoled', 'smart', 'waterproof', 'fast charging', 'touchscreen', 'camera', 'cotton', 'leather', 'running', 'stainless steel', 'inverter', 'front load', 'top load', 'frost free', 'robot', 'cordless', 'portable', 'unlocked', 'dual sim', 'wifi', 'hdr', 'alexa', 'google assistant', 'gps', 'slim fit', 'stretch', 'polarized', 'automatic', 'quartz', 'usb-c', 'magsafe'];

function tagsFor(c, sub, brand) {
  const text = `${c.title} ${c.features.join(' ')}`.toLowerCase();
  const tags = new Set([sub.toLowerCase().replace(/[^a-z0-9 &'-]/g, ''), brand.toLowerCase()]);
  TAG_WORDS.forEach((w) => text.includes(w) && tags.add(w.replace('noise canceling', 'noise cancelling')));
  return [...tags].slice(0, 12);
}

function description(c) {
  const desc = c.description.map(stripHtml).filter((d) => d.length > 30 && !/^(product description|from the manufacturer|about this item)$/i.test(d));
  let text = desc.join('\n\n');
  if (text.length < 120) text = [text, ...c.features.map(stripHtml)].filter(Boolean).join('\n');
  return truncateWords(text, 1400);
}

/** INR price rounded to a "...99" price point, from the dataset's USD list price. */
export function inrPrice(usd) {
  const inr = usd * USD_TO_INR;
  if (inr < 1000) return Math.max(99, Math.round(inr / 10) * 10 - 1);
  return Math.round(inr / 100) * 100 - 1;
}

function mrpFor(price, id) {
  const discount = 0.05 + rand(id, 'mrp') * 0.3; // 5% - 35%
  const raw = price / (1 - discount);
  return raw < 1000 ? Math.ceil(raw / 10) * 10 - 1 : Math.ceil(raw / 100) * 100 - 1;
}

function stockFor(id) {
  const r = rand(id, 'stock');
  if (r < 0.04) return 0; // a few out-of-stock items
  if (r < 0.14) return 1 + Math.floor(rand(id, 'low') * 9); // low stock 1-9
  return 12 + Math.floor(rand(id, 'qty') * 140);
}

const REVIEW_BLOCK = /amazon|\$\d|seller|ebay|walmart|best buy|costco|\bvine\b|free product|discount in exchange/i;
function cleanReviews(list = []) {
  const seen = new Set();
  return list
    .map((r) => ({ ...r, text: stripHtml(r.text), title: stripHtml(r.title).slice(0, 110) }))
    .filter((r) => r.text.length >= 25 && r.text.length <= 900 && !REVIEW_BLOCK.test(`${r.text} ${r.title}`) && r.rating >= 1 && r.rating <= 5)
    .filter((r) => !seen.has(r.text.slice(0, 60)) && seen.add(r.text.slice(0, 60)))
    .sort((a, b) => (b.helpful || 0) - (a.helpful || 0))
    .slice(0, 8)
    .map(({ rating, title, text, timestamp, verified }) => ({ rating, title, comment: truncateWords(text, 700), createdAt: new Date(timestamp).toISOString(), verified: Boolean(verified) }));
}

const nameKey = (n) => n.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 6).join(' ');

export function clean({ log = console.log } = {}) {
  const candidates = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'candidates.json'), 'utf8'));
  // Optional Kaggle (Flipkart) rows, produced by pipeline/kaggle.js, are merged when present.
  const kagglePath = path.join(RAW_DIR, 'candidates.kaggle.json');
  if (fs.existsSync(kagglePath)) {
    const extra = JSON.parse(fs.readFileSync(kagglePath, 'utf8'));
    Object.entries(extra).forEach(([k, list]) => (candidates[k] = [...(candidates[k] || []), ...list]));
    log(`[clean] merged ${Object.values(extra).flat().length} Kaggle candidates`);
  }
  const rawReviews = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'reviews.raw.json'), 'utf8'));
  const usedNames = new Set();
  const products = [];
  const stats = [];

  for (const rule of RULES) {
    const list = candidates[ruleKey(rule)] || [];
    const normalized = [];
    let dropped = 0;
    for (const c of list) {
      const brand = canonicalBrand(c.store);
      const name = cleanTitle(c.title, brand);
      const key = nameKey(name);
      const desc = description(c);
      if (!brand || name.length < 8 || desc.length < 40 || usedNames.has(key)) {
        dropped += 1;
        continue;
      }
      const reviews = cleanReviews(rawReviews[c.asin]);
      // Kaggle/Flipkart rows already carry INR price + MRP; Amazon rows are converted from USD.
      const price = c.priceInr || inrPrice(c.price);
      normalized.push({
        key,
        score: (reviews.length >= 2 ? 3 : reviews.length ? 1 : 0) + Math.log10(c.rating_number + 1) + c.average_rating / 2,
        product: {
          name,
          brand,
          category: rule.category,
          subCategory: rule.sub,
          description: desc,
          highlights: c.features.map(stripHtml).filter((f) => f.length > 10).slice(0, 6).map((f) => truncateWords(f, 200)),
          price,
          mrp: c.mrpInr || mrpFor(price, c.asin),
          stock: stockFor(c.asin),
          images: c.images.slice(0, 5).map((url) => ({ url, alt: name })),
          specifications: cleanSpecs(c.details, brand),
          tags: tagsFor(c, rule.sub, brand),
          datasetRating: c.average_rating,
          datasetRatingCount: c.rating_number,
          source: c.source?.startsWith('kaggle')
            ? { dataset: 'PromptCloudHQ/flipkart-products (Kaggle, CC BY-SA 4.0)', sourceId: c.asin, imageLicense: 'Dataset image URL (Flipkart CDN) - local/educational use only' }
            : { dataset: 'McAuley-Lab/Amazon-Reviews-2023', sourceId: c.asin, imageLicense: 'Dataset image URL (Amazon CDN) - local/educational use only' },
        },
        reviews,
      });
    }
    // Best first, with brand diversity: at most ~35% of a sub-type from one brand.
    normalized.sort((a, b) => b.score - a.score);
    const perBrand = {};
    const maxPerBrand = Math.max(2, Math.ceil(rule.quota * 0.35));
    const picked = [];
    for (const n of normalized) {
      if (picked.length >= rule.quota) break;
      if ((perBrand[n.product.brand] || 0) >= maxPerBrand) continue;
      perBrand[n.product.brand] = (perBrand[n.product.brand] || 0) + 1;
      picked.push(n);
    }
    for (const n of normalized) {
      // top up if diversity cap left us short
      if (picked.length >= rule.quota) break;
      if (!picked.includes(n)) picked.push(n);
    }
    picked.forEach((n) => usedNames.add(n.key));
    products.push(...picked.map((n) => ({ ...n.product, reviews: n.reviews })));
    stats.push({ rule: ruleKey(rule), candidates: list.length, dropped, kept: picked.length, quota: rule.quota });
  }

  // Feature the two strongest products per category on the home page.
  const byCat = {};
  products.forEach((p) => (byCat[p.category] ||= []).push(p));
  Object.values(byCat).forEach((list) =>
    [...list].sort((a, b) => b.datasetRating * Math.log10(b.datasetRatingCount + 1) - a.datasetRating * Math.log10(a.datasetRatingCount + 1)).slice(0, 2).forEach((p) => (p.isFeatured = true)),
  );

  fs.writeFileSync(path.join(RAW_DIR, 'products.cleaned.json'), JSON.stringify(products, null, 1));
  stats.forEach((s) => log(`[clean] ${s.rule.padEnd(48)} candidates ${String(s.candidates).padStart(3)}  dropped ${String(s.dropped).padStart(3)}  kept ${s.kept}/${s.quota}`));
  log(`[clean] ${products.length} products, ${products.reduce((s, p) => s + p.reviews.length, 0)} reviews -> raw/products.cleaned.json`);
  return { products, stats };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) clean();
