const { randomUUID } = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('./logger');

// Every request gets a unique ID (or reuses one supplied by an upstream proxy
// via X-Request-Id), attached to:
//   - the response header (so a client/caller can report it back when filing a bug)
//   - every log line for that request (req.log), so all logs for one request
//     can be found by searching for a single ID during an incident investigation
// Paths that get hit repeatedly by automated probes (Kubernetes liveness/
// readiness checks, Prometheus scraping /metrics) rather than real traffic.
// Logging every single one of these would drown out logs from actual user
// requests within minutes in production, so they're excluded from normal
// request logging. A failing health check will still surface via the
// orchestrator's own alerting (pod restarts, failed probes), not via logs.
const NOISY_PATHS = new Set(['/health', '/ready', '/metrics']);

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingId = req.headers['x-request-id'];
    const id = existingId || randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: {
    ignore: (req) => NOISY_PATHS.has(req.url),
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`,
  // Keep log lines compact: just the fields useful for debugging, not the
  // full raw req/res objects (headers, sockets, etc.)
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = httpLogger;
