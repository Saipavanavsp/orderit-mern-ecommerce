import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from './openapi.js';

export function mountDocs(app) {
  const spec = buildOpenApiSpec();
  app.get('/api-docs.json', (_req, res) => res.json(spec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'OrderIt API Docs' }));
}
