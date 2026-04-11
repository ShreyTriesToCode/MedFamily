# Supabase Setup Guide

This project currently runs in a demo-friendly mode with custom DB-backed login instead of live Supabase Auth. That keeps MedFamily easy to demo while still using Supabase for database, storage, realtime, and future auth hardening.

## 1. Create the Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open `Settings -> API`.
3. Copy:
   - `Project URL`
   - `anon public key`
4. Put them in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 2. Run the Full SQL Schema

1. Open `SQL Editor`.
2. Create a new query.
3. Paste the full contents of:

```text
supabase/database.sql
```

4. Run it once.

That script now:

- creates the MedFamily schema
- adds access control, ordering, chat, notifications, appointments, vitals, and care tasks
- creates storage buckets
- seeds demo accounts and sample healthcare data
- enables demo-mode DB auth functions
- makes demo preview files work immediately

## 3. Storage Buckets Created

The SQL creates these buckets:

| Bucket | Purpose |
| --- | --- |
| `patient-records` | medical reports and uploaded files |
| `prescriptions` | prescriptions and related uploads |
| `order-prescriptions` | medicine-order attachments |

In demo mode, these are made public so seeded sample attachments and local previews work without Supabase Auth sessions.

## 4. Run the Project

```bash
cd "/Users/shrey-mac/Downloads/Codes/SEPM/SEPM-Project-main"
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

For production build verification:

```bash
npm run build
npm run preview
```

## 5. Seeded Demo Accounts

These are created by the SQL:

| Role | Login | Password |
| --- | --- | --- |
| Patient | `familyadmin@medfamily.demo` or `+919900000001` | `family123` |
| Doctor | `doctor@medfamily.demo` or `+919900000002` | `doctor123` |
| Hospital | `hospital@medfamily.demo` or `+919900000003` | `hospital123` |
| Caretaker | `caretaker@medfamily.demo` or `+919900000004` | `caretaker123` |
| Chemist | `chemist@gmail.com` or `+919900000005` | `chemist123` |
| Patient Demo | `patient@medfamily.demo` or `+919900000006` | `patient123` |

## 6. Optional: Re-enable Supabase Auth Later

This is not required for the current project demo, but if you want to move back toward production-style auth later:

1. Enable `Authentication -> Providers -> Email`.
2. Enable `Authentication -> Providers -> Phone` if you want real OTP.
3. Configure an SMS provider for phone OTP.
4. Re-enable strict RLS by removing or reversing the `Temporary demo mode access` section in `supabase/database.sql`.
5. Swap the app back from `register_demo_user` / `login_demo_user` RPC usage to Supabase Auth flows in [src/context/AuthContext.tsx](/Users/shrey-mac/Downloads/Codes/SEPM/SEPM-Project-main/src/context/AuthContext.tsx).

## 7. If `npm` Is Missing on macOS

If your shell says `npm: command not found`, temporarily export Homebrew Node into the current terminal:

```bash
export PATH="/opt/homebrew/opt/node/bin:/opt/homebrew/bin:$PATH"
```

Then run the project commands again.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| SQL rerun errors | Use the latest `supabase/database.sql` file and rerun the full file instead of mixing old snippets |
| Login fails | Make sure the SQL finished and `demo_auth_accounts` was created |
| Records do not preview | Confirm the seeded `/public/demo/` files exist locally and the app rebuilt after changes |
| No data on dashboards | Sign in with one of the seeded demo accounts above |
