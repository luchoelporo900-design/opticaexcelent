/*
  # Add full RLS policies to cash_ingresos

  Adds UPDATE and DELETE policies for authenticated users on cash_ingresos.
  SELECT and INSERT policies already exist from the previous migration.
*/

CREATE POLICY "Authenticated users can update cash ingresos"
  ON cash_ingresos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cash ingresos"
  ON cash_ingresos FOR DELETE
  TO authenticated
  USING (true);
