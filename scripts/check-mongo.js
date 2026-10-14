// Detects whether MongoDB is reachable before seeding. Exits 1 with Windows instructions if not.
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { getMongoUri } from './lib/env.js';

export function parseHostPort(uri) {
  if (uri.startsWith('mongodb+srv://')) return null; // Atlas - DNS based, cannot probe with TCP
  const match = uri.match(/^mongodb:\/\/(?:[^@/]+@)?([^:/,]+)(?::(\d+))?/);
  if (!match) return null;
  return { host: match[1], port: Number(match[2] || 27017) };
}

export function probe(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

export function printMongoHelp(uri) {
  console.error(`
[mongo] Cannot reach MongoDB at ${uri}

Choose ONE of these options (PowerShell):

  1) Installed MongoDB Community Server? Start the Windows service:
       net start MongoDB              # run PowerShell as Administrator
     or open services.msc -> "MongoDB Server" -> Start

  2) No MongoDB installed? Run the bundled local database (keeps data in .mongo-data/):
       npm run db:local               # leave this window open, then run "npm run seed" in another

  3) Use MongoDB Atlas: put your connection string in server/.env
       MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shopverse
`);
}

export async function checkMongo({ quiet = false } = {}) {
  const uri = getMongoUri();
  const target = parseHostPort(uri);
  if (!target) {
    if (!quiet) console.log(`[mongo] Using remote URI (${uri.split('@').pop()}); skipping TCP probe.`);
    return true;
  }
  const ok = await probe(target.host, target.port);
  if (ok && !quiet) console.log(`[mongo] MongoDB is reachable at ${target.host}:${target.port}`);
  if (!ok) printMongoHelp(uri);
  return ok;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit((await checkMongo()) ? 0 : 1);
}
