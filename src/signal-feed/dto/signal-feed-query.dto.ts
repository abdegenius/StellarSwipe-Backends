import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortBy {
  RECENT = 'recent',
  POPULAR = 'popular',
  PERFORMANCE = 'performance',
}

export class SignalFeedQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination',
    example: 'eyJpZCI6MTIzNCwidGltZXN0YW1wIjoxNzAwMDAwMDAwfQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of signals per page',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by asset pair',
    example: 'USDC/XLM',
  })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({
    description: 'Filter by provider wallet address',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Sort signals by criteria',
    enum: SortBy,
    default: SortBy.RECENT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.RECENT;
}