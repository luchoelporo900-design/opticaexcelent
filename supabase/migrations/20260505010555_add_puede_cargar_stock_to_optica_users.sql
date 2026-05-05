/*
  # Add puede_cargar_stock column to optica_users

  - Adds `puede_cargar_stock` (boolean, default false) to the optica_users table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'optica_users' AND column_name = 'puede_cargar_stock'
  ) THEN
    ALTER TABLE optica_users ADD COLUMN puede_cargar_stock boolean DEFAULT false;
  END IF;
END $$;
