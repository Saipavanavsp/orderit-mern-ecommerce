// Dataset pipeline configuration. See docs/DATASETS.md for sources, licences and the method.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(SEED_DIR, 'data');
export const RAW_DIR = path.join(DATA_DIR, 'raw'); // git-ignored downloads
export const DOCS_DIR = path.resolve(SEED_DIR, '..', '..', 'docs');

export const HF_BASE = 'https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/resolve/main/raw';
export const metaUrl = (file) => `${HF_BASE}/meta_categories/meta_${file}.jsonl`;
export const reviewUrl = (file) => `${HF_BASE}/review_categories/${file}.jsonl`;

// Files are streamed with HTTP Range requests and abandoned once quotas fill (never fully downloaded).
export const SOURCES = {
  Cell_Phones_and_Accessories: { metaMaxMB: 900, reviewMaxMB: 500 },
  Electronics: { metaMaxMB: 1100, reviewMaxMB: 500 },
  Appliances: { metaMaxMB: 290, reviewMaxMB: 300 },
  Home_and_Kitchen: { metaMaxMB: 1100, reviewMaxMB: 500 },
  Clothing_Shoes_and_Jewelry: { metaMaxMB: 900, reviewMaxMB: 500 },
};

export const USD_TO_INR = 83;
export const CANDIDATE_MULTIPLIER = 4; // collect 4x the quota, then pick the best

const B = (s) => s.split('|');
const PHONE_BRANDS = B('Samsung|Apple|Google|Motorola|OnePlus|Nokia|Xiaomi|Redmi|Sony|LG|Asus|ASUS|Oppo|OPPO|Realme|realme|Vivo|vivo|TCL|Nothing|Honor|HONOR|Alcatel|BlackBerry|Huawei|HUAWEI|ZTE|Poco|POCO');
const ELECTRONICS_BRANDS = B('Apple|Samsung|Sony|Dell|HP|Lenovo|ASUS|Asus|Acer|Microsoft|MSI|LG|Google|Amazon|JBL|Bose|Sennheiser|Skullcandy|Beats|Jabra|Anker|Soundcore|Audio-Technica|Marshall|Ultimate Ears|Bang & Olufsen|Garmin|Fitbit|Amazfit|Huawei|Xiaomi|Fossil|Canon|Nikon|Fujifilm|FUJIFILM|Panasonic|GoPro|Kodak|KODAK|Olympus|OM SYSTEM|Logitech|Razer|Sonos|Philips|Plantronics|Poly|Shure|Polaroid|DJI|Insta360');
const TV_BRANDS = B('Samsung|SAMSUNG|LG|Sony|SONY|TCL|Hisense|VIZIO|Vizio|Toshiba|TOSHIBA|Panasonic|Philips|Insignia|INSIGNIA|Sharp|Sceptre|Roku|Amazon|Bose|Sonos|JBL|Yamaha|Polk Audio|Denon|Klipsch|Epson|BenQ|Optoma|ViewSonic|Whirlpool|GE|GE Appliances|Frigidaire|Maytag|Bosch|BOSCH|Electrolux|KitchenAid|Haier|Kenmore|Midea|Danby|Beko|Miele|Amana|Hotpoint|Galanz|Magic Chef|Insignia');
const HOME_BRANDS = B('Cuisinart|KitchenAid|Ninja|NINJA|Hamilton Beach|Instant Pot|Instant|Breville|Philips|PHILIPS|BLACK+DECKER|Black+Decker|BLACK + DECKER|Oster|Keurig|Mr. Coffee|De\'Longhi|DeLonghi|Nespresso|Dyson|Shark|SharkNinja|Bissell|BISSELL|Hoover|iRobot|Eureka|Panasonic|Sharp|Toshiba|TOSHIBA|Dash|DASH|Crock-Pot|Crockpot|Chefman|COSORI|Cosori|Honeywell|Levoit|LEVOIT|Vornado|Lasko|Rowenta|Conair|Zojirushi|Smeg|SMEG|Morphy Richards|Russell Hobbs|Bella|BELLA|Elite Gourmet|Presto|West Bend|Vitamix|NutriBullet|nutribullet|Magic Bullet|Sunbeam|Proctor Silex|Tefal|T-fal|Bosch|Midea|Galanz|GE|Frigidaire|Whirlpool|Eufy|eufy|Roborock|Tineco|Gourmia|Aroma|Tiger|Bajaj|Prestige|Havells');
const FASHION_BRANDS = B("Levi's|Levis|Nike|adidas|Adidas|PUMA|Puma|Under Armour|Reebok|New Balance|ASICS|Skechers|Converse|Vans|Crocs|Clarks|Timberland|Tommy Hilfiger|Calvin Klein|Ralph Lauren|Polo Ralph Lauren|Lacoste|Columbia|The North Face|Champion|Hanes|Fruit of the Loom|Wrangler|Lee|Carhartt|Dockers|Van Heusen|IZOD|Nautica|GAP|Gap|Old Navy|Amazon Essentials|Gildan|Jockey|Dickies|Guess|GUESS|Steve Madden|Cole Haan|Rockport|Brooks|Saucony|HOKA|Hoka|Fila|FILA|Kenneth Cole|Michael Kors|Anne Klein|Calvin Klein Jeans|U.S. Polo Assn.|Lucky Brand|Hurley|Quiksilver|Billabong|Patagonia|Merrell|Keen|KEEN|Teva|Sperry|Dr. Martens|UGG|Allen Edmonds|Florsheim|Bruno Marc|Goodthreads|Daily Ritual|Lark & Ro");
const ACCESSORY_BRANDS = B("Casio|CASIO|Fossil|Timex|Seiko|SEIKO|Citizen|Michael Kors|Armitron|Invicta|Skagen|Guess|GUESS|Daniel Wellington|Tommy Hilfiger|Calvin Klein|Anne Klein|Nine West|Bulova|Movado|Swatch|Garmin|Ray-Ban|Oakley|Costa Del Mar|Maui Jim|Polaroid|Persol|Prada|Gucci|Coach|COACH|Kate Spade|Kate Spade New York|Michael Kors|Fossil|Samsonite|JanSport|Herschel|The North Face|Osprey|Under Armour|Nike|adidas|Columbia|Travelpro|American Tourister|Tumi|Timbuk2|Matein|Levi's|Buxton|Tommy Bahama|Bellroy|Anker|Belkin|Mophie|mophie|Samsung|SAMSUNG|Apple|Spigen|OtterBox|UGREEN|Baseus|INIU|Aukey|AUKEY|RAVPower|Nekteck|Amazon Basics|Amazon Essentials");

/**
 * Category rules. `path` is matched against the joined Amazon category path,
 * `title`/`exclude` against the product title. `quota` = products kept after cleaning.
 */
export const RULES = [
  // ---------- Mobiles ----------
  { category: 'Mobiles', sub: 'Smartphones', source: 'Cell_Phones_and_Accessories', path: /^Cell Phones & Accessories > Cell Phones/, title: /phone|galaxy|pixel|iphone|moto|5g|smartphone|unlocked/i, exclude: /renewed|refurbish|certified|case|cover|protector|prepaid|tracfone|straight talk|boost mobile|cricket|total wireless|simple mobile|verizon|at&t|t-mobile|consumer cellular|metro by|lot of|bundle|flip phone|jitterbug/i, brands: PHONE_BRANDS, usd: [70, 1600], quota: 40 },

  // ---------- Electronics ----------
  { category: 'Electronics', sub: 'Laptops', source: 'Electronics', path: /Computers & Tablets > Laptops/, title: /laptop|notebook|chromebook|macbook|thinkpad|vivobook|ideapad|inspiron|pavilion/i, exclude: /renewed|refurbish|skin|sleeve|case|charger|battery|keyboard cover|screen protector|bag/i, brands: ELECTRONICS_BRANDS, usd: [180, 3500], quota: 10 },
  { category: 'Electronics', sub: 'Tablets', source: 'Electronics', path: /Computers & Tablets > Tablets/, title: /tablet|ipad|tab\b|fire hd|galaxy tab/i, exclude: /renewed|refurbish|case|cover|protector|stylus|keyboard/i, brands: ELECTRONICS_BRANDS, usd: [60, 1500], quota: 6 },
  { category: 'Electronics', sub: 'Headphones & Earbuds', source: 'Electronics', path: /Headphones, Earbuds & Accessories > Headphones & Earbuds/, title: /headphone|earbud|earphone|in-ear|over-ear|on-ear|airpods|buds/i, exclude: /renewed|refurbish|case|replacement|ear tips|earpads|cushion|cable/i, brands: ELECTRONICS_BRANDS, usd: [15, 600], quota: 10 },
  { category: 'Electronics', sub: 'Smartwatches', source: 'Electronics', path: /Wearable Technology > Smartwatches/, title: /watch|band|fitness/i, exclude: /renewed|refurbish|strap|band for|bands compatible|replacement|charger|protector|case/i, brands: ELECTRONICS_BRANDS, usd: [30, 900], quota: 6 },
  { category: 'Electronics', sub: 'Speakers', source: 'Electronics', path: /Portable Speakers & Docks/, title: /speaker/i, exclude: /renewed|refurbish|case|cover|mount|stand/i, brands: ELECTRONICS_BRANDS, usd: [20, 600], quota: 4 },
  { category: 'Electronics', sub: 'Cameras', source: 'Electronics', path: /Camera & Photo > (Digital Cameras|Video|Film Photography)/, title: /camera|camcorder|instant/i, exclude: /renewed|refurbish|case|bag|strap|battery|charger|lens cap|kids|toy|webcam/i, brands: ELECTRONICS_BRANDS, usd: [50, 3500], quota: 4 },

  // ---------- TV & Appliances ----------
  { category: 'TV & Appliances', sub: 'Televisions', source: 'Electronics', path: /Television & Video > Televisions/, title: /tv|television|led|qled|oled|smart/i, exclude: /renewed|refurbish|mount|remote|stand|antenna|cable|part|board|replacement/i, brands: TV_BRANDS, usd: [90, 4500], quota: 14 },
  { category: 'TV & Appliances', sub: 'Soundbars & Home Theatre', source: 'Electronics', path: /Home Audio > (Speakers|Home Theater)|Television & Video > Home Theater Systems/, title: /sound ?bar|home theater|home theatre|surround/i, exclude: /renewed|refurbish|mount|bracket|remote|cable|replacement/i, brands: TV_BRANDS, usd: [50, 1800], quota: 6 },
  { category: 'TV & Appliances', sub: 'Washing Machines', source: 'Appliances', path: /Laundry Appliances > Washers/, title: /wash|washer|laundry/i, exclude: /renewed|refurbish|part|pedestal|hose|cover|kit|portable mini/i, brands: TV_BRANDS, usd: [150, 4000], quota: 8 },
  { category: 'TV & Appliances', sub: 'Refrigerators & Freezers', source: 'Appliances', path: /Refrigerators, Freezers & Ice Makers > (Refrigerators|Freezers)/, title: /refrigerator|fridge|freezer/i, exclude: /renewed|refurbish|part|filter|handle|gasket|shelf|bin/i, brands: TV_BRANDS, usd: [120, 5000], quota: 8 },
  { category: 'TV & Appliances', sub: 'Dishwashers & Cooking Ranges', source: 'Appliances', path: /Appliances > (Dishwashers|Ranges, Ovens & Cooktops > (Ranges|Wall Ovens|Cooktops))/, title: /dishwasher|range|oven|cooktop/i, exclude: /renewed|refurbish|part|rack|knob|element|filter|hood/i, brands: TV_BRANDS, usd: [150, 4000], quota: 4 },

  // ---------- Home Appliances ----------
  { category: 'Home Appliances', sub: 'Mixers & Blenders', source: 'Home_and_Kitchen', path: /Small Appliances > (Blenders|Mixers|Food Processors|Juicers)/, title: /blender|mixer|processor|juicer|chopper/i, exclude: /renewed|refurbish|replacement|part|blade|jar only|gasket|lid/i, brands: HOME_BRANDS, usd: [20, 800], quota: 10 },
  { category: 'Home Appliances', sub: 'Microwaves & Ovens', source: 'Home_and_Kitchen', path: /Small Appliances > (Microwave Ovens|Ovens & Toasters)/, title: /microwave|oven|toaster/i, exclude: /renewed|refurbish|replacement|part|cover|rack|tray/i, brands: HOME_BRANDS, usd: [20, 900], quota: 7 },
  { category: 'Home Appliances', sub: 'Coffee Makers', source: 'Home_and_Kitchen', path: /Coffee, Tea & Espresso|Coffee Machines|Coffee Makers/, title: /coffee|espresso|brewer|keurig/i, exclude: /renewed|refurbish|filter|pod|capsule|replacement|carafe only|part|descal/i, brands: HOME_BRANDS, usd: [20, 900], quota: 5 },
  { category: 'Home Appliances', sub: 'Cookers & Fryers', source: 'Home_and_Kitchen', path: /Small Appliances > (Fryers|Slow Cookers|Rice Cookers|Electric Pressure Cookers|Indoor Grills & Griddles|Specialty Appliances)/, title: /fryer|cooker|pressure|grill|griddle|instant pot|kettle/i, exclude: /renewed|refurbish|liner|replacement|part|gasket|paper|accessor/i, brands: HOME_BRANDS, usd: [20, 500], quota: 7 },
  { category: 'Home Appliances', sub: 'Vacuum Cleaners', source: 'Home_and_Kitchen', path: /Vacuums & Floor Care > (Vacuums|Steam Cleaners)/, title: /vacuum|robot|steam/i, exclude: /renewed|refurbish|filter|bag|replacement|part|brush roll|belt|battery/i, brands: HOME_BRANDS, usd: [40, 1000], quota: 7 },
  { category: 'Home Appliances', sub: 'Air Care & Ironing', source: 'Home_and_Kitchen', path: /Heating, Cooling & Air Quality|Irons & Steamers|Clothing & Closet Storage > Irons/, title: /purifier|humidifier|fan|heater|iron|steamer/i, exclude: /renewed|refurbish|filter|replacement|part|cover|board/i, brands: HOME_BRANDS, usd: [20, 800], quota: 4 },

  // ---------- Fashion ----------
  { category: 'Fashion', sub: 'Men\'s Clothing', source: 'Clothing_Shoes_and_Jewelry', path: /> Men > Clothing > (Shirts|T-Shirts|Jeans|Pants|Polos|Active|Fashion Hoodies & Sweatshirts|Sweaters|Coats, Jackets & Vests)/, title: /shirt|tee|jean|pant|polo|hoodie|sweatshirt|jacket|sweater|jogger|chino/i, exclude: /pack of|\d+[- ]pack|costume|underwear|socks|boxer|brief|big & tall|renewed/i, brands: FASHION_BRANDS, usd: [8, 250], quota: 14 },
  { category: 'Fashion', sub: 'Women\'s Clothing', source: 'Clothing_Shoes_and_Jewelry', path: /> Women > Clothing > (Dresses|Tops, Tees & Blouses|Jeans|Active|Sweaters|Coats, Jackets & Vests|Fashion Hoodies & Sweatshirts|Pants)/, title: /dress|top|tee|blouse|jean|legging|sweater|jacket|hoodie|cardigan|pant|shirt/i, exclude: /pack of|\d+[- ]pack|costume|lingerie|bra\b|panty|swim|maternity|plus size/i, brands: FASHION_BRANDS, usd: [8, 250], quota: 12 },
  { category: 'Fashion', sub: 'Footwear', source: 'Clothing_Shoes_and_Jewelry', path: /> (Men|Women) > Shoes > (Athletic|Fashion Sneakers|Boots|Loafers & Slip-Ons|Oxfords|Sandals|Flats|Walking)/, title: /shoe|sneaker|boot|loafer|oxford|sandal|trainer|runner|slip-on|flat/i, exclude: /insole|lace|cleaner|renewed|pack of/i, brands: FASHION_BRANDS, usd: [20, 320], quota: 14 },

  // ---------- Accessories ----------
  { category: 'Accessories', sub: 'Watches', source: 'Clothing_Shoes_and_Jewelry', path: /> (Men|Women) > Watches/, title: /watch/i, exclude: /band|strap|replacement|battery|tool|box|winder|renewed|protector/i, brands: ACCESSORY_BRANDS, usd: [20, 700], quota: 12 },
  { category: 'Accessories', sub: 'Sunglasses', source: 'Clothing_Shoes_and_Jewelry', path: /Sunglasses/, title: /sunglass|aviator|wayfarer/i, exclude: /case|replacement lens|lenses for|strap|cleaning|clip/i, brands: ACCESSORY_BRANDS, usd: [15, 450], quota: 5 },
  { category: 'Accessories', sub: 'Bags & Backpacks', source: 'Clothing_Shoes_and_Jewelry', path: /Handbags & Wallets|Luggage & Travel Gear > (Backpacks|Luggage|Travel Duffels|Laptop Bags)|Backpacks/, title: /bag|backpack|tote|satchel|crossbody|duffel|luggage|suitcase|shoulder/i, exclude: /organizer insert|charm|strap only|replacement|pack of|renewed/i, brands: ACCESSORY_BRANDS, usd: [15, 500], quota: 8 },
  { category: 'Accessories', sub: 'Wallets & Belts', source: 'Clothing_Shoes_and_Jewelry', path: /> Men > Accessories > (Wallets|Belts)|> Women > Accessories > Belts/, title: /wallet|belt|card holder|cardholder/i, exclude: /pack of|chain|replacement|buckle only/i, brands: ACCESSORY_BRANDS, usd: [10, 250], quota: 5 },
  { category: 'Accessories', sub: 'Chargers & Power Banks', source: 'Cell_Phones_and_Accessories', path: /Accessories > (Chargers & Power Adapters|Portable Power Banks|Power Banks|Cables)|Battery Chargers|Power Banks/, title: /charger|power bank|powerbank|portable battery|charging|adapter/i, exclude: /renewed|refurbish|case|pack of [3-9]|replacement for/i, brands: ACCESSORY_BRANDS, usd: [10, 160], quota: 10 },
];

export const CATEGORY_INFO = {
  Mobiles: { sortOrder: 1, description: 'Latest smartphones from leading brands with 5G, great cameras and long battery life.' },
  Electronics: { sortOrder: 2, description: 'Laptops, tablets, headphones, smartwatches, speakers and cameras.' },
  'TV & Appliances': { sortOrder: 3, description: 'Smart TVs, soundbars and large appliances for every home.' },
  'Home Appliances': { sortOrder: 4, description: 'Kitchen and home essentials: mixers, microwaves, coffee makers, vacuums and more.' },
  Fashion: { sortOrder: 5, description: "Men's and women's clothing and footwear from popular brands." },
  Accessories: { sortOrder: 6, description: 'Watches, sunglasses, bags, wallets and mobile chargers.' },
};
