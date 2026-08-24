const express = require('express');
const helmet = require('helmet');
const client = require('prom-client');
const httpLogger = require('./httpLogger');
const logger = require('./logger');

function createApp() {
  const app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage

  app.use(helmet());
  app.use(express.json());
  app.use(httpLogger);

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

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (req, res) => {
    res.status(200).json({ status: 'ready' });
  });

  app.use('/api/products', require('./routes/products'));
  app.use('/api/customers', require('./routes/customers'));
  app.use('/api/orders', require('./routes/orders'));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    (req.log || logger).error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error', requestId: req.id });
  });

  return app;
}

module.exports = createApp;
