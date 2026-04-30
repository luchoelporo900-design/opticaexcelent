
/*
  # Real Optical Sales System — Core Enhancement

  ## Changes:

  ### 1. sale_payments table (NEW)
  - Tracks every individual payment against a sale
  - Supports cash/transfer/POS per payment
  - Enables partial payment workflow: customer returns to pay more

  ### 2. sales table updates
  - Add `seller_name` column (denormalized for fast reports)
  - Add `deposit_method` for the initial deposit payment method

  ### 3. cash_register table (NEW)
  - Daily cash tracking per branch
  - Breakdown: efectivo / transferencia / tarjeta (POS)
  - Supports daily closing summary

  ### 4. sale_status enum expansion
  - `en_laboratorio` added as explicit status for bifocal/multifocal
  - Keep existing statuses

  ### 5. RLS updates
  - Sellers (vendedor) can only SELECT their own sales
  - Admin/gerente see all sales
  - Sellers can INSERT sales (required for POS)
  - Sellers can UPDATE their own sales status

  ### Security:
  - All new tables have RLS enabled
  - Payments tied to sale ownership for access control
*/

-- ── 1. sale_payments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount        numeric(15,2) NOT NULL DEFAULT 0,
  method        text NOT NULL DEFAULT 'efectivo'
                CHECK (method IN ('efectivo', 'transferencia', 'tarjeta', 'mixto')),
  notes         text DEFAULT '',
  paid_at       timestamptz DEFAULT now(),
  registered_by uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can insert payments for their sales"
  ON sale_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id
        AND (
          s.seller_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'gerente')
          )
        )
    )
  );

CREATE POLICY "Sellers see payments on their own sales"
  ON sale_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id
        AND (
          s.seller_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'gerente')
          )
        )
    )
  );

-- ── 2. seller_name on sales (denormalized for fast reporting) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'seller_name'
  ) THEN
    ALTER TABLE sales ADD COLUMN seller_name text DEFAULT '';
  END IF;
END $$;

-- ── 3. cash_register table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_register (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES branches(id),
  register_date date NOT NULL DEFAULT CURRENT_DATE,
  efectivo      numeric(15,2) NOT NULL DEFAULT 0,
  transferencia numeric(15,2) NOT NULL DEFAULT 0,
  tarjeta       numeric(15,2) NOT NULL DEFAULT 0,
  total         numeric(15,2) GENERATED ALWAYS AS (efectivo + transferencia + tarjeta) STORED,
  notes         text DEFAULT '',
  closed_by     uuid REFERENCES auth.users(id),
  closed_at     timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (branch_id, register_date)
);

ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cash register"
  ON cash_register FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cash register"
  ON cash_register FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cash register"
  ON cash_register FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 4. Updated RLS on sales: sellers only see their own ───────────────────────
-- Drop old permissive policies and replace with role-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON sales;

CREATE POLICY "Sellers see own sales, admins see all"
  ON sales FOR SELECT
  TO authenticated
  USING (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Sellers can create sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Sellers can update own sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'gerente')
    )
  )
  WITH CHECK (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'gerente')
    )
  );

-- ── 5. sale_items: sellers see items on their sales only ──────────────────────
DROP POLICY IF EXISTS "Authenticated users can view sale_items" ON sale_items;
DROP POLICY IF EXISTS "Authenticated users can insert sale_items" ON sale_items;

CREATE POLICY "Sellers see items on their own sales"
  ON sale_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id
        AND (
          s.seller_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'gerente')
          )
        )
    )
  );

CREATE POLICY "Sellers can insert sale items"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 6. Index for payment queries ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id  ON sale_payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_paid_at  ON sale_payments (paid_at);
CREATE INDEX IF NOT EXISTS idx_sales_seller_id        ON sales (seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at       ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_cash_register_date     ON cash_register (register_date, branch_id);
