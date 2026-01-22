import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
// Import your Signal entity
// import { Signal } from './entities/signal.entity';

@Module({
  imports: [
    // TypeOrmModule.forFeature([Signal]),
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 30, // 30 seconds default TTL
    }),
  ],
  controllers: [SignalsController],
  providers: [SignalsService],
  exports: [SignalsService],
})
export class SignalsModule {}

