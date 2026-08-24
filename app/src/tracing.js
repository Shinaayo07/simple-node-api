const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { ConsoleSpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');

const isTest = process.env.NODE_ENV === 'test';

let sdk = null;

if (!isTest) {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

  const useConsoleExporter = process.env.OTEL_TRACES_EXPORTER === 'console';

  const NOISY_PATHS = new Set(['/health', '/ready', '/metrics']);

  const sdkConfig = {
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'customer-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => NOISY_PATHS.has(req.url),
        },
      }),
    ],
  };

  if (useConsoleExporter) {
    sdkConfig.spanProcessors = [new SimpleSpanProcessor(new ConsoleSpanExporter())];
  } else {
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
