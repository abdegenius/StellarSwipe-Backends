import { ApiProperty } from '@nestjs/swagger';

export class ProviderStats {
  @ApiProperty()
  successRate!: number;

  @ApiProperty()
  totalSignals!: number;

  @ApiProperty()
  activeSignals: number | undefined;
}

export class AssetInfo {
  @ApiProperty()
  pair!: string;

  @ApiProperty()
  currentPrice!: number;

  @ApiProperty()
  priceChange24h!: number;
}

export class SignalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  asset!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  type!: 'BUY' | 'SELL';

  @ApiProperty()
  entryPrice!: number;

  @ApiProperty()
  targetPrice!: number;

  @ApiProperty()
  stopLoss!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  popularity!: number; // e.g., view count or follower count

  @ApiProperty()
  performance?: number; // success rate or ROI

  @ApiProperty({ type: ProviderStats })
  providerStats!: ProviderStats;

  @ApiProperty({ type: AssetInfo })
  assetInfo!: AssetInfo;
}

export class SignalFeedResponseDto {
  @ApiProperty({ type: [SignalDto] })
  signals: SignalDto[] = [];

  @ApiProperty({
    description: 'Cursor for next page',
    nullable: true,
  })
  nextCursor: string | null = null;

  @ApiProperty({
    description: 'Whether more results are available',
  })
  hasMore: boolean = false;
}