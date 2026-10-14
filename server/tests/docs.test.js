// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import request from 'supertest';
import { app, API } from './helpers/setup.js';
import { MOUNTS } from '../routes/index.js';
import { ROUTES, buildOpenApiSpec } from '../docs/openapi.js';

function expressRoutes() {
  const out = [];
  for (const [prefix, router] of MOUNTS) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const path = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');
      Object.keys(layer.route.methods).forEach((m) => out.push(`${m.toUpperCase()} ${path}`));
    }
  }
  return out.sort();
}

describe('API documentation', () => {
  test('every Express route is documented in the OpenAPI registry and vice versa', () => {
    const documented = ROUTES.map(([m, p]) => `${m.toUpperCase()} ${p}`).sort();
    const actual = expressRoutes();
    expect(actual.filter((r) => !documented.includes(r))).toEqual([]);
    expect(documented.filter((r) => !actual.includes(r))).toEqual([]);
    expect(actual.length).toBeGreaterThan(80);
  });

  test('spec builds with request schemas generated from Zod validators', () => {
    const spec = buildOpenApiSpec();
    const login = spec.paths['/auth/login'].post.requestBody.content['application/json'].schema;
    expect(login.required).toEqual(expect.arrayContaining(['email', 'password']));
    const list = spec.paths['/products'].get.parameters.map((p) => p.name);
    expect(list).toEqual(expect.arrayContaining(['search', 'category', 'brand', 'minPrice', 'maxPrice', 'rating', 'sort', 'page', 'limit']));
  });

  test('Swagger UI and JSON are served', async () => {
    expect((await request(app).get('/api-docs/')).status).toBe(200);
    const json = await request(app).get('/api-docs.json');
    expect(json.body.openapi).toBe('3.0.3');
    expect(json.body.servers[0].url).toBe(`http://localhost:5001${API}`);
  });
});
