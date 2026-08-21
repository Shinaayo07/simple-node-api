// IMPORTANT: this file must be required (via `-r ./src/tracing.js` or as the
// very first `require` in the entry point) before express, http, or any other
// instrumented module is loaded. OpenTelemetry's auto-instrumentation works by
// monkey-patching those modules at require-time - if they're already loaded
// first, the patch never applies and no spans get created.

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { ConsoleSpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');

const isTest = process.env.NODE_ENV === 'test';

let sdk = null;

if (!isTest) {
  // Tempo's OTLP HTTP receiver defaults to this path/port. Override via
  // OTEL_EXPORTER_OTLP_ENDPOINT to point at a different collector/environment.
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

  // OTEL_TRACES_EXPORTER=console prints spans to stdout instead of sending
  // them to Tempo. Useful for local development/debugging when you want to
  // see span structure without running the full monitoring stack.
  const useConsoleExporter = process.env.OTEL_TRACES_EXPORTER === 'console';

  // Same reasoning as the log filter in httpLogger.js: probe/scrape traffic
  // hitting these paths every few seconds would otherwise flood Tempo with
  // meaningless traces and make real request traces harder to find.
  const NOISY_PATHS = new Set(['/health', '/ready', '/metrics']);

  const sdkConfig = {
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'customer-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // The filesystem instrumentation is extremely chatty (fires on every
        // fs.readFile/stat/etc, including ones Node itself does internally)
        // and adds noise without adding debugging value for this app.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => NOISY_PATHS.has(req.url),
        },
      }),
    ],
  };

  if (useConsoleExporter) {
    // SimpleSpanProcessor exports each span the moment it ends, instead of
    // batching - what you want when eyeballing spans in a terminal.
    sdkConfig.spanProcessors = [new SimpleSpanProcessor(new ConsoleSpanExporter())];
  } else {
    // In real deployments, traceExporter is wrapped in a BatchSpanProcessor
    // automatically, batching spans before sending to reduce network overhead.
    sdkConfig.traceExporter = new OTLPTraceExporter({ url: endpoint });
  }

  sdk = new NodeSDK(sdkConfig);

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(
      useConsoleExporter
        ? '[tracing] OpenTelemetry initialized, printing spans to console'
        : `[tracing] OpenTelemetry initialized, exporting to ${endpoint}`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[tracing] Failed to initialize OpenTelemetry SDK', err);
  }

  const shutdown = () => {
    sdk
      .shutdown()
      // eslint-disable-next-line no-console
      .catch((err) => console.error('[tracing] Error shutting down OpenTelemetry SDK', err));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = sdk;
