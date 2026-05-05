/*
  # Create stock_movimientos table

  1. New Tables
    - `stock_movimientos`
      - `id` (uuid, primary key, auto-generated)
      - `armazon_id` (text) - reference to the frame identifier
      - `armazon_nombre` (text) - frame name at time of movement
      - `armazon_codigo` (text) - frame code at time of movement
      - `cantidad` (integer, default 1) - quantity moved
      - `tipo` (text, default 'venta') - movement type (venta, devolucion, ajuste, etc.)
      - `sucursal` (text) - branch where movement occurred
      - `vendedora` (text) - seller who registered the movement
      - `venta_id` (text) - associated sale ID if applicable
      - `created_at` (timestamptz, default now()) - timestamp of movement

  2. Security
    - Enable RLS on `stock_movimientos` table
    - Authenticated users can insert movements
    - Authenticated users can read movements
*/

CREATE TABLE IF NOT EXISTS stock_movimientos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  armazon_id text,
  armazon_nombre text,
  armazon_codigo text,
  cantidad integer DEFAULT 1,
  tipo text DEFAULT 'venta',
  sucursal text,
  vendedora text,
  venta_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stock movements"
  ON stock_movimientos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert stock movements"
  ON stock_movimientos FOR INSERT
  TO authenticated
  WITH CHECK (true);
