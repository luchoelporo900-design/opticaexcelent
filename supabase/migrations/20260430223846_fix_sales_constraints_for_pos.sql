/*
  # Fix sales table constraints that blocked every POS insert

  ## Problems found
  1. payment_method CHECK only allowed: efectivo, tarjeta, transferencia, mixto
     The POS sends: qr, giro — causing every insert to fail silently.
  2. customer_id was NOT NULL — the POS saves without a customer when lookup fails,
     causing a NOT NULL violation.

  ## Changes
  1. Drop and recreate payment_method CHECK to include all values the POS uses:
     efectivo, tarjeta, transferencia, mixto, qr, giro
  2. Make customer_id nullable (customer is looked up/created but can fail gracefully)
*/

-- 1. Fix payment_method CHECK — add qr and giro
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'efectivo'::text,
    'tarjeta'::text,
    'transferencia'::text,
    'mixto'::text,
    'qr'::text,
    'giro'::text
  ]));

-- 2. Make customer_id nullable so a sale can be saved without a matched customer
ALTER TABLE sales ALTER COLUMN customer_id DROP NOT NULL;
