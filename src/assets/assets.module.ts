import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from './entities/asset.entity';
import { AssetPair } from './entities/asset-pair.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, AssetPair]),
    CacheModule.register({
      ttl: 60 * 1000, // 60 seconds default TTL
    }),
  ],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
