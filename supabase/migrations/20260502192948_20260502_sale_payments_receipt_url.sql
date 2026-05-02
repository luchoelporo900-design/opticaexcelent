/*
  # Add receipt_url to sale_payments

  ## Summary
  Adds a `receipt_url` column to the `sale_payments` table to store
  compressed base64 images of payment receipts (tickets, transfers, giros).

  ## Changes
  - `sale_payments.receipt_url` (text, nullable): stores a compressed base64 data-URL
    of the payment comprobante photo. Kept as text to avoid needing a separate
    storage bucket; images are pre-compressed to ≤200KB before saving.

  ## Notes
  - Column is nullable — receipt is optional for efectivo but encouraged for
    transferencia/giro/qr methods.
  - No RLS change needed; existing policies on sale_payments already apply.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_payments' AND column_name = 'receipt_url'
  ) THEN
    ALTER TABLE sale_payments ADD COLUMN receipt_url text DEFAULT NULL;
  END IF;
END $$;
