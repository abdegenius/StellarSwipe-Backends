import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  Signal,
  SignalStatus,
  SignalOutcome,
  SignalType,
} from '../entities/signal.entity';

// Stub for disabled feature
export class SignalPerformance {
  id!: string;
  signalId!: string;
}

// import { SignalPerformance } from '../entities/signal-performance.entity';
import { SdexPriceService } from './sdex-price.service';
import {
  CreateSignalDto,
  UpdateSignalDto,
} from '../dto';

// Stub DTOs for disabled features
export class PerformanceQueryDto {}

@Injectable()
export class SignalPerformanceService {

  constructor(
    @InjectRepository(Signal)
    private signalRepository: Repository<Signal>,
    // @InjectRepository(SignalPerformance)
    // private performanceRepository: Repository<SignalPerformance>,
    private sdexPriceService: SdexPriceService,
  ) {}

  async createSignal(dto: CreateSignalDto): Promise<Signal> {
    const entryPrice = parseFloat(dto.entryPrice);
    const targetPrice = parseFloat(dto.targetPrice);
    const stopLossPrice = parseFloat(dto.stopLossPrice || '0');

    if (dto.type === SignalType.BUY) {
      if (targetPrice <= entryPrice) {
        throw new BadRequestException(
          'Target price must be higher than entry price for BUY signals',
        );
      }
      if (stopLossPrice >= entryPrice) {
        throw new BadRequestException(
          'Stop loss price must be lower than entry price for BUY signals',
        );
      }
    } else {
      if (targetPrice >= entryPrice) {
        throw new BadRequestException(
          'Target price must be lower than entry price for SELL signals',
        );
      }
      if (stopLossPrice <= entryPrice) {
        throw new BadRequestException(
          'Stop loss price must be higher than entry price for SELL signals',
        );
      }
    }

    const signal = this.signalRepository.create({
      providerId: dto.providerId,
      baseAsset: dto.baseAsset,
      counterAsset: dto.counterAsset,
      type: dto.type,
      entryPrice: dto.entryPrice,
      targetPrice: dto.targetPrice,
      stopLossPrice: dto.stopLossPrice || null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : new Date(),
      status: SignalStatus.ACTIVE,
      outcome: SignalOutcome.PENDING,
      metadata: dto.metadata,
    } as any);

    const saved = (await this.signalRepository.save(signal)) as unknown as Signal;
    return saved;
  }

  async getSignal(id: string): Promise<Signal> {
    const signal = await this.signalRepository.findOne({
      where: { id },
      relations: ['performanceHistory'],
    });

    if (!signal) {
      throw new NotFoundException('Signal not found');
    }

    return signal;
  }

  async listSignals(query: any): Promise<{
    data: Signal[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = (query.page as number | undefined) ?? 1;
    const limit = (query.limit as number | undefined) ?? 20;

    const whereConditions: Record<string, unknown> = {};

    if (query.providerId) {
      whereConditions.providerId = query.providerId;
    }
    if (query.status) {
      whereConditions.status = query.status;
    }
    if (query.type) {
      whereConditions.type = query.type;
    }
    if (query.baseAsset) {
      whereConditions.baseAsset = query.baseAsset;
    }
    if (query.counterAsset) {
      whereConditions.counterAsset = query.counterAsset;
    }

    const [data, total] = await this.signalRepository.findAndCount({
      where: whereConditions,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async updateSignal(id: string, dto: UpdateSignalDto): Promise<Signal> {
    const signal = await this.getSignal(id);

    if (dto.status) {
      signal.status = dto.status;
    }
    if (dto.outcome) {
      signal.outcome = dto.outcome;
    }
    if (dto.currentPrice !== undefined) {
      signal.currentPrice = dto.currentPrice;
    }
    if (dto.closePrice !== undefined) {
      signal.closePrice = dto.closePrice;
    }
    if (dto.copiersCount !== undefined) {
      signal.copiersCount = dto.copiersCount;
    }
    if (dto.totalCopiedVolume !== undefined) {
      signal.totalCopiedVolume = dto.totalCopiedVolume;
    }
    if (dto.metadata) {
      signal.metadata = { ...signal.metadata, ...dto.metadata };
    }

    const saved = (await this.signalRepository.save(signal)) as unknown as Signal;
    return saved;
  }

  async closeSignal(
    id: string,
    outcome: SignalOutcome,
    closePrice: string,
  ): Promise<Signal> {
    const signal = await this.getSignal(id);

    if (signal.status !== SignalStatus.ACTIVE) {
      throw new BadRequestException('Signal is not active');
    }

    signal.status = SignalStatus.CLOSED;
    signal.outcome = outcome;
    signal.closePrice = closePrice;
    signal.closedAt = new Date();

    const saved = (await this.signalRepository.save(signal)) as unknown as Signal;
    return saved;
  }

  async recordPerformance(signalId: string): Promise<SignalPerformance | null> {
    // Performance tracking is disabled in this build; update current price and return null.
    const signal = await this.getSignal(signalId);
    if (!signal || signal.status !== SignalStatus.ACTIVE) return null;

    const priceResult = await this.sdexPriceService.getPrice(signal.baseAsset, signal.counterAsset);
    const currentPrice = priceResult.available ? priceResult.price : signal.currentPrice || signal.entryPrice;

    await this.signalRepository.update(signalId, { currentPrice } as any);
    return null;
  }

  async checkSignalOutcome(signalId: string): Promise<{
    signal: Signal;
    outcome: SignalOutcome;
    shouldClose: boolean;
  }> {
    const signal = await this.getSignal(signalId);

    if (signal.status !== SignalStatus.ACTIVE) {
      return { signal, outcome: signal.outcome, shouldClose: false };
    }

    if (new Date() > signal.expiresAt) {
      return { signal, outcome: SignalOutcome.EXPIRED, shouldClose: true };
    }

    const priceResult = await this.sdexPriceService.getPrice(
      signal.baseAsset,
      signal.counterAsset,
    );

    if (!priceResult.available) {
      return { signal, outcome: SignalOutcome.PENDING, shouldClose: false };
    }

    const currentPrice = priceResult.price;

    if (
      this.sdexPriceService.isTargetHit(
        currentPrice,
        signal.targetPrice,
        signal.type as unknown as 'buy' | 'sell',
      )
    ) {
      return { signal, outcome: SignalOutcome.TARGET_HIT, shouldClose: true };
    }

    if (
      signal.stopLossPrice && 
      this.sdexPriceService.isStopLossHit(
        currentPrice,
        signal.stopLossPrice,
        signal.type as unknown as 'buy' | 'sell',
      )
    ) {
      return { signal, outcome: SignalOutcome.STOP_LOSS_HIT, shouldClose: true };
    }

    return { signal, outcome: SignalOutcome.PENDING, shouldClose: false };
  }

  async getActiveSignals(): Promise<Signal[]> {
    return this.signalRepository.find({
      where: { status: SignalStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async getExpiredSignals(): Promise<Signal[]> {
    return this.signalRepository.find({
      where: {
        status: SignalStatus.ACTIVE,
        expiresAt: LessThan(new Date()),
      },
    });
  }

  async getPerformanceHistory(_signalId: string, query: any): Promise<{
    data: SignalPerformance[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Performance tracking disabled in this build — return empty page
    const page = (query?.page as number | undefined) ?? 1;
    const limit = (query?.limit as number | undefined) ?? 20;
    return { data: [], total: 0, page, limit };
  }

  async getSignalsByProvider(providerId: string): Promise<Signal[]> {
    return this.signalRepository.find({
      where: { providerId },
      order: { createdAt: 'DESC' },
    });
  }

  async incrementCopiers(signalId: string, volume: string): Promise<Signal> {
    const signal = await this.getSignal(signalId);

    signal.copiersCount += 1;
    signal.totalCopiedVolume = (
      parseFloat(signal.totalCopiedVolume) + parseFloat(volume)
    ).toFixed(8);

    return this.signalRepository.save(signal);
  }

  async getSignalStats(): Promise<{
    totalActiveSignals: number;
    totalClosedSignals: number;
    avgPnlActive: string;
    totalVolume: string;
  }> {
    const activeCount = await this.signalRepository.count({
      where: { status: SignalStatus.ACTIVE },
    });

    const closedCount = await this.signalRepository.count({
      where: { status: SignalStatus.CLOSED },
    });

    const activeSignals = await this.getActiveSignals();

    let totalPnl = 0;
    let totalVolume = 0;

    for (const signal of activeSignals) {
      if (signal.currentPrice) {
        const pnl = this.sdexPriceService.calculatePnlPercentage(
          signal.entryPrice,
          signal.currentPrice,
        );
        totalPnl += parseFloat(pnl);
      }
      totalVolume += parseFloat(signal.totalCopiedVolume);
    }

    const avgPnl =
      activeSignals.length > 0
        ? (totalPnl / activeSignals.length).toFixed(4)
        : '0';

    return {
      totalActiveSignals: activeCount,
      totalClosedSignals: closedCount,
      avgPnlActive: avgPnl,
      totalVolume: totalVolume.toFixed(8),
    };
  }
}
