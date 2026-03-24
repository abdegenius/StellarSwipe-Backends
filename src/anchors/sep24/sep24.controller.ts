import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Sep24Service } from './sep24.service';
import {
  InitiateDepositDto,
  InitiateWithdrawalDto,
  Sep24ResponseDto,
  TransactionStatusDto,
  GetTransactionDto,
  KycStatusDto,
  InitiateKycDto,
} from './dto/deposit-withdrawal.dto';

@ApiTags('SEP-24 Anchors')
@Controller('anchors/sep24')
export class Sep24Controller {
  constructor(private readonly sep24Service: Sep24Service) {}

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate fiat deposit to crypto',
    description:
      'Start a SEP-24 interactive deposit flow. Returns URL for user to complete deposit with anchor.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deposit flow initiated successfully',
    type: Sep24ResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid deposit parameters',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Anchor not found',
  })
  async initiateDeposit(
    @Body() dto: InitiateDepositDto,
  ): Promise<Sep24ResponseDto> {
    return this.sep24Service.initiateDeposit(dto);
  }

  @Post('withdrawal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate crypto withdrawal to fiat',
    description:
      'Start a SEP-24 interactive withdrawal flow. Returns URL for user to complete withdrawal with anchor.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdrawal flow initiated successfully',
    type: Sep24ResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid withdrawal parameters',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Anchor not found',
  })
  async initiateWithdrawal(
    @Body() dto: InitiateWithdrawalDto,
  ): Promise<Sep24ResponseDto> {
    return this.sep24Service.initiateWithdrawal(dto);
  }

  @Get('transaction')
  @ApiOperation({
    summary: 'Get transaction status',
    description: 'Retrieve the current status of a SEP-24 transaction',
  })
  @ApiQuery({ name: 'id', required: false, description: 'Transaction ID' })
  @ApiQuery({
    name: 'stellarTransactionId',
    required: false,
    description: 'Stellar transaction hash',
  })
  @ApiQuery({
    name: 'externalTransactionId',
    required: false,
    description: 'External transaction ID',
  })
  @ApiQuery({
    name: 'anchorDomain',
    required: false,
    description: 'Anchor domain (defaults to configured anchor)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction status retrieved',
    type: TransactionStatusDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Transaction not found',
  })
  async getTransactionStatus(
    @Query('id') id?: string,
    @Query('stellarTransactionId') stellarTransactionId?: string,
    @Query('externalTransactionId') externalTransactionId?: string,
    @Query('anchorDomain') anchorDomain?: string,
  ): Promise<TransactionStatusDto> {
    const dto: GetTransactionDto = {
      id: id || '',
      stellarTransactionId,
      externalTransactionId,
    };

    return this.sep24Service.getTransactionStatus(dto, anchorDomain);
  }

  @Get('transactions/user/:userId')
  @ApiOperation({
    summary: 'Get user transactions',
    description: 'Retrieve all SEP-24 transactions for a specific user',
  })
  @ApiQuery({
    name: 'assetCode',
    required: true,
    description: 'Asset code (USDC or XLM)',
  })
  @ApiQuery({
    name: 'anchorDomain',
    required: false,
    description: 'Anchor domain (defaults to configured anchor)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of transactions to return',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User transactions retrieved',
    type: [TransactionStatusDto],
  })
  async getUserTransactions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('assetCode') assetCode: string,
    @Query('anchorDomain') anchorDomain?: string,
    @Query('limit') limit?: number,
  ): Promise<TransactionStatusDto[]> {
    return this.sep24Service.getUserTransactions(
      userId,
      assetCode,
      anchorDomain,
      limit,
    );
  }

  @Get('kyc/status/:userId')
  @ApiOperation({
    summary: 'Check KYC status',
    description: 'Check the KYC verification status for a user with an anchor',
  })
  @ApiQuery({
    name: 'anchorDomain',
    required: false,
    description: 'Anchor domain (defaults to configured anchor)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC status retrieved',
    type: KycStatusDto,
  })
  async checkKycStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('anchorDomain') anchorDomain?: string,
  ): Promise<KycStatusDto> {
    return this.sep24Service.checkKycStatus(userId, anchorDomain);
  }

  @Post('kyc/initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate KYC process',
    description:
      'Start the KYC verification process with an anchor. Returns URL for user to complete KYC.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC process initiated',
  })
  @ApiResponse({
    status: HttpStatus.NOT_IMPLEMENTED,
    description: 'Anchor does not support KYC',
  })
  async initiateKyc(@Body() dto: InitiateKycDto): Promise<{ url: string }> {
    return this.sep24Service.initiateKyc(dto);
  }

  @Get('anchors')
  @ApiOperation({
    summary: 'List available anchors',
    description:
      'Get a list of all configured anchor services and their capabilities',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available anchors list',
  })
  async getAvailableAnchors() {
    return this.sep24Service.getAvailableAnchors();
  }
}
