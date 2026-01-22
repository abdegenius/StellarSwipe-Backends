import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { SignalsService } from './signals.service';
import { Signal } from './entities/signal.entity';

@Controller('signals')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSignal(@Body() body: any): Promise<Signal> {
    return this.signalsService.create(body);
  }

  @Get()
  async findAll(): Promise<Signal[]> {
    return this.signalsService.findAll();
  }

  @Get(':id')
  async getSignal(@Param('id', ParseUUIDPipe) id: string): Promise<Signal> {
    const signal = await this.signalsService.findOne(id);
    if (!signal) {
      throw new NotFoundException(`Signal with ID ${id} not found`);
    }
    return signal;
  }
}
