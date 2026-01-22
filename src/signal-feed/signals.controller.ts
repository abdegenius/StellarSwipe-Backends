import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SignalsService } from './signals.service';
import { SignalFeedQueryDto } from './dto/signal-feed-query.dto';
import { SignalFeedResponseDto } from './dto/signal-feed-response.dto';

@ApiTags('signals')
@Controller('signals')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Get paginated signal feed',
    description: 'Returns a paginated list of active signals with cursor-based pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved signal feed',
    type: SignalFeedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getFeed(
    @Query(new ValidationPipe({ transform: true }))
    query: SignalFeedQueryDto,
  ): Promise<SignalFeedResponseDto> {
    return this.signalsService.getFeed(query);
  }
}