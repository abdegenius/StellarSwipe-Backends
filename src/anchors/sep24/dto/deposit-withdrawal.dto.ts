import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum TransactionStatus {
  INCOMPLETE = 'incomplete',
  PENDING_USER_TRANSFER_START = 'pending_user_transfer_start',
  PENDING_ANCHOR = 'pending_anchor',
  PENDING_STELLAR = 'pending_stellar',
  PENDING_EXTERNAL = 'pending_external',
  PENDING_TRUST = 'pending_trust',
  PENDING_USER = 'pending_user',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
  ERROR = 'error',
}

export enum AssetCode {
  USDC = 'USDC',
  XLM = 'XLM',
}

export class InitiateDepositDto {
  @ApiProperty({
    description: 'User ID initiating the deposit',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: AssetCode,
    description: 'Asset to deposit (USDC or XLM)',
    example: AssetCode.USDC,
  })
  @IsEnum(AssetCode)
  @IsNotEmpty()
  assetCode: AssetCode;

  @ApiProperty({
    description: 'Amount to deposit in fiat',
    example: 100.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'Stellar account to receive the deposit',
  })
  @IsOptional()
  @IsString()
  account?: string;

  @ApiPropertyOptional({
    description: 'Language preference for anchor UI',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  lang?: string;

  @ApiPropertyOptional({
    description: 'Anchor service to use',
    example: 'circle',
  })
  @IsOptional()
  @IsString()
  anchorDomain?: string;
}

export class InitiateWithdrawalDto {
  @ApiProperty({
    description: 'User ID initiating the withdrawal',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: AssetCode,
    description: 'Asset to withdraw (USDC or XLM)',
    example: AssetCode.USDC,
  })
  @IsEnum(AssetCode)
  @IsNotEmpty()
  assetCode: AssetCode;

  @ApiProperty({
    description: 'Amount to withdraw',
    example: 50.0,
  })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'Destination type (bank_account, card, etc.)',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Destination identifier',
  })
  @IsOptional()
  @IsString()
  dest?: string;

  @ApiPropertyOptional({
    description: 'Additional destination details',
  })
  @IsOptional()
  @IsString()
  destExtra?: string;

  @ApiPropertyOptional({
    description: 'Stellar account sending the withdrawal',
  })
  @IsOptional()
  @IsString()
  account?: string;

  @ApiPropertyOptional({
    description: 'Anchor service to use',
    example: 'circle',
  })
  @IsOptional()
  @IsString()
  anchorDomain?: string;
}

export class TransactionStatusDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '82fhs729f63dh0v4',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    enum: TransactionStatus,
    description: 'Current transaction status',
  })
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Status update timestamp',
  })
  @IsOptional()
  statusEta?: number;

  @ApiPropertyOptional({
    description: 'More details about the transaction',
  })
  @IsOptional()
  @IsString()
  moreInfoUrl?: string;

  @ApiPropertyOptional({
    description: 'Amount in',
  })
  @IsOptional()
  @IsString()
  amountIn?: string;

  @ApiPropertyOptional({
    description: 'Amount out',
  })
  @IsOptional()
  @IsString()
  amountOut?: string;

  @ApiPropertyOptional({
    description: 'Fee charged',
  })
  @IsOptional()
  @IsString()
  amountFee?: string;

  @ApiPropertyOptional({
    description: 'Started timestamp',
  })
  @IsOptional()
  startedAt?: Date;

  @ApiPropertyOptional({
    description: 'Completed timestamp',
  })
  @IsOptional()
  completedAt?: Date;

  @ApiPropertyOptional({
    description: 'Stellar transaction ID',
  })
  @IsOptional()
  @IsString()
  stellarTransactionId?: string;

  @ApiPropertyOptional({
    description: 'External transaction ID',
  })
  @IsOptional()
  @IsString()
  externalTransactionId?: string;

  @ApiPropertyOptional({
    description: 'Error message if status is error',
  })
  @IsOptional()
  @IsString()
  message?: string;
}

export class Sep24ResponseDto {
  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
  })
  type: TransactionType;

  @ApiProperty({
    description: 'Interactive URL for the anchor flow',
  })
  url: string;

  @ApiProperty({
    description: 'Unique transaction identifier',
  })
  id: string;
}

export class GetTransactionDto {
  @ApiProperty({
    description: 'Transaction ID to query',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiPropertyOptional({
    description: 'Stellar transaction hash',
  })
  @IsOptional()
  @IsString()
  stellarTransactionId?: string;

  @ApiPropertyOptional({
    description: 'External transaction ID',
  })
  @IsOptional()
  @IsString()
  externalTransactionId?: string;
}

export class KycStatusDto {
  @ApiProperty({
    description: 'User ID',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Anchor domain',
  })
  @IsString()
  @IsNotEmpty()
  anchorDomain: string;

  @ApiProperty({
    description: 'KYC verification status',
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'More info URL for KYC',
  })
  @IsOptional()
  @IsString()
  moreInfoUrl?: string;
}

export class InitiateKycDto {
  @ApiProperty({
    description: 'User ID to initiate KYC for',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Anchor domain for KYC',
  })
  @IsString()
  @IsNotEmpty()
  anchorDomain: string;
}
