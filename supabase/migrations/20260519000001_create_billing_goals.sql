/*
  # Metas de Facturación Mensuales

  Nueva tabla `billing_goals` para almacenar metas editables por vendedora
  y por sucursal, expresadas en Guaraníes (sin porcentajes ni comisiones).

  Campos:
    - seller_name  → coincide con ventas.vendedora (texto libre del sistema)
    - branch_name  → coincide con ventas.sucursal_venta
    - month        → formato YYYY-MM
    - goal_amount_gs → meta en Gs
    - created_by   → nombre del admin que registró la meta

  Restricción UNIQUE(seller_name, branch_name, month) — una meta por
  combinación vendedora + sucursal + mes.
*/

CREATE TABLE IF NOT EXISTS billing_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name     text NOT NULL,
  branch_name     text NOT NULL,
  month           text NOT NULL,
  goal_amount_gs  numeric(15, 0) NOT NULL DEFAULT 0,
  created_by      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  CONSTRAINT billing_goals_unique_per_period
    UNIQUE (seller_name, branch_name, month)
);

ALTER TABLE billing_goals ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer metas
CREATE POLICY "billing_goals_select"
  ON billing_goals FOR SELECT
  TO authenticated
  USING (true);

-- Solo admin/gerente pueden insertar
CREATE POLICY "billing_goals_insert"
  ON billing_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'gerente')
    )
  );

-- Solo admin/gerente pueden actualizar
CREATE POLICY "billing_goals_update"
  ON billing_goals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'gerente')
    )
  );

-- Solo admin/gerente pueden eliminar
CREATE POLICY "billing_goals_delete"
  ON billing_goals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'gerente')
    )
  );

-- Índices para consultas frecuentes
CREATE INDEX idx_billing_goals_month        ON billing_goals (month);
CREATE INDEX idx_billing_goals_seller_month ON billing_goals (seller_name, month);
CREATE INDEX idx_billing_goals_branch_month ON billing_goals (branch_name, month);
