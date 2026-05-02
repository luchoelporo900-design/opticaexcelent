/*
  # Rename branch "La Fina" to "Centro"

  The user requested 4 branches: Azara, Centro, Caacupé, Fernando.
  Current branches: Azara, Caacupé, Fernando, La Fina.
  Action: rename "La Fina" to "Centro" to match the requested list.

  No data is deleted. All existing sales/profiles linked to this branch_id remain valid.
*/

UPDATE branches
SET name = 'Centro', address = 'Sucursal Centro'
WHERE name = 'La Fina';
