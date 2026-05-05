/*
  # Add color column to armazones

  - Adds `color` (text, default '') to the armazones table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'armazones' AND column_name = 'color'
  ) THEN
    ALTER TABLE armazones ADD COLUMN color text DEFAULT '';
  END IF;
END $$;
