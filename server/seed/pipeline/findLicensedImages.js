// Pre-deployment helper: finds freely-licensed photos on Wikimedia Commons that match each product
// title (brand + model words) and writes CANDIDATES for manual review. Nothing is auto-approved:
// copy the entries you have checked into server/seed/data/licensed-images.json, then set
// IMAGE_SOURCE=licensed in server/.env and run "npm run seed".
//   node server/seed/pipeline/findLicensedImages.js [--limit 20]
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, RAW_DIR } from './config.js';

const API = 'https://commons.wikimedia.org/w/api.php';
const ALLOWED = /^(cc0|cc by(-sa)? [\d.]+|public domain|pd)/i;
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const queryFor = (p) => p.name.replace(/[,()]/g, ' ').split(/\s+/).slice(0, 5).join(' ');

async function search(q) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '5', gsrsearch: `${q} filetype:bitmap`,
    prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '800', origin: '*',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'OrderIt-capstone/1.0 (educational project)' } });
  if (!res.ok) throw new Error(`Commons API HTTP ${res.status}`);
  const data = await res.json();
  return Object.values(data.query?.pages || {})
    .map((pg) => {
      const info = pg.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      return {
        title: pg.title,
        url: info?.thumburl || info?.url,
        sourceUrl: info?.descriptionurl,
        license: meta.LicenseShortName?.value || '',
        author: (meta.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
        width: info?.width,
      };
    })
    .filter((c) => c.url && ALLOWED.test(c.license) && c.width >= 400);
}

const products = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8')).slice(0, LIMIT);
const out = {};
for (const p of products) {
  try {
    const found = await search(queryFor(p));
    // Require the brand and at least one model token in the file title to reduce mismatches.
    const tokens = queryFor(p).toLowerCase().split(' ').slice(1).filter((t) => t.length > 2);
    out[p.source.sourceId] = {
      product: p.name,
      candidates: found.filter((c) => c.title.toLowerCase().includes(p.brand.toLowerCase().split(' ')[0]) && tokens.some((t) => c.title.toLowerCase().includes(t))),
    };
    console.log(`[licensed] ${p.name.slice(0, 60)}: ${out[p.source.sourceId].candidates.length} candidate(s)`);
  } catch (err) {
    console.log(`[licensed] ${p.name.slice(0, 60)}: error ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 300)); // be polite to the API
}
fs.mkdirSync(RAW_DIR, { recursive: true });
const file = path.join(RAW_DIR, 'licensed-images.candidates.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`[licensed] Wrote ${file}. Review each candidate visually, then copy approved ones to server/seed/data/licensed-images.json as:`);
console.log('  { "<sourceId>": [{ "url": "...", "license": "CC BY-SA 4.0", "author": "...", "sourceUrl": "..." }] }');
