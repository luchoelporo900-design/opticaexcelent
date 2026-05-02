/*
  # Add pagado_total to sales status constraint

  ## Summary
  Extends the `sales.status` check constraint to include 'pagado_total'.
  This status is automatically set when the sale balance reaches 0 via an
  abono payment, indicating the sale is fully paid but not yet delivered.

  ## Changes
  - Drops and recreates `sales_status_check` constraint to allow:
    'pendiente', 'en_proceso', 'en_laboratorio', 'listo',
    'pagado_total', 'entregado', 'cancelado'

  ## Notes
  - 'pagado_total' differs from 'entregado': the sale is fully paid but
    the glasses may not have been handed over yet (still in lab, or ready
    for pickup). 'entregado' is set when glasses are physically delivered.
*/

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN (
    'pendiente',
    'en_proceso',
    'en_laboratorio',
    'listo',
    'pagado_total',
    'entregado',
    'cancelado'
  ));
