/*
  # Óptica Excelent — Actualización de sucursales y columnas de stock

  ## Cambios:
  1. Renombrar columnas de stock en tabla `armazones`:
     - stock_azara     → stock_pettirossi
     - stock_fernando  → stock_lambere
     - stock_caacupe   → stock_accesosur
     - stock_la_fina   → stock_capiata
  2. Agregar columna stock_azara para la nueva sucursal Azara
  3. Actualizar registros de la tabla `branches` con las nuevas sucursales
*/

-- ── 1. Renombrar columnas de stock en armazones ──────────────────────────────

ALTER TABLE armazones RENAME COLUMN stock_azara    TO stock_pettirossi;
ALTER TABLE armazones RENAME COLUMN stock_fernando TO stock_lambere;
ALTER TABLE armazones RENAME COLUMN stock_caacupe  TO stock_accesosur;
ALTER TABLE armazones RENAME COLUMN stock_la_fina  TO stock_capiata;

-- Agregar nueva columna para sucursal Azara (que se mantiene)
ALTER TABLE armazones ADD COLUMN IF NOT EXISTS stock_azara int DEFAULT 0;

-- ── 2. Actualizar sucursales en tabla branches ───────────────────────────────

-- Eliminar sucursales antiguas y agregar las nuevas
DELETE FROM branches WHERE name IN ('Fernando', 'Caacupé', 'Centro', 'La Fina');

-- Renombrar la sucursal Azara existente a Pettirossi
UPDATE branches SET name = 'Pettirossi', address = 'Sucursal Pettirossi'
  WHERE name = 'Azara';

-- Insertar las nuevas sucursales
INSERT INTO branches (name, address, phone) VALUES
  ('Azara',      'Sucursal Azara',      '0981-000002'),
  ('Lambaré',    'Sucursal Lambaré',    '0981-000003'),
  ('Acceso Sur', 'Sucursal Acceso Sur', '0981-000004'),
  ('Capiatá',    'Sucursal Capiatá',    '0981-000005')
ON CONFLICT DO NOTHING;
