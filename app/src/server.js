require('dotenv').config();

// Tracing MUST be required before ./app (which pulls in express) so that
// OpenTelemetry's auto-instrumentation can patch http/express before they're
// used. dotenv is fine to load first since it only sets process.env values -
// it doesn't touch any of the modules OpenTelemetry instruments.
require('./tracing');

const createApp = require('./app');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'customer-api listening');
});

// Graceful shutdown: important for zero-downtime deploys.
// Lets in-flight requests finish before the container/process exits,
// instead of dropping connections mid-request when the orchestrator sends SIGTERM.
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing server gracefully');
  server.close(() => {
    logger.info('Server closed. Exiting process.');
    process.exit(0);
  });

  // Force-exit if something hangs (e.g. open connections that never finish)
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch anything that would otherwise crash the process silently or with an
// unhelpful stack trace straight to stdout.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

module.exports = server;
