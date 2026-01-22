import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { QualityScore, QualityBadge } from './entities/quality-score.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

interface ProviderQualityReport {
  providerId: string;
  averageScore: number;
  badge: QualityBadge;
  totalSignals: number;
  successRate: number;
  trend: 'improving' | 'declining' | 'stable';
  recentScores: number[];
}

@Injectable()
export class QualityTrackerService {
  private readonly logger = new Logger(QualityTrackerService.name);

  constructor(
    @InjectRepository(QualityScore)
    private qualityScoreRepository: Repository<QualityScore>,
  ) {}

  /**
   * Track quality trends over time
   */
  async getProviderQualityReport(providerId: string, days = 30): Promise<ProviderQualityReport> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const scores = await this.qualityScoreRepository.find({
      where: {
        providerId,
        calculatedAt: MoreThan(cutoffDate),
      },
      order: { calculatedAt: 'DESC' },
    });

    if (scores.length === 0) {
      return {
        providerId,
        averageScore: 0,
        badge: QualityBadge.BRONZE,
        totalSignals: 0,
        successRate: 0,
        trend: 'stable',
        recentScores: [],
      };
    }

    const avgScore = scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;
    const totalSuccessful = scores.reduce((sum, s) => sum + s.successfulSignals, 0);
    const totalSignals = scores.reduce((sum, s) => sum + s.totalSignalsTracked, 0);
    const successRate = totalSignals > 0 ? (totalSuccessful / totalSignals) * 100 : 0;

    // Determine trend
    const trend = this.calculateTrend(scores.map(s => s.overallScore));

    // Determine badge from average
    let badge = QualityBadge.BRONZE;
    if (avgScore >= 90) badge = QualityBadge.PLATINUM;
    else if (avgScore >= 75) badge = QualityBadge.GOLD;
    else if (avgScore >= 60) badge = QualityBadge.SILVER;

    return {
      providerId,
      averageScore: Math.round(avgScore * 100) / 100,
      badge,
      totalSignals,
      successRate: Math.round(successRate * 100) / 100,
      trend,
      recentScores: scores.slice(0, 10).map(s => s.overallScore),
    };
  }

  /**
   * Calculate quality trend
   */
  private calculateTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
    if (scores.length < 5) return 'stable';

    const recentAvg = scores.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const olderAvg = scores.slice(5, 10).reduce((a, b) => a + b, 0) / Math.min(5, scores.length - 5);

    const difference = recentAvg - olderAvg;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  /**
   * Get top quality signals
   */
  async getTopQualitySignals(limit = 10, minScore = 75): Promise<QualityScore[]> {
    return this.qualityScoreRepository.find({
      where: {
        overallScore: MoreThan(minScore),
      },
      order: { overallScore: 'DESC' },
      take: limit,
    });
  }

  /**
   * Scheduled task to cleanup old scores
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldScores() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days

    const result = await this.qualityScoreRepository
      .createQueryBuilder()
      .delete()
      .where('calculatedAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old quality scores`);
  }

  /**
   * Get quality distribution by badge
   */
  async getQualityDistribution(providerId?: string): Promise<Record<QualityBadge, number>> {
    const queryBuilder = this.qualityScoreRepository.createQueryBuilder('qs');

    if (providerId) {
      queryBuilder.where('qs.providerId = :providerId', { providerId });
    }

    const scores = await queryBuilder.getMany();

    const distribution: Record<QualityBadge, number> = {
      [QualityBadge.BRONZE]: 0,
      [QualityBadge.SILVER]: 0,
      [QualityBadge.GOLD]: 0,
      [QualityBadge.PLATINUM]: 0,
    };

    scores.forEach(score => {
      if (score.badge) {
        distribution[score.badge]++;
      }
    });

    return distribution;
  }
}