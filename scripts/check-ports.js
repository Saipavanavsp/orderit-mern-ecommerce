// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
// Verifies that the API, customer and admin ports are free before `npm run dev`.
// Probes by connecting on IPv4 and IPv6 loopback: on Windows a test *bind* on 0.0.0.0 can succeed even
// when another process listens on [::1] (Vite) or [::], so a successful connection means "busy".
import net from 'node:net';
import { getPorts } from './lib/env.js';

function accepts(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(800, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

const isPortBusy = async (port) => (await accepts('127.0.0.1', port)) || (await accepts('::1', port));

const ports = getPorts();
const labels = { api: 'API server', client: 'Customer app', admin: 'Admin dashboard' };
const busy = [];

for (const [key, port] of Object.entries(ports)) {
  if (await isPortBusy(port)) busy.push({ key, port });
}

if (busy.length === 0) {
  console.log(`[check-ports] Ports free: API ${ports.api}, client ${ports.client}, admin ${ports.admin}`);
  process.exitCode = 0;
} else {
  console.error('\n[check-ports] The following ports are already in use:\n');
  for (const { key, port } of busy) console.error(`  - ${labels[key]} port ${port}`);
  console.error('\nFix it in PowerShell (run for each busy port):\n');
  for (const { port } of busy) {
    console.error(`  netstat -ano | findstr :${port}`);
    console.error('  taskkill /PID <pid> /F     # <pid> is the last column of the LISTENING line\n');
  }
  console.error('Or change PORT / CLIENT_PORT / ADMIN_PORT in server/.env, client/.env, admin/.env.\n');
  process.exitCode = 1;
}
