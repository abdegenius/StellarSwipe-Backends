import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signal, SignalStatus, SignalType } from './entities/signal.entity';

@Injectable()
export class SignalsService {

  constructor(
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>,
  ) {}

  async create(createSignalDto: any): Promise<Signal> {
    // Validate required fields
    if (!createSignalDto.providerId || !createSignalDto.baseAsset || !createSignalDto.counterAsset) {
      throw new BadRequestException('providerId, baseAsset, and counterAsset are required');
    }

    const signal = this.signalRepository.create({
      providerId: createSignalDto.providerId,
      baseAsset: createSignalDto.baseAsset,
      counterAsset: createSignalDto.counterAsset,
      type: createSignalDto.type || SignalType.BUY,
      status: SignalStatus.ACTIVE,
      outcome: createSignalDto.outcome,
      entryPrice: createSignalDto.entryPrice || '0',
      targetPrice: createSignalDto.targetPrice || '0',
      stopLossPrice: createSignalDto.stopLossPrice || null,
      currentPrice: null,
      closePrice: null,
      copiersCount: 0,
      totalCopiedVolume: '0',
      expiresAt: createSignalDto.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      gracePeriodEndsAt: null,
      closedAt: null,
      rationale: createSignalDto.rationale || null,
      confidenceScore: createSignalDto.confidenceScore || 50,
      executedCount: 0,
      totalProfitLoss: '0',
      successRate: 0,
      metadata: createSignalDto.metadata || null,
    } as any);

    return this.signalRepository.save(signal as any);
  }

  async findOne(id: string): Promise<Signal | null> {
    return this.signalRepository.findOneBy({ id });
  }

  async findAll(): Promise<Signal[]> {
    return this.signalRepository.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async updateSignalStatus(id: string, status: SignalStatus): Promise<Signal | null> {
    await this.signalRepository.update(id, { status });
    return this.findOne(id);
  }
}
