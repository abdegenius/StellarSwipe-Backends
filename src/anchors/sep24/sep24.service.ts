import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InitiateDepositDto,
  InitiateWithdrawalDto,
  Sep24ResponseDto,
  TransactionStatusDto,
  GetTransactionDto,
  KycStatusDto,
  InitiateKycDto,
  TransactionType,
  TransactionStatus,
} from './dto/deposit-withdrawal.dto';
import {
  AnchorIntegrationsProvider,
  Sep24Transaction,
} from './providers/anchor-integrations';

@Injectable()
export class Sep24Service {
  private readonly logger = new Logger(Sep24Service.name);
  private readonly defaultAnchor: string;

  constructor(
    private readonly anchorProvider: AnchorIntegrationsProvider,
    private readonly configService: ConfigService,
  ) {
    this.defaultAnchor =
      this.configService.get<string>('SEP24_DEFAULT_ANCHOR') || 'circle';
    this.logger.log(`SEP24 Service initialized with default anchor: ${this.defaultAnchor}`);
  }

  async initiateDeposit(dto: InitiateDepositDto): Promise<Sep24ResponseDto> {
    try {
      const anchorDomain = dto.anchorDomain || this.defaultAnchor;

      this.logger.log(
        `User ${dto.userId} initiating deposit of ${dto.amount} ${dto.assetCode} via ${anchorDomain}`,
      );

      const anchor = this.anchorProvider.getAnchor(anchorDomain);

      const result = await this.anchorProvider.initiateDeposit(anchorDomain, {
        asset_code: dto.assetCode,
        account: dto.account || await this.getUserStellarAccount(dto.userId),
        amount: dto.amount.toString(),
        lang: dto.lang || 'en',
      });

      this.logger.log(
        `Deposit initiated successfully. Transaction ID: ${result.id}`,
      );

      return {
        type: TransactionType.DEPOSIT,
        url: result.url,
        id: result.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate deposit for user ${dto.userId}: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate deposit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async initiateWithdrawal(
    dto: InitiateWithdrawalDto,
  ): Promise<Sep24ResponseDto> {
    try {
      const anchorDomain = dto.anchorDomain || this.defaultAnchor;

      this.logger.log(
        `User ${dto.userId} initiating withdrawal of ${dto.amount} ${dto.assetCode} via ${anchorDomain}`,
      );

      const anchor = this.anchorProvider.getAnchor(anchorDomain);

      const result = await this.anchorProvider.initiateWithdrawal(
        anchorDomain,
        {
          asset_code: dto.assetCode,
          account: dto.account || await this.getUserStellarAccount(dto.userId),
          amount: dto.amount.toString(),
          type: dto.type,
          dest: dto.dest,
          dest_extra: dto.destExtra,
        },
      );

      this.logger.log(
        `Withdrawal initiated successfully. Transaction ID: ${result.id}`,
      );

      return {
        type: TransactionType.WITHDRAWAL,
        url: result.url,
        id: result.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate withdrawal for user ${dto.userId}: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate withdrawal',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTransactionStatus(
    dto: GetTransactionDto,
    anchorDomain?: string,
  ): Promise<TransactionStatusDto> {
    try {
      const domain = anchorDomain || this.defaultAnchor;

      this.logger.log(
        `Fetching transaction status from ${domain} - ID: ${dto.id}`,
      );

      const transaction = await this.anchorProvider.getTransaction(
        domain,
        dto.id,
        dto.stellarTransactionId,
        dto.externalTransactionId,
      );

      return this.mapToTransactionStatusDto(transaction);
    } catch (error) {
      this.logger.error(
        `Failed to get transaction status: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get transaction status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserTransactions(
    userId: string,
    assetCode: string,
    anchorDomain?: string,
    limit?: number,
  ): Promise<TransactionStatusDto[]> {
    try {
      const domain = anchorDomain || this.defaultAnchor;
      const account = await this.getUserStellarAccount(userId);

      this.logger.log(
        `Fetching transactions for user ${userId} from ${domain}`,
      );

      const transactions = await this.anchorProvider.getTransactions(
        domain,
        assetCode,
        account,
        limit,
      );

      return transactions.map((tx) => this.mapToTransactionStatusDto(tx));
    } catch (error) {
      this.logger.error(
        `Failed to get user transactions: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get user transactions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkKycStatus(
    userId: string,
    anchorDomain?: string,
  ): Promise<KycStatusDto> {
    try {
      const domain = anchorDomain || this.defaultAnchor;

      this.logger.log(`Checking KYC status for user ${userId} with ${domain}`);

      const result = await this.anchorProvider.checkKycStatus(domain, userId);

      return {
        userId,
        anchorDomain: domain,
        status: result.status,
        moreInfoUrl: result.moreInfoUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check KYC status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to check KYC status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async initiateKyc(dto: InitiateKycDto): Promise<{ url: string }> {
    try {
      this.logger.log(
        `Initiating KYC for user ${dto.userId} with ${dto.anchorDomain}`,
      );

      const result = await this.anchorProvider.initiateKyc(
        dto.anchorDomain,
        dto.userId,
      );

      this.logger.log(`KYC initiated successfully. URL: ${result.url}`);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to initiate KYC: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate KYC',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAvailableAnchors() {
    try {
      const anchors = this.anchorProvider.listAvailableAnchors();
      return anchors.map((anchor) => ({
        domain: anchor.domain,
        homeDomain: anchor.homeDomain,
        supportedAssets: this.anchorProvider.getSupportedAssets(anchor.domain),
        supportsKyc: !!anchor.kycUrl,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to list available anchors: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to list available anchors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private mapToTransactionStatusDto(
    transaction: Sep24Transaction,
  ): TransactionStatusDto {
    return {
      id: transaction.id,
      status: transaction.status,
      statusEta: transaction.status_eta,
      moreInfoUrl: transaction.more_info_url,
      amountIn: transaction.amount_in,
      amountOut: transaction.amount_out,
      amountFee: transaction.amount_fee,
      startedAt: transaction.started_at
        ? new Date(transaction.started_at)
        : undefined,
      completedAt: transaction.completed_at
        ? new Date(transaction.completed_at)
        : undefined,
      stellarTransactionId: transaction.stellar_transaction_id,
      externalTransactionId: transaction.external_transaction_id,
      message: transaction.message,
    };
  }

  private async getUserStellarAccount(userId: string): Promise<string> {
    const stellarAccount = this.configService.get<string>(
      `USER_STELLAR_ACCOUNT_${userId}`,
    );
    if (!stellarAccount) {
      throw new NotFoundException(
        `Stellar account not found for user ${userId}`,
      );
    }
    return stellarAccount;
  }
}
