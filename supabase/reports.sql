create table if not exists public.lei_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('member', 'problem')),
  username text,
  reason text not null,
  details text not null,
  contact text,
  page_url text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now(),
  constraint lei_reports_member_username check (report_type <> 'member' or username is not null)
);

create index if not exists lei_reports_created_at_idx on public.lei_reports (created_at desc);
create index if not exists lei_reports_status_idx on public.lei_reports (status);

alter table public.lei_reports enable row level security;
revoke all on public.lei_reports from anon, authenticated;
grant all on public.lei_reports to service_role;