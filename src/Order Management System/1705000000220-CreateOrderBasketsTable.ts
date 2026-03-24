import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderBasketsTable1705000000220 implements MigrationInterface {
  name = 'CreateOrderBasketsTable1705000000220';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE basket_status_enum AS ENUM (
        'DRAFT',
        'PENDING',
        'ACTIVE',
        'PARTIALLY_FILLED',
        'FILLED',
        'CANCELLED',
        'REJECTED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE basket_type_enum AS ENUM (
        'REBALANCE',
        'STRATEGY',
        'HEDGE',
        'CUSTOM'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE order_baskets (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        basket_ref      VARCHAR(64) UNIQUE NOT NULL,
        type            basket_type_enum NOT NULL DEFAULT 'CUSTOM',
        status          basket_status_enum NOT NULL DEFAULT 'DRAFT',
        portfolio_id    VARCHAR(64) NOT NULL,
        manager_id      VARCHAR(64) NOT NULL,
        total_legs      INTEGER NOT NULL DEFAULT 0,
        filled_legs     INTEGER NOT NULL DEFAULT 0,
        total_notional  DECIMAL(18, 4) NOT NULL DEFAULT 0,
        filled_notional DECIMAL(18, 4) NOT NULL DEFAULT 0,
        metadata        JSONB,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_order_baskets_portfolio ON order_baskets (portfolio_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_order_baskets_manager ON order_baskets (manager_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_order_baskets_status ON order_baskets (status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_order_baskets_created_at ON order_baskets (created_at DESC)
    `);

    // Auto-update updated_at on row change
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_order_baskets_updated_at
      BEFORE UPDATE ON order_baskets
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_order_baskets_updated_at ON order_baskets`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_baskets_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_baskets_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_baskets_manager`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_baskets_portfolio`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_baskets`);
    await queryRunner.query(`DROP TYPE IF EXISTS basket_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS basket_status_enum`);
  }
}
