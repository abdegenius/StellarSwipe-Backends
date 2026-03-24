import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Sep24Controller } from './sep24.controller';
import { Sep24Service } from './sep24.service';
import { AnchorIntegrationsProvider } from './providers/anchor-integrations';

@Module({
  imports: [ConfigModule],
  controllers: [Sep24Controller],
  providers: [Sep24Service, AnchorIntegrationsProvider],
  exports: [Sep24Service, AnchorIntegrationsProvider],
})
export class Sep24Module {}
