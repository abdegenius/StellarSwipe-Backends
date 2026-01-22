import { IsString, IsOptional, IsBoolean, IsUrl, MaxLength } from 'class-validator';

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
