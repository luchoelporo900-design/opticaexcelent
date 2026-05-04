/*
  # Create armazones table

  1. New Tables
    - `armazones`: Stores eyeglass frames inventory
      - `id` (text, primary key)
      - `codigo` (text, unique) - frame code/SKU
      - `nombre` (text) - frame name
      - `foto_url` (text) - photo URL
      - `precio` (numeric) - price
      - `stock_azara`, `stock_fernando`, `stock_caacupe`, `stock_la_fina` (int) - stock per branch
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow full access to anon and authenticated users
*/

CREATE TABLE IF NOT EXISTS armazones (
  id text PRIMARY KEY,
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  foto_url text DEFAULT '',
  precio numeric DEFAULT 0,
  stock_azara int DEFAULT 0,
  stock_fernando int DEFAULT 0,
  stock_caacupe int DEFAULT 0,
  stock_la_fina int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE armazones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all"
  ON armazones
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
