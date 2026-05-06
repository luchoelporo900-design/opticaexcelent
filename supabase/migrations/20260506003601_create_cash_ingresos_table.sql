/*
  # Create cash_ingresos table

  1. New Tables
    - `cash_ingresos`
      - `id` (uuid, primary key, auto-generated)
      - `fecha` (text) - date of the income entry
      - `descripcion` (text) - description of the income
      - `monto` (numeric, default 0) - amount
      - `metodo` (text) - payment method
      - `sucursal` (text) - branch where registered
      - `vendedora` (text) - seller who registered it
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `cash_ingresos` table
    - Authenticated users can read and insert income records
*/

CREATE TABLE IF NOT EXISTS cash_ingresos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha text,
  descripcion text,
  monto numeric DEFAULT 0,
  metodo text,
  sucursal text,
  vendedora text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_ingresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cash ingresos"
  ON cash_ingresos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cash ingresos"
  ON cash_ingresos FOR INSERT
  TO authenticated
  WITH CHECK (true);
