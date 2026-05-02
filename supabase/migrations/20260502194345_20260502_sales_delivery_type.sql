/*
  # Add delivery_type to sales

  ## Summary
  Adds a `delivery_type` column to the `sales` table to record how the
  finished glasses were handed over to the customer at the moment of closing.

  ## Changes
  - `sales.delivery_type` (text, nullable): one of 'retiro', 'delivery', 'encomienda'.
    Null means not yet closed / delivered.

  ## Notes
  - No RLS change needed; existing policies on `sales` already apply.
  - Column is nullable so existing rows are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'delivery_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN delivery_type text DEFAULT NULL
      CHECK (delivery_type IN ('retiro', 'delivery', 'encomienda'));
  END IF;
END $$;
