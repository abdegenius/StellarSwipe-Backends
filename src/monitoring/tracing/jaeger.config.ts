import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';

const JAEGER_ENDPOINT =
  process.env.JAEGER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces';

const exporter = new OTLPTraceExporter({ url: JAEGER_ENDPOINT });

export const otelSdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'stellarswipe-backend',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
  }),
  spanProcessor: new SimpleSpanProcessor(exporter),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new PgInstrumentation(),
  ],
});

export function initTracing(): void {
  if (process.env.TRACING_ENABLED !== 'true') return;
  otelSdk.start();
  process.on('SIGTERM', () => otelSdk.shutdown());
}
