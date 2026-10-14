// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { cleanSpecs, cleanTitle, inrPrice } from '../seed/pipeline/clean.js';
import { parsePrice, pickImages, qualifies } from '../seed/pipeline/download.js';
import { normalizeFlipkart, parseCsv } from '../seed/pipeline/kaggle.js';
import { RULES } from '../seed/pipeline/config.js';

const phoneRule = RULES.find((r) => r.sub === 'Smartphones');

describe('Dataset pipeline - cleaning', () => {
  test('cleans long marketplace titles and normalises brand casing', () => {
    expect(cleanTitle('SAMSUNG Galaxy S23 Ultra, Factory Unlocked Android Smartphone, 256GB, 200MP Camera, Night Mode', 'Samsung'))
      .toBe('Samsung Galaxy S23 Ultra, Android Smartphone');
    expect(cleanTitle('Wireless Earbuds Bluetooth 5.3 | Noise Cancelling', 'JBL')).toBe('JBL Wireless Earbuds Bluetooth 5.3, Noise Cancelling');
    expect(cleanTitle('Fujifilm FinePix S8200 16.2MP Digital Camera with 3-Inch LCD (Black) (OLD MODEL)', 'Fujifilm')).toBe('Fujifilm FinePix S8200 16.2MP Digital Camera with 3-Inch LCD (Black)');
    expect(cleanTitle('Samsung 32-inch Class LED Smart FHD TV 1080P (UN32N5300AFXZA, 2018 Model)', 'Samsung')).toBe('Samsung 32-inch Class LED Smart FHD TV 1080P');
    expect(cleanTitle('Elite Gourmet EGC007CHC# Rapid Egg Cooker', 'Elite Gourmet')).toBe('Elite Gourmet Rapid Egg Cooker');
    expect(cleanTitle('Skullcandy Jib True Wireless Earbud with Microphone / 22 Hour Battery Life / Use with iPhone', 'Skullcandy'))
      .toBe('Skullcandy Jib True Wireless Earbud with Microphone');
    expect(cleanTitle('Xiaomi M5s 4G LTE GSM (128GB + 6GB) 64MP Quad Camera (NOT for USA Market) Global Unlocked', 'Xiaomi'))
      .toBe('Xiaomi M5s 4G LTE GSM (128GB + 6GB) 64MP Quad Camera Global Unlocked');
  });

  test('converts USD to realistic INR price points', () => {
    expect(inrPrice(199.99)).toBe(16599);
    expect(inrPrice(9.99)).toBe(829);
  });

  test('parses prices and rejects blanks', () => {
    expect(parsePrice('1,299.50')).toBe(1299.5);
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice('')).toBeNull();
  });

  test('keeps relevant specs and drops irrelevant columns', () => {
    const specs = cleanSpecs({ 'Best Sellers Rank': '#1', ASIN: 'B0X', 'Screen Size': '6.6 Inches', RAM: '8 GB', Color: 'Black' }, 'Samsung');
    expect(specs.map((s) => s.label)).toEqual(['Brand', 'Screen Size', 'RAM', 'Color']);
  });

  test('only Amazon CDN images are accepted, de-duplicated', () => {
    const imgs = pickImages([
      { large: 'https://m.media-amazon.com/images/I/a.jpg', hi_res: null },
      { large: 'https://m.media-amazon.com/images/I/a.jpg' },
      { large: 'http://example.com/x.jpg' },
    ]);
    expect(imgs).toEqual(['https://m.media-amazon.com/images/I/a.jpg']);
  });

  test('quality gate rejects refurbished, unbranded and unpriced records', () => {
    const base = {
      title: 'Samsung Galaxy A54 5G Unlocked Smartphone 128GB', store: 'SAMSUNG', price: '349.99', average_rating: 4.3, rating_number: 120,
      features: ['6.4 inch display'], images: [{ large: 'https://m.media-amazon.com/images/I/1.jpg' }, { large: 'https://m.media-amazon.com/images/I/2.jpg' }],
    };
    expect(qualifies(base, phoneRule)).toBe(true);
    expect(qualifies({ ...base, title: `${base.title} (Renewed)` }, phoneRule)).toBe(false);
    expect(qualifies({ ...base, store: 'NoNameBrand' }, phoneRule)).toBe(false);
    expect(qualifies({ ...base, price: null }, phoneRule)).toBe(false);
  });
});

describe('Dataset pipeline - Kaggle Flipkart normaliser', () => {
  test('parses quoted CSV and maps Flipkart rows to our categories', () => {
    const csv = [
      'uniq_id,product_name,product_category_tree,retail_price,discounted_price,image,description,product_rating,brand,product_specifications',
      'abc123,"Samsung Galaxy J7, Gold","[""Mobiles & Accessories >> Mobiles >> Samsung""]",16990,14990,"[""http://img5a.flixcart.com/x.jpeg""]","A phone, with ""quotes""",4.1,Samsung,"{""product_specification""=>[{""key""=>""RAM"", ""value""=>""2 GB""}]}"',
    ].join('\n');
    const rows = parseCsv(csv);
    expect(rows[0].product_name).toBe('Samsung Galaxy J7, Gold');
    expect(rows[0].description).toBe('A phone, with "quotes"');
    const out = normalizeFlipkart(rows);
    const phone = out['Mobiles::Smartphones'][0];
    expect(phone).toMatchObject({ priceInr: 14990, mrpInr: 16990, store: 'Samsung' });
    expect(phone.images[0]).toMatch(/^https:/);
    expect(phone.details).toEqual({ RAM: '2 GB' });
  });
});
