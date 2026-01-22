import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityScore } from './entities/quality-score.entity';
import { QualityScorerService } from './dto/quality-scorer.service';
import { QualityTrackerService } from './quality-tracker.service';

@Module({
  imports: [TypeOrmModule.forFeature([QualityScore])],
  providers: [QualityScorerService, QualityTrackerService],
  exports: [QualityScorerService, QualityTrackerService],
})
export class QualityModule {}
