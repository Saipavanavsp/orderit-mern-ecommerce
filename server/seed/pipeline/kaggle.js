// Optional source: Flipkart products dataset on Kaggle (PromptCloudHQ/flipkart-products, CC BY-SA 4.0).
// Requires the official Kaggle CLI + your API token. Usage:  node server/seed/pipeline/kaggle.js
// Produces raw/candidates.kaggle.json in the same shape as download.js, merged by clean.js when present.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { RAW_DIR, RULES } from './config.js';
import { canonicalBrand, ruleKey } from './download.js';

export const KAGGLE_DATASET = 'PromptCloudHQ/flipkart-products';

export function printKaggleHelp() {
  console.log(`
[kaggle] The Kaggle source needs the Kaggle CLI and your API token (one-time setup, PowerShell):

  1. pip install kaggle
  2. Sign in at https://www.kaggle.com -> Settings -> API -> "Create New Token" (downloads kaggle.json)
  3. New-Item -ItemType Directory -Force "$env:USERPROFILE\\.kaggle"
     Move-Item "$env:USERPROFILE\\Downloads\\kaggle.json" "$env:USERPROFILE\\.kaggle\\kaggle.json"
  4. node server/seed/pipeline/kaggle.js
  5. npm run dataset:build -- --skip-download     (re-clean + validate images with the extra rows)

The Hugging Face source used by default needs no credentials, so seeding works without this step.
`);
}

/** RFC 4180 CSV parser (handles quotes, escaped quotes and newlines inside fields). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...data] = rows.filter((r) => r.length > 1);
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// Flipkart category tree prefix -> our rule (category::sub)
const TREE_MAP = [
  [/^Mobiles & Accessories >> Mobiles\b/, 'Mobiles::Smartphones'],
  [/^Computers >> Laptops/, 'Electronics::Laptops'],
  [/^Cameras & Accessories >> Cameras/, 'Electronics::Cameras'],
  [/Headphones|Headsets/, 'Electronics::Headphones & Earbuds'],
  [/^Watches >> Wrist Watches/, 'Accessories::Watches'],
  [/^Sunglasses/, 'Accessories::Sunglasses'],
  [/^Bags, Wallets & Belts >> (Bags|Backpacks)/, 'Accessories::Bags & Backpacks'],
  [/^Bags, Wallets & Belts >> (Wallets|Belts)/, 'Accessories::Wallets & Belts'],
  [/Power Banks|Mobile Chargers/, 'Accessories::Chargers & Power Banks'],
  [/^Footwear/, 'Fashion::Footwear'],
  [/^Clothing >> Men's Clothing/, "Fashion::Men's Clothing"],
  [/^Clothing >> Women's Clothing/, "Fashion::Women's Clothing"],
  [/Mixer|Juicer|Grinder|Blender/, 'Home Appliances::Mixers & Blenders'],
  [/Microwave|Oven Toaster/, 'Home Appliances::Microwaves & Ovens'],
  [/Coffee Maker/, 'Home Appliances::Coffee Makers'],
  [/Vacuum Cleaner/, 'Home Appliances::Vacuum Cleaners'],
  [/Television/, 'TV & Appliances::Televisions'],
  [/Washing Machine/, 'TV & Appliances::Washing Machines'],
  [/Refrigerator/, 'TV & Appliances::Refrigerators & Freezers'],
];

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function normalizeFlipkart(rows) {
  const ruleKeys = new Set(RULES.map(ruleKey));
  const out = {};
  for (const r of rows) {
    const tree = (r.product_category_tree || '').replace(/^\["|"\]$/g, '');
    const key = TREE_MAP.find(([re]) => re.test(tree))?.[1];
    if (!key || !ruleKeys.has(key)) continue;
    const brand = canonicalBrand(r.brand);
    const price = Number(r.discounted_price);
    const mrp = Number(r.retail_price);
    const images = safeJson(r.image, []);
    if (!brand || !price || !mrp || price > mrp || !Array.isArray(images) || !images.length || !r.product_name || !r.description) continue;
    // product_specifications looks like {"product_specification"=>[{"key"=>"Brand", "value"=>"X"}, ...]}
    const specList = safeJson((r.product_specifications || '').replace(/=>/g, ':'), {}).product_specification || [];
    const specs = Object.fromEntries(specList.filter((s) => s.key).map((s) => [s.key, s.value]));
    (out[key] ||= []).push({
      asin: `fk-${r.uniq_id || r.pid}`,
      title: r.product_name,
      store: brand,
      priceInr: price,
      mrpInr: mrp,
      price: price / 83,
      average_rating: Number(r.product_rating) || 0,
      rating_number: 0,
      features: [],
      description: [r.description],
      images: images.map((u) => u.replace(/^http:/, 'https:')),
      details: specs,
      categories: tree.split(' >> '),
      source: 'kaggle:flipkart-products',
    });
  }
  return out;
}

export function runKaggle() {
  const token = path.join(os.homedir(), '.kaggle', 'kaggle.json');
  const cli = spawnSync('kaggle', ['--version'], { shell: true, encoding: 'utf8' });
  if (cli.status !== 0 || !fs.existsSync(token)) {
    printKaggleHelp();
    return null;
  }
  const dir = path.join(RAW_DIR, 'kaggle');
  fs.mkdirSync(dir, { recursive: true });
  const dl = spawnSync('kaggle', ['datasets', 'download', '-d', KAGGLE_DATASET, '-p', dir, '--unzip'], { shell: true, stdio: 'inherit' });
  if (dl.status !== 0) throw new Error('kaggle download failed');
  const csv = fs.readdirSync(dir).find((f) => f.endsWith('.csv'));
  const rows = parseCsv(fs.readFileSync(path.join(dir, csv), 'utf8'));
  const candidates = normalizeFlipkart(rows);
  fs.writeFileSync(path.join(RAW_DIR, 'candidates.kaggle.json'), JSON.stringify(candidates));
  console.log(`[kaggle] ${rows.length} rows -> ${Object.values(candidates).flat().length} candidates in raw/candidates.kaggle.json`);
  return candidates;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runKaggle();
  } catch (err) {
    console.error(`[kaggle] ${err.message}`);
    process.exit(1);
  }
}
