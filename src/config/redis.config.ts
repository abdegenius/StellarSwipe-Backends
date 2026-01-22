import { registerAs } from '@nestjs/config';

/**
 * Redis cache configuration
 * TTL values for different data types:
 * - User sessions: 24 hours
 * - Signal feed: 30 seconds
 * - User portfolio: 5 minutes
 */
export const redisCacheConfig = registerAs('redisCache', () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),

    // Connection pooling settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,

    // Key prefix for namespacing
    keyPrefix: 'stellarswipe:',

    // TTL values in seconds
    ttl: {
        session: 24 * 60 * 60,      // 24 hours
        signal: 30,                  // 30 seconds
        portfolio: 5 * 60,           // 5 minutes
        default: 60,                 // 1 minute default
    },
}));
