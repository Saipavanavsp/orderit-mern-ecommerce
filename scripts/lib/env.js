// Minimal .env reader used by root scripts (they run before any package is installed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readEnvFile(relativePath) {
  const file = path.join(ROOT, relativePath);
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

export function getPorts() {
  const server = readEnvFile(path.join('server', '.env'));
  const client = readEnvFile(path.join('client', '.env'));
  const admin = readEnvFile(path.join('admin', '.env'));
  return {
    api: Number(server.PORT || 5001),
    client: Number(client.CLIENT_PORT || server.CLIENT_PORT || 5173),
    admin: Number(admin.ADMIN_PORT || server.ADMIN_PORT || 5174),
  };
}

export function getMongoUri() {
  const server = readEnvFile(path.join('server', '.env'));
  return server.MONGO_URI || 'mongodb://127.0.0.1:27017/shopverse';
}
