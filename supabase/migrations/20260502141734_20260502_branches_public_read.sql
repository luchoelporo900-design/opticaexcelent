/*
  # Allow public read on branches

  Branches need to be readable before authentication so that:
  - The login page register form can list branches for new users
  - The BranchContext loads branch list regardless of auth state

  Changes:
  - Drop the authenticated-only SELECT policy on branches
  - Add a new policy allowing anyone (anon + authenticated) to SELECT branches
  - Write operations remain restricted (no INSERT/UPDATE/DELETE policy for public)
*/

DROP POLICY IF EXISTS "Authenticated users can view branches" ON branches;

CREATE POLICY "Anyone can view branches"
  ON branches
  FOR SELECT
  TO anon, authenticated
  USING (true);
