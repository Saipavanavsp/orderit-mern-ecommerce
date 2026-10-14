// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
export default async function globalTeardown() {
  await globalThis.__MONGO_SERVER__?.stop();
}
