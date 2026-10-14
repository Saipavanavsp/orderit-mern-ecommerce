// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
// "ShopVerse Assistant": answers shopping questions using ONLY products from our catalog.
// Uses the Anthropic API server-side when ANTHROPIC_API_KEY is set; otherwise a rule-based engine.
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { Product } from '../models/Product.js';
import { logger } from '../utils/logger.js';
import { formatINR } from '../utils/format.js';
import { listAvailable } from './coupon.service.js';
import { naturalLanguageSearch } from './nlSearch.service.js';
import { toPublic } from './product.service.js';

let client = null;
export function getClient() {
  if (!env.anthropic.enabled) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropic.apiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}
/** Test hook: inject a fake client. */
export function setClient(fake) {
  client = fake;
}

const POLICIES = () => [
  `Shipping is free on orders of ${formatINR(env.pricing.freeShippingThreshold)} or more, otherwise ${formatINR(env.pricing.shippingFee)}. Delivery takes 3-7 business days.`,
  `GST of ${Math.round(env.pricing.taxRate * 100)}% is added at checkout.`,
  'Payments: UPI/cards/netbanking via Razorpay, or Cash on Delivery.',
  'Returns: unused items can be returned within 7 days of delivery. Orders can be cancelled until they are shipped (My Orders page).',
];

// Stable prefix: identical on every request.
const SYSTEM_PROMPT = `You are "ShopVerse Assistant", the shopping assistant of the OrderIt online store (India, prices in INR).

What you do:
- Help customers find products, compare options, and understand store policies.
- Recommend products ONLY from the <catalog> provided with each question. Never invent products, prices, specifications, stock levels or offers. If nothing in the catalog fits, say so plainly and suggest how to refine the search (budget, brand, category).
- When you recommend a catalog product, write its name followed by its id in double square brackets, for example: Samsung Galaxy M14 5G [[samsung-galaxy-m14-5g]]. Use only ids that appear in the catalog.
- Quote prices exactly as given, in rupees (₹). Mention stock only if it is low or zero.
- For order status, tell the customer to open "My Orders"; you cannot see individual orders.
- Politely decline topics unrelated to shopping at this store.

Style: friendly, concise (under 120 words), plain sentences or a short list. No markdown headings.

Store policies:
${POLICIES().map((p) => `- ${p}`).join('\n')}`;

function catalogLine(p) {
  const specs = (p.specifications || []).slice(0, 4).map((s) => `${s.label}: ${s.value}`).join('; ');
  return JSON.stringify({
    id: p.slug,
    name: p.name,
    brand: p.brand?.name || '',
    category: p.category?.name || '',
    price: p.price,
    mrp: p.mrp,
    discountPercent: p.discountPercent,
    rating: p.rating,
    reviews: p.numReviews,
    stock: p.stock,
    specs,
  });
}

async function retrieveCandidates(question, contextSlug) {
  const nl = await naturalLanguageSearch(question, { limit: 8 });
  let products = nl.products;
  if (contextSlug) {
    const current = await Product.findOne({ slug: contextSlug, isActive: true })
      .populate([{ path: 'brand', select: 'name slug' }, { path: 'category', select: 'name slug' }])
      .lean();
    if (current) products = [toPublic(current), ...products.filter((p) => p.slug !== contextSlug)];
  }
  // Needs full specs for grounding.
  const full = await Product.find({ slug: { $in: products.map((p) => p.slug) } })
    .select('slug specifications')
    .lean();
  const specsBySlug = new Map(full.map((f) => [f.slug, f.specifications]));
  products = products.slice(0, 8).map((p) => ({ ...p, specifications: specsBySlug.get(p.slug) || [] }));
  return { products, interpreted: nl.interpreted };
}

function card(p) {
  return {
    _id: p._id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    mrp: p.mrp,
    discountPercent: p.discountPercent,
    rating: p.rating,
    image: p.images?.[0]?.url || '',
    inStock: p.stock > 0,
  };
}

/** Pulls [[slug]] markers out of the reply, keeping only slugs we actually supplied. */
export function extractRecommendations(reply, candidates) {
  const bySlug = new Map(candidates.map((p) => [p.slug, p]));
  const picked = [];
  const text = reply
    .replace(/\s*\[\[([a-z0-9-]+)\]\]/g, (_m, slug) => {
      if (bySlug.has(slug) && !picked.includes(slug)) picked.push(slug);
      return '';
    })
    .trim();
  return { text, products: picked.map((s) => card(bySlug.get(s))) };
}

const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);
const EFFORT_MODELS = /^claude-(fable-5|opus-5|opus-4-[678]|sonnet-5|sonnet-4-6|haiku-5)/;

async function askClaude(messages, candidates) {
  const anthropic = getClient();
  const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  const question = messages[messages.length - 1].content;
  const catalog = candidates.length ? candidates.map(catalogLine).join('\n') : '(no matching products)';
  const model = env.anthropic.model;
  const response = await anthropic.beta.messages.create({
    model,
    max_tokens: 4096,
    // Server-side refusal fallback ("default" routing) - only on models that support it.
    ...(FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    // Short shopping answers: low effort keeps latency and cost down.
    ...(EFFORT_MODELS.test(model) ? { output_config: { effort: 'low' } } : {}),
    system: SYSTEM_PROMPT,
    messages: [
      ...history,
      { role: 'user', content: `<catalog>\n${catalog}\n</catalog>\n\nCustomer question: ${question}` },
    ],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return text || null;
}

// ---------- Rule-based fallback ----------
const INTENTS = [
  { name: 'greeting', re: /^(hi|hello|hey|namaste|good (morning|evening|afternoon))\b/ },
  { name: 'shipping', re: /\b(ship|shipping|delivery|deliver|courier|dispatch)\b/ },
  { name: 'returns', re: /\b(return|refund|exchange|replace|replacement)\b/ },
  { name: 'payment', re: /\b(pay|payment|upi|card|cod|cash on delivery|emi|razorpay)\b/ },
  { name: 'coupon', re: /\b(coupon|promo|discount code|voucher|offer code)\b/ },
  { name: 'order', re: /\b(my order|track|tracking|where is|order status|cancel)\b/ },
  { name: 'help', re: /\b(help|what can you do)\b/ },
];

async function ruleBasedReply(question, candidates, interpreted) {
  const q = question.toLowerCase().trim();
  const intent = INTENTS.find((i) => i.re.test(q))?.name;
  const hasProductSignal = Boolean(
    interpreted.category || interpreted.brand || interpreted.maxPrice || interpreted.minPrice || interpreted.keywords?.length,
  );

  if (intent === 'greeting' && !hasProductSignal) {
    return { text: 'Hi! I am the ShopVerse Assistant. Tell me what you are looking for, e.g. "phone under 20000 with good camera".', products: [] };
  }
  if (intent === 'shipping') return { text: POLICIES()[0], products: [] };
  if (intent === 'returns') return { text: POLICIES()[3], products: [] };
  if (intent === 'payment') return { text: `${POLICIES()[2]} ${POLICIES()[1]}`, products: [] };
  if (intent === 'order') {
    return { text: 'You can track or cancel orders from "My Orders" in your account menu. Orders can be cancelled until they are shipped.', products: [] };
  }
  if (intent === 'coupon') {
    const coupons = await listAvailable();
    if (!coupons.length) return { text: 'There are no active coupons right now.', products: [] };
    const list = coupons
      .slice(0, 4)
      .map((c) => `${c.code}: ${c.description || (c.discountType === 'percent' ? `${c.discountValue}% off` : `${formatINR(c.discountValue)} off`)}${c.minOrderValue ? ` (min ${formatINR(c.minOrderValue)})` : ''}`)
      .join('; ');
    return { text: `Active coupons: ${list}. Apply them in your cart.`, products: [] };
  }
  if (intent === 'help' && !hasProductSignal) {
    return { text: 'I can find products by budget, brand or feature, and answer questions about shipping, returns, payments and coupons.', products: [] };
  }

  const top = candidates.slice(0, 3);
  if (!top.length) {
    return {
      text: 'I could not find matching products in our catalog. Try a different budget, brand or category (Mobiles, Electronics, TV & Appliances, Home Appliances, Fashion, Accessories).',
      products: [],
    };
  }
  const label = interpreted.summary?.length ? ` (${interpreted.summary.join(', ')})` : '';
  const lines = top.map(
    (p) => `${p.name} at ${formatINR(p.price)}${p.discountPercent ? ` (${p.discountPercent}% off)` : ''}, rated ${p.rating || 'new'}${p.rating ? '★' : ''}${p.stock > 0 && p.stock <= env.lowStockThreshold ? `, only ${p.stock} left` : ''}`,
  );
  const relaxedNote = interpreted.relaxed ? ' I could not match every keyword, so these are the closest options.' : '';
  return { text: `Here are some options${label}: ${lines.join('; ')}.${relaxedNote}`, products: top.map(card) };
}

export async function chat({ messages, productSlug }) {
  const question = messages[messages.length - 1].content;
  const { products: candidates, interpreted } = await retrieveCandidates(question, productSlug);

  if (getClient()) {
    try {
      const reply = await askClaude(messages, candidates);
      if (reply) {
        const { text, products } = extractRecommendations(reply, candidates);
        return { reply: text, products, source: 'claude', interpreted };
      }
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) logger.error('Anthropic API key rejected; using rule-based assistant');
      else if (err instanceof Anthropic.RateLimitError) logger.warn('Anthropic rate limit hit; using rule-based assistant');
      else if (err instanceof Anthropic.APIError) logger.warn(`Anthropic API error ${err.status}; using rule-based assistant`);
      else logger.warn(`Assistant error (${err.message}); using rule-based assistant`);
    }
  }
  const { text, products } = await ruleBasedReply(question, candidates, interpreted);
  return { reply: text, products, source: 'rule-based', interpreted };
}
