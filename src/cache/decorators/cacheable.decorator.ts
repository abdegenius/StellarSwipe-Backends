import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

export interface CacheableOptions {
    /**
     * Cache key or key generator function
     */
    key?: string | ((...args: any[]) => string);

    /**
     * TTL type: 'session' (24h), 'signal' (30s), 'portfolio' (5min), 'default' (60s)
     */
    ttlType?: 'session' | 'signal' | 'portfolio' | 'default';

    /**
     * Custom TTL in seconds (overrides ttlType)
     */
    ttl?: number;

    /**
     * Cache key prefix
     */
    prefix?: string;
}

/**
 * Decorator to mark a method as cacheable
 * Use with CacheInterceptor for automatic caching
 * 
 * @example
 * @Cacheable({ key: 'signals:feed', ttlType: 'signal' })
 * async getSignalFeed() { ... }
 * 
 * @example
 * @Cacheable({ key: (userId) => `portfolio:${userId}`, ttlType: 'portfolio' })
 * async getPortfolio(userId: string) { ... }
 */
export const Cacheable = (options: CacheableOptions = {}): MethodDecorator => {
    return SetMetadata(CACHEABLE_KEY, {
        key: options.key,
        ttlType: options.ttlType ?? 'default',
        ttl: options.ttl,
        prefix: options.prefix ?? 'stellarswipe:',
    });
};
