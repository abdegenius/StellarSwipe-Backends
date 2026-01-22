import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto, AssetPriceDto, AssetDto, AssetPairDto } from './dto/asset-price.dto';
import { Asset } from './entities/asset.entity';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  /**
   * Get all supported assets
   * GET /assets
   */
  @Get()
  async getAllAssets(): Promise<AssetDto[]> {
    return this.assetsService.getAllAssets();
  }

  /**
   * Get all tradable asset pairs
   * GET /assets/pairs
   */
  @Get('pairs')
  async getAssetPairs(): Promise<AssetPairDto[]> {
    return this.assetsService.getAssetPairs();
  }

  /**
   * Get current price for a specific asset pair
   * GET /assets/price/:pair
   * Example: GET /assets/price/XLM/USDC
   */
  @Get('price/:pair')
  async getAssetPrice(@Param('pair') pair: string): Promise<AssetPriceDto | { error: string }> {
    if (!pair || !pair.includes('/')) {
      throw new BadRequestException('Invalid pair format. Use BASE/COUNTER format.');
    }

    const price = await this.assetsService.getAssetPrice(pair);

    if (!price) {
      return { error: `Unable to fetch price for pair ${pair}` };
    }

    return price;
  }

  /**
   * Validate if an asset pair is tradable
   * GET /assets/validate/:baseCode/:counterCode
   */
  @Get('validate/:baseCode/:counterCode')
  async validateAssetPair(
    @Param('baseCode') baseCode: string,
    @Param('counterCode') counterCode: string,
  ): Promise<{ isValid: boolean; pair: string }> {
    const isValid = await this.assetsService.validateAssetPair(baseCode, counterCode);

    return {
      isValid,
      pair: `${baseCode}/${counterCode}`,
    };
  }

  /**
   * Get a specific asset by code
   * GET /assets/:code
   */
  @Get(':code')
  async getAssetByCode(@Param('code') code: string): Promise<AssetDto> {
    const asset = await this.assetsService.getAssetByCode(code);
    return {
      id: asset.id,
      code: asset.code,
      issuer: asset.issuer,
      name: asset.name,
      description: asset.description,
      logoUrl: asset.logoUrl,
      isVerified: asset.isVerified,
      isPopular: asset.isPopular,
      type: asset.type,
      createdAt: asset.createdAt,
    };
  }

  /**
   * Create a new asset
   * POST /assets
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAsset(@Body() createAssetDto: CreateAssetDto): Promise<Asset> {
    return this.assetsService.createAsset(createAssetDto);
  }
}
