/*
  # Fix sales and sale_payments RLS — allow all authenticated users to read

  ## Problem
  The SELECT policies on `sales` and `sale_payments` required seller_id = auth.uid()
  or admin/gerente role. When a sale was saved with seller_id = null (fallback seller),
  auth.uid() != null so the row was invisible to the inserting user — causing the
  "saves visually but never appears" bug.

  ## Changes
  - Drop restrictive SELECT policy on `sales`, replace with "authenticated users can view all sales"
  - Drop restrictive SELECT policy on `sale_payments`, replace with "authenticated users can view all payments"
  - Keep INSERT/UPDATE policies unchanged

  This matches the access pattern of every other table in the schema (branches, customers, etc.)
*/

-- sales: replace restrictive SELECT with open authenticated read
DROP POLICY IF EXISTS "Sellers see own sales, admins see all" ON sales;

CREATE POLICY "Authenticated users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

-- sale_payments: replace restrictive SELECT with open authenticated read
DROP POLICY IF EXISTS "Sellers see payments on their own sales" ON sale_payments;

CREATE POLICY "Authenticated users can view sale_payments"
  ON sale_payments FOR SELECT
  TO authenticated
  USING (true);
