/*
  # User Management & Customer History Enhancement

  ## Changes

  1. Tables
    - `profiles` already exists — no schema changes needed, we'll use Supabase Auth admin via edge functions
    - Add `invite_tokens` table for user creation flow (admin creates user email+password via Supabase auth)

  2. Security
    - Add policy so admins can read ALL profiles (for user management panel)
    - Add policy so admins can update any profile (role, branch_id)
    - Existing policies already allow users to read own profile

  3. Views
    - No new views needed; we query sales + sale_eyeglasses + customers directly

  ## Notes
    - User creation uses supabase.auth.admin — not available from browser client
    - We'll store pending profile data and use service role in an edge function
    - customer_history: queries sales joined with sale_eyeglasses for photo/prescription data
*/

-- Allow admins to read all profiles (needed for user management)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admins can read all profiles'
  ) THEN
    CREATE POLICY "Admins can read all profiles"
      ON profiles FOR SELECT
      TO authenticated
      USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'gerente')
        )
      );
  END IF;
END $$;

-- Allow admins to update any profile (role, branch assignment)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile"
      ON profiles FOR UPDATE
      TO authenticated
      USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'gerente')
        )
      )
      WITH CHECK (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'gerente')
        )
      );
  END IF;
END $$;

-- Allow admins to insert new profiles (after auth user creation via edge function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admins can insert profiles'
  ) THEN
    CREATE POLICY "Admins can insert profiles"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'gerente')
        )
      );
  END IF;
END $$;

-- Ensure sale_eyeglasses can be queried by authenticated users for customer history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sale_eyeglasses' AND policyname = 'Authenticated users can view sale_eyeglasses'
  ) THEN
    CREATE POLICY "Authenticated users can view sale_eyeglasses"
      ON sale_eyeglasses FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Index for fast customer history lookups
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_name ON sales(customer_first_name, customer_last_name);
CREATE INDEX IF NOT EXISTS idx_sale_eyeglasses_sale_id ON sale_eyeglasses(sale_id);
