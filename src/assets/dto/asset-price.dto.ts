import { IsString, IsOptional, IsBoolean, IsUrl, MaxLength } from 'class-validator';
import { IsNumber } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MaxLength(12)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(56)
  issuer?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class AssetPriceDto {
  @IsString()
  pair!: string;

  @IsString()
  lastPrice!: string;

  @IsOptional()
  @IsString()
  bidPrice?: string;

  @IsOptional()
  @IsString()
  askPrice?: string;

  @IsOptional()
  @IsString()
  baseVolume24h?: string;

  @IsOptional()
  @IsString()
  counterVolume24h?: string;

  @IsOptional()
  @IsNumber()
  tradeCount24h?: number;

  timestamp!: Date;
}

export class AssetDto {
  id!: string;
  code!: string;
  issuer?: string | null;
  name!: string;
  description!: string | null;
  logoUrl!: string | null;
  isVerified!: boolean;
  isPopular!: boolean;
  type!: string;
  createdAt!: Date;
}

export class AssetPairDto {
  id!: string;
  baseAsset!: AssetDto;
  counterAsset!: AssetDto;
  isTradable!: boolean;
  lastPrice!: string | null;
  bidPrice!: string | null;
  askPrice!: string | null;
  baseVolume24h!: string | null;
  counterVolume24h!: string | null;
  tradeCount24h!: number;
  lastPriceUpdate!: Date | null;
}
