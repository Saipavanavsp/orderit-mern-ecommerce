// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { MongoMemoryServer } from 'mongodb-memory-server';

// One in-memory MongoDB for the whole run; each test file uses its own database name.
export default async function globalSetup() {
  const server = await MongoMemoryServer.create();
  globalThis.__MONGO_SERVER__ = server;
  process.env.TEST_MONGO_URI = server.getUri();
}
