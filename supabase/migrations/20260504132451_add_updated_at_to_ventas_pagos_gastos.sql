/*
  # Add updated_at column to ventas, pagos, and gastos

  - Adds `updated_at` timestamptz column with default now() to ventas, pagos, and gastos
*/

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
