import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SignalFeedQueryDto, SortBy } from './dto/signal-feed-query.dto';
import { SignalFeedResponseDto, SignalDto } from './dto/signal-feed-response.dto';

@Entity('signals')
export class Signal {
  @PrimaryColumn()
  id!: string;

  @Column()
  asset!: string;

  @Column()
  provider!: string;

  @Column()
  type!: 'BUY' | 'SELL';

  @Column()
  entryPrice!: number;

  @Column()
  targetPrice!: number;

  @Column()
  stopLoss!: number;

  @Column()
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column()
  expiresAt!: Date;

  @Column({ nullable: true })
  viewCount?: number;

  @Column({ nullable: true })
  followerCount?: number;

  @Column({ nullable: true })
  successRate?: number;
}

interface CursorData {
  id: string;
  timestamp: number;
  sortValue?: number;
}

@Injectable()
export class SignalsService {
  constructor(
    @InjectRepository(Signal)
    private signalRepository: Repository<Signal>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getFeed(query: SignalFeedQueryDto): Promise<SignalFeedResponseDto> {
    const { cursor, limit = 20, asset, provider, sortBy = SortBy.RECENT } = query;

    // Generate cache key
    const cacheKey = this.generateCacheKey(query);

    // Try to get from cache
    const cached = await this.cacheManager.get<SignalFeedResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Decode cursor if present
    const cursorData = cursor ? this.decodeCursor(cursor) : null;

    // Build query
    const queryBuilder = this.signalRepository
      .createQueryBuilder('signal')
      .leftJoinAndSelect('signal.provider', 'provider')
      .leftJoinAndSelect('signal.asset', 'assetEntity')
      .where('signal.status = :status', { status: 'ACTIVE' })
      .andWhere('signal.expiresAt > :now', { now: new Date() });

    // Apply filters
    if (asset) {
      queryBuilder.andWhere('signal.asset = :asset', { asset });
    }

    if (provider) {
      queryBuilder.andWhere('signal.provider = :provider', { provider });
    }

    // Apply cursor-based pagination
    if (cursorData) {
      this.applyCursorCondition(queryBuilder, cursorData, sortBy);
    }

    // Apply sorting
    this.applySorting(queryBuilder, sortBy);

    // Fetch limit + 1 to check if there are more results
    const signals = await queryBuilder.take(limit + 1).getMany();

    // Check if there are more results
    const hasMore = signals.length > limit;
    const resultSignals = hasMore ? signals.slice(0, limit) : signals;

    // Generate next cursor
    const nextCursor = hasMore
      ? this.encodeCursor(resultSignals[resultSignals.length - 1], sortBy)
      : null;

    // Transform signals to DTOs with eager loaded data
    const signalDtos = await Promise.all(
      resultSignals.map((signal) => this.transformToDto(signal)),
    );

    const response: SignalFeedResponseDto = {
      signals: signalDtos,
      nextCursor,
      hasMore,
    };

    // Cache the response for 30 seconds
    await this.cacheManager.set(cacheKey, response, 30000);

    return response;
  }

  private generateCacheKey(query: SignalFeedQueryDto): string {
    const { cursor, limit, asset, provider, sortBy } = query;
    return `feed:${cursor || 'first'}:${limit}:${asset || 'all'}:${provider || 'all'}:${sortBy}`;
  }

  private encodeCursor(signal: Signal, sortBy: SortBy): string {
    const cursorData: CursorData = {
      id: signal.id,
      timestamp: signal.createdAt.getTime(),
    };

    // Add sort-specific value for non-timestamp sorts
    if (sortBy === SortBy.POPULAR) {
      cursorData.sortValue = (signal.viewCount || 0) + (signal.followerCount || 0);
    } else if (sortBy === SortBy.PERFORMANCE) {
      cursorData.sortValue = signal.successRate || 0;
    }

    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  private decodeCursor(cursor: string): CursorData {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }

  private applyCursorCondition(
    queryBuilder: any,
    cursorData: CursorData,
    sortBy: SortBy,
  ): void {
    switch (sortBy) {
      case SortBy.RECENT:
        queryBuilder.andWhere(
          '(signal.createdAt < :timestamp OR (signal.createdAt = :timestamp AND signal.id < :id))',
          { timestamp: new Date(cursorData.timestamp), id: cursorData.id },
        );
        break;

      case SortBy.POPULAR:
        queryBuilder.andWhere(
          '((signal.viewCount + signal.followerCount) < :sortValue OR ((signal.viewCount + signal.followerCount) = :sortValue AND signal.id < :id))',
          { sortValue: cursorData.sortValue, id: cursorData.id },
        );
        break;

      case SortBy.PERFORMANCE:
        queryBuilder.andWhere(
          '(signal.successRate < :sortValue OR (signal.successRate = :sortValue AND signal.id < :id))',
          { sortValue: cursorData.sortValue, id: cursorData.id },
        );
        break;
    }
  }

  private applySorting(queryBuilder: any, sortBy: SortBy): void {
    switch (sortBy) {
      case SortBy.RECENT:
        queryBuilder
          .orderBy('signal.createdAt', 'DESC')
          .addOrderBy('signal.id', 'DESC');
        break;

      case SortBy.POPULAR:
        queryBuilder
          .orderBy('signal.viewCount + signal.followerCount', 'DESC')
          .addOrderBy('signal.id', 'DESC');
        break;

      case SortBy.PERFORMANCE:
        queryBuilder
          .orderBy('signal.successRate', 'DESC')
          .addOrderBy('signal.id', 'DESC');
        break;
    }
  }

  private async transformToDto(signal: Signal): Promise<SignalDto> {
    // In a real implementation, you'd fetch this from related entities
    // This is a simplified version
    return {
      id: signal.id,
      asset: signal.asset,
      provider: signal.provider,
      type: signal.type,
      entryPrice: signal.entryPrice,
      targetPrice: signal.targetPrice,
      stopLoss: signal.stopLoss,
      status: signal.status,
      createdAt: signal.createdAt,
      expiresAt: signal.expiresAt,
      popularity: (signal.viewCount || 0) + (signal.followerCount || 0),
      performance: signal.successRate,
      providerStats: {
        successRate: signal.successRate || 0,
        totalSignals: 0, // Fetch from provider stats
        activeSignals: 0, // Fetch from provider stats
      },
      assetInfo: {
        pair: signal.asset,
        currentPrice: 0, // Fetch from market data
        priceChange24h: 0, // Fetch from market data
      },
    };
  }
}