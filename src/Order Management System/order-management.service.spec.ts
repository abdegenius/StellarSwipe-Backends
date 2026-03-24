import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { OrderManagementService } from './order-management.service';
import { OrderBasket, BasketStatus, BasketType } from './entities/order-basket.entity';
import { AlgoOrder, AlgoOrderStatus, OrderSide, OrderType } from './entities/algo-order.entity';
import { ExecutionReport, ExecType } from './entities/execution-report.entity';
import { TradeAllocation, AllocationStatus } from './entities/trade-allocation.entity';
import { BasketBuilder } from './utils/basket-builder';
import { AllocationEngine } from './utils/allocation-engine';
import { VwapAlgorithm } from './algorithms/vwap.algorithm';
import { TwapAlgorithm } from './algorithms/twap.algorithm';
import { ImplementationShortfallAlgorithm } from './algorithms/implementation-shortfall.algorithm';
import { ParticipationAlgorithm } from './algorithms/participation.algorithm';
import { AlgoType, AllocationMethod } from './interfaces/oms-config.interface';
import { CreateBasketDto } from './dto/create-basket.dto';
import { ExecutionReportDto } from './dto/execution-report.dto';
import { AllocateTradeDto } from './dto/allocation.dto';
import { MarketData } from './interfaces/execution-algo.interface';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const mockMarketData: MarketData = {
  symbol: 'AAPL',
  price: 185.5,
  bid: 185.49,
  ask: 185.51,
  volume: 5_000_000,
  vwap: 185.3,
  timestamp: new Date('2024-01-15T14:00:00Z'),
  historicalVolume: Array.from({ length: 78 }, (_, i) => 50_000 + Math.random() * 10_000),
};

const mockBasketDto: CreateBasketDto = {
  type: BasketType.STRATEGY,
  portfolioId: 'PORT-001',
  managerId: 'MGR-001',
  legs: [
    { symbol: 'AAPL', side: OrderSide.BUY, algoType: AlgoType.VWAP, quantity: 10_000 },
    { symbol: 'MSFT', side: OrderSide.BUY, algoType: AlgoType.TWAP, quantity: 5_000 },
    { symbol: 'TSLA', side: OrderSide.SELL, algoType: AlgoType.IMPLEMENTATION_SHORTFALL, quantity: 3_000 },
  ],
};

const makeBasket = (overrides: Partial<OrderBasket> = {}): OrderBasket =>
  Object.assign(new OrderBasket(), {
    id: 'basket-uuid-1',
    basketRef: 'BKT-1705000000-ABCDEF',
    type: BasketType.STRATEGY,
    status: BasketStatus.DRAFT,
    portfolioId: 'PORT-001',
    managerId: 'MGR-001',
    totalLegs: 3,
    filledLegs: 0,
    totalNotional: 0,
    filledNotional: 0,
    orders: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeOrder = (overrides: Partial<AlgoOrder> = {}): AlgoOrder =>
  Object.assign(new AlgoOrder(), {
    id: 'order-uuid-1',
    clientOrderId: 'ORD-ABC123',
    symbol: 'AAPL',
    side: OrderSide.BUY,
    orderType: OrderType.MARKET,
    algoType: AlgoType.VWAP,
    status: AlgoOrderStatus.NEW,
    quantity: 10_000,
    filledQuantity: 0,
    avgFillPrice: null,
    algoParams: { maxParticipation: 15 },
    startTime: new Date('2024-01-15T09:30:00Z'),
    endTime: new Date('2024-01-15T16:00:00Z'),
    executionReports: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeExecReport = (overrides: Partial<ExecutionReport> = {}): ExecutionReport =>
  Object.assign(new ExecutionReport(), {
    id: 'report-uuid-1',
    execId: 'EXEC-001',
    orderId: 'order-uuid-1',
    execType: ExecType.PARTIAL_FILL,
    lastQty: 2_000,
    lastPrice: 185.5,
    cumQty: 2_000,
    avgPrice: 185.5,
    leavesQty: 8_000,
    venue: 'NYSE',
    commission: 10.0,
    transactTime: new Date(),
    ...overrides,
  });

// ─── Mock Factory ─────────────────────────────────────────────────────────────

function mockRepo<T>(): jest.Mocked<Repository<T>> {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OrderManagementService', () => {
  let service: OrderManagementService;
  let basketRepo: jest.Mocked<Repository<OrderBasket>>;
  let orderRepo: jest.Mocked<Repository<AlgoOrder>>;
  let execReportRepo: jest.Mocked<Repository<ExecutionReport>>;
  let allocationRepo: jest.Mocked<Repository<TradeAllocation>>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    basketRepo = mockRepo<OrderBasket>();
    orderRepo = mockRepo<AlgoOrder>();
    execReportRepo = mockRepo<ExecutionReport>();
    allocationRepo = mockRepo<TradeAllocation>();

    dataSource = {
      transaction: jest.fn((cb) =>
        cb({
          save: jest.fn().mockImplementation((Entity, data) => ({ ...data, id: 'tx-uuid' })),
          update: jest.fn(),
          find: jest.fn().mockResolvedValue([]),
          findOne: jest.fn(),
          findOneOrFail: jest.fn(),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderManagementService,
        BasketBuilder,
        AllocationEngine,
        VwapAlgorithm,
        TwapAlgorithm,
        ImplementationShortfallAlgorithm,
        ParticipationAlgorithm,
        { provide: getRepositoryToken(OrderBasket), useValue: basketRepo },
        { provide: getRepositoryToken(AlgoOrder), useValue: orderRepo },
        { provide: getRepositoryToken(ExecutionReport), useValue: execReportRepo },
        { provide: getRepositoryToken(TradeAllocation), useValue: allocationRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<OrderManagementService>(OrderManagementService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createBasket ───────────────────────────────────────────────────────────

  describe('createBasket', () => {
    it('creates a basket with the correct number of legs', async () => {
      const savedBasket = makeBasket();
      const txManager = {
        save: jest.fn()
          .mockResolvedValueOnce(savedBasket)
          .mockResolvedValueOnce(mockBasketDto.legs.map((l, i) => makeOrder({ id: `order-${i}`, symbol: l.symbol }))),
        update: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        findOneOrFail: jest.fn().mockResolvedValue({ ...savedBasket, orders: [] }),
      };
      dataSource.transaction.mockImplementation((cb) => cb(txManager));

      const result = await service.createBasket(mockBasketDto);

      expect(txManager.save).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(savedBasket.id);
    });

    it('rejects a basket with duplicate symbols', async () => {
      const dto: CreateBasketDto = {
        ...mockBasketDto,
        legs: [
          { symbol: 'AAPL', side: OrderSide.BUY, algoType: AlgoType.VWAP, quantity: 1000 },
          { symbol: 'AAPL', side: OrderSide.SELL, algoType: AlgoType.TWAP, quantity: 500 },
        ],
      };

      await expect(service.createBasket(dto)).rejects.toThrow(BadRequestException);
    });

    it('rejects a basket with no legs', async () => {
      const dto: CreateBasketDto = { ...mockBasketDto, legs: [] };
      await expect(service.createBasket(dto)).rejects.toThrow(BadRequestException);
    });

    it('rejects a basket exceeding 500 legs', async () => {
      const dto: CreateBasketDto = {
        ...mockBasketDto,
        legs: Array.from({ length: 501 }, (_, i) => ({
          symbol: `SYM${i}`,
          side: OrderSide.BUY,
          algoType: AlgoType.VWAP,
          quantity: 100,
        })),
      };
      await expect(service.createBasket(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── submitBasket ───────────────────────────────────────────────────────────

  describe('submitBasket', () => {
    it('transitions basket from DRAFT to PENDING', async () => {
      const basket = makeBasket({ status: BasketStatus.DRAFT });
      basketRepo.findOne
        .mockResolvedValueOnce(basket)
        .mockResolvedValueOnce({ ...basket, status: BasketStatus.PENDING });
      basketRepo.update.mockResolvedValue(undefined);
      orderRepo.update.mockResolvedValue(undefined);

      const result = await service.submitBasket(basket.id);

      expect(basketRepo.update).toHaveBeenCalledWith(basket.id, { status: BasketStatus.PENDING });
      expect(orderRepo.update).toHaveBeenCalledWith(
        { basketId: basket.id },
        { status: AlgoOrderStatus.PENDING_NEW },
      );
    });

    it('throws NotFoundException for unknown basket', async () => {
      basketRepo.findOne.mockResolvedValue(null);
      await expect(service.submitBasket('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when basket is not in DRAFT', async () => {
      basketRepo.findOne.mockResolvedValue(makeBasket({ status: BasketStatus.ACTIVE }));
      await expect(service.submitBasket('basket-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelBasket ───────────────────────────────────────────────────────────

  describe('cancelBasket', () => {
    it('cancels an active basket and its pending orders', async () => {
      const basket = makeBasket({ status: BasketStatus.ACTIVE });
      basketRepo.findOneOrFail = jest.fn().mockResolvedValue(basket);
      basketRepo.findOne.mockResolvedValue({ ...basket, status: BasketStatus.CANCELLED });
      const txManager = { update: jest.fn() };
      dataSource.transaction.mockImplementation((cb) => cb(txManager));

      await service.cancelBasket(basket.id);

      expect(txManager.update).toHaveBeenCalledWith(OrderBasket, basket.id, {
        status: BasketStatus.CANCELLED,
      });
    });

    it('throws when basket is already FILLED', async () => {
      basketRepo.findOneOrFail = jest.fn().mockResolvedValue(makeBasket({ status: BasketStatus.FILLED }));
      await expect(service.cancelBasket('basket-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('throws when basket is already CANCELLED', async () => {
      basketRepo.findOneOrFail = jest.fn().mockResolvedValue(makeBasket({ status: BasketStatus.CANCELLED }));
      await expect(service.cancelBasket('basket-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── createAlgoOrder ────────────────────────────────────────────────────────

  describe('createAlgoOrder', () => {
    it('creates a standalone algo order with generated clientOrderId', async () => {
      const order = makeOrder();
      orderRepo.create.mockReturnValue(order);
      orderRepo.save.mockResolvedValue(order);

      const result = await service.createAlgoOrder({
        symbol: 'AAPL',
        side: OrderSide.BUY,
        algoType: AlgoType.VWAP,
        quantity: 10_000,
      });

      expect(orderRepo.create).toHaveBeenCalled();
      expect(result.symbol).toBe('AAPL');
    });
  });

  // ─── getAlgoOrderSlices ─────────────────────────────────────────────────────

  describe('getAlgoOrderSlices', () => {
    it('returns a VWAP schedule with correct slice count', async () => {
      const order = makeOrder({ algoType: AlgoType.VWAP });
      orderRepo.findOneOrFail = jest.fn().mockResolvedValue(order);

      const slices = await service.getAlgoOrderSlices(order.id, mockMarketData);

      expect(slices.length).toBeGreaterThan(0);
      expect(slices.every((s) => s.quantity > 0)).toBe(true);
      expect(slices.every((s) => s.targetTime instanceof Date)).toBe(true);
    });

    it('returns a TWAP schedule with default 12 slices', async () => {
      const order = makeOrder({ algoType: AlgoType.TWAP, algoParams: { slices: 12 } });
      orderRepo.findOneOrFail = jest.fn().mockResolvedValue(order);

      const slices = await service.getAlgoOrderSlices(order.id, mockMarketData);

      expect(slices).toHaveLength(12);
    });

    it('returns IS schedule front-loaded for high urgency', async () => {
      const order = makeOrder({
        algoType: AlgoType.IMPLEMENTATION_SHORTFALL,
        algoParams: { urgency: 0.9 },
      });
      orderRepo.findOneOrFail = jest.fn().mockResolvedValue(order);

      const slices = await service.getAlgoOrderSlices(order.id, mockMarketData);

      // High urgency: first slice should be larger than last
      expect(slices[0].quantity).toBeGreaterThan(slices[slices.length - 1].quantity);
    });

    it('returns a single POV slice based on current market volume', async () => {
      const order = makeOrder({
        algoType: AlgoType.PARTICIPATION,
        algoParams: { targetRate: 10 },
      });
      orderRepo.findOneOrFail = jest.fn().mockResolvedValue(order);

      const slices = await service.getAlgoOrderSlices(order.id, mockMarketData);

      expect(slices).toHaveLength(1);
      // 10% of 5_000_000 = 500_000, capped at order qty 10_000
      expect(slices[0].quantity).toBe(10_000);
    });

    it('throws BadRequestException for unknown algo type', async () => {
      const order = makeOrder({ algoType: 'UNKNOWN' as AlgoType });
      orderRepo.findOneOrFail = jest.fn().mockResolvedValue(order);

      await expect(service.getAlgoOrderSlices(order.id, mockMarketData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── processExecutionReport ─────────────────────────────────────────────────

  describe('processExecutionReport', () => {
    const reportDto: ExecutionReportDto = {
      execId: 'EXEC-001',
      orderId: 'order-uuid-1',
      execType: ExecType.PARTIAL_FILL,
      lastQty: 2_000,
      lastPrice: 185.5,
      cumQty: 2_000,
      avgPrice: 185.5,
      leavesQty: 8_000,
      venue: 'NYSE',
      commission: 10,
    };

    it('saves the execution report and updates order to PARTIALLY_FILLED', async () => {
      const order = makeOrder({ basketId: null });
      orderRepo.findOne.mockResolvedValue(order);
      const savedReport = makeExecReport();
      const txManager = {
        save: jest.fn().mockResolvedValue(savedReport),
        update: jest.fn(),
        find: jest.fn().mockResolvedValue([order]),
      };
      dataSource.transaction.mockImplementation((cb) => cb(txManager));

      const result = await service.processExecutionReport(reportDto);

      expect(txManager.save).toHaveBeenCalled();
      expect(txManager.update).toHaveBeenCalledWith(
        AlgoOrder,
        order.id,
        expect.objectContaining({ status: AlgoOrderStatus.PARTIALLY_FILLED }),
      );
    });

    it('marks order as FILLED when cumQty equals quantity', async () => {
      const order = makeOrder({ quantity: 2_000, basketId: null });
      orderRepo.findOne.mockResolvedValue(order);
      const txManager = {
        save: jest.fn().mockResolvedValue(makeExecReport({ execType: ExecType.FILL })),
        update: jest.fn(),
        find: jest.fn().mockResolvedValue([order]),
      };
      dataSource.transaction.mockImplementation((cb) => cb(txManager));

      await service.processExecutionReport({
        ...reportDto,
        execType: ExecType.FILL,
        cumQty: 2_000,
        leavesQty: 0,
      });

      expect(txManager.update).toHaveBeenCalledWith(
        AlgoOrder,
        order.id,
        expect.objectContaining({ status: AlgoOrderStatus.FILLED }),
      );
    });

    it('marks order as REJECTED on reject exec type', async () => {
      const order = makeOrder({ basketId: null });
      orderRepo.findOne.mockResolvedValue(order);
      const txManager = {
        save: jest.fn().mockResolvedValue(makeExecReport()),
        update: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      };
      dataSource.transaction.mockImplementation((cb) => cb(txManager));

      await service.processExecutionReport({ ...reportDto, execType: ExecType.REJECTED });

      expect(txManager.update).toHaveBeenCalledWith(
        AlgoOrder,
        order.id,
        expect.objectContaining({ status: AlgoOrderStatus.REJECTED }),
      );
    });

    it('throws NotFoundException for unknown order', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.processExecutionReport(reportDto)).rejects.toThrow(NotFoundException);
    });

    it('rolls up basket fill status when basketId is set', async () => {
      const order = makeOrder({ basketId: 'basket-uuid-1' });
      orderRepo.findOne.mockResolvedValue(order);
      const filledOrders = [
        makeOrder({ status: AlgoOrderStatus.FILLED }),
        makeOrder({ status: AlgoOrderStatus.FILLED }),
        makeOrder({ status: AlgoOrderStatus.NEW }),
      ];
      const txManager = {
        save: jest.fn().mockResolvedValue(makeExecReport()),
        update: jest.fn(),
        find: jest.fn().mockResolvedValue(filledOrders),
      };
      dataSource.transaction.mockImplementation((cb) => cb(txManager));

      await service.processExecutionReport(reportDto);

      // Should update basket with PARTIALLY_FILLED
      expect(txManager.update).toHaveBeenCalledWith(
        OrderBasket,
        order.basketId,
        expect.objectContaining({ status: BasketStatus.PARTIALLY_FILLED, filledLegs: 2 }),
      );
    });
  });

  // ─── allocateTrade ──────────────────────────────────────────────────────────

  describe('allocateTrade', () => {
    const allocateDto: AllocateTradeDto = {
      orderId: 'order-uuid-1',
      basketId: 'basket-uuid-1',
      allocationMethod: AllocationMethod.PRO_RATA,
      accounts: [
        { accountId: 'ACC-001', portfolioId: 'PORT-001', weight: 60 },
        { accountId: 'ACC-002', portfolioId: 'PORT-002', weight: 40 },
      ],
    };

    it('creates allocations proportional to account weights', async () => {
      const report = makeExecReport({ lastQty: 1000, lastPrice: 185.5 });
      execReportRepo.findOne.mockResolvedValue(report);
      allocationRepo.save.mockImplementation((allocations) => Promise.resolve(allocations as any));

      const result = await service.allocateTrade(allocateDto);

      expect(result).toHaveLength(2);
      const total = result.reduce((sum, a) => sum + (a as any).allocatedQty, 0);
      expect(total).toBeLessThanOrEqual(1001); // within rounding tolerance
    });

    it('throws BadRequestException when quantities do not reconcile', async () => {
      const report = makeExecReport({ lastQty: 1000 });
      execReportRepo.findOne.mockResolvedValue(report);

      const badDto: AllocateTradeDto = {
        ...allocateDto,
        accounts: [
          { accountId: 'ACC-001', portfolioId: 'PORT-001', weight: 0 },
          { accountId: 'ACC-002', portfolioId: 'PORT-002', weight: 0 },
        ],
      };

      // zero weights → all allocatedQty = 0, won't match lastQty = 1000
      allocationRepo.save.mockImplementation((a) => Promise.resolve(a as any));
      await expect(service.allocateTrade(badDto)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when no execution report exists', async () => {
      execReportRepo.findOne.mockResolvedValue(null);
      await expect(service.allocateTrade(allocateDto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Algorithm Unit Tests ───────────────────────────────────────────────────

  describe('VwapAlgorithm (unit)', () => {
    let vwap: VwapAlgorithm;
    beforeEach(() => (vwap = new VwapAlgorithm()));

    it('generates schedule where total qty equals order qty', () => {
      const order = makeOrder({ quantity: 10_000, filledQuantity: 0 });
      const schedule = vwap.calculateSchedule(order, mockMarketData);
      const totalQty = schedule.reduce((s, sl) => s + sl.quantity, 0);
      expect(Math.abs(totalQty - 10_000)).toBeLessThanOrEqual(5); // rounding tolerance
    });

    it('respects already-filled quantity in schedule', () => {
      const order = makeOrder({ quantity: 10_000, filledQuantity: 3_000 });
      const schedule = vwap.calculateSchedule(order, mockMarketData);
      const totalQty = schedule.reduce((s, sl) => s + sl.quantity, 0);
      expect(Math.abs(totalQty - 7_000)).toBeLessThanOrEqual(5);
    });
  });

  describe('TwapAlgorithm (unit)', () => {
    let twap: TwapAlgorithm;
    beforeEach(() => (twap = new TwapAlgorithm()));

    it('returns exactly the requested number of slices', () => {
      const order = makeOrder({ algoType: AlgoType.TWAP, algoParams: { slices: 8 } });
      const schedule = twap.calculateSchedule(order, mockMarketData);
      expect(schedule).toHaveLength(8);
    });

    it('last slice absorbs rounding remainder', () => {
      const order = makeOrder({ quantity: 1001, filledQuantity: 0, algoParams: { slices: 10 } });
      const schedule = twap.calculateSchedule(order, mockMarketData);
      const total = schedule.reduce((s, sl) => s + sl.quantity, 0);
      expect(total).toBe(1001);
    });

    it('slice times are strictly increasing', () => {
      const order = makeOrder({ algoParams: { slices: 6 } });
      const schedule = twap.calculateSchedule(order, mockMarketData);
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].targetTime.getTime()).toBeGreaterThan(
          schedule[i - 1].targetTime.getTime(),
        );
      }
    });
  });

  describe('AllocationEngine (unit)', () => {
    let engine: AllocationEngine;
    beforeEach(() => (engine = new AllocationEngine()));

    it('allocates proportionally and sums to filled qty within tolerance', () => {
      const report = makeExecReport({ lastQty: 1000, lastPrice: 100 });
      const dto: AllocateTradeDto = {
        orderId: 'order-uuid-1',
        basketId: 'basket-uuid-1',
        allocationMethod: AllocationMethod.PRO_RATA,
        accounts: [
          { accountId: 'A1', portfolioId: 'P1', weight: 50 },
          { accountId: 'A2', portfolioId: 'P2', weight: 30 },
          { accountId: 'A3', portfolioId: 'P3', weight: 20 },
        ],
      };

      const allocations = engine.allocate(dto, report, AllocationMethod.PRO_RATA);
      const total = allocations.reduce((s, a) => s + a.allocatedQty, 0);

      expect(allocations).toHaveLength(3);
      expect(engine.validateAllocations(allocations, 1000)).toBe(true);
      expect(total).toBe(1000);
    });

    it('normalizes weights that do not sum to 100', () => {
      const report = makeExecReport({ lastQty: 500, lastPrice: 50 });
      const dto: AllocateTradeDto = {
        orderId: 'o1',
        basketId: 'b1',
        allocationMethod: AllocationMethod.PRO_RATA,
        accounts: [
          { accountId: 'A1', portfolioId: 'P1', weight: 1 },
          { accountId: 'A2', portfolioId: 'P2', weight: 1 },
        ],
      };

      const allocations = engine.allocate(dto, report, AllocationMethod.PRO_RATA);
      expect(allocations[0].allocatedQty).toBe(250);
      expect(allocations[1].allocatedQty).toBe(250);
    });
  });
});
