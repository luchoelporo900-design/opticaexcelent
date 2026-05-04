create table if not exists optica_users (
  id text primary key,
  full_name text not null,
  email text unique not null,
  password text not null,
  role text not null default 'vendedora',
  branch_id text,
  avatar_url text default '',
  created_at timestamptz default now()
);

alter table optica_users enable row level security;
create policy "allow all" on optica_users for all using (true) with check (true);