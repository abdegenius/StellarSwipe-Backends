import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlgoOrdersTable1705000000221 implements MigrationInterface {
  name = 'CreateAlgoOrdersTable1705000000221';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE algo_order_status_enum AS ENUM (
        'NEW',
        'PENDING_NEW',
        'PARTIALLY_FILLED',
        'FILLED',
        'PENDING_CANCEL',
        'CANCELLED',
        'REJECTED',
        'EXPIRED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE order_side_enum AS ENUM (
        'BUY',
        'SELL',
        'SELL_SHORT'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE order_type_enum AS ENUM (
        'MARKET',
        'LIMIT',
        'STOP',
        'STOP_LIMIT'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE algo_type_enum AS ENUM (
        'VWAP',
        'TWAP',
        'IS',
        'POV'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE algo_orders (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_order_id   VARCHAR(64) UNIQUE NOT NULL,
        broker_order_id   VARCHAR(64),
        basket_id         UUID REFERENCES order_baskets(id) ON DELETE SET NULL,
        symbol            VARCHAR(32) NOT NULL,
        side              order_side_enum NOT NULL,
        order_type        order_type_enum NOT NULL DEFAULT 'MARKET',
        algo_type         algo_type_enum NOT NULL,
        status            algo_order_status_enum NOT NULL DEFAULT 'NEW',
        quantity          DECIMAL(18, 4) NOT NULL CHECK (quantity > 0),
        filled_quantity   DECIMAL(18, 4) NOT NULL DEFAULT 0,
        limit_price       DECIMAL(18, 8),
        stop_price        DECIMAL(18, 8),
        avg_fill_price    DECIMAL(18, 8),
        algo_params       JSONB,
        start_time        TIMESTAMPTZ,
        end_time          TIMESTAMPTZ,
        venue             VARCHAR(32),
        participation_rate DECIMAL(5, 2) CHECK (participation_rate BETWEEN 0 AND 100),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE algo_orders
        ADD CONSTRAINT chk_filled_lte_quantity
          CHECK (filled_quantity <= quantity)
    `);

    await queryRunner.query(`
      ALTER TABLE algo_orders
        ADD CONSTRAINT chk_end_after_start
          CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_algo_orders_basket ON algo_orders (basket_id)
        WHERE basket_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_algo_orders_symbol ON algo_orders (symbol)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_algo_orders_status ON algo_orders (status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_algo_orders_algo_type ON algo_orders (algo_type)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_algo_orders_created_at ON algo_orders (created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE execution_reports (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exec_id     VARCHAR(64) UNIQUE NOT NULL,
        order_id    UUID NOT NULL REFERENCES algo_orders(id) ON DELETE CASCADE,
        exec_type   VARCHAR(2) NOT NULL,
        last_qty    DECIMAL(18, 4) NOT NULL,
        last_price  DECIMAL(18, 8) NOT NULL,
        cum_qty     DECIMAL(18, 4) NOT NULL,
        avg_price   DECIMAL(18, 8) NOT NULL,
        leaves_qty  DECIMAL(18, 4) NOT NULL,
        venue       VARCHAR(32) NOT NULL,
        commission  DECIMAL(10, 4) NOT NULL DEFAULT 0,
        reject_reason TEXT,
        raw_report  JSONB,
        transact_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_exec_reports_order ON execution_reports (order_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_exec_reports_transact_time ON execution_reports (transact_time DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE trade_allocations (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id            UUID NOT NULL,
        basket_id           UUID NOT NULL,
        account_id          VARCHAR(64) NOT NULL,
        portfolio_id        VARCHAR(64) NOT NULL,
        allocated_qty       DECIMAL(18, 4) NOT NULL,
        allocated_price     DECIMAL(18, 8) NOT NULL,
        allocated_notional  DECIMAL(18, 4) NOT NULL,
        allocation_pct      DECIMAL(5, 4) NOT NULL CHECK (allocation_pct BETWEEN 0 AND 1),
        status              VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        commission          DECIMAL(10, 4) NOT NULL DEFAULT 0,
        custodian           VARCHAR(64),
        settlement_date     DATE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_allocations_order ON trade_allocations (order_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_allocations_account ON trade_allocations (account_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_allocations_basket ON trade_allocations (basket_id)
    `);

    // Reuse the trigger function created in previous migration
    await queryRunner.query(`
      CREATE TRIGGER trg_algo_orders_updated_at
      BEFORE UPDATE ON algo_orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_trade_allocations_updated_at
      BEFORE UPDATE ON trade_allocations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_trade_allocations_updated_at ON trade_allocations`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_algo_orders_updated_at ON algo_orders`);
    await queryRunner.query(`DROP TABLE IF EXISTS trade_allocations`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_exec_reports_transact_time`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_exec_reports_order`);
    await queryRunner.query(`DROP TABLE IF EXISTS execution_reports`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_algo_orders_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_algo_orders_algo_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_algo_orders_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_algo_orders_symbol`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_algo_orders_basket`);
    await queryRunner.query(`DROP TABLE IF EXISTS algo_orders`);
    await queryRunner.query(`DROP TYPE IF EXISTS algo_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_side_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS algo_order_status_enum`);
  }
}
