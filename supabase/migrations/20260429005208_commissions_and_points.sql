/*
  # Sistema de Comisiones y Premios

  ## Nuevas tablas:
  1. `seller_points` - Registro de puntos por venta, por vendedora y mes.
     - `seller_id` - Referencia al perfil de la vendedora
     - `sale_id` - Venta que generó los puntos
     - `points` - 1.0 (venta completa) o 0.5 (solo armazón o solo cristales)
     - `sale_month` - Mes de la venta (YYYY-MM) para filtrar por mes fácilmente
     - `point_type` - Descripción del tipo: 'completa', 'solo_armazon', 'solo_cristales'

  ## Funciones:
  - `calculate_sale_points(sale_id)` - Calcula los puntos de una venta según sus ítems
    y los inserta en seller_points. Llamada desde la app tras registrar la venta.

  ## Seguridad:
  - RLS habilitado, vendedoras ven sus propios puntos, admin ve todos.
*/

CREATE TABLE IF NOT EXISTS seller_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  points numeric(4,1) NOT NULL CHECK (points IN (0.5, 1.0)),
  point_type text NOT NULL CHECK (point_type IN ('completa', 'solo_armazon', 'solo_cristales')),
  sale_month text NOT NULL, -- formato YYYY-MM
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(sale_id) -- Una venta genera un único registro de puntos
);

ALTER TABLE seller_points ENABLE ROW LEVEL SECURITY;

-- Cada vendedora ve solo sus propios puntos
CREATE POLICY "Sellers view own points"
  ON seller_points FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

-- Admin ve todos los puntos
CREATE POLICY "Admin views all points"
  ON seller_points FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "System can insert points"
  ON seller_points FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Vista de resumen mensual por vendedora (útil para el reporte del admin)
CREATE OR REPLACE VIEW monthly_seller_summary AS
SELECT
  sp.seller_id,
  p.full_name AS seller_name,
  sp.sale_month,
  b.name AS branch_name,
  SUM(sp.points) AS total_points,
  COUNT(*) AS total_sales,
  COUNT(*) FILTER (WHERE sp.point_type = 'completa') AS full_sales,
  COUNT(*) FILTER (WHERE sp.point_type != 'completa') AS partial_sales,
  CASE
    WHEN SUM(sp.points) >= 10 THEN 'oro'
    WHEN SUM(sp.points) >= 8  THEN 'bronce'
    ELSE 'sin_nivel'
  END AS prize_level
FROM seller_points sp
JOIN profiles p ON p.id = sp.seller_id
LEFT JOIN branches b ON b.id = sp.branch_id
GROUP BY sp.seller_id, p.full_name, sp.sale_month, b.name, sp.branch_id
ORDER BY sp.sale_month DESC, total_points DESC;
