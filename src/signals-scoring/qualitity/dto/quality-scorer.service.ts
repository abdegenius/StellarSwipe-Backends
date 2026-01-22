import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityScore, QualityBadge as EntityQualityBadge } from '../entities/quality-score.entity';
import { QualityScoreDto, QualityScoreCalculationInput, QualityBadge as DtoQualityBadge } from './quality-score.dto';

@Injectable()
export class QualityScorerService {
  private readonly logger = new Logger(QualityScorerService.name);

  // Scoring weights
  private readonly WEIGHTS = {
    accuracy: 0.30,
    consistency: 0.20,
    timeliness: 0.15,
    marketAlignment: 0.20,
    riskAdjusted: 0.15,
  };

  constructor(
    @InjectRepository(QualityScore)
    private qualityScoreRepository: Repository<QualityScore>,
  ) {}

  /**
   * Calculate comprehensive quality score for a signal
   */
  async calculateQualityScore(input: QualityScoreCalculationInput): Promise<QualityScoreDto> {
    this.logger.log(`Calculating quality score for signal: ${input.signalId}`);

    // Calculate component scores
    const accuracyScore = this.calculateAccuracyScore(input);
    const consistencyScore = this.calculateConsistencyScore(input);
    const timelinessScore = this.calculateTimelinessScore(input);
    const marketAlignmentScore = this.calculateMarketAlignmentScore(input);
    const riskAdjustedScore = this.calculateRiskAdjustedScore(input);

    // Calculate weighted overall score
    const overallScore = 
      accuracyScore * this.WEIGHTS.accuracy +
      consistencyScore * this.WEIGHTS.consistency +
      timelinessScore * this.WEIGHTS.timeliness +
      marketAlignmentScore * this.WEIGHTS.marketAlignment +
      riskAdjustedScore * this.WEIGHTS.riskAdjusted;

    // Determine badge
    const badge = this.determineBadge(overallScore);

    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(input);

    // Generate metadata
    const metadata = this.generateMetadata(
      { accuracyScore, consistencyScore, timelinessScore, marketAlignmentScore, riskAdjustedScore },
      input
    );

    // Save to database
    const qualityScore = this.qualityScoreRepository.create({
      signalId: input.signalId,
      providerId: input.providerId,
      overallScore: Math.round(overallScore * 100) / 100,
      accuracyScore,
      consistencyScore,
      timelinessScore,
      marketAlignmentScore,
      riskAdjustedScore,
      historicalAccuracy: input.providerHistory 
        ? (input.providerHistory.successfulSignals / input.providerHistory.totalSignals) * 100
        : null,
      totalSignalsTracked: input.providerHistory?.totalSignals || 0,
      successfulSignals: input.providerHistory?.successfulSignals || 0,
      failedSignals: input.providerHistory 
        ? input.providerHistory.totalSignals - input.providerHistory.successfulSignals 
        : 0,
      sharpeRatio: riskMetrics.sharpeRatio,
      maxDrawdown: riskMetrics.maxDrawdown,
      volatility: riskMetrics.volatility,
      badge,
      metadata,
      calculatedAt: new Date(),
    });

    await this.qualityScoreRepository.save(qualityScore);

    return this.toDto(qualityScore);
  }

  /**
   * Calculate accuracy score based on historical performance
   */
  private calculateAccuracyScore(input: QualityScoreCalculationInput): number {
    if (!input.providerHistory || input.providerHistory.totalSignals === 0) {
      // Default score for new providers based on signal confidence
      const confidence = input.signalData?.confidence ?? 0.5;
      return confidence * 60; // Max 60 for unproven
    }

    const successRate = input.providerHistory.successfulSignals / input.providerHistory.totalSignals;
    const minSignals = 10;
    
    // Adjust for sample size (more signals = more reliable)
    const reliabilityFactor = Math.min(input.providerHistory.totalSignals / minSignals, 1);
    
    return successRate * 100 * reliabilityFactor;
  }

  /**
   * Calculate consistency score based on return variance
   */
  private calculateConsistencyScore(input: QualityScoreCalculationInput): number {
    if (!input.providerHistory?.returns || input.providerHistory.returns.length < 3) {
      return 50; // Neutral score for insufficient data
    }

    const returns = input.providerHistory.returns;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Lower volatility = higher consistency
    const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 1;
    const consistencyScore = Math.max(0, 100 - (coefficientOfVariation * 50));

    return Math.min(100, consistencyScore);
  }

  /**
   * Calculate timeliness score based on signal freshness and execution window
   */
  private calculateTimelinessScore(input: QualityScoreCalculationInput): number {
    if (!input.signalData) {
      return 50; // Default score if signal data is missing
    }

    // Score based on timeframe appropriateness
    const timeframeScores: Record<string, number> = {
      '1m': 95,
      '5m': 90,
      '15m': 85,
      '1h': 80,
      '4h': 75,
      '1d': 70,
      '1w': 60,
    };

    const baseScore = timeframeScores[input.signalData.timeframe] || 50;

    // Boost for clear entry/exit levels
    const hasStopLoss = input.signalData.stopLoss > 0;
    const hasTarget = input.signalData.targetPrice > 0;
    const clarityBonus = (hasStopLoss ? 5 : 0) + (hasTarget ? 5 : 0);

    return Math.min(100, baseScore + clarityBonus);
  }

  /**
   * Calculate market alignment score
   */
  private calculateMarketAlignmentScore(input: QualityScoreCalculationInput): number {
    // Base score from signal confidence
    const confidence = input.signalData?.confidence ?? 0.5;
    let score = confidence * 70;

    // Bonus for reasonable risk/reward ratio
    const riskRewardRatio = this.calculateRiskRewardRatio(input.signalData);
    if (riskRewardRatio >= 2) score += 20;
    else if (riskRewardRatio >= 1.5) score += 10;
    else if (riskRewardRatio < 1) score -= 10;

    // Market condition alignment
    if (input.signalData?.marketConditions) {
      score += 10; // Bonus for considering market context
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate risk-adjusted score using Sharpe-like metrics
   */
  private calculateRiskAdjustedScore(input: QualityScoreCalculationInput): number {
    if (!input.providerHistory?.returns || input.providerHistory.returns.length < 3) {
      // Score based on signal's risk/reward setup
      const rrRatio = this.calculateRiskRewardRatio(input.signalData);
      return Math.min(100, rrRatio * 30);
    }

    const { sharpeRatio } = this.calculateRiskMetrics(input);
    
    // Convert Sharpe ratio to 0-100 score
    // Sharpe > 2 is excellent, 1-2 is good, 0-1 is acceptable, <0 is poor
    if (sharpeRatio >= 2) return 100;
    if (sharpeRatio >= 1) return 70 + (sharpeRatio - 1) * 30;
    if (sharpeRatio >= 0) return 40 + sharpeRatio * 30;
    return Math.max(0, 40 + sharpeRatio * 20);
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(input: QualityScoreCalculationInput): {
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  } {
    if (!input.providerHistory?.returns || input.providerHistory.returns.length < 2) {
      return { sharpeRatio: 0, maxDrawdown: 0, volatility: 0 };
    }

    const returns = input.providerHistory.returns;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Sharpe ratio (assuming risk-free rate of 0 for simplicity)
    const sharpeRatio = volatility !== 0 ? mean / volatility : 0;

    // Max drawdown
    let maxDrawdown = 0;
    let peak = returns[0];
    for (const ret of returns) {
      if (ret > peak) peak = ret;
      const drawdown = ((peak - ret) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
    };
  }

  /**
   * Calculate risk/reward ratio
   */
  private calculateRiskRewardRatio(signalData: QualityScoreCalculationInput['signalData']): number {
    if (!signalData) return 0;
    
    const { entryPrice, targetPrice, stopLoss } = signalData;
    
    if (!stopLoss || stopLoss === 0) return 0;

    const reward = Math.abs(targetPrice - entryPrice);
    const risk = Math.abs(entryPrice - stopLoss);

    return risk !== 0 ? reward / risk : 0;
  }

  /**
   * Determine quality badge tier
   */
  private determineBadge(overallScore: number): EntityQualityBadge {
    if (overallScore >= 90) return EntityQualityBadge.PLATINUM;
    if (overallScore >= 75) return EntityQualityBadge.GOLD;
    if (overallScore >= 60) return EntityQualityBadge.SILVER;
    return EntityQualityBadge.BRONZE;
  }

  /**
   * Map entity badge enum to DTO badge string
   */
  private mapBadgeToDto(badge: EntityQualityBadge): DtoQualityBadge {
    switch (badge) {
      case EntityQualityBadge.PLATINUM:
        return 'excellent';
      case EntityQualityBadge.GOLD:
        return 'good';
      case EntityQualityBadge.SILVER:
        return 'fair';
      case EntityQualityBadge.BRONZE:
      default:
        return 'poor';
    }
  }

  /**
   * Generate metadata with insights
   */
  private generateMetadata(
    scores: Record<string, number>,
    input: QualityScoreCalculationInput
  ): QualityScore['metadata'] {
    const strengths: string[] = [];
    const warnings: string[] = [];

    // Identify strengths
    if (scores.accuracyScore >= 80) strengths.push('High historical accuracy');
    if (scores.consistencyScore >= 80) strengths.push('Consistent performance');
    if (scores.riskAdjustedScore >= 80) strengths.push('Strong risk-adjusted returns');
    if (this.calculateRiskRewardRatio(input.signalData) >= 2) strengths.push('Favorable risk/reward ratio');

    // Identify warnings
    if (scores.accuracyScore < 50) warnings.push('Low historical accuracy');
    if (scores.consistencyScore < 50) warnings.push('Inconsistent returns');
    if (!input.providerHistory || input.providerHistory.totalSignals < 10) {
      warnings.push('Limited track record');
    }
    if (this.calculateRiskRewardRatio(input.signalData) < 1) {
      warnings.push('Unfavorable risk/reward ratio');
    }

    return {
      factors: scores,
      strengths,
      warnings,
      marketConditions: input.signalData?.marketConditions || 'Not specified',
    };
  }

  /**
   * Convert entity to DTO
   */
  private toDto(score: QualityScore): QualityScoreDto {
    return {
      id: score.id,
      signalId: score.signalId,
      providerId: score.providerId,
      overallScore: score.overallScore,
      badge: score.badge ? this.mapBadgeToDto(score.badge) : undefined,
      breakdown: {
        accuracy: score.accuracyScore,
        consistency: score.consistencyScore,
        timeliness: score.timelinessScore,
        marketAlignment: score.marketAlignmentScore,
        riskAdjusted: score.riskAdjustedScore,
      },
      historicalMetrics: {
        accuracy: score.historicalAccuracy || 0,
        totalSignals: score.totalSignalsTracked,
        successRate: score.totalSignalsTracked > 0 
          ? (score.successfulSignals / score.totalSignalsTracked) * 100 
          : 0,
      },
      riskMetrics: {
        sharpeRatio: score.sharpeRatio || 0,
        maxDrawdown: score.maxDrawdown || 0,
        volatility: score.volatility || 0,
      },
      metadata: {
        strengths: score.metadata?.strengths || [],
        warnings: score.metadata?.warnings || [],
        marketConditions: score.metadata?.marketConditions || 'Unknown',
      },
      calculatedAt: score.calculatedAt,
    };
  }

  /**
   * Get quality score by signal ID
   */
  async getQualityScoreBySignal(signalId: string): Promise<QualityScoreDto | null> {
    const score = await this.qualityScoreRepository.findOne({
      where: { signalId },
      order: { calculatedAt: 'DESC' },
    });

    return score ? this.toDto(score) : null;
  }

  /**
   * Get average quality score for a provider
   */
  async getProviderAverageScore(providerId: string, limit = 20): Promise<number> {
    const scores = await this.qualityScoreRepository.find({
      where: { providerId },
      order: { calculatedAt: 'DESC' },
      take: limit,
    });

    if (scores.length === 0) return 0;

    const sum = scores.reduce((acc, s) => acc + s.overallScore, 0);
    return Math.round((sum / scores.length) * 100) / 100;
  }
}