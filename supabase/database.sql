-- ============================================================
-- MedFamily - Patient Healthcare Management System
-- Extended Supabase PostgreSQL schema for:
-- - mobile-first family health vault
-- - doctor / hospital / caretaker consent access
-- - medicine ordering, chemist fulfilment, tracking, chat
-- - notifications and audit logging
--
-- This script is written to be re-runnable on an existing project.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$
begin
  create type public.app_role as enum (
    'patient_admin',
    'family_member',
    'caretaker',
    'doctor',
    'hospital',
    'chemist'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.access_request_status as enum (
    'pending',
    'approved',
    'rejected',
    'revoked',
    'expired'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.access_grant_status as enum (
    'active',
    'revoked',
    'expired'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum (
    'placed',
    'awaiting_chemist_approval',
    'accepted',
    'preparing',
    'packed',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_category as enum (
    'access_request',
    'access_update',
    'order_update',
    'chat_message',
    'reminder',
    'system'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.notification_category add value if not exists 'appointment';
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.notification_category add value if not exists 'health_alert';
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Utility functions
-- ------------------------------------------------------------
create or replace function public.generate_share_code()
returns text
language sql
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

create or replace function public.generate_consent_code()
returns text
language sql
as $$
  select lpad(((random() * 999999)::int)::text, 6, '0');
$$;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'MED-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Profiles and role-specific tables
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key,
  full_name text,
  phone text,
  email text,
  primary_role public.app_role not null default 'patient_admin',
  avatar_url text,
  address text,
  date_of_birth date,
  gender text,
  blood_group text,
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.doctor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  specialization text,
  clinic_name text,
  license_number text,
  address text,
  consultation_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.hospital_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  hospital_name text,
  department text,
  registration_number text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.caretaker_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  relation text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.chemist_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  store_name text,
  license_number text,
  address text,
  service_area text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Family core
-- ------------------------------------------------------------
create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  group_name text not null default 'My Family',
  share_code text not null unique default public.generate_share_code(),
  created_at timestamptz not null default now()
);

alter table public.family_groups
  add column if not exists share_code text;

alter table public.family_groups
  alter column group_name set default 'My Family';

alter table public.family_groups
  alter column share_code set default public.generate_share_code();

update public.family_groups
set share_code = public.generate_share_code()
where share_code is null or btrim(share_code) = '';

alter table public.family_groups
  alter column share_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'family_groups_share_code_key'
      and conrelid = 'public.family_groups'::regclass
  ) and not exists (
    select 1
    from pg_class
    where relname = 'family_groups_share_code_key'
      and relnamespace = 'public'::regnamespace
  ) then
    alter table public.family_groups
      add constraint family_groups_share_code_key unique (share_code);
  end if;
end $$;

create index if not exists idx_family_groups_admin on public.family_groups(admin_id);
create index if not exists idx_family_groups_share_code on public.family_groups(share_code);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups(id) on delete cascade,
  name text not null,
  relation text not null,
  date_of_birth date,
  phone text,
  blood_group text,
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.family_members
  add column if not exists blood_group text,
  add column if not exists allergies text[] not null default '{}',
  add column if not exists chronic_conditions text[] not null default '{}',
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists notes text;

create index if not exists idx_family_members_group on public.family_members(group_id);

-- ------------------------------------------------------------
-- Clinical content
-- ------------------------------------------------------------
create table if not exists public.patient_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text not null,
  record_type text not null,
  notes text,
  upload_date timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id)
);

create index if not exists idx_patient_records_member on public.patient_records(member_id);
create index if not exists idx_patient_records_uploaded_by on public.patient_records(uploaded_by);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  file_url text,
  doctor_name text,
  prescription_date date not null,
  medicines jsonb not null default '[]'::jsonb,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_prescriptions_member on public.prescriptions(member_id);

create table if not exists public.medicine_reminders (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid references public.prescriptions(id) on delete set null,
  member_id uuid not null references public.family_members(id) on delete cascade,
  medicine_name text not null,
  dosage text not null,
  frequency text not null,
  reminder_times text[] not null default '{}',
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_reminders_member on public.medicine_reminders(member_id);
create index if not exists idx_reminders_active on public.medicine_reminders(is_active);

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.medicine_reminders(id) on delete cascade,
  scheduled_time timestamptz not null,
  taken_at timestamptz,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  unique (reminder_id, scheduled_time)
);

create index if not exists idx_reminder_logs_reminder on public.reminder_logs(reminder_id);
create index if not exists idx_reminder_logs_date on public.reminder_logs(scheduled_time);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  title text not null,
  appointment_type text not null default 'consultation',
  provider_name text,
  provider_contact text,
  provider_role text,
  scheduled_for timestamptz not null,
  location text,
  mode text,
  notes text,
  status text not null default 'scheduled',
  follow_up_date date,
  diagnosis text,
  visit_summary text,
  advice_summary text,
  booked_by uuid not null references public.profiles(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_group on public.appointments(family_group_id);
create index if not exists idx_appointments_member on public.appointments(member_id);
create index if not exists idx_appointments_schedule on public.appointments(scheduled_for);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

create table if not exists public.vital_entries (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  metric_type text not null,
  value_primary text not null,
  value_secondary text,
  unit text,
  symptoms text[] not null default '{}',
  notes text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_vital_entries_group on public.vital_entries(family_group_id);
create index if not exists idx_vital_entries_member on public.vital_entries(member_id);
create index if not exists idx_vital_entries_recorded_at on public.vital_entries(recorded_at desc);

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_care_tasks_group on public.care_tasks(family_group_id);
create index if not exists idx_care_tasks_member on public.care_tasks(member_id);
create index if not exists idx_care_tasks_status on public.care_tasks(status);

-- ------------------------------------------------------------
-- Access control, approvals, audit
-- ------------------------------------------------------------
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requester_name text,
  requester_phone text,
  requester_organization text,
  target_group_id uuid not null references public.family_groups(id) on delete cascade,
  requester_role public.app_role not null,
  status public.access_request_status not null default 'pending',
  reason text,
  requested_scopes text[] not null default '{}',
  member_ids uuid[] not null default '{}',
  consent_code text not null default public.generate_consent_code(),
  expires_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_requests_group on public.access_requests(target_group_id);
create index if not exists idx_access_requests_requester on public.access_requests(requester_id);
create index if not exists idx_access_requests_status on public.access_requests(status);

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.access_requests(id) on delete set null,
  grantee_user_id uuid not null references public.profiles(id) on delete cascade,
  grantee_name text,
  target_group_id uuid not null references public.family_groups(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete cascade,
  grantee_role public.app_role not null,
  permission_scopes text[] not null default '{}',
  member_ids uuid[] not null default '{}',
  reason text,
  consultation_note text,
  status public.access_grant_status not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_grants_group on public.access_grants(target_group_id);
create index if not exists idx_access_grants_grantee on public.access_grants(grantee_user_id);
create index if not exists idx_access_grants_status on public.access_grants(status);

create table if not exists public.access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_group_id uuid references public.family_groups(id) on delete set null,
  member_id uuid references public.family_members(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_audit_logs_group on public.access_audit_logs(target_group_id);
create index if not exists idx_access_audit_logs_actor on public.access_audit_logs(actor_id);

-- ------------------------------------------------------------
-- Orders, tracking, chat
-- ------------------------------------------------------------
create table if not exists public.medicine_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  patient_member_id uuid references public.family_members(id) on delete set null,
  placed_by_user_id uuid not null references public.profiles(id) on delete cascade,
  placed_by_name text,
  placed_for_name text not null,
  placed_for_phone text,
  receiver_name text not null,
  receiver_phone text,
  delivery_address text not null,
  location_text text,
  map_link text,
  notes text,
  source_prescription_id uuid references public.prescriptions(id) on delete set null,
  uploaded_prescription_url text,
  chemist_id uuid references public.profiles(id) on delete set null,
  chemist_name text,
  status public.order_status not null default 'placed',
  total_items integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medicine_orders_group on public.medicine_orders(family_group_id);
create index if not exists idx_medicine_orders_member on public.medicine_orders(patient_member_id);
create index if not exists idx_medicine_orders_status on public.medicine_orders(status);
create index if not exists idx_medicine_orders_chemist on public.medicine_orders(chemist_id);

drop trigger if exists medicine_orders_set_updated_at on public.medicine_orders;
create trigger medicine_orders_set_updated_at
before update on public.medicine_orders
for each row
execute function public.set_updated_at();

create table if not exists public.medicine_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.medicine_orders(id) on delete cascade,
  medicine_name text not null,
  dosage text,
  quantity text,
  instructions text,
  source text not null default 'manual',
  is_substitute boolean not null default false,
  substitute_for text,
  created_at timestamptz not null default now()
);

create index if not exists idx_medicine_order_items_order on public.medicine_order_items(order_id);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.medicine_orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_status_history_order on public.order_status_history(order_id);

create table if not exists public.order_chat_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.medicine_orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_chat_messages_order on public.order_chat_messages(order_id);

-- ------------------------------------------------------------
-- Notifications
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  category public.notification_category not null,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(user_id, is_read);

-- ------------------------------------------------------------
-- Temporary demo auth credentials
-- ------------------------------------------------------------
create or replace function public.normalize_demo_phone(input_phone text)
returns text
language sql
immutable
as $$
  select case
    when input_phone is null or btrim(input_phone) = '' then null
    when left(regexp_replace(input_phone, '[^0-9+]', '', 'g'), 1) = '+' then regexp_replace(input_phone, '[^0-9+]', '', 'g')
    when length(regexp_replace(input_phone, '\D', '', 'g')) = 10 then '+91' || regexp_replace(input_phone, '\D', '', 'g')
    when length(regexp_replace(input_phone, '\D', '', 'g')) = 12 and regexp_replace(input_phone, '\D', '', 'g') like '91%' then '+' || regexp_replace(input_phone, '\D', '', 'g')
    else regexp_replace(input_phone, '[^0-9+]', '', 'g')
  end;
$$;

create table if not exists public.demo_auth_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  phone text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_auth_accounts_identifier_check check (email is not null or phone is not null)
);

drop trigger if exists demo_auth_accounts_set_updated_at on public.demo_auth_accounts;
create trigger demo_auth_accounts_set_updated_at
before update on public.demo_auth_accounts
for each row
execute function public.set_updated_at();

create unique index if not exists idx_demo_auth_accounts_email
on public.demo_auth_accounts (lower(email))
where email is not null;

create unique index if not exists idx_demo_auth_accounts_phone
on public.demo_auth_accounts (phone)
where phone is not null;

create or replace function public.register_demo_user(
  p_identifier text,
  p_password text,
  p_full_name text,
  p_primary_role public.app_role
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identifier text := btrim(coalesce(p_identifier, ''));
  v_email text := null;
  v_phone text := null;
  v_user_id uuid := gen_random_uuid();
  v_role public.app_role := coalesce(p_primary_role, 'patient_admin');
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_group_name text;
begin
  if length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  if position('@' in v_identifier) > 0 then
    v_email := lower(v_identifier);
  elsif v_identifier <> '' then
    v_phone := public.normalize_demo_phone(v_identifier);
  end if;

  if v_email is null and v_phone is null then
    raise exception 'Enter a valid email address or phone number';
  end if;

  if exists (
    select 1
    from public.demo_auth_accounts daa
    where (v_email is not null and lower(daa.email) = v_email)
       or (v_phone is not null and daa.phone = v_phone)
  ) then
    raise exception 'An account already exists with these details.';
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone,
    email,
    primary_role,
    onboarding_complete
  )
  values (
    v_user_id,
    v_name,
    v_phone,
    v_email,
    v_role,
    false
  );

  insert into public.demo_auth_accounts (
    user_id,
    email,
    phone,
    password_hash
  )
  values (
    v_user_id,
    v_email,
    v_phone,
    md5(p_password || ':' || v_user_id::text)
  );

  if v_role in ('patient_admin', 'family_member') then
    v_group_name := coalesce(nullif(split_part(coalesce(v_name, ''), ' ', 1), ''), 'My') || ' Family';
    insert into public.family_groups (admin_id, group_name)
    values (v_user_id, v_group_name);
  end if;

  return jsonb_build_object(
    'id', v_user_id,
    'email', v_email,
    'phone', v_phone,
    'full_name', v_name,
    'primary_role', v_role,
    'onboarding_complete', false
  );
end;
$$;

create or replace function public.login_demo_user(
  p_identifier text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identifier text := btrim(coalesce(p_identifier, ''));
  v_account public.demo_auth_accounts%rowtype;
  v_profile public.profiles%rowtype;
  v_normalized_phone text := public.normalize_demo_phone(v_identifier);
begin
  if position('@' in v_identifier) > 0 then
    select *
    into v_account
    from public.demo_auth_accounts
    where lower(email) = lower(v_identifier)
    limit 1;
  else
    select *
    into v_account
    from public.demo_auth_accounts
    where phone = v_normalized_phone
    limit 1;
  end if;

  if v_account.user_id is null or v_account.password_hash <> md5(p_password || ':' || v_account.user_id::text) then
    raise exception 'Invalid login credentials';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_account.user_id;

  return jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'full_name', v_profile.full_name,
    'primary_role', v_profile.primary_role,
    'onboarding_complete', v_profile.onboarding_complete
  );
end;
$$;

create or replace function public.sync_demo_auth_identity(
  p_user_id uuid,
  p_email text default null,
  p_phone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.demo_auth_accounts
  set
    email = case when nullif(btrim(coalesce(p_email, '')), '') is null then email else lower(btrim(p_email)) end,
    phone = case when nullif(btrim(coalesce(p_phone, '')), '') is null then phone else public.normalize_demo_phone(p_phone) end
  where user_id = p_user_id;
end;
$$;

grant execute on function public.register_demo_user(text, text, text, public.app_role) to anon, authenticated;
grant execute on function public.login_demo_user(text, text) to anon, authenticated;
grant execute on function public.sync_demo_auth_identity(uuid, text, text) to anon, authenticated;

alter table public.demo_auth_accounts enable row level security;

-- ------------------------------------------------------------
-- Bootstrap auth users into profiles/family groups
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_role public.app_role;
  group_name text;
begin
  derived_role := coalesce((new.raw_user_meta_data ->> 'primary_role')::public.app_role, 'patient_admin');

  insert into public.profiles (
    id,
    full_name,
    phone,
    email,
    primary_role,
    onboarding_complete
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone,
    new.email,
    derived_role,
    false
  )
  on conflict (id) do update
  set
    phone = excluded.phone,
    email = coalesce(excluded.email, public.profiles.email),
    primary_role = public.profiles.primary_role;

  if derived_role in ('patient_admin', 'family_member') then
    group_name := coalesce(nullif(new.raw_user_meta_data ->> 'group_name', ''), 'My Family');
    insert into public.family_groups (admin_id, group_name)
    select new.id, group_name
    where not exists (
      select 1 from public.family_groups fg where fg.admin_id = new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Align foreign keys with demo auth user model
-- ------------------------------------------------------------
with referenced_users as (
  select admin_id as user_id, 'patient_admin'::public.app_role as inferred_role from public.family_groups
  union
  select uploaded_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.patient_records
  union
  select uploaded_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.prescriptions
  union
  select requester_id as user_id, requester_role::public.app_role as inferred_role from public.access_requests
  union
  select reviewed_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.access_requests where reviewed_by is not null
  union
  select grantee_user_id as user_id, grantee_role::public.app_role as inferred_role from public.access_grants
  union
  select granted_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.access_grants
  union
  select revoked_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.access_grants where revoked_by is not null
  union
  select actor_id as user_id, 'patient_admin'::public.app_role as inferred_role from public.access_audit_logs where actor_id is not null
  union
  select placed_by_user_id as user_id, 'patient_admin'::public.app_role as inferred_role from public.medicine_orders
  union
  select chemist_id as user_id, 'chemist'::public.app_role as inferred_role from public.medicine_orders where chemist_id is not null
  union
  select changed_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.order_status_history where changed_by is not null
  union
  select sender_id as user_id, 'patient_admin'::public.app_role as inferred_role from public.order_chat_messages
  union
  select user_id as user_id, 'patient_admin'::public.app_role as inferred_role from public.notifications
  union
  select booked_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.appointments
  union
  select updated_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.appointments where updated_by is not null
  union
  select recorded_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.vital_entries where recorded_by is not null
  union
  select assigned_to_user_id as user_id, 'caretaker'::public.app_role as inferred_role from public.care_tasks where assigned_to_user_id is not null
  union
  select created_by as user_id, 'patient_admin'::public.app_role as inferred_role from public.care_tasks where created_by is not null
),
deduped_users as (
  select distinct on (user_id)
    user_id,
    inferred_role
  from referenced_users
  where user_id is not null
  order by user_id
)
insert into public.profiles (
  id,
  full_name,
  phone,
  email,
  primary_role,
  onboarding_complete
)
select
  du.user_id,
  coalesce(
    nullif(au.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(au.email, au.phone, ''), '@', 1), ''),
    'MedFamily User'
  ) as full_name,
  public.normalize_demo_phone(au.phone),
  lower(au.email),
  du.inferred_role,
  false
from deduped_users du
left join auth.users au on au.id = du.user_id
left join public.profiles p on p.id = du.user_id
where p.id is null
on conflict (id) do nothing;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.family_groups
  drop constraint if exists family_groups_admin_id_fkey;
alter table public.family_groups
  add constraint family_groups_admin_id_fkey
  foreign key (admin_id) references public.profiles(id) on delete cascade;

alter table public.patient_records
  drop constraint if exists patient_records_uploaded_by_fkey;
alter table public.patient_records
  add constraint patient_records_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(id);

alter table public.prescriptions
  drop constraint if exists prescriptions_uploaded_by_fkey;
alter table public.prescriptions
  add constraint prescriptions_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(id);

alter table public.access_requests
  drop constraint if exists access_requests_requester_id_fkey;
alter table public.access_requests
  add constraint access_requests_requester_id_fkey
  foreign key (requester_id) references public.profiles(id) on delete cascade;

alter table public.access_requests
  drop constraint if exists access_requests_reviewed_by_fkey;
alter table public.access_requests
  add constraint access_requests_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

alter table public.access_grants
  drop constraint if exists access_grants_grantee_user_id_fkey;
alter table public.access_grants
  add constraint access_grants_grantee_user_id_fkey
  foreign key (grantee_user_id) references public.profiles(id) on delete cascade;

alter table public.access_grants
  drop constraint if exists access_grants_granted_by_fkey;
alter table public.access_grants
  add constraint access_grants_granted_by_fkey
  foreign key (granted_by) references public.profiles(id) on delete cascade;

alter table public.access_grants
  drop constraint if exists access_grants_revoked_by_fkey;
alter table public.access_grants
  add constraint access_grants_revoked_by_fkey
  foreign key (revoked_by) references public.profiles(id) on delete set null;

alter table public.access_audit_logs
  drop constraint if exists access_audit_logs_actor_id_fkey;
alter table public.access_audit_logs
  add constraint access_audit_logs_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.medicine_orders
  drop constraint if exists medicine_orders_placed_by_user_id_fkey;
alter table public.medicine_orders
  add constraint medicine_orders_placed_by_user_id_fkey
  foreign key (placed_by_user_id) references public.profiles(id) on delete cascade;

alter table public.medicine_orders
  drop constraint if exists medicine_orders_chemist_id_fkey;
alter table public.medicine_orders
  add constraint medicine_orders_chemist_id_fkey
  foreign key (chemist_id) references public.profiles(id) on delete set null;

alter table public.order_status_history
  drop constraint if exists order_status_history_changed_by_fkey;
alter table public.order_status_history
  add constraint order_status_history_changed_by_fkey
  foreign key (changed_by) references public.profiles(id) on delete set null;

alter table public.order_chat_messages
  drop constraint if exists order_chat_messages_sender_id_fkey;
alter table public.order_chat_messages
  add constraint order_chat_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_user_id_fkey;
alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.appointments
  drop constraint if exists appointments_booked_by_fkey;
alter table public.appointments
  add constraint appointments_booked_by_fkey
  foreign key (booked_by) references public.profiles(id) on delete cascade;

alter table public.appointments
  drop constraint if exists appointments_updated_by_fkey;
alter table public.appointments
  add constraint appointments_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.vital_entries
  drop constraint if exists vital_entries_recorded_by_fkey;
alter table public.vital_entries
  add constraint vital_entries_recorded_by_fkey
  foreign key (recorded_by) references public.profiles(id) on delete set null;

alter table public.care_tasks
  drop constraint if exists care_tasks_assigned_to_user_id_fkey;
alter table public.care_tasks
  add constraint care_tasks_assigned_to_user_id_fkey
  foreign key (assigned_to_user_id) references public.profiles(id) on delete set null;

alter table public.care_tasks
  drop constraint if exists care_tasks_created_by_fkey;
alter table public.care_tasks
  add constraint care_tasks_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- ------------------------------------------------------------
-- Prescription -> reminder sync
-- ------------------------------------------------------------
create or replace function public.sync_reminders_from_prescription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  med jsonb;
  reminder_times text[];
begin
  delete from public.medicine_reminders
  where prescription_id = new.id;

  for med in select * from jsonb_array_elements(coalesce(new.medicines, '[]'::jsonb))
  loop
    reminder_times := array(
      select jsonb_array_elements_text(coalesce(med -> 'reminder_times', '[]'::jsonb))
    );

    insert into public.medicine_reminders (
      prescription_id,
      member_id,
      medicine_name,
      dosage,
      frequency,
      reminder_times,
      start_date,
      end_date,
      is_active
    )
    values (
      new.id,
      new.member_id,
      coalesce(med ->> 'name', 'Medicine'),
      coalesce(med ->> 'dosage', '-'),
      coalesce(med ->> 'frequency', 'Once daily'),
      coalesce(reminder_times, '{}'),
      coalesce((med ->> 'start_date')::date, new.prescription_date),
      coalesce((med ->> 'end_date')::date, new.prescription_date),
      true
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists prescriptions_sync_reminders on public.prescriptions;
create trigger prescriptions_sync_reminders
after insert or update of medicines, prescription_date on public.prescriptions
for each row
execute function public.sync_reminders_from_prescription();

-- ------------------------------------------------------------
-- Order history trigger
-- ------------------------------------------------------------
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, status, changed_by, note)
    values (new.id, new.status, new.placed_by_user_id, 'Order created');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by, note)
    values (new.id, new.status, auth.uid(), null);
  end if;

  return new;
end;
$$;

drop trigger if exists medicine_orders_status_history on public.medicine_orders;
create trigger medicine_orders_status_history
after insert or update on public.medicine_orders
for each row
execute function public.log_order_status_change();

-- ------------------------------------------------------------
-- Access helpers for policies
-- ------------------------------------------------------------
create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
stable
as $$
  select primary_role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.owns_group(group_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.family_groups
    where id = group_uuid
      and admin_id = auth.uid()
  );
$$;

create or replace function public.user_group_id()
returns uuid
language sql
security definer
stable
as $$
  select id
  from public.family_groups
  where admin_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_active_access_to_group(group_uuid uuid, required_scope text default null)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.access_grants ag
    where ag.grantee_user_id = auth.uid()
      and ag.target_group_id = group_uuid
      and ag.status = 'active'
      and (ag.expires_at is null or ag.expires_at > now())
      and (
        required_scope is null
        or cardinality(ag.permission_scopes) = 0
        or required_scope = any(ag.permission_scopes)
      )
  );
$$;

create or replace function public.can_access_member(member_uuid uuid, required_scope text default null)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.family_members fm
    join public.family_groups fg on fg.id = fm.group_id
    where fm.id = member_uuid
      and (
        fg.admin_id = auth.uid()
        or exists (
          select 1
          from public.access_grants ag
          where ag.grantee_user_id = auth.uid()
            and ag.target_group_id = fg.id
            and ag.status = 'active'
            and (ag.expires_at is null or ag.expires_at > now())
            and (
              cardinality(ag.member_ids) = 0
              or member_uuid = any(ag.member_ids)
            )
            and (
              required_scope is null
              or cardinality(ag.permission_scopes) = 0
              or required_scope = any(ag.permission_scopes)
            )
        )
      )
  );
$$;

create or replace function public.can_access_order(order_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.medicine_orders mo
    where mo.id = order_uuid
      and (
        mo.placed_by_user_id = auth.uid()
        or public.owns_group(mo.family_group_id)
        or public.has_active_access_to_group(mo.family_group_id, 'medicine_ordering')
        or mo.chemist_id = auth.uid()
        or (
          public.current_user_role() = 'chemist'
          and mo.chemist_id is null
          and mo.status in ('placed', 'awaiting_chemist_approval')
        )
      )
  );
$$;

-- ------------------------------------------------------------
-- Buckets
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('patient-records', 'patient-records', false),
  ('prescriptions', 'prescriptions', false),
  ('order-prescriptions', 'order-prescriptions', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- RLS enablement
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.doctor_profiles enable row level security;
alter table public.hospital_profiles enable row level security;
alter table public.caretaker_profiles enable row level security;
alter table public.chemist_profiles enable row level security;
alter table public.family_groups enable row level security;
alter table public.family_members enable row level security;
alter table public.patient_records enable row level security;
alter table public.prescriptions enable row level security;
alter table public.medicine_reminders enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.access_requests enable row level security;
alter table public.access_grants enable row level security;
alter table public.access_audit_logs enable row level security;
alter table public.medicine_orders enable row level security;
alter table public.medicine_order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_chat_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.appointments enable row level security;
alter table public.vital_entries enable row level security;
alter table public.care_tasks enable row level security;

-- ------------------------------------------------------------
-- Policies: profiles
-- ------------------------------------------------------------
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "Profiles can be inserted by owner" on public.profiles;
create policy "Profiles can be inserted by owner"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "Profiles can be updated by owner" on public.profiles;
create policy "Profiles can be updated by owner"
on public.profiles for update
using (id = auth.uid());

drop policy if exists "Doctor profiles own row" on public.doctor_profiles;
create policy "Doctor profiles own row"
on public.doctor_profiles for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Hospital profiles own row" on public.hospital_profiles;
create policy "Hospital profiles own row"
on public.hospital_profiles for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Caretaker profiles own row" on public.caretaker_profiles;
create policy "Caretaker profiles own row"
on public.caretaker_profiles for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Chemist profiles own row" on public.chemist_profiles;
create policy "Chemist profiles own row"
on public.chemist_profiles for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Policies: family data
-- ------------------------------------------------------------
drop policy if exists "Family groups visible to owners or grantees" on public.family_groups;
create policy "Family groups visible to owners or grantees"
on public.family_groups for select
using (
  admin_id = auth.uid()
  or public.has_active_access_to_group(id, null)
);

drop policy if exists "Family groups can be created by admin" on public.family_groups;
create policy "Family groups can be created by admin"
on public.family_groups for insert
with check (admin_id = auth.uid());

drop policy if exists "Family groups can be updated by admin" on public.family_groups;
create policy "Family groups can be updated by admin"
on public.family_groups for update
using (admin_id = auth.uid());

drop policy if exists "Family members visible via grants" on public.family_members;
create policy "Family members visible via grants"
on public.family_members for select
using (public.can_access_member(id, null));

drop policy if exists "Family members manageable by admin" on public.family_members;
create policy "Family members manageable by admin"
on public.family_members for insert
with check (public.owns_group(group_id));

drop policy if exists "Family members updatable by admin" on public.family_members;
create policy "Family members updatable by admin"
on public.family_members for update
using (public.owns_group(group_id));

drop policy if exists "Family members deletable by admin" on public.family_members;
create policy "Family members deletable by admin"
on public.family_members for delete
using (public.owns_group(group_id));

-- ------------------------------------------------------------
-- Policies: records, prescriptions, reminders
-- ------------------------------------------------------------
drop policy if exists "Records visible through scope" on public.patient_records;
create policy "Records visible through scope"
on public.patient_records for select
using (public.can_access_member(member_id, 'records'));

drop policy if exists "Records insert by owner" on public.patient_records;
create policy "Records insert by owner"
on public.patient_records for insert
with check (
  uploaded_by = auth.uid()
  and public.owns_group((select group_id from public.family_members where id = member_id))
);

drop policy if exists "Records delete by owner" on public.patient_records;
create policy "Records delete by owner"
on public.patient_records for delete
using (
  uploaded_by = auth.uid()
  or public.owns_group((select group_id from public.family_members where id = member_id))
);

drop policy if exists "Prescriptions visible through scope" on public.prescriptions;
create policy "Prescriptions visible through scope"
on public.prescriptions for select
using (public.can_access_member(member_id, 'prescriptions'));

drop policy if exists "Prescriptions insert by owner" on public.prescriptions;
create policy "Prescriptions insert by owner"
on public.prescriptions for insert
with check (
  uploaded_by = auth.uid()
  and public.owns_group((select group_id from public.family_members where id = member_id))
);

drop policy if exists "Prescriptions delete by owner" on public.prescriptions;
create policy "Prescriptions delete by owner"
on public.prescriptions for delete
using (
  uploaded_by = auth.uid()
  or public.owns_group((select group_id from public.family_members where id = member_id))
);

drop policy if exists "Reminders visible through scope" on public.medicine_reminders;
create policy "Reminders visible through scope"
on public.medicine_reminders for select
using (
  public.can_access_member(member_id, 'reminders')
  or public.can_access_member(member_id, 'reminders_management')
);

drop policy if exists "Reminders create by owner or caretaker" on public.medicine_reminders;
create policy "Reminders create by owner or caretaker"
on public.medicine_reminders for insert
with check (
  public.owns_group((select group_id from public.family_members where id = member_id))
  or public.can_access_member(member_id, 'reminders_management')
);

drop policy if exists "Reminders update by owner or caretaker" on public.medicine_reminders;
create policy "Reminders update by owner or caretaker"
on public.medicine_reminders for update
using (
  public.owns_group((select group_id from public.family_members where id = member_id))
  or public.can_access_member(member_id, 'reminders_management')
);

drop policy if exists "Reminder logs visible through reminder access" on public.reminder_logs;
create policy "Reminder logs visible through reminder access"
on public.reminder_logs for select
using (
  exists (
    select 1
    from public.medicine_reminders mr
    where mr.id = reminder_id
      and (
        public.can_access_member(mr.member_id, 'reminders')
        or public.can_access_member(mr.member_id, 'reminders_management')
      )
  )
);

drop policy if exists "Reminder logs write by owner or caretaker" on public.reminder_logs;
create policy "Reminder logs write by owner or caretaker"
on public.reminder_logs for insert
with check (
  exists (
    select 1
    from public.medicine_reminders mr
    where mr.id = reminder_id
      and (
        public.owns_group((select group_id from public.family_members where id = mr.member_id))
        or public.can_access_member(mr.member_id, 'reminders_management')
      )
  )
);

drop policy if exists "Reminder logs update by owner or caretaker" on public.reminder_logs;
create policy "Reminder logs update by owner or caretaker"
on public.reminder_logs for update
using (
  exists (
    select 1
    from public.medicine_reminders mr
    where mr.id = reminder_id
      and (
        public.owns_group((select group_id from public.family_members where id = mr.member_id))
        or public.can_access_member(mr.member_id, 'reminders_management')
      )
  )
);

-- ------------------------------------------------------------
-- Policies: appointments, vitals, care tasks
-- ------------------------------------------------------------
drop policy if exists "Appointments visible through summary access" on public.appointments;
create policy "Appointments visible through summary access"
on public.appointments for select
using (public.can_access_member(member_id, 'summary'));

drop policy if exists "Appointments insert by owner or caretaker" on public.appointments;
create policy "Appointments insert by owner or caretaker"
on public.appointments for insert
with check (
  booked_by = auth.uid()
  and (
    public.owns_group(family_group_id)
    or public.has_active_access_to_group(family_group_id, 'summary')
  )
);

drop policy if exists "Appointments update by participants" on public.appointments;
create policy "Appointments update by participants"
on public.appointments for update
using (
  booked_by = auth.uid()
  or updated_by = auth.uid()
  or public.owns_group(family_group_id)
  or public.has_active_access_to_group(family_group_id, 'summary')
);

drop policy if exists "Vitals visible through summary access" on public.vital_entries;
create policy "Vitals visible through summary access"
on public.vital_entries for select
using (public.can_access_member(member_id, 'summary'));

drop policy if exists "Vitals insert by care workspace" on public.vital_entries;
create policy "Vitals insert by care workspace"
on public.vital_entries for insert
with check (
  recorded_by = auth.uid()
  and (
    public.owns_group(family_group_id)
    or public.has_active_access_to_group(family_group_id, 'summary')
  )
);

drop policy if exists "Care tasks visible through summary access" on public.care_tasks;
create policy "Care tasks visible through summary access"
on public.care_tasks for select
using (public.can_access_member(member_id, 'summary'));

drop policy if exists "Care tasks insert by care workspace" on public.care_tasks;
create policy "Care tasks insert by care workspace"
on public.care_tasks for insert
with check (
  created_by = auth.uid()
  and (
    public.owns_group(family_group_id)
    or public.has_active_access_to_group(family_group_id, 'summary')
  )
);

drop policy if exists "Care tasks update by care workspace" on public.care_tasks;
create policy "Care tasks update by care workspace"
on public.care_tasks for update
using (
  created_by = auth.uid()
  or assigned_to_user_id = auth.uid()
  or public.owns_group(family_group_id)
  or public.has_active_access_to_group(family_group_id, 'summary')
);

-- ------------------------------------------------------------
-- Policies: access requests, grants, audit
-- ------------------------------------------------------------
drop policy if exists "Access requests visible to requester and group owner" on public.access_requests;
create policy "Access requests visible to requester and group owner"
on public.access_requests for select
using (
  requester_id = auth.uid()
  or public.owns_group(target_group_id)
);

drop policy if exists "Access requests insert by requester" on public.access_requests;
create policy "Access requests insert by requester"
on public.access_requests for insert
with check (
  requester_id = auth.uid()
  and requester_role in ('doctor', 'hospital', 'caretaker')
);

drop policy if exists "Access requests update by group owner or requester" on public.access_requests;
create policy "Access requests update by group owner or requester"
on public.access_requests for update
using (
  requester_id = auth.uid()
  or public.owns_group(target_group_id)
);

drop policy if exists "Access grants visible to grantee and group owner" on public.access_grants;
create policy "Access grants visible to grantee and group owner"
on public.access_grants for select
using (
  grantee_user_id = auth.uid()
  or public.owns_group(target_group_id)
);

drop policy if exists "Access grants insert by group owner" on public.access_grants;
create policy "Access grants insert by group owner"
on public.access_grants for insert
with check (public.owns_group(target_group_id));

drop policy if exists "Access grants update by group owner" on public.access_grants;
create policy "Access grants update by group owner"
on public.access_grants for update
using (public.owns_group(target_group_id));

drop policy if exists "Audit logs visible to owners and actors" on public.access_audit_logs;
create policy "Audit logs visible to owners and actors"
on public.access_audit_logs for select
using (
  actor_id = auth.uid()
  or (target_group_id is not null and public.owns_group(target_group_id))
);

drop policy if exists "Audit logs insert by authenticated users" on public.access_audit_logs;
create policy "Audit logs insert by authenticated users"
on public.access_audit_logs for insert
with check (auth.uid() is not null);

-- ------------------------------------------------------------
-- Policies: orders, items, history, chat
-- ------------------------------------------------------------
drop policy if exists "Orders visible to participants" on public.medicine_orders;
create policy "Orders visible to participants"
on public.medicine_orders for select
using (public.can_access_order(id));

drop policy if exists "Orders insert by owners or caretakers" on public.medicine_orders;
create policy "Orders insert by owners or caretakers"
on public.medicine_orders for insert
with check (
  placed_by_user_id = auth.uid()
  and (
    public.owns_group(family_group_id)
    or public.has_active_access_to_group(family_group_id, 'medicine_ordering')
  )
);

drop policy if exists "Orders update by owner or chemist" on public.medicine_orders;
create policy "Orders update by owner or chemist"
on public.medicine_orders for update
using (
  placed_by_user_id = auth.uid()
  or public.owns_group(family_group_id)
  or chemist_id = auth.uid()
  or (
    public.current_user_role() = 'chemist'
    and chemist_id is null
    and status in ('placed', 'awaiting_chemist_approval')
  )
);

drop policy if exists "Order items follow parent order visibility" on public.medicine_order_items;
create policy "Order items follow parent order visibility"
on public.medicine_order_items for select
using (public.can_access_order(order_id));

drop policy if exists "Order items write via parent order access" on public.medicine_order_items;
create policy "Order items write via parent order access"
on public.medicine_order_items for insert
with check (public.can_access_order(order_id));

drop policy if exists "Order history visible to participants" on public.order_status_history;
create policy "Order history visible to participants"
on public.order_status_history for select
using (public.can_access_order(order_id));

drop policy if exists "Order history write by participants" on public.order_status_history;
create policy "Order history write by participants"
on public.order_status_history for insert
with check (public.can_access_order(order_id));

drop policy if exists "Order chat visible to participants" on public.order_chat_messages;
create policy "Order chat visible to participants"
on public.order_chat_messages for select
using (public.can_access_order(order_id));

drop policy if exists "Order chat insert by participants" on public.order_chat_messages;
create policy "Order chat insert by participants"
on public.order_chat_messages for insert
with check (
  sender_id = auth.uid()
  and public.can_access_order(order_id)
);

-- ------------------------------------------------------------
-- Policies: notifications
-- ------------------------------------------------------------
drop policy if exists "Notifications visible to owner" on public.notifications;
create policy "Notifications visible to owner"
on public.notifications for select
using (user_id = auth.uid());

drop policy if exists "Notifications insert by authenticated users" on public.notifications;
create policy "Notifications insert by authenticated users"
on public.notifications for insert
with check (auth.uid() is not null);

drop policy if exists "Notifications update by owner" on public.notifications;
create policy "Notifications update by owner"
on public.notifications for update
using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Storage policies
-- ------------------------------------------------------------
drop policy if exists "Medical storage readable to authenticated users" on storage.objects;
create policy "Medical storage readable to authenticated users"
on storage.objects for select
using (
  bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions')
  and auth.role() = 'authenticated'
);

drop policy if exists "Medical storage upload to own prefix" on storage.objects;
create policy "Medical storage upload to own prefix"
on storage.objects for insert
with check (
  bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions')
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Medical storage update own prefix" on storage.objects;
create policy "Medical storage update own prefix"
on storage.objects for update
using (
  bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions')
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Medical storage delete own prefix" on storage.objects;
create policy "Medical storage delete own prefix"
on storage.objects for delete
using (
  bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions')
  and split_part(name, '/', 1) = auth.uid()::text
);

-- ------------------------------------------------------------
-- Temporary demo mode access
-- This keeps the app functional without Supabase Auth while
-- MedFamily uses custom DB-backed login/register for demos.
-- ------------------------------------------------------------
alter table public.profiles disable row level security;
alter table public.doctor_profiles disable row level security;
alter table public.hospital_profiles disable row level security;
alter table public.caretaker_profiles disable row level security;
alter table public.chemist_profiles disable row level security;
alter table public.family_groups disable row level security;
alter table public.family_members disable row level security;
alter table public.patient_records disable row level security;
alter table public.prescriptions disable row level security;
alter table public.medicine_reminders disable row level security;
alter table public.reminder_logs disable row level security;
alter table public.access_requests disable row level security;
alter table public.access_grants disable row level security;
alter table public.access_audit_logs disable row level security;
alter table public.medicine_orders disable row level security;
alter table public.medicine_order_items disable row level security;
alter table public.order_status_history disable row level security;
alter table public.order_chat_messages disable row level security;
alter table public.notifications disable row level security;
alter table public.appointments disable row level security;
alter table public.vital_entries disable row level security;
alter table public.care_tasks disable row level security;

update storage.buckets
set public = true
where id in ('patient-records', 'prescriptions', 'order-prescriptions');

drop policy if exists "Demo storage public read" on storage.objects;
create policy "Demo storage public read"
on storage.objects for select
using (bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions'));

drop policy if exists "Demo storage public insert" on storage.objects;
create policy "Demo storage public insert"
on storage.objects for insert
with check (bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions'));

drop policy if exists "Demo storage public update" on storage.objects;
create policy "Demo storage public update"
on storage.objects for update
using (bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions'));

drop policy if exists "Demo storage public delete" on storage.objects;
create policy "Demo storage public delete"
on storage.objects for delete
using (bucket_id in ('patient-records', 'prescriptions', 'order-prescriptions'));

-- ------------------------------------------------------------
-- Demo seed accounts and sample workspace
-- ------------------------------------------------------------
insert into public.profiles (
  id,
  full_name,
  phone,
  email,
  primary_role,
  address,
  blood_group,
  allergies,
  chronic_conditions,
  emergency_contact_name,
  emergency_contact_phone,
  onboarding_complete
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Rahul Sharma',
    '+919900000001',
    'familyadmin@medfamily.demo',
    'patient_admin',
    '24 Green Avenue, Pune',
    'B+',
    array['Penicillin'],
    array['Type 2 Diabetes'],
    'Neha Sharma',
    '+919922334455',
    true
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Dr. Arjun Mehta',
    '+919900000002',
    'doctor@medfamily.demo',
    'doctor',
    'Mehta Family Clinic, Pune',
    null,
    '{}',
    '{}',
    null,
    null,
    true
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Sunrise Care Hospital',
    '+919900000003',
    'hospital@medfamily.demo',
    'hospital',
    'Sunrise Care Hospital, Baner, Pune',
    null,
    '{}',
    '{}',
    null,
    null,
    true
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Anita Joshi',
    '+919900000004',
    'caretaker@medfamily.demo',
    'caretaker',
    'Support Care Services, Pune',
    null,
    '{}',
    '{}',
    null,
    null,
    true
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'QuickMeds Chemist',
    '+919900000005',
    'chemist@gmail.com',
    'chemist',
    'QuickMeds Pharmacy, Kothrud, Pune',
    null,
    '{}',
    '{}',
    null,
    null,
    true
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Aanya Khanna',
    '+919900000006',
    'patient@medfamily.demo',
    'patient_admin',
    '18 Lake View Society, Pune',
    'O+',
    '{}',
    '{}',
    'Rohit Khanna',
    '+919933221100',
    true
  )
on conflict (id) do update
set
  full_name = excluded.full_name,
  phone = excluded.phone,
  email = excluded.email,
  primary_role = excluded.primary_role,
  address = excluded.address,
  blood_group = excluded.blood_group,
  allergies = excluded.allergies,
  chronic_conditions = excluded.chronic_conditions,
  emergency_contact_name = excluded.emergency_contact_name,
  emergency_contact_phone = excluded.emergency_contact_phone,
  onboarding_complete = true;

insert into public.demo_auth_accounts (user_id, email, phone, password_hash)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'familyadmin@medfamily.demo',
    '+919900000001',
    md5('family123' || ':' || '11111111-1111-4111-8111-111111111111')
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'doctor@medfamily.demo',
    '+919900000002',
    md5('doctor123' || ':' || '22222222-2222-4222-8222-222222222222')
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'hospital@medfamily.demo',
    '+919900000003',
    md5('hospital123' || ':' || '33333333-3333-4333-8333-333333333333')
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'caretaker@medfamily.demo',
    '+919900000004',
    md5('caretaker123' || ':' || '44444444-4444-4444-8444-444444444444')
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'chemist@gmail.com',
    '+919900000005',
    md5('chemist123' || ':' || '55555555-5555-4555-8555-555555555555')
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'patient@medfamily.demo',
    '+919900000006',
    md5('patient123' || ':' || '66666666-6666-4666-8666-666666666666')
  )
on conflict (user_id) do update
set
  email = excluded.email,
  phone = excluded.phone,
  password_hash = excluded.password_hash;

insert into public.doctor_profiles (user_id, specialization, clinic_name, license_number, address, consultation_note)
values (
  '22222222-2222-4222-8222-222222222222',
  'Internal Medicine',
  'Mehta Family Clinic',
  'DOC-MH-1021',
  'Baner, Pune',
  'Focuses on chronic care, diabetes follow-up, and family medicine.'
)
on conflict (user_id) do update
set
  specialization = excluded.specialization,
  clinic_name = excluded.clinic_name,
  license_number = excluded.license_number,
  address = excluded.address,
  consultation_note = excluded.consultation_note;

insert into public.hospital_profiles (user_id, hospital_name, department, registration_number, address)
values (
  '33333333-3333-4333-8333-333333333333',
  'Sunrise Care Hospital',
  'General Medicine',
  'HSP-4452',
  'Baner, Pune'
)
on conflict (user_id) do update
set
  hospital_name = excluded.hospital_name,
  department = excluded.department,
  registration_number = excluded.registration_number,
  address = excluded.address;

insert into public.caretaker_profiles (user_id, relation, address)
values (
  '44444444-4444-4444-8444-444444444444',
  'Professional caretaker',
  'Support Care Services, Pune'
)
on conflict (user_id) do update
set
  relation = excluded.relation,
  address = excluded.address;

insert into public.chemist_profiles (user_id, store_name, license_number, address, service_area)
values (
  '55555555-5555-4555-8555-555555555555',
  'QuickMeds Chemist',
  'PH-7781',
  'Kothrud, Pune',
  'Kothrud, Baner, Aundh, Pashan'
)
on conflict (user_id) do update
set
  store_name = excluded.store_name,
  license_number = excluded.license_number,
  address = excluded.address,
  service_area = excluded.service_area;

insert into public.family_groups (id, admin_id, group_name, share_code)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', '11111111-1111-4111-8111-111111111111', 'Sharma Family', 'SHARMA01'),
  ('a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', '66666666-6666-4666-8666-666666666666', 'Khanna Household', 'KHANNA02')
on conflict (id) do update
set
  admin_id = excluded.admin_id,
  group_name = excluded.group_name,
  share_code = excluded.share_code;

insert into public.family_members (
  id,
  group_id,
  name,
  relation,
  date_of_birth,
  phone,
  blood_group,
  allergies,
  chronic_conditions,
  emergency_contact_name,
  emergency_contact_phone,
  notes
)
values
  (
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'Rahul Sharma',
    'Self',
    '1992-06-14',
    '+919900000001',
    'B+',
    array['Penicillin'],
    array['Type 2 Diabetes'],
    'Neha Sharma',
    '+919922334455',
    'Needs regular glucose tracking and monthly medicine refill.'
  ),
  (
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'Sushma Sharma',
    'Mother',
    '1960-11-02',
    '+919944556677',
    'O+',
    array['Sulfa drugs'],
    array['Hypertension', 'Arthritis'],
    'Rahul Sharma',
    '+919900000001',
    'Uses walking support on long clinic days and needs BP follow-ups.'
  ),
  (
    'b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3',
    'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
    'Aanya Khanna',
    'Self',
    '1998-02-21',
    '+919900000006',
    'O+',
    array[]::text[],
    array['Migraine'],
    'Rohit Khanna',
    '+919933221100',
    'Sample family-member account for UI walkthroughs.'
  )
on conflict (id) do update
set
  group_id = excluded.group_id,
  name = excluded.name,
  relation = excluded.relation,
  date_of_birth = excluded.date_of_birth,
  phone = excluded.phone,
  blood_group = excluded.blood_group,
  allergies = excluded.allergies,
  chronic_conditions = excluded.chronic_conditions,
  emergency_contact_name = excluded.emergency_contact_name,
  emergency_contact_phone = excluded.emergency_contact_phone,
  notes = excluded.notes;

insert into public.patient_records (
  id,
  member_id,
  file_url,
  file_name,
  file_type,
  record_type,
  notes,
  upload_date,
  uploaded_by
)
values
  (
    'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    '/demo/lab-report.svg',
    'cbc-lab-report.svg',
    'image/svg+xml',
    'Lab Report',
    'Routine diabetes and HbA1c review uploaded for doctor access.',
    '2026-03-06T09:00:00+05:30',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    '/demo/chest-scan.svg',
    'joint-mobility-follow-up.svg',
    'image/svg+xml',
    'Other',
    'Physiotherapy and mobility follow-up summary for arthritis management.',
    '2026-03-10T12:15:00+05:30',
    '11111111-1111-4111-8111-111111111111'
  )
on conflict (id) do update
set
  member_id = excluded.member_id,
  file_url = excluded.file_url,
  file_name = excluded.file_name,
  file_type = excluded.file_type,
  record_type = excluded.record_type,
  notes = excluded.notes,
  upload_date = excluded.upload_date,
  uploaded_by = excluded.uploaded_by;

insert into public.prescriptions (
  id,
  member_id,
  file_url,
  doctor_name,
  prescription_date,
  medicines,
  uploaded_by,
  created_at
)
values
  (
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    '/demo/prescription-note.svg',
    'Dr. Arjun Mehta',
    '2026-03-05',
    '[
      {"name":"Metformin","dosage":"500 mg","frequency":"Twice daily","reminder_times":["08:00","20:00"],"start_date":"2026-03-05","end_date":"2026-04-05","notes":"After meals"},
      {"name":"Vitamin D3","dosage":"60,000 IU weekly","frequency":"As needed","reminder_times":["09:00"],"start_date":"2026-03-05","end_date":"2026-03-29","notes":"Once every Sunday"}
    ]'::jsonb,
    '11111111-1111-4111-8111-111111111111',
    '2026-03-05T11:00:00+05:30'
  ),
  (
    'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    '/demo/prescription-note.svg',
    'Dr. Arjun Mehta',
    '2026-03-08',
    '[
      {"name":"Amlodipine","dosage":"5 mg","frequency":"Once daily","reminder_times":["09:00"],"start_date":"2026-03-08","end_date":"2026-04-08","notes":"Morning after breakfast"},
      {"name":"Calcium","dosage":"500 mg","frequency":"Once daily","reminder_times":["20:30"],"start_date":"2026-03-08","end_date":"2026-04-08","notes":"Evening tablet"}
    ]'::jsonb,
    '11111111-1111-4111-8111-111111111111',
    '2026-03-08T14:10:00+05:30'
  )
on conflict (id) do update
set
  member_id = excluded.member_id,
  file_url = excluded.file_url,
  doctor_name = excluded.doctor_name,
  prescription_date = excluded.prescription_date,
  medicines = excluded.medicines,
  uploaded_by = excluded.uploaded_by,
  created_at = excluded.created_at;

insert into public.access_requests (
  id,
  requester_id,
  requester_name,
  requester_phone,
  requester_organization,
  target_group_id,
  requester_role,
  status,
  reason,
  requested_scopes,
  member_ids,
  consent_code,
  expires_at,
  reviewed_at,
  reviewed_by,
  created_at
)
values
  (
    'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
    '22222222-2222-4222-8222-222222222222',
    'Dr. Arjun Mehta',
    '+919900000002',
    'Mehta Family Clinic',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'doctor',
    'approved',
    'Routine diabetes consultation and medicine review.',
    array['summary', 'records', 'prescriptions', 'emergency'],
    array['b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1']::uuid[],
    '482913',
    '2026-04-15T23:59:00+05:30',
    '2026-03-05T09:20:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    '2026-03-05T08:55:00+05:30'
  ),
  (
    'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
    '44444444-4444-4444-8444-444444444444',
    'Anita Joshi',
    '+919900000004',
    'Support Care Services',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'caretaker',
    'approved',
    'Daily medicine support and appointment assistance for Sushma Sharma.',
    array['summary', 'records', 'prescriptions', 'reminders', 'reminders_management', 'medicine_ordering'],
    array['b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2']::uuid[],
    '650244',
    '2026-04-12T23:59:00+05:30',
    '2026-03-09T10:00:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    '2026-03-09T09:20:00+05:30'
  ),
  (
    'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3',
    '33333333-3333-4333-8333-333333333333',
    'Sunrise Care Hospital',
    '+919900000003',
    'Sunrise Care Hospital',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'hospital',
    'pending',
    'Requested access for admission desk pre-check and continuity planning.',
    array['summary', 'records', 'prescriptions'],
    array['b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2']::uuid[],
    '311204',
    null,
    null,
    null,
    '2026-03-12T16:45:00+05:30'
  )
on conflict (id) do update
set
  requester_id = excluded.requester_id,
  requester_name = excluded.requester_name,
  requester_phone = excluded.requester_phone,
  requester_organization = excluded.requester_organization,
  target_group_id = excluded.target_group_id,
  requester_role = excluded.requester_role,
  status = excluded.status,
  reason = excluded.reason,
  requested_scopes = excluded.requested_scopes,
  member_ids = excluded.member_ids,
  consent_code = excluded.consent_code,
  expires_at = excluded.expires_at,
  reviewed_at = excluded.reviewed_at,
  reviewed_by = excluded.reviewed_by,
  created_at = excluded.created_at;

insert into public.access_grants (
  id,
  request_id,
  grantee_user_id,
  grantee_name,
  target_group_id,
  granted_by,
  grantee_role,
  permission_scopes,
  member_ids,
  reason,
  consultation_note,
  status,
  starts_at,
  expires_at,
  created_at
)
values
  (
    'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1',
    'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
    '22222222-2222-4222-8222-222222222222',
    'Dr. Arjun Mehta',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    '11111111-1111-4111-8111-111111111111',
    'doctor',
    array['summary', 'records', 'prescriptions', 'emergency'],
    array['b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1']::uuid[],
    'Diabetes consultation access',
    'Review HbA1c trend and medicine adherence before April review.',
    'active',
    '2026-03-05T09:20:00+05:30',
    '2026-04-15T23:59:00+05:30',
    '2026-03-05T09:20:00+05:30'
  ),
  (
    'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2',
    'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
    '44444444-4444-4444-8444-444444444444',
    'Anita Joshi',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    '11111111-1111-4111-8111-111111111111',
    'caretaker',
    array['summary', 'records', 'prescriptions', 'reminders', 'reminders_management', 'medicine_ordering'],
    array['b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2']::uuid[],
    'Daily support for elderly patient',
    'Can mark doses, coordinate medicine orders, and manage follow-up reminders.',
    'active',
    '2026-03-09T10:00:00+05:30',
    '2026-04-12T23:59:00+05:30',
    '2026-03-09T10:00:00+05:30'
  )
on conflict (id) do update
set
  request_id = excluded.request_id,
  grantee_user_id = excluded.grantee_user_id,
  grantee_name = excluded.grantee_name,
  target_group_id = excluded.target_group_id,
  granted_by = excluded.granted_by,
  grantee_role = excluded.grantee_role,
  permission_scopes = excluded.permission_scopes,
  member_ids = excluded.member_ids,
  reason = excluded.reason,
  consultation_note = excluded.consultation_note,
  status = excluded.status,
  starts_at = excluded.starts_at,
  expires_at = excluded.expires_at,
  created_at = excluded.created_at;

insert into public.appointments (
  id,
  family_group_id,
  member_id,
  title,
  appointment_type,
  provider_name,
  provider_contact,
  provider_role,
  scheduled_for,
  location,
  mode,
  notes,
  status,
  follow_up_date,
  diagnosis,
  visit_summary,
  advice_summary,
  booked_by,
  updated_by,
  created_at
)
values
  (
    '12121212-1212-4212-8212-121212121212',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'Diabetes follow-up review',
    'follow_up',
    'Dr. Arjun Mehta',
    '+919900000002',
    'doctor',
    '2026-03-28T10:30:00+05:30',
    'Mehta Family Clinic, Baner',
    'clinic',
    'Carry latest HbA1c report and fasting sugar note.',
    'scheduled',
    '2026-04-25',
    null,
    null,
    null,
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '2026-03-18T08:45:00+05:30'
  ),
  (
    '13131313-1313-4313-8313-131313131313',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'Joint mobility consultation',
    'consultation',
    'Dr. Arjun Mehta',
    '+919900000002',
    'doctor',
    '2026-03-16T16:00:00+05:30',
    'Video follow-up',
    'video',
    'Review home exercise compliance and pain diary.',
    'completed',
    '2026-03-30',
    'Stable arthritis flare',
    'Mobility improved compared with last visit. Continue light exercise.',
    'Continue evening calcium and use support brace during longer walks.',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '2026-03-16T16:00:00+05:30'
  )
on conflict (id) do update
set
  family_group_id = excluded.family_group_id,
  member_id = excluded.member_id,
  title = excluded.title,
  appointment_type = excluded.appointment_type,
  provider_name = excluded.provider_name,
  provider_contact = excluded.provider_contact,
  provider_role = excluded.provider_role,
  scheduled_for = excluded.scheduled_for,
  location = excluded.location,
  mode = excluded.mode,
  notes = excluded.notes,
  status = excluded.status,
  follow_up_date = excluded.follow_up_date,
  diagnosis = excluded.diagnosis,
  visit_summary = excluded.visit_summary,
  advice_summary = excluded.advice_summary,
  booked_by = excluded.booked_by,
  updated_by = excluded.updated_by,
  created_at = excluded.created_at;

insert into public.vital_entries (
  id,
  family_group_id,
  member_id,
  metric_type,
  value_primary,
  value_secondary,
  unit,
  symptoms,
  notes,
  recorded_at,
  recorded_by
)
values
  (
    '14141414-1414-4414-8414-141414141414',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'sugar',
    '148',
    null,
    'mg/dL',
    array['fatigue'],
    'Post-breakfast reading',
    '2026-03-20T09:15:00+05:30',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    '15151515-1515-4515-8515-151515151515',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'blood_pressure',
    '128',
    '84',
    'mmHg',
    array['mild dizziness'],
    'Recorded after work',
    '2026-03-22T19:40:00+05:30',
    '22222222-2222-4222-8222-222222222222'
  ),
  (
    '16161616-1616-4616-8616-161616161616',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'blood_pressure',
    '142',
    '88',
    'mmHg',
    array['joint stiffness'],
    'Morning reading before walk',
    '2026-03-22T08:10:00+05:30',
    '44444444-4444-4444-8444-444444444444'
  ),
  (
    '17171717-1717-4717-8717-171717171717',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'weight',
    '63',
    null,
    'kg',
    array[]::text[],
    'Weekly weight note',
    '2026-03-21T07:45:00+05:30',
    '44444444-4444-4444-8444-444444444444'
  )
on conflict (id) do update
set
  family_group_id = excluded.family_group_id,
  member_id = excluded.member_id,
  metric_type = excluded.metric_type,
  value_primary = excluded.value_primary,
  value_secondary = excluded.value_secondary,
  unit = excluded.unit,
  symptoms = excluded.symptoms,
  notes = excluded.notes,
  recorded_at = excluded.recorded_at,
  recorded_by = excluded.recorded_by;

insert into public.care_tasks (
  id,
  family_group_id,
  member_id,
  title,
  description,
  due_at,
  assigned_to_user_id,
  created_by,
  status,
  completed_at,
  created_at
)
values
  (
    '18181818-1818-4818-8818-181818181818',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'Check evening BP',
    'Caretaker should log the reading after dinner and confirm medication.',
    '2026-03-25T20:30:00+05:30',
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'pending',
    null,
    '2026-03-23T18:00:00+05:30'
  ),
  (
    '19191919-1919-4919-8919-191919191919',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'Upload lab report before review',
    'Attach latest HbA1c report ahead of consultation.',
    '2026-03-24T11:00:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'completed',
    '2026-03-24T09:15:00+05:30',
    '2026-03-22T09:00:00+05:30'
  )
on conflict (id) do update
set
  family_group_id = excluded.family_group_id,
  member_id = excluded.member_id,
  title = excluded.title,
  description = excluded.description,
  due_at = excluded.due_at,
  assigned_to_user_id = excluded.assigned_to_user_id,
  created_by = excluded.created_by,
  status = excluded.status,
  completed_at = excluded.completed_at,
  created_at = excluded.created_at;

insert into public.medicine_orders (
  id,
  order_number,
  family_group_id,
  patient_member_id,
  placed_by_user_id,
  placed_by_name,
  placed_for_name,
  placed_for_phone,
  receiver_name,
  receiver_phone,
  delivery_address,
  location_text,
  notes,
  source_prescription_id,
  uploaded_prescription_url,
  chemist_id,
  chemist_name,
  status,
  total_items,
  created_at,
  updated_at
)
values
  (
    '20202020-2020-4020-8020-202020202020',
    'MED-DEMO-1001',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    '11111111-1111-4111-8111-111111111111',
    'Rahul Sharma',
    'Sushma Sharma',
    '+919944556677',
    'Anita Joshi',
    '+919900000004',
    '24 Green Avenue, Pune',
    'Near main gate, second floor',
    'Please call caretaker before delivery.',
    'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
    '/demo/prescription-note.svg',
    '55555555-5555-4555-8555-555555555555',
    'QuickMeds Chemist',
    'preparing',
    2,
    '2026-03-23T10:10:00+05:30',
    '2026-03-23T11:20:00+05:30'
  ),
  (
    '21212121-2121-4121-8121-212121212121',
    'MED-DEMO-1002',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    '44444444-4444-4444-8444-444444444444',
    'Anita Joshi',
    'Rahul Sharma',
    '+919900000001',
    'Rahul Sharma',
    '+919900000001',
    '24 Green Avenue, Pune',
    'Building C lobby',
    'Reorder of diabetes medicines.',
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    null,
    '55555555-5555-4555-8555-555555555555',
    'QuickMeds Chemist',
    'delivered',
    2,
    '2026-03-12T09:05:00+05:30',
    '2026-03-12T18:30:00+05:30'
  )
on conflict (id) do update
set
  order_number = excluded.order_number,
  family_group_id = excluded.family_group_id,
  patient_member_id = excluded.patient_member_id,
  placed_by_user_id = excluded.placed_by_user_id,
  placed_by_name = excluded.placed_by_name,
  placed_for_name = excluded.placed_for_name,
  placed_for_phone = excluded.placed_for_phone,
  receiver_name = excluded.receiver_name,
  receiver_phone = excluded.receiver_phone,
  delivery_address = excluded.delivery_address,
  location_text = excluded.location_text,
  notes = excluded.notes,
  source_prescription_id = excluded.source_prescription_id,
  uploaded_prescription_url = excluded.uploaded_prescription_url,
  chemist_id = excluded.chemist_id,
  chemist_name = excluded.chemist_name,
  status = excluded.status,
  total_items = excluded.total_items,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.medicine_order_items (
  id,
  order_id,
  medicine_name,
  dosage,
  quantity,
  instructions,
  source,
  is_substitute,
  substitute_for
)
values
  ('22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20202020-2020-4020-8020-202020202020', 'Amlodipine', '5 mg', '30 tablets', 'Morning dose', 'prescription', false, null),
  ('23232323-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20202020-2020-4020-8020-202020202020', 'Calcium', '500 mg', '30 tablets', 'Evening dose', 'prescription', false, null),
  ('24242424-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '21212121-2121-4121-8121-212121212121', 'Metformin', '500 mg', '60 tablets', 'After meals', 'prescription', false, null),
  ('25252525-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '21212121-2121-4121-8121-212121212121', 'Vitamin D3', '60,000 IU', '4 sachets', 'Weekly dose', 'prescription', false, null)
on conflict (id) do update
set
  order_id = excluded.order_id,
  medicine_name = excluded.medicine_name,
  dosage = excluded.dosage,
  quantity = excluded.quantity,
  instructions = excluded.instructions,
  source = excluded.source,
  is_substitute = excluded.is_substitute,
  substitute_for = excluded.substitute_for;

insert into public.order_status_history (id, order_id, status, note, changed_by, created_at)
values
  ('26262626-2626-4626-8626-262626262626', '20202020-2020-4020-8020-202020202020', 'accepted', 'Order reviewed by chemist.', '55555555-5555-4555-8555-555555555555', '2026-03-23T10:25:00+05:30'),
  ('27272727-2727-4727-8727-272727272727', '20202020-2020-4020-8020-202020202020', 'preparing', 'Packing medicines and confirming stock.', '55555555-5555-4555-8555-555555555555', '2026-03-23T11:20:00+05:30'),
  ('28282828-2828-4828-8828-282828282828', '21212121-2121-4121-8121-212121212121', 'accepted', 'Repeat order accepted.', '55555555-5555-4555-8555-555555555555', '2026-03-12T09:20:00+05:30'),
  ('29292929-2929-4929-8929-292929292929', '21212121-2121-4121-8121-212121212121', 'out_for_delivery', 'Sent with delivery partner.', '55555555-5555-4555-8555-555555555555', '2026-03-12T15:10:00+05:30'),
  ('30303030-3030-4030-8030-303030303030', '21212121-2121-4121-8121-212121212121', 'delivered', 'Delivered successfully.', '55555555-5555-4555-8555-555555555555', '2026-03-12T18:30:00+05:30')
on conflict (id) do update
set
  order_id = excluded.order_id,
  status = excluded.status,
  note = excluded.note,
  changed_by = excluded.changed_by,
  created_at = excluded.created_at;

insert into public.order_chat_messages (id, order_id, sender_id, sender_name, message, created_at)
values
  (
    '31313131-3131-4131-8131-313131313131',
    '20202020-2020-4020-8020-202020202020',
    '55555555-5555-4555-8555-555555555555',
    'QuickMeds Chemist',
    'Amlodipine is available. Calcium will be packed in the same order.',
    '2026-03-23T10:30:00+05:30'
  ),
  (
    '32323232-3232-4232-8232-323232323232',
    '20202020-2020-4020-8020-202020202020',
    '11111111-1111-4111-8111-111111111111',
    'Rahul Sharma',
    'Please hand over the package to Anita Joshi, our caretaker.',
    '2026-03-23T10:36:00+05:30'
  )
on conflict (id) do update
set
  order_id = excluded.order_id,
  sender_id = excluded.sender_id,
  sender_name = excluded.sender_name,
  message = excluded.message,
  created_at = excluded.created_at;

insert into public.notifications (id, user_id, title, body, category, entity_type, entity_id, is_read, created_at)
values
  (
    '33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'New hospital access request',
    'Sunrise Care Hospital requested access for Sushma Sharma.',
    'access_request',
    'access_request',
    'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3',
    false,
    '2026-03-12T16:46:00+05:30'
  ),
  (
    '34343434-3434-4434-8434-343434343434',
    '22222222-2222-4222-8222-222222222222',
    'Access approved',
    'The Sharma family approved your review access for Rahul Sharma.',
    'access_update',
    'access_grant',
    'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1',
    false,
    '2026-03-05T09:22:00+05:30'
  ),
  (
    '35353535-3535-4535-8535-353535353535',
    '55555555-5555-4555-8555-555555555555',
    'New medicine order placed',
    'Rahul Sharma placed a medicine order for Sushma Sharma.',
    'order_update',
    'medicine_order',
    '20202020-2020-4020-8020-202020202020',
    false,
    '2026-03-23T10:12:00+05:30'
  ),
  (
    '36363636-3636-4636-8636-363636363636',
    '11111111-1111-4111-8111-111111111111',
    'Caretaker health update',
    'Anita Joshi logged a new blood pressure reading for Sushma Sharma.',
    'system',
    'vital_entry',
    '16161616-1616-4616-8616-161616161616',
    true,
    '2026-03-22T08:15:00+05:30'
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  title = excluded.title,
  body = excluded.body,
  category = excluded.category,
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  is_read = excluded.is_read,
  created_at = excluded.created_at;

-- Helpful comments
-- ------------------------------------------------------------
comment on table public.family_groups is 'One shareable family vault with a unique MedFamily ID per admin.';
comment on table public.access_requests is 'Doctor, hospital, and caretaker access requests awaiting patient or family approval.';
comment on table public.access_grants is 'Approved, time-bound access grants with permission scopes and optional member limits.';
comment on table public.medicine_orders is 'Medicine ordering workflow for families, caretakers, and chemists.';
comment on table public.notifications is 'In-app notification feed for access, reminders, orders, and chat activity.';
