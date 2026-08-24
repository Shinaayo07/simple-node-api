const pino = require('pino');
const { trace, context } = require('@opentelemetry/api');

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

const level = process.env.LOG_LEVEL || (isTest ? 'silent' : 'info');

const logger = pino({
  level,
  base: { service: process.env.OTEL_SERVICE_NAME || 'customer-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
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
