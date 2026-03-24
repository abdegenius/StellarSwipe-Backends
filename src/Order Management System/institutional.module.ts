import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderManagementService } from './oms/order-management.service';
import { OrderManagementController } from './oms/order-management.controller';
import { OrderBasket } from './oms/entities/order-basket.entity';
import { AlgoOrder } from './oms/entities/algo-order.entity';
import { ExecutionReport } from './oms/entities/execution-report.entity';
import { TradeAllocation } from './oms/entities/trade-allocation.entity';
import { BasketBuilder } from './oms/utils/basket-builder';
import { AllocationEngine } from './oms/utils/allocation-engine';
import { VwapAlgorithm } from './oms/algorithms/vwap.algorithm';
import { TwapAlgorithm } from './oms/algorithms/twap.algorithm';
import { ImplementationShortfallAlgorithm } from './oms/algorithms/implementation-shortfall.algorithm';
import { ParticipationAlgorithm } from './oms/algorithms/participation.algorithm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderBasket,
      AlgoOrder,
      ExecutionReport,
      TradeAllocation,
    ]),
  ],
  controllers: [OrderManagementController],
  providers: [
    OrderManagementService,
    BasketBuilder,
    AllocationEngine,
    VwapAlgorithm,
    TwapAlgorithm,
    ImplementationShortfallAlgorithm,
    ParticipationAlgorithm,
  ],
  exports: [OrderManagementService],
})
export class InstitutionalModule {}
