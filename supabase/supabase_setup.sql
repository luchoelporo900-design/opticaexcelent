-- ============================================================
-- ÓPTICA YOLANDA — Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Agregar columna puede_editar_ventas a optica_users
ALTER TABLE optica_users
  ADD COLUMN IF NOT EXISTS puede_editar_ventas boolean DEFAULT false;

-- Verificar que quedó bien:
SELECT id, full_name, role, puede_cargar_stock, puede_editar_ventas
FROM optica_users
ORDER BY created_at;

-- ============================================================
-- LISTO. Solo esto es necesario.
-- ============================================================
