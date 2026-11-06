-- FlipFinder shared storage. Paste this whole file into Supabase > SQL Editor > Run.

create table if not exists public.finds (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null,
  brand          text,
  model          text,
  condition      text,
  photo          text,            -- small JPEG as a data URL (about 30-60 KB)
  purchase_price numeric,
  sell_price     numeric,
  fee_pct        numeric default 8,
  shipping       numeric default 5,
  profit         numeric,
  verdict        text,            -- green | orange | red
  price_source   text default 'manual'  -- ai | manual
);

alter table public.finds enable row level security;

-- Only signed-in users (you and your girlfriend share ONE login) can touch the data.
drop policy if exists "signed in users share finds" on public.finds;
create policy "signed in users share finds"
  on public.finds for all
  to authenticated
  using (true)
  with check (true);
