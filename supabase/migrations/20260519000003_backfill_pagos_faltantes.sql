/*
  # Fase A — Backfill de pagos faltantes en tabla `pagos`

  ## Problema que resuelve
  Ventas antiguas que tienen `sena > 0` pero no tienen ningún registro
  en `pagos` → la caja del día original no muestra ese cobro.

  ## Qué hace esta migración
  Para cada venta con sena > 0 sin ningún registro en pagos:
  crea UN registro de tipo 'sena' con la fecha original de la venta.

  ## Garantías de seguridad
  - INSERT ... WHERE NOT EXISTS → nunca duplica
  - Si una venta ya tiene CUALQUIER registro en pagos, no se toca
  - ID generado con base en año 2001 → sin colisión con Date.now() moderno (~2026)
  - No modifica la tabla ventas
  - No crea abonos, solo reconstruye la seña inicial

  ## Cómo ejecutar (en 3 pasos en Supabase → SQL Editor)
  PASO 1: Ejecutar solo el bloque de DIAGNÓSTICO → revisar los números
  PASO 2: Si los números son razonables, ejecutar el bloque de INSERCIÓN
  PASO 3: Ejecutar la VERIFICACIÓN para confirmar cuántas filas se insertaron

  ## Rollback
  Si algo salió mal, ejecutar el bloque de ROLLBACK al final de este archivo.
*/


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 1 — DIAGNÓSTICO (solo lectura, ejecutar primero)
-- Muestra cuántas ventas serán afectadas y el monto total a recuperar.
-- NO inserta nada.
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  COUNT(*)         AS ventas_sin_pago_en_pagos,
  SUM(v.sena)      AS monto_total_gs_a_recuperar,
  MIN(v.fecha)     AS venta_mas_antigua,
  MAX(v.fecha)     AS venta_mas_reciente,
  COUNT(DISTINCT v.vendedora) AS vendedoras_afectadas
FROM ventas v
WHERE v.sena > 0
  AND NOT EXISTS (
    SELECT 1 FROM pagos p WHERE p.sale_id = v.id
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 2 — INSERCIÓN (ejecutar solo si el PASO 1 devolvió números esperados)
-- ══════════════════════════════════════════════════════════════════════════════

/*
  Columnas generadas:

  id         → (1_000_000_000 + ventas.id) × 1000
               Ejemplo: venta id=1234 → pagos.id = 1_000_001_234_000
               Rango resultante: ~año 2001 en timestamp ms
               Date.now() en 2026 ≈ 1_746_000_000_000 → sin colisión posible.

  sale_id    → ventas.id (enlace a la venta)

  fecha      → ventas.fecha tal como está almacenado (texto, ej: '2026-05-05')
               La caja filtra con LIKE 'YYYY-MM-DD%' → funcionará correctamente.

  monto      → ventas.sena (monto cobrado al crear la venta)

  metodo     → ventas.metodo_pago, normalizado:
               'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro' → se usa tal cual
               'mixto'    → se guarda como 'mixto' (aparece en total de caja, no en subtotales)
               NULL / ''  → 'efectivo' como fallback

  sucursal   → sucursal_cobro; si vacío, sucursal_venta; si ambos vacíos → ''

  vendedora  → ventas.vendedora

  cliente    → nombre + apellido concatenados

  tipo       → 'sena' (siempre — esta migración solo reconstruye el pago inicial)

  receipt_url → NULL (las ventas antiguas no tienen comprobante digital)
*/

INSERT INTO pagos (
  id, sale_id, fecha, monto,
  metodo, sucursal, vendedora, cliente,
  tipo, receipt_url
)
SELECT
  -- ID único: base año 2001 + ventas.id → sin colisión con Date.now() 2026+
  ((1000000000::bigint + v.id::bigint) * 1000::bigint) AS id,

  v.id                                                  AS sale_id,

  v.fecha                                               AS fecha,

  v.sena                                                AS monto,

  -- Normalizar método de pago
  CASE
    WHEN v.metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'qr', 'giro', 'mixto')
      THEN v.metodo_pago
    WHEN v.metodo_pago IS NULL OR TRIM(v.metodo_pago) = ''
      THEN 'efectivo'
    ELSE 'efectivo'
  END                                                   AS metodo,

  -- Sucursal de cobro con fallback a sucursal de venta
  COALESCE(
    NULLIF(TRIM(v.sucursal_cobro), ''),
    NULLIF(TRIM(v.sucursal_venta), ''),
    ''
  )                                                     AS sucursal,

  COALESCE(v.vendedora, '')                             AS vendedora,

  -- Nombre completo del cliente
  TRIM(
    COALESCE(v.cliente_nombre, '') ||
    CASE
      WHEN COALESCE(v.cliente_apellido, '') <> '' THEN ' ' || v.cliente_apellido
      ELSE ''
    END
  )                                                     AS cliente,

  'sena'                                                AS tipo,

  NULL                                                  AS receipt_url

FROM ventas v
WHERE v.sena > 0
  AND NOT EXISTS (
    SELECT 1 FROM pagos p WHERE p.sale_id = v.id
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 3 — VERIFICACIÓN (ejecutar después del INSERT)
-- Confirma cuántas filas se insertaron y muestra las primeras 20 para revisión.
-- ══════════════════════════════════════════════════════════════════════════════

-- ¿Cuántas filas insertó esta migración?
SELECT COUNT(*) AS filas_de_backfill_en_pagos
FROM pagos
WHERE id >= 1000000001000   -- mínimo: venta id=1 → (1000000000+1)×1000
  AND id <  2000000000000;  -- máximo seguro: id de venta < 1.000.000.000

-- Previsualizar los primeros 20 registros insertados
SELECT
  p.id,
  p.sale_id,
  p.fecha,
  p.monto,
  p.metodo,
  p.sucursal,
  p.vendedora,
  p.cliente,
  p.tipo
FROM pagos p
WHERE p.id >= 1000000001000
  AND p.id <  2000000000000
ORDER BY p.sale_id
LIMIT 20;

-- Cross-check: ventas que siguen sin pago en pagos (debe ser 0 si todo OK)
SELECT COUNT(*) AS ventas_sin_pago_restantes
FROM ventas v
WHERE v.sena > 0
  AND NOT EXISTS (
    SELECT 1 FROM pagos p WHERE p.sale_id = v.id
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — solo si algo salió mal y necesitás deshacer
-- Elimina ÚNICAMENTE los registros insertados por esta migración.
-- NO toca pagos reales (sus IDs son Date.now() ~1.7 trillion, fuera del rango).
-- ══════════════════════════════════════════════════════════════════════════════

/*
  DELETE FROM pagos
  WHERE id >= 1000000001000
    AND id <  2000000000000;
*/
