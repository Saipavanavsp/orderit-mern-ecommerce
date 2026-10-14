// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
// Runs a real MongoDB server (binary downloaded by mongodb-memory-server) on 127.0.0.1:27017
// with persistent storage in .mongo-data/. Useful on Windows machines without MongoDB installed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './lib/env.js';
import { probe } from './check-mongo.js';

const port = Number(process.env.LOCAL_MONGO_PORT || 27017);

if (await probe('127.0.0.1', port)) {
  console.log(`[db:local] Something is already listening on 127.0.0.1:${port} - assuming MongoDB is running.`);
  process.exit(0);
}

const requireFromServer = createRequire(path.join(ROOT, 'server', 'package.json'));
let MongoMemoryServer;
try {
  ({ MongoMemoryServer } = requireFromServer('mongodb-memory-server'));
} catch {
  console.error('[db:local] mongodb-memory-server is not installed. Run "npm run setup" first.');
  process.exit(1);
}

const dbPath = path.join(ROOT, '.mongo-data');
fs.mkdirSync(dbPath, { recursive: true });

console.log('[db:local] Starting MongoDB (first run downloads the mongod binary, ~1-2 min)...');
const server = await MongoMemoryServer.create({
  instance: { port, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
});
console.log(`[db:local] MongoDB running at ${server.getUri()} (data: ${dbPath})`);
console.log('[db:local] Keep this window open. Press Ctrl+C to stop.');

const shutdown = async () => {
  console.log('\n[db:local] Stopping MongoDB...');
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
