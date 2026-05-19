/*
  # Trazabilidad de Laboratorio — Campos adicionales en lab_orders

  Todas las columnas son nullable para no romper registros existentes.

  Campos nuevos:
    - assigned_lab_name   → nombre del laboratorio asignado por admin (NULL hasta asignar)
    - sent_date           → fecha real de envío al laboratorio
    - internal_observation → nota interna visible solo para lab/admin
    - assigned_by         → nombre del admin/encargada que realizó la asignación
    - assigned_at         → timestamp de la asignación

  El campo `history` (jsonb) ya existe — se enriquecerá en la UI sin
  cambio de esquema, usando eventos tipados:
    { event: 'lab_assigned', lab_name, sent_date, timestamp, by }
    { event: 'observation',  text, timestamp, by }
*/

ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS assigned_lab_name    text,
  ADD COLUMN IF NOT EXISTS sent_date            timestamptz,
  ADD COLUMN IF NOT EXISTS internal_observation text,
  ADD COLUMN IF NOT EXISTS assigned_by          text,
  ADD COLUMN IF NOT EXISTS assigned_at          timestamptz;

-- Índices para búsqueda por laboratorio y por fecha de envío
CREATE INDEX IF NOT EXISTS idx_lab_orders_assigned_lab
  ON lab_orders (assigned_lab_name);

CREATE INDEX IF NOT EXISTS idx_lab_orders_sent_date
  ON lab_orders (sent_date);
