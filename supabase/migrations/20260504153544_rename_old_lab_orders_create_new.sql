/*
  # Replace lab_orders table with correct schema

  The existing lab_orders table has a different schema (UUID ids, branch_id, lab_name)
  than what the application expects (text id, sale_number, customer_*, seller_*, anteojos, history).

  1. Rename old table to lab_orders_legacy (preserving data)
  2. Create new lab_orders table with the correct application schema
  3. Enable RLS and add permissive policy for authenticated access
*/

ALTER TABLE IF EXISTS lab_orders RENAME TO lab_orders_legacy;

CREATE TABLE IF NOT EXISTS lab_orders (
  id text PRIMARY KEY,
  sale_id bigint,
  sale_number text,
  customer_name text,
  customer_phone text,
  customer_ci text,
  seller_name text,
  seller_phone text,
  branch_name text,
  status text DEFAULT 'enviado',
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  anteojos jsonb,
  history jsonb
);

ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all"
  ON lab_orders
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
