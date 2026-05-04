/*
  # Create lab_orders table

  1. New Tables
    - `lab_orders`: Stores optical lab orders linked to sales
      - `id` (text, primary key)
      - `sale_id` (bigint) - reference to sale
      - `sale_number` (text)
      - `customer_name`, `customer_phone`, `customer_ci` (text)
      - `seller_name`, `seller_phone` (text)
      - `branch_name` (text)
      - `status` (text, default 'enviado')
      - `notes` (text)
      - `created_at`, `updated_at` (timestamptz)
      - `anteojos` (jsonb) - lens/frame details
      - `history` (jsonb) - status history log

  2. Security
    - Enable RLS
    - Allow full access to anon and authenticated users
*/

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
