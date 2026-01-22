export type QualityBadge = 'excellent' | 'good' | 'fair' | 'poor';

export class QualityScoreDto {
  id?: string;
  signalId?: string;
  providerId?: string;
  overallScore?: number;
  badge?: QualityBadge;
  breakdown?: {
    accuracy: number;
    consistency: number;
    timeliness: number;
    marketAlignment: number;
    riskAdjusted: number;
  };
  historicalMetrics?: {
    accuracy: number;
    totalSignals: number;
    successRate: number;
  };
  riskMetrics?: {
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  };
  metadata?: {
    strengths: string[];
    warnings: string[];
    marketConditions: string;
  };
  calculatedAt?: Date;
}

export class QualityScoreCalculationInput {
  signalId?: string;
  providerId?: string;
  signalData?: {
    asset: string;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    confidence: number;
    timeframe: string;
    marketConditions?: string;
  };
  providerHistory?: {
    totalSignals: number;
    successfulSignals: number;
    averageReturn: number;
    returns: number[];
  };
}
