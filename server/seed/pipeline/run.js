// Full dataset pipeline: download (stream) -> clean/normalise -> validate images -> curated JSON.
//   npm run dataset:build              (all steps)
//   npm run dataset:build -- --skip-download   (re-clean existing raw/ files)
import { download } from './download.js';
import { clean } from './clean.js';
import { validateImages } from './validateImages.js';

const skipDownload = process.argv.includes('--skip-download');
const started = Date.now();
let last = 0;
const log = (m) => {
  if (!m.startsWith('  ') || Date.now() - last > 15000) {
    last = Date.now();
    console.log(m);
  }
};

try {
  if (!skipDownload) await download({ log });
  clean({ log });
  await validateImages({ log });
  console.log(`[pipeline] Done in ${Math.round((Date.now() - started) / 1000)} s. Now run: npm run seed`);
} catch (err) {
  console.error(`[pipeline] Failed: ${err.message}`);
  console.error('[pipeline] The committed fallback data in server/seed/data/ is unchanged, so "npm run seed" still works.');
  process.exit(1);
}
