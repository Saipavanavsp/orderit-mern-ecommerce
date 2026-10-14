// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
// Step 1 - download (stream) candidates from the Hugging Face "Amazon Reviews 2023" dataset.
// Writes server/seed/data/raw/candidates.json and raw/reviews.raw.json.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CANDIDATE_MULTIPLIER, RAW_DIR, RULES, SOURCES, metaUrl, reviewUrl } from './config.js';
import { mb, streamJsonl } from './stream.js';

export const ruleKey = (r) => `${r.category}::${r.sub}`;

const canonicalBrands = new Map();
for (const rule of RULES) {
  for (const b of rule.brands) {
    const key = b.toLowerCase();
    const prev = canonicalBrands.get(key);
    // prefer mixed-case spellings ("Samsung" over "SAMSUNG") unless only caps exist
    if (!prev || (prev === prev.toUpperCase() && b !== b.toUpperCase())) canonicalBrands.set(key, b);
  }
}
export const canonicalBrand = (store) => canonicalBrands.get(String(store || '').trim().toLowerCase());

export function parsePrice(value) {
  if (value === null || value === undefined) return null;
  const m = String(value).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function pickImages(images = []) {
  const urls = [];
  for (const img of images) {
    const url = img.hi_res || img.large;
    if (url && /^https:\/\/m\.media-amazon\.com\/images\//.test(url) && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** Basic record quality gate shared by all rules (blank fields, invalid prices, missing images). */
export function qualifies(o, rule) {
  const price = parsePrice(o.price);
  if (!price || price < rule.usd[0] || price > rule.usd[1]) return false;
  if (!o.title || o.title.length < 15 || o.title.length > 260) return false;
  if (!rule.title.test(o.title) || rule.exclude.test(o.title)) return false;
  const brand = canonicalBrand(o.store);
  if (!brand || !rule.brands.some((b) => b.toLowerCase() === brand.toLowerCase())) return false;
  if (pickImages(o.images).length < 2) return false;
  if (!o.average_rating || (o.rating_number || 0) < 5) return false;
  if (!(o.features?.length || o.description?.length)) return false;
  return true;
}

async function scanMeta(source, log) {
  const rules = RULES.filter((r) => r.source === source);
  const buckets = Object.fromEntries(rules.map((r) => [ruleKey(r), []]));
  const seen = new Set();
  const cap = (r) => r.quota * CANDIDATE_MULTIPLIER;
  const full = () => rules.every((r) => buckets[ruleKey(r)].length >= cap(r));
  let records = 0;
  const maxBytes = SOURCES[source].metaMaxMB * 1e6;
  for await (const o of streamJsonl(metaUrl(source), {
    maxBytes,
    onProgress: (b) => log(`  ${source}: ${mb(b)} scanned, ${records} records, ${Object.values(buckets).reduce((s, x) => s + x.length, 0)} candidates`),
  })) {
    records += 1;
    if (seen.has(o.parent_asin)) continue; // duplicate listings
    const catPath = (o.categories || []).join(' > ');
    const rule = rules.find((r) => r.path.test(catPath) && buckets[ruleKey(r)].length < cap(r) && qualifies(o, r));
    if (!rule) continue;
    seen.add(o.parent_asin);
    buckets[ruleKey(rule)].push({
      asin: o.parent_asin,
      title: o.title,
      store: o.store,
      price: parsePrice(o.price),
      average_rating: o.average_rating,
      rating_number: o.rating_number,
      features: o.features || [],
      description: o.description || [],
      images: pickImages(o.images),
      details: o.details || {},
      categories: o.categories || [],
      source,
    });
    if (full()) break;
  }
  return { buckets, records };
}

async function scanReviews(source, asins, log) {
  const wanted = new Set(asins);
  const out = {};
  let n = 0;
  const maxBytes = SOURCES[source].reviewMaxMB * 1e6;
  for await (const r of streamJsonl(reviewUrl(source), {
    maxBytes,
    onProgress: (b) => log(`  ${source} reviews: ${mb(b)} scanned, ${n} matched`),
  })) {
    if (!wanted.has(r.parent_asin)) continue;
    const list = (out[r.parent_asin] ||= []);
    if (list.length >= 12) continue;
    list.push({ rating: r.rating, title: r.title, text: r.text, timestamp: r.timestamp, verified: r.verified_purchase, helpful: r.helpful_vote });
    n += 1;
  }
  return out;
}

export async function download({ log = console.log } = {}) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const candidates = {};
  const reviews = {};
  for (const source of Object.keys(SOURCES)) {
    log(`[download] Streaming metadata: ${source}`);
    const { buckets, records } = await scanMeta(source, log);
    Object.assign(candidates, buckets);
    const summary = Object.entries(buckets).map(([k, v]) => `${k.split('::')[1]}=${v.length}`).join(', ');
    log(`[download] ${source}: ${records} records scanned -> ${summary}`);
    const asins = Object.values(buckets).flat().map((c) => c.asin);
    log(`[download] Streaming reviews for ${asins.length} candidates: ${source}`);
    Object.assign(reviews, await scanReviews(source, asins, log));
  }
  fs.writeFileSync(path.join(RAW_DIR, 'candidates.json'), JSON.stringify(candidates));
  fs.writeFileSync(path.join(RAW_DIR, 'reviews.raw.json'), JSON.stringify(reviews));
  const total = Object.values(candidates).reduce((s, v) => s + v.length, 0);
  log(`[download] Saved ${total} candidates and reviews for ${Object.keys(reviews).length} products to ${RAW_DIR}`);
  return { candidates, reviews };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let last = 0;
  download({
    log: (m) => {
      // throttle progress lines
      if (!m.startsWith('  ') || Date.now() - last > 15000) {
        last = Date.now();
        console.log(m);
      }
    },
  }).catch((err) => {
    console.error('[download] Failed:', err.message);
    process.exit(1);
  });
}
