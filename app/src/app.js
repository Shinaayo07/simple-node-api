const express = require('express');
const helmet = require('helmet');
const client = require('prom-client');
const httpLogger = require('./httpLogger');
const logger = require('./logger');

function createApp() {
  // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
  // No CSRF middleware: this API has no cookie-based session auth (no express-session/cookie-parser),
  // so there's no ambient credential for a cross-site request to ride along on - the CSRF threat model
  // doesn't apply. Revisit if cookie-based auth is ever added.
  const app = express();

  app.use(helmet());
  app.use(express.json());
  app.use(httpLogger);

  // ---- Prometheus metrics setup ----
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  });

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  register.registerMetric(httpRequestDuration);
  register.registerMetric(httpRequestsTotal);

  app.use((req, res, next) => {
    const endTimer = httpRequestDuration.startTimer();
    res.on('finish', () => {
      // req.route.path is relative to whichever router matched (e.g. '/:id'),
      // so prefix it with req.baseUrl (e.g. '/api/products') to get the full,
      // human-readable path. Without this, '/api/products/:id' and
      // '/api/customers/:id' would collide under the same generic ':id' label.
      const route = req.route ? `${req.baseUrl}${req.route.path}` : req.path;
      const labels = { method: req.method, route, status_code: res.statusCode };
      httpRequestsTotal.inc(labels);
      endTimer(labels);
    });
    next();
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // ---- Health & readiness endpoints ----
  // /health = liveness: process is up and can serve traffic
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // /ready = readiness: dependencies (DB, cache, etc.) are reachable.
  // No real dependency here yet, but kept separate so it's easy to wire up later
  // without changing the liveness contract the container/orchestrator relies on.
  app.get('/ready', (req, res) => {
    res.status(200).json({ status: 'ready' });
  });

  // ---- Business resources ----
  // Each resource has its own router + validation, backed by the shared
  // in-memory store (src/store). Orders reference products and customers,
  // giving a realistic relational shape without needing a real database.
  app.use('/api/products', require('./routes/products'));
  app.use('/api/customers', require('./routes/customers'));
  app.use('/api/orders', require('./routes/orders'));

  // ---- 404 handler ----
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ---- Central error handler ----
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // req.log is the pino instance scoped to this request - it automatically
    // includes the request's id, so this error can be found in logs alongside
    // every other log line for the same request.
    (req.log || logger).error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error', requestId: req.id });
  });

  return app;
}

module.exports = createApp;
