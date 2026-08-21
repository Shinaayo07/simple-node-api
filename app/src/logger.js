const pino = require('pino');
const { trace, context } = require('@opentelemetry/api');

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

// Log level is configurable via LOG_LEVEL (info/debug/warn/error).
// Tests default to 'silent' so `npm test` output stays clean, unless
// LOG_LEVEL is explicitly set (useful when debugging a failing test).
const level = process.env.LOG_LEVEL || (isTest ? 'silent' : 'info');

// In production, logs are emitted as raw JSON (one object per line) so they
// can be shipped to and parsed by a log aggregator (CloudWatch, Loki, ELK, etc).
// In development, they're pretty-printed for a human reading a terminal.
// `transport` is intentionally omitted in prod/test: pino-pretty adds overhead
// and non-JSON output that log aggregators can't parse.
const logger = pino({
  level,
  // Sourced from the same OTEL_SERVICE_NAME env var that tracing.js uses, so
  // logs and traces always report the same service name. If these ever drifted
  // apart, filtering "all telemetry for customer-api" in Grafana would
  // silently miss one signal.
  base: { service: process.env.OTEL_SERVICE_NAME || 'customer-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Pulls the currently active OpenTelemetry span (if any) and stamps its
  // trace_id/span_id onto every log line. This is what lets you go from a
  // log line straight to the matching trace in Tempo (or vice versa), instead
  // of logs and traces being two disconnected systems.
  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    return { trace_id: traceId, span_id: spanId };
  },
  transport:
    !isProd && !isTest
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        }
      : undefined,
});

module.exports = logger;
