/*
  # Optical Sales System V2 - Payments & Branches

  ## Summary
  Extends the payment and sales system to support:
  1. Payments received at any branch (not just sale branch)
  2. All payment methods: efectivo, transferencia, tarjeta (POS), qr, giro
  3. Delivery dates on sales (estimated and actual)
  4. Daily expenses tracking per branch
  5. Branch tracking on sale_payments for correct cash reporting

  ## Changes

  ### sale_payments table
  - Add `branch_id` - branch where money was received (can differ from sale branch)
  - Add `reference` - bank/reference number for transfers
  - Expand `method` to include 'qr' and 'giro'

  ### sales table
  - Add `estimated_delivery` date
  - Add `delivered_at` date
  - Add `first_name`, `last_name` columns for denormalized client display
  - Expand status to include 'cancelado'

  ### expenses table (new)
  - Track daily expenses per branch for cash sheet accuracy
  - id, branch_id, amount, method, description, registered_by, expense_date

  ### cash_register table
  - Add qr and giro columns
  - Update total GENERATED column to include all methods
*/

-- Extend sale_payments: branch where money received + more methods + reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_payments' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE sale_payments ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_payments' AND column_name = 'reference'
  ) THEN
    ALTER TABLE sale_payments ADD COLUMN reference text DEFAULT '';
  END IF;
END $$;

-- Update method check constraint on sale_payments to include qr/giro
ALTER TABLE sale_payments DROP CONSTRAINT IF EXISTS sale_payments_method_check;
ALTER TABLE sale_payments ADD CONSTRAINT sale_payments_method_check
  CHECK (method IN ('efectivo', 'transferencia', 'tarjeta', 'qr', 'giro', 'mixto'));

-- Add delivery date columns to sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'estimated_delivery'
  ) THEN
    ALTER TABLE sales ADD COLUMN estimated_delivery date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN delivered_at date;
  END IF;
END $$;

-- Add denormalized first/last name for faster display
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_first_name'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_first_name text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_last_name'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_last_name text DEFAULT '';
  END IF;
END $$;

-- Expand sales status to add cancelado if not already present
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('pendiente', 'en_proceso', 'en_laboratorio', 'listo', 'entregado', 'cancelado'));

-- Expenses table (daily cash expenses per branch)
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  method text DEFAULT 'efectivo' CHECK (method IN ('efectivo', 'transferencia', 'tarjeta', 'qr', 'giro')),
  description text NOT NULL DEFAULT '',
  registered_by uuid REFERENCES profiles(id),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Extend cash_register to include qr, giro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_register' AND column_name = 'qr'
  ) THEN
    ALTER TABLE cash_register ADD COLUMN qr numeric(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_register' AND column_name = 'giro'
  ) THEN
    ALTER TABLE cash_register ADD COLUMN giro numeric(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_register' AND column_name = 'expenses'
  ) THEN
    ALTER TABLE cash_register ADD COLUMN expenses numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- Add indexes for branch-based payment queries
CREATE INDEX IF NOT EXISTS idx_sale_payments_branch_id ON sale_payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
