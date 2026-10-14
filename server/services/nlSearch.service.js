// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
// Natural-language query parser: "phone under 20000 with good camera" -> structured filters.
import { Brand } from '../models/Brand.js';
import { listProducts } from './product.service.js';

const CATEGORY_KEYWORDS = [
  { slug: 'mobiles', words: ['phone', 'phones', 'mobile', 'mobiles', 'smartphone', 'smartphones', 'iphone', 'android'] },
  {
    slug: 'tv-and-appliances',
    words: ['tv', 'tvs', 'television', 'televisions', 'smart tv', 'soundbar', 'soundbars', 'projector', 'home theater', 'home theatre'],
  },
  {
    slug: 'home-appliances',
    words: [
      'washing machine', 'washer', 'refrigerator', 'fridge', 'microwave', 'oven', 'mixer', 'blender', 'air fryer',
      'vacuum', 'kettle', 'coffee maker', 'toaster', 'air purifier', 'dishwasher', 'appliance', 'appliances', 'iron',
    ],
  },
  {
    slug: 'electronics',
    words: [
      'laptop', 'laptops', 'notebook', 'headphone', 'headphones', 'earbuds', 'earphones', 'camera', 'cameras', 'tablet',
      'tablets', 'ipad', 'speaker', 'speakers', 'monitor', 'keyboard', 'mouse', 'smartwatch', 'smart watch', 'fitness band', 'gaming console',
    ],
  },
  {
    slug: 'fashion',
    words: [
      'shirt', 'shirts', 't-shirt', 'tshirt', 'jeans', 'dress', 'dresses', 'shoes', 'sneakers', 'jacket', 'kurta',
      'trousers', 'shorts', 'hoodie', 'sweater', 'clothing', 'clothes', 'boots', 'sandals', 'top', 'tops',
    ],
  },
  {
    slug: 'accessories',
    words: [
      'watch', 'watches', 'bag', 'bags', 'backpack', 'wallet', 'sunglasses', 'belt', 'charger', 'power bank',
      'powerbank', 'cable', 'case', 'cover', 'handbag', 'jewellery', 'jewelry',
    ],
  },
];

// Product-type words -> exact sub-category (more precise than full-text search, which also matches
// descriptions, e.g. a laptop's "headphone jack"). Longest phrases first.
const SUBTYPES = [
  ['Mobiles', 'Smartphones', ['smartphone', 'smartphones', 'iphone', 'android phone']],
  ['Electronics', 'Smartwatches', ['smartwatch', 'smartwatches', 'smart watch', 'fitness band', 'fitness tracker']],
  ['Electronics', 'Laptops', ['laptop', 'laptops', 'notebook', 'chromebook', 'macbook']],
  ['Electronics', 'Tablets', ['tablet', 'tablets', 'ipad']],
  ['Electronics', 'Headphones & Earbuds', ['headphones', 'headphone', 'earbuds', 'earphones', 'airpods', 'headset']],
  ['Electronics', 'Speakers', ['bluetooth speaker', 'speakers', 'speaker']],
  ['Electronics', 'Cameras', ['digital camera', 'cameras', 'camcorder']],
  ['TV & Appliances', 'Soundbars & Home Theatre', ['sound bar', 'soundbar', 'soundbars', 'home theater', 'home theatre']],
  ['TV & Appliances', 'Televisions', ['smart tv', 'television', 'televisions', 'tvs', 'tv']],
  ['TV & Appliances', 'Washing Machines', ['washing machine', 'washer']],
  ['TV & Appliances', 'Refrigerators & Freezers', ['refrigerator', 'fridge', 'freezer']],
  ['TV & Appliances', 'Dishwashers & Cooking Ranges', ['dishwasher', 'cooktop', 'cooking range']],
  ['Home Appliances', 'Mixers & Blenders', ['food processor', 'blender', 'mixer', 'juicer']],
  ['Home Appliances', 'Microwaves & Ovens', ['microwave', 'toaster', 'oven']],
  ['Home Appliances', 'Coffee Makers', ['coffee maker', 'coffee machine', 'espresso']],
  ['Home Appliances', 'Cookers & Fryers', ['air fryer', 'rice cooker', 'pressure cooker', 'instant pot', 'fryer', 'cooker']],
  ['Home Appliances', 'Vacuum Cleaners', ['robot vacuum', 'vacuum cleaner', 'vacuum']],
  ['Home Appliances', 'Air Care & Ironing', ['air purifier', 'purifier', 'humidifier', 'heater', 'fan', 'iron']],
  ['Fashion', 'Footwear', ['running shoes', 'sneakers', 'shoes', 'boots', 'sandals', 'loafers']],
  ['Accessories', 'Watches', ['watches', 'watch']],
  ['Accessories', 'Sunglasses', ['sunglasses']],
  ['Accessories', 'Bags & Backpacks', ['backpack', 'luggage', 'suitcase', 'duffel', 'handbag', 'bag']],
  ['Accessories', 'Wallets & Belts', ['wallet', 'belt']],
  ['Accessories', 'Chargers & Power Banks', ['power bank', 'powerbank', 'charger']],
];
const slugOf = (name) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-');

// Product-type words that also make good text-search keywords.
const TYPE_KEYWORDS = new Set(
  CATEGORY_KEYWORDS.flatMap((c) => c.words).filter((w) => !['appliance', 'appliances', 'clothing', 'clothes', 'phones', 'mobiles', 'mobile', 'phone'].includes(w)),
);

const STOPWORDS = new Set(
  'a an the and or for with without in on of to me my i want need show find get buy looking look some any best good great nice cheap cheapest top latest new newest under below less than within upto up rs inr price budget around about range between from over above more min max maximum minimum which is are that this please can you recommend suggest something rated rating star stars review reviews quality value money worth popular trending lowest highest affordable decent having has have'.split(
    ' ',
  ),
);

const FEATURE_PHRASES = [
  'noise cancelling', 'noise cancellation', 'fast charging', 'wireless', 'bluetooth', 'gaming', '5g', 'camera', 'battery',
  'waterproof', 'amoled', 'oled', 'qled', '4k', 'inverter', 'front load', 'top load', 'double door', 'single door',
  'cotton', 'leather', 'running', 'slim fit', 'smart',
];

function toNumber(raw) {
  if (!raw) return undefined;
  const m = String(raw).toLowerCase().replace(/[,₹\s]/g, '').match(/^(\d+(?:\.\d+)?)(k|thousand|l|lakh|lakhs|lac)?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const mult = { k: 1e3, thousand: 1e3, l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5 }[m[2]] || 1;
  return Math.round(n * mult);
}

const NUM = '(?:₹|rs\\.?|inr)?\\s*(\\d[\\d,]*(?:\\.\\d+)?\\s*(?:k|thousand|lakhs?|lac|l)?)\\b';

let brandCache = { at: 0, brands: [] };
async function getBrands() {
  if (Date.now() - brandCache.at > 60_000) {
    brandCache = { at: Date.now(), brands: await Brand.find({ isActive: true }).select('name slug').lean() };
  }
  return brandCache.brands;
}

export function _resetBrandCache() {
  brandCache = { at: 0, brands: [] };
}

/** Pure parser (brands passed in) so it is easy to unit test. */
export function parseQuery(query, brands = []) {
  const text = ` ${String(query).toLowerCase().replace(/\s+/g, ' ').trim()} `;
  const filters = {};
  const notes = [];
  let rest = text;

  const between = text.match(new RegExp(`between\\s+${NUM}\\s+(?:and|to|-)\\s+${NUM}`)) ||
    text.match(new RegExp(`${NUM}\\s*(?:-|to)\\s*${NUM}`));
  if (between) {
    const a = toNumber(between[1]);
    const b = toNumber(between[2]);
    if (a && b && a < b) {
      filters.minPrice = a;
      filters.maxPrice = b;
      rest = rest.replace(between[0], ' ');
    }
  }
  if (!filters.maxPrice) {
    const under = text.match(new RegExp(`(?:under|below|less than|within|upto|up to|max(?:imum)?|budget(?: of)?|cheaper than)\\s+${NUM}`));
    if (under) {
      filters.maxPrice = toNumber(under[1]);
      rest = rest.replace(under[0], ' ');
    }
  }
  if (!filters.minPrice) {
    const over = text.match(new RegExp(`(?:over|above|more than|min(?:imum)?|starting|at least)\\s+${NUM}`));
    if (over) {
      filters.minPrice = toNumber(over[1]);
      rest = rest.replace(over[0], ' ');
    }
  }
  if (filters.minPrice) notes.push(`above ₹${filters.minPrice.toLocaleString('en-IN')}`);
  if (filters.maxPrice) notes.push(`under ₹${filters.maxPrice.toLocaleString('en-IN')}`);

  const ratingMatch = text.match(/(\d(?:\.\d)?)\s*(?:\+|plus)?\s*(?:star|stars|rating|rated)/);
  if (ratingMatch && Number(ratingMatch[1]) <= 5) {
    filters.rating = Number(ratingMatch[1]);
    rest = rest.replace(ratingMatch[0], ' ');
  } else if (/\b(top rated|best rated|highly rated|good reviews|well reviewed|good rating)\b/.test(text)) {
    filters.rating = 4;
  }
  if (filters.rating) notes.push(`${filters.rating}★ & above`);

  if (/\b(cheapest|lowest price|low to high|budget|affordable|cheap)\b/.test(text)) filters.sort = 'price_asc';
  else if (/\b(most expensive|premium|high to low|flagship)\b/.test(text)) filters.sort = 'price_desc';
  else if (/\b(latest|newest|new arrivals?|just launched)\b/.test(text)) filters.sort = 'newest';
  else if (/\b(best|top rated|highest rated)\b/.test(text)) filters.sort = 'rating';
  else if (/\b(popular|trending|bestsell(?:er|ing))\b/.test(text)) filters.sort = 'popularity';

  if (/\b(discount|deal|deals|offer|offers|sale)\b/.test(text)) filters.minDiscount = 20;
  if (/\bin stock\b|\bavailable\b/.test(text)) filters.inStock = true;

  // 1) A specific product type ("headphones", "mobile charger", "smart watch") wins: it fixes both
  //    the category and the exact sub-category.
  for (const [catName, sub, words] of SUBTYPES) {
    const word = words.find((w) => new RegExp(`\\b${w}\\b`).test(text));
    if (!word) continue;
    filters.category = [slugOf(catName)];
    if (sub !== 'Smartphones') {
      filters.subCategory = sub;
      notes.unshift(sub);
    }
    rest = rest.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
    break;
  }
  // 2) Otherwise fall back to broad category words ("phone", "appliances", "clothes"). Feature words
  //    such as "camera" in "phone with good camera" stay as search keywords.
  if (!filters.category) {
    for (const c of CATEGORY_KEYWORDS) {
      if (c.words.some((w) => new RegExp(`\\b${w}\\b`).test(text))) {
        filters.category = [c.slug];
        break;
      }
    }
  }

  const matchedBrands = brands.filter((b) => new RegExp(`\\b${b.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
  if (matchedBrands.length) {
    filters.brand = matchedBrands.map((b) => b.slug);
    matchedBrands.forEach((b) => {
      rest = rest.replace(new RegExp(`\\b${b.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ');
    });
    notes.push(matchedBrands.map((b) => b.name).join(', '));
  }

  const keywords = [];
  for (const phrase of FEATURE_PHRASES) {
    if (rest.includes(` ${phrase} `)) {
      keywords.push(phrase);
      rest = rest.replace(` ${phrase} `, ' ');
    }
  }
  for (const word of rest.split(/[^a-z0-9-]+/)) {
    if (word.length < 2 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
    if (CATEGORY_KEYWORDS.some((c) => c.words.includes(word)) && !TYPE_KEYWORDS.has(word)) continue;
    keywords.push(word);
  }
  const uniqueKeywords = [...new Set(keywords)].slice(0, 6);
  return { filters, keywords: uniqueKeywords, notes };
}

/** Parses the query and runs it; relaxes keywords when they would return nothing. */
export async function naturalLanguageSearch(query, { page = 1, limit = 12 } = {}) {
  const parsed = parseQuery(query, await getBrands());
  const base = { sort: 'relevance', page, limit, ...parsed.filters };
  let relaxed = false;
  let result = await listProducts({ ...base, search: parsed.keywords.join(' ') || undefined });
  if (result.total === 0 && parsed.keywords.length && Object.keys(parsed.filters).length) {
    relaxed = true;
    result = await listProducts(base);
  }
  return {
    query,
    interpreted: { ...parsed.filters, keywords: parsed.keywords, summary: parsed.notes, relaxed },
    products: result.items,
    total: result.total,
  };
}
