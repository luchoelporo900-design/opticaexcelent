/*
  # Create ventas, pagos, and gastos tables

  1. New Tables
    - `ventas` - sales records
    - `pagos` - payment records linked to sales
    - `gastos` - expense records

  2. Security
    - Enable RLS on all three tables
    - Allow all access to anon and authenticated roles
*/

CREATE TABLE IF NOT EXISTS ventas (
  id bigint PRIMARY KEY,
  fecha text NOT NULL,
  cliente_nombre text, cliente_apellido text, cliente_telefono text, cliente_ci text,
  sucursal_venta text, sucursal_entrega text, sucursal_cobro text,
  vendedora text, total numeric, sena numeric, saldo numeric,
  metodo_pago text, estado_trabajo text, anteojos jsonb, observaciones text,
  delivery_type text, delivered_at text, receipt_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos (
  id bigint PRIMARY KEY,
  sale_id bigint,
  fecha text, monto numeric,
  metodo text, sucursal text, vendedora text, cliente text,
  tipo text, receipt_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gastos (
  id bigint PRIMARY KEY,
  fecha text, descripcion text, categoria text,
  monto numeric, metodo text, sucursal text, vendedora text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON ventas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON pagos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON gastos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
