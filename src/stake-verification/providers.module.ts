import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ProvidersController } from './providers.controller';
import { StakeVerificationService } from './stake-verification.service';
import { VerificationMonitorJob } from './verification-monitor.job';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register({
      ttl: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
      max: 1000, // Maximum number of items in cache
    }),
  ],
  controllers: [ProvidersController],
  providers: [StakeVerificationService, VerificationMonitorJob],
  exports: [StakeVerificationService, VerificationMonitorJob],
})
export class ProvidersModule {}