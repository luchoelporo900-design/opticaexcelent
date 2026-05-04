import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'gerente' | 'vendedor' | 'laboratorio';
  branch_id: string | null;
  avatar_url: string;
  created_at: string;
};

export type Customer = {
  id: string;
  ci: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  birth_date: string | null;
  branch_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Prescription = {
  id: string;
  customer_id: string;
  doctor_name: string;
  prescription_date: string;
  od_esf: string; od_cil: string; od_eje: string; od_add: string; od_av: string;
  oi_esf: string; oi_cil: string; oi_eje: string; oi_add: string; oi_av: string;
  dip_lejos: number | null;
  dip_cerca: number | null;
  lens_type: 'monofocal' | 'bifocal' | 'multifocal' | 'ocupacional';
  notes: string;
  created_at: string;
};

export type Sale = {
  id: string;
  sale_number: string;
  customer_id: string;
  branch_id: string;
  seller_id: string | null;
  prescription_id: string | null;
  total: number;
  deposit: number;
  balance: number;
  status: 'pendiente' | 'en_proceso' | 'en_laboratorio' | 'listo' | 'entregado' | 'cancelado';
  payment_method: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  notes: string;
  created_at: string;
  updated_at: string;
  customers?: Customer;
  branches?: Branch;
};

export type LabOrder = {
  id: string;
  order_number: string;
  sale_id: string;
  branch_id: string;
  lab_name: string;
  status: 'enviado' | 'proceso' | 'listo' | 'entregado';
  sent_date: string;
  ready_date: string | null;
  delivered_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  sales?: Sale;
};

export type SellerPoints = {
  id: string;
  seller_id: string;
  sale_id: string;
  points: 0.5 | 1.0;
  point_type: 'completa' | 'solo_armazon' | 'solo_cristales';
  sale_month: string;
  branch_id: string | null;
  created_at: string;
};

export type MonthlySummary = {
  seller_id: string;
  seller_name: string;
  sale_month: string;
  branch_name: string | null;
  total_points: number;
  total_sales: number;
  full_sales: number;
  partial_sales: number;
  prize_level: 'oro' | 'bronce' | 'sin_nivel';
};

export type SalePayment = {
  id: string;
  sale_id: string;
  amount: number;
  method: 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro' | 'mixto';
  notes: string;
  branch_id: string | null;
  reference: string;
  paid_at: string;
  registered_by: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  branch_id: string;
  amount: number;
  method: string;
  description: string;
  registered_by: string | null;
  expense_date: string;
  created_at: string;
};

export type CashRegister = {
  id: string;
  branch_id: string;
  register_date: string;
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  total: number;
  closed_by: string | null;
  closed_at: string | null;
};

export type Reminder = {
  id: string;
  customer_id: string;
  sale_id: string | null;
  reminder_type: '6_meses' | '12_meses' | 'personalizado';
  scheduled_date: string;
  sent_at: string | null;
  status: 'pendiente' | 'enviado' | 'cancelado';
  whatsapp_message: string;
  created_at: string;
  customers?: Customer;
};
