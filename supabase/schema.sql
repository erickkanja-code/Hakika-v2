-- HakikaSend database. Paste all of this into Supabase > SQL Editor > New query, then click Run.

create table if not exists payments (
  id uuid primary key,
  sender_email text not null,
  recipient_name text not null,
  recipient_contact text not null,
  amount numeric(20,7) not null,
  asset text not null default 'XLM',
  amount_kes_display integer not null,
  purpose text not null,
  proof_required text not null,
  deadline timestamptz not null,
  status text not null check (status in ('pending','failed','locked','proof_submitted','releasing','released','refunding','refunded')),
  sender_public_key text,
  recipient_public_key text,
  claimable_balance_id text,
  lock_tx_hash text,
  release_tx_hash text,
  refund_tx_hash text,
  sender_token text not null unique,
  recipient_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists proofs (
  id uuid primary key,
  payment_id uuid not null references payments(id) on delete cascade,
  file_url text not null,
  file_name text,
  mime text,
  note text,
  submitted_at timestamptz not null default now(),
  decision text check (decision in ('approved','rejected')),
  decision_reason text,
  decided_at timestamptz
);

create table if not exists events (
  id bigserial primary key,
  payment_id uuid not null references payments(id) on delete cascade,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists signups (
  id bigserial primary key,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  based_in text,
  family_area text,
  frequency text not null,
  purpose text not null,
  story text,
  created_at timestamptz not null default now()
);

create table if not exists rate_hits (
  id bigserial primary key,
  client text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_hits_lookup on rate_hits (client, action, created_at);
create index if not exists events_payment on events (payment_id, created_at);
create index if not exists proofs_payment on proofs (payment_id, submitted_at);

-- Lock every table. Only the server (service role key) can read or write.
alter table payments enable row level security;
alter table proofs enable row level security;
alter table events enable row level security;
alter table signups enable row level security;
alter table rate_hits enable row level security;

-- Private storage bucket for proof files, max 5 MB, photos and PDFs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
