import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { CacheService } from './cache.service';

@Global()
@Module({
    imports: [
        NestCacheModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                store: redisStore as any,
                host: configService.get<string>('redisCache.host') ?? 'localhost',
                port: configService.get<number>('redisCache.port') ?? 6379,
                password: configService.get<string>('redisCache.password'),
                db: configService.get<number>('redisCache.db') ?? 0,
                ttl: configService.get<number>('redisCache.ttl.default') ?? 60,
                // Connection pooling
                max: 100,
                maxRetriesPerRequest: configService.get<number>('redisCache.maxRetriesPerRequest') ?? 3,
            }),
        }),
    ],
    providers: [CacheService],
    exports: [NestCacheModule, CacheService],
})
export class CacheModule { }
