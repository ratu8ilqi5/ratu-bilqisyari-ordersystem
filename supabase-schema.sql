-- Run this once in Supabase Dashboard > SQL Editor

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null,
  stock integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  name text not null,
  wa text not null,
  address text not null,
  payment_method text,
  items jsonb not null,
  total integer not null,
  status text not null default 'pending',
  proof_image text,
  created_at timestamptz default now()
);

-- If you already ran this schema before (table already exists), run this
-- one line separately in SQL Editor to add the new column:
-- alter table orders add column if not exists payment_method text;

create table if not exists payment_info (
  id int primary key default 1,
  bank_name text,
  bank_account text,
  bank_holder text,
  qris_image text
);
insert into payment_info (id) values (1) on conflict do nothing;

-- Row Level Security
alter table products enable row level security;
alter table orders enable row level security;
alter table payment_info enable row level security;

-- MVP policies: fully open to the anon/publishable key.
-- This is fine to start (no login system yet) but means anyone with the
-- publishable key could technically write data. Tighten later with
-- Supabase Auth once you add an admin login screen.
drop policy if exists "public all products" on products;
create policy "public all products" on products for all using (true) with check (true);

drop policy if exists "public all orders" on orders;
create policy "public all orders" on orders for all using (true) with check (true);

drop policy if exists "public all payment_info" on payment_info;
create policy "public all payment_info" on payment_info for all using (true) with check (true);

-- Realtime: lets the customer page & admin dashboard update live
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table orders;

-- Optional starter products, delete/edit freely from the admin dashboard
insert into products (name, price, stock) values
  ('Gamis Syar''i Basic', 185000, 15),
  ('Khimar Instan', 65000, 25),
  ('Bergo Rawis', 45000, 30);
