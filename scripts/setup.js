// One-command setup: installs root + server + client + admin, creates .env files, seeds the DB.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/env.js';
import { checkMongo } from './check-mongo.js';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args, cwd) {
  console.log(`\n> npm ${args.join(' ')}   (${path.relative(ROOT, cwd) || '.'})`);
  const result = spawnSync(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\n[setup] "npm ${args.join(' ')}" failed in ${cwd}`);
    process.exit(result.status || 1);
  }
}

for (const dir of ['.', 'server', 'client', 'admin']) {
  run(['install', '--no-audit', '--no-fund'], path.join(ROOT, dir));
}

for (const dir of ['server', 'client', 'admin']) {
  const example = path.join(ROOT, dir, '.env.example');
  const target = path.join(ROOT, dir, '.env');
  if (!fs.existsSync(target) && fs.existsSync(example)) {
    fs.copyFileSync(example, target);
    console.log(`[setup] Created ${path.join(dir, '.env')} from .env.example`);
  } else {
    console.log(`[setup] ${path.join(dir, '.env')} already exists - left unchanged`);
  }
}

if (await checkMongo()) {
  run(['run', 'seed'], ROOT);
  console.log('\n[setup] Done. Start everything with:  npm run dev');
} else {
  console.log('\n[setup] Dependencies installed, but the database was NOT seeded (MongoDB not reachable).');
  console.log('[setup] Start MongoDB using one of the options above, then run:  npm run seed');
}
