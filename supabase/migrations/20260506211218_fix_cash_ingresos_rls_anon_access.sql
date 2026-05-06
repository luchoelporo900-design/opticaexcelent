/*
  # Fix cash_ingresos RLS policies to allow anon role

  The app uses custom auth (optica_users table) without Supabase Auth sessions,
  so the Supabase client always operates as the 'anon' role. The existing policies
  were restricted to 'authenticated' only, blocking all inserts and reads.

  Changes:
  - Drop all 4 existing cash_ingresos policies (SELECT, INSERT, UPDATE, DELETE)
  - Recreate them targeting both 'anon' and 'authenticated' roles
*/

DROP POLICY IF EXISTS "Authenticated users can delete cash ingresos" ON cash_ingresos;
DROP POLICY IF EXISTS "Authenticated users can insert cash ingresos" ON cash_ingresos;
DROP POLICY IF EXISTS "Authenticated users can read cash ingresos" ON cash_ingresos;
DROP POLICY IF EXISTS "Authenticated users can update cash ingresos" ON cash_ingresos;

CREATE POLICY "anon and authenticated can select cash ingresos"
  ON cash_ingresos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon and authenticated can insert cash ingresos"
  ON cash_ingresos FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon and authenticated can update cash ingresos"
  ON cash_ingresos FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon and authenticated can delete cash ingresos"
  ON cash_ingresos FOR DELETE
  TO anon, authenticated
  USING (true);
