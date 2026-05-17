
/*
  # Óptica Excelent - Management V10 - Schema Principal

  ## Tablas creadas:
  1. `branches` - 4 sucursales (Azara, Fernando, Caacupé, La Fina)
  2. `profiles` - Perfiles de usuarios del sistema con rol y sucursal
  3. `customers` - Clientes con CI paraguaya
  4. `prescriptions` - Recetas oftalmológicas completas
  5. `frames` - Armazones con foto
  6. `sales` - Ventas POS con señas/saldos
  7. `sale_items` - Items de cada venta
  8. `lab_orders` - Pedidos de laboratorio con seguimiento
  9. `reminders` - Recordatorios CRM (6 y 12 meses)

  ## Seguridad:
  - RLS habilitado en todas las tablas
  - Políticas basadas en autenticación y rol de usuario
*/

-- Sucursales
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view branches"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

-- Insertar las 4 sucursales
INSERT INTO branches (name, address, phone) VALUES
  ('Azara', 'Sucursal Azara', '0981-000001'),
  ('Fernando', 'Sucursal Fernando de la Mora', '0981-000002'),
  ('Caacupé', 'Sucursal Caacupé', '0981-000003'),
  ('La Fina', 'Sucursal La Fina', '0981-000004')
ON CONFLICT DO NOTHING;

-- Perfiles de usuarios
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'gerente', 'vendedor', 'laboratorio')),
  branch_id uuid REFERENCES branches(id),
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Clientes
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ci text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text DEFAULT '',
  whatsapp text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  birth_date date,
  branch_id uuid REFERENCES branches(id),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Recetas oftalmológicas
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  doctor_name text DEFAULT '',
  prescription_date date DEFAULT CURRENT_DATE,
  -- Ojo derecho
  od_esf text DEFAULT '',
  od_cil text DEFAULT '',
  od_eje text DEFAULT '',
  od_add text DEFAULT '',
  od_av text DEFAULT '',
  -- Ojo izquierdo
  oi_esf text DEFAULT '',
  oi_cil text DEFAULT '',
  oi_eje text DEFAULT '',
  oi_add text DEFAULT '',
  oi_av text DEFAULT '',
  -- DIP
  dip_lejos numeric(5,1),
  dip_cerca numeric(5,1),
  -- Tipo de lente
  lens_type text DEFAULT 'monofocal' CHECK (lens_type IN ('monofocal', 'bifocal', 'multifocal', 'ocupacional')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prescriptions"
  ON prescriptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert prescriptions"
  ON prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update prescriptions"
  ON prescriptions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Armazones
CREATE TABLE IF NOT EXISTS frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  color text DEFAULT '',
  material text DEFAULT '',
  price numeric(12,2) DEFAULT 0,
  stock integer DEFAULT 0,
  branch_id uuid REFERENCES branches(id),
  photo_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view frames"
  ON frames FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert frames"
  ON frames FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update frames"
  ON frames FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ventas
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  branch_id uuid REFERENCES branches(id) NOT NULL,
  seller_id uuid REFERENCES profiles(id),
  prescription_id uuid REFERENCES prescriptions(id),
  total numeric(12,2) DEFAULT 0,
  deposit numeric(12,2) DEFAULT 0,
  balance numeric(12,2) DEFAULT 0,
  status text DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado')),
  payment_method text DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'mixto')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Items de venta
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('armazon', 'cristal', 'tratamiento', 'accesorio', 'servicio')),
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  frame_id uuid REFERENCES frames(id),
  lens_type text DEFAULT '',
  treatment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sale_items"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sale_items"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Pedidos de laboratorio
CREATE TABLE IF NOT EXISTS lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  sale_id uuid REFERENCES sales(id) NOT NULL,
  branch_id uuid REFERENCES branches(id) NOT NULL,
  lab_name text DEFAULT 'Laboratorio Central',
  status text DEFAULT 'enviado' CHECK (status IN ('enviado', 'proceso', 'listo', 'entregado')),
  sent_date timestamptz DEFAULT now(),
  ready_date timestamptz,
  delivered_date timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lab_orders"
  ON lab_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lab_orders"
  ON lab_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lab_orders"
  ON lab_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Recordatorios CRM
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  sale_id uuid REFERENCES sales(id),
  reminder_type text NOT NULL CHECK (reminder_type IN ('6_meses', '12_meses', 'personalizado')),
  scheduled_date date NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'enviado', 'cancelado')),
  whatsapp_message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reminders"
  ON reminders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reminders"
  ON reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reminders"
  ON reminders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Función para auto-crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'vendedor');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
