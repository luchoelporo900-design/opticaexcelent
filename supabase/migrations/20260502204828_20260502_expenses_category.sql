/*
  # Add category column to expenses table

  ## Changes
  - `expenses`: adds `category` text column with predefined values for expense classification
    - Categories: alquiler, servicios, insumos, comisiones, limpieza, transporte, reparacion, otros
    - Default: 'otros'

  ## Notes
  - Safe additive change, existing rows default to 'otros'
  - No data loss possible
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'category'
  ) THEN
    ALTER TABLE expenses ADD COLUMN category text NOT NULL DEFAULT 'otros'
      CHECK (category IN ('alquiler','servicios','insumos','comisiones','limpieza','transporte','reparacion','otros'));
  END IF;
END $$;
