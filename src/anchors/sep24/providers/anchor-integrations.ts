import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  AssetCode,
  TransactionType,
  TransactionStatus,
} from '../dto/deposit-withdrawal.dto';

export interface AnchorConfig {
  domain: string;
  homeDomain: string;
  transferServerUrl: string;
  webAuthUrl: string;
  kycUrl?: string;
}

export interface Sep24DepositParams {
  asset_code: string;
  account: string;
  amount?: string;
  lang?: string;
  email?: string;
  jwt?: string;
}

export interface Sep24WithdrawalParams {
  asset_code: string;
  account: string;
  amount?: string;
  type?: string;
  dest?: string;
  dest_extra?: string;
  jwt?: string;
}

export interface Sep24Transaction {
  id: string;
  kind: TransactionType;
  status: TransactionStatus;
  status_eta?: number;
  more_info_url?: string;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at?: string;
  completed_at?: string;
  stellar_transaction_id?: string;
  external_transaction_id?: string;
  message?: string;
}

@Injectable()
export class AnchorIntegrationsProvider {
  private readonly logger = new Logger(AnchorIntegrationsProvider.name);
  private readonly anchors: Map<string, AnchorConfig> = new Map();
  private readonly httpClients: Map<string, AxiosInstance> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeAnchors();
  }

  private initializeAnchors() {
    const defaultAnchors: AnchorConfig[] = [
      {
        domain: 'circle',
        homeDomain: 'circle.com',
        transferServerUrl: 'https://api.circle.com/sep24',
        webAuthUrl: 'https://api.circle.com/auth',
        kycUrl: 'https://api.circle.com/kyc',
      },
      {
        domain: 'vibrant',
        homeDomain: 'vibrantapp.com',
        transferServerUrl: 'https://api.vibrantapp.com/sep24',
        webAuthUrl: 'https://api.vibrantapp.com/auth',
        kycUrl: 'https://api.vibrantapp.com/kyc',
      },
      {
        domain: 'moneygram',
        homeDomain: 'moneygram.com',
        transferServerUrl: 'https://extusdc.moneygram.com/sep24',
        webAuthUrl: 'https://extusdc.moneygram.com/auth',
      },
    ];

    defaultAnchors.forEach((anchor) => {
      this.anchors.set(anchor.domain, anchor);
      this.httpClients.set(
        anchor.domain,
        axios.create({
          baseURL: anchor.transferServerUrl,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );
    });

    this.logger.log(
      `Initialized ${this.anchors.size} anchor integrations: ${Array.from(this.anchors.keys()).join(', ')}`,
    );
  }

  getAnchor(domain: string): AnchorConfig {
    const anchor = this.anchors.get(domain);
    if (!anchor) {
      throw new HttpException(
        `Anchor ${domain} not configured`,
        HttpStatus.NOT_FOUND,
      );
    }
    return anchor;
  }

  private getHttpClient(domain: string): AxiosInstance {
    const client = this.httpClients.get(domain);
    if (!client) {
      throw new HttpException(
        `HTTP client for anchor ${domain} not found`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return client;
  }

  async initiateDeposit(
    anchorDomain: string,
    params: Sep24DepositParams,
  ): Promise<{ url: string; id: string }> {
    try {
      const client = this.getHttpClient(anchorDomain);
      this.logger.log(
        `Initiating deposit with ${anchorDomain} for asset ${params.asset_code}`,
      );

      const response = await client.post('/transactions/deposit/interactive', {
        asset_code: params.asset_code,
        account: params.account,
        amount: params.amount,
        lang: params.lang || 'en',
        email: params.email,
      }, {
        headers: params.jwt ? { Authorization: `Bearer ${params.jwt}` } : {},
      });

      if (!response.data.url || !response.data.id) {
        throw new HttpException(
          'Invalid response from anchor',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        url: response.data.url,
        id: response.data.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate deposit with ${anchorDomain}: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate deposit with anchor',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async initiateWithdrawal(
    anchorDomain: string,
    params: Sep24WithdrawalParams,
  ): Promise<{ url: string; id: string }> {
    try {
      const client = this.getHttpClient(anchorDomain);
      this.logger.log(
        `Initiating withdrawal with ${anchorDomain} for asset ${params.asset_code}`,
      );

      const response = await client.post(
        '/transactions/withdraw/interactive',
        {
          asset_code: params.asset_code,
          account: params.account,
          amount: params.amount,
          type: params.type,
          dest: params.dest,
          dest_extra: params.dest_extra,
        },
        {
          headers: params.jwt ? { Authorization: `Bearer ${params.jwt}` } : {},
        },
      );

      if (!response.data.url || !response.data.id) {
        throw new HttpException(
          'Invalid response from anchor',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        url: response.data.url,
        id: response.data.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate withdrawal with ${anchorDomain}: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate withdrawal with anchor',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getTransaction(
    anchorDomain: string,
    id?: string,
    stellarTransactionId?: string,
    externalTransactionId?: string,
  ): Promise<Sep24Transaction> {
    try {
      const client = this.getHttpClient(anchorDomain);
      const params: any = {};

      if (id) params.id = id;
      if (stellarTransactionId)
        params.stellar_transaction_id = stellarTransactionId;
      if (externalTransactionId)
        params.external_transaction_id = externalTransactionId;

      if (Object.keys(params).length === 0) {
        throw new HttpException(
          'At least one transaction identifier is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Fetching transaction from ${anchorDomain} with params: ${JSON.stringify(params)}`,
      );

      const response = await client.get('/transaction', { params });

      if (!response.data.transaction) {
        throw new HttpException(
          'Transaction not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return response.data.transaction;
    } catch (error) {
      this.logger.error(
        `Failed to fetch transaction from ${anchorDomain}: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch transaction from anchor',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getTransactions(
    anchorDomain: string,
    assetCode: string,
    account: string,
    limit?: number,
  ): Promise<Sep24Transaction[]> {
    try {
      const client = this.getHttpClient(anchorDomain);

      this.logger.log(
        `Fetching transactions from ${anchorDomain} for account ${account}`,
      );

      const response = await client.get('/transactions', {
        params: {
          asset_code: assetCode,
          account,
          limit: limit || 10,
        },
      });

      return response.data.transactions || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch transactions from ${anchorDomain}: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch transactions from anchor',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async checkKycStatus(
    anchorDomain: string,
    userId: string,
  ): Promise<{ status: string; moreInfoUrl?: string }> {
    try {
      const anchor = this.getAnchor(anchorDomain);
      
      if (!anchor.kycUrl) {
        this.logger.warn(`Anchor ${anchorDomain} does not support KYC`);
        return { status: 'not_required' };
      }

      const client = axios.create({
        baseURL: anchor.kycUrl,
        timeout: 15000,
      });

      const response = await client.get('/status', {
        params: { user_id: userId },
      });

      return {
        status: response.data.status || 'unknown',
        moreInfoUrl: response.data.more_info_url,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check KYC status with ${anchorDomain}: ${error.message}`,
        error.stack,
      );
      return { status: 'unknown' };
    }
  }

  async initiateKyc(
    anchorDomain: string,
    userId: string,
  ): Promise<{ url: string }> {
    try {
      const anchor = this.getAnchor(anchorDomain);

      if (!anchor.kycUrl) {
        throw new HttpException(
          `Anchor ${anchorDomain} does not support KYC`,
          HttpStatus.NOT_IMPLEMENTED,
        );
      }

      const client = axios.create({
        baseURL: anchor.kycUrl,
        timeout: 15000,
      });

      const response = await client.post('/initiate', {
        user_id: userId,
      });

      if (!response.data.url) {
        throw new HttpException(
          'Invalid KYC response from anchor',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return { url: response.data.url };
    } catch (error) {
      this.logger.error(
        `Failed to initiate KYC with ${anchorDomain}: ${error.message}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to initiate KYC with anchor',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  listAvailableAnchors(): AnchorConfig[] {
    return Array.from(this.anchors.values());
  }

  getSupportedAssets(anchorDomain: string): AssetCode[] {
    return [AssetCode.USDC, AssetCode.XLM];
  }
}
