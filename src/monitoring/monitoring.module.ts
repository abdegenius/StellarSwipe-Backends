import { Module, Global } from '@nestjs/common';
import { PrometheusService } from './metrics/prometheus.service';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { MonitoringController } from './monitoring.controller';

@Global()
@Module({
  providers: [PrometheusService, MetricsInterceptor],
  controllers: [MonitoringController],
  exports: [PrometheusService, MetricsInterceptor],
})
export class MonitoringModule {}
