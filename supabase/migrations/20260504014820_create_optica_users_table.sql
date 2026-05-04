/*
  # Create optica_users table

  1. New Tables
    - `optica_users` - standalone user table for app authentication
      - `id` (text, primary key)
      - `full_name` (text)
      - `email` (text, unique)
      - `password` (text)
      - `role` (text, default 'vendedora')
      - `branch_id` (text, nullable)
      - `avatar_url` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow all access to anon and authenticated roles

  3. Data
    - Insert admin user: Luis Martinez
*/

CREATE TABLE IF NOT EXISTS optica_users (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'vendedora',
  branch_id text,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE optica_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all"
  ON optica_users
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO optica_users (id, full_name, email, password, role, branch_id, avatar_url, created_at)
VALUES ('admin1', 'Luis Martinez', 'luchoelporo900@gmail.com', '@Lucho2020', 'admin', null, '', now())
ON CONFLICT (id) DO NOTHING;
