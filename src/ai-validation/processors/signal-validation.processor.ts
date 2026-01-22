import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Signal, SignalOutcome } from "../../signals/entities/signal.entity";
import { AiValidationService } from "../ai-validation.service";

@Processor("signal-validation")
export class SignalValidationProcessor {
  private readonly logger = new Logger(SignalValidationProcessor.name);

  constructor(
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>,
    private readonly aiValidationService: AiValidationService,
  ) {}

  @Process("validate")
  async handleValidation(job: Job<{ signalId: string }>) {
    const { signalId } = job.data;
    this.logger.log(`Processing validation for signal ${signalId}`);

    const signal = await this.signalRepository.findOneBy({ id: signalId });
    if (!signal) {
      this.logger.error(`Signal ${signalId} not found`);
      return;
    }

    try {
      const assetPair = `${signal.baseAsset}/${signal.counterAsset}`;
      const result = await this.aiValidationService.validateSignal(
        assetPair,
        signal.type,
        signal.rationale || "No rationale provided",
      );

      signal.confidenceScore = result.score;

      // Logic: Mark as pending with low outcome if score < 30
      if (result.score < 30 || result.isSpam) {
        signal.outcome = SignalOutcome.PENDING;
        signal.confidenceScore = Math.max(0, result.score);
        this.logger.warn(`Signal ${signalId} marked PENDING with low confidence ${result.score}`);
      } else {
        signal.outcome = SignalOutcome.PENDING;
        signal.confidenceScore = result.score;
        this.logger.log(`Signal ${signalId} validated with confidence ${result.score}`);
      }

      await this.signalRepository.save(signal);
    } catch (error: any) {
      this.logger.error(`Failed to process job ${job.id}: ${error.message}`);
      // If validation fails completely, keep as pending for manual review
      signal.outcome = SignalOutcome.PENDING;
      signal.confidenceScore = 0;
      await this.signalRepository.save(signal);
      throw error; // Rethrow to allow Bull to retry based on configuration
    }
  }
}

