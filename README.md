# MedFamily - Patient Healthcare Management System

MedFamily is a mobile-first healthcare management Progressive Web App built as an SEPM project and polished into a presentation-ready MVP. It helps patients, families, caretakers, doctors, hospitals, and chemists manage records, prescriptions, reminders, appointments, medicine ordering, controlled access, emergency summaries, and notifications in one place.

## Highlights

- Mobile-first responsive healthcare dashboard
- Email or phone plus password demo authentication
- Role-aware flows for Patient, Doctor, Hospital, Caretaker, and Chemist
- Family workspace with member-wise health separation
- Medical records and prescription management with in-app previews
- Reminder tracking, appointment planning, and health monitoring
- Doctor, hospital, and caretaker access request workflows
- Medicine ordering, order tracking, and chemist chat
- Emergency summary, notifications center, and dark/light theme

## Active Roles

- `Patient` - owns the family workspace, approves access, and manages records
- `Doctor` - requests access and reviews patient summaries, records, and prescriptions
- `Hospital` - handles institutional access and visit coordination
- `Caretaker` - supports reminders, tasks, orders, and dependent care
- `Chemist` - manages medicine fulfilment, delivery states, and order chat

Note: the codebase still contains a legacy `family_member` role for backward compatibility with older seeded data.

## Tech Stack

- Vite 7
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase
- React Router
- React Hook Form
- Lucide React
- date-fns
- react-hot-toast
- Web Notifications API

## Major Modules

- Authentication and role-based onboarding
- Family profiles and unique member records
- Patient records and secure document storage
- Prescription digitization and medicine reminders
- Appointment scheduling and follow-up tracking
- Health hub with vitals, symptom notes, and care tasks
- Access control for doctors, hospitals, and caretakers
- Medicine ordering, chemist dashboard, and order chat
- Notifications center and emergency summary

## Project Structure

```text
src/
  components/        Reusable UI and role-aware interface blocks
  context/           Auth, theme, and notification providers
  hooks/             Data hooks for records, orders, reminders, access, health, and appointments
  lib/               Shared constants, Supabase client, and TypeScript models
  pages/             Route-level screens
  utils/             Validation, exports, storage, and helper utilities
supabase/
  database.sql       Database schema, seeds, helper functions, and policies
docs/
  FEATURE_MATRIX.md  Feature audit
  PRD.md             Product requirements document
public/demo/         Demo-safe assets used for preview content
```

## Local Setup

### 1. Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A Supabase project

You can verify your installation with:

```bash
node -v
npm -v
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase project values:

```bash
cp .env.example .env
```

Required keys:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database Setup

Open the Supabase SQL Editor and run:

```text
supabase/database.sql
```

This sets up:

- tables and enums
- helper functions
- seeded demo data
- storage bucket references
- role and access foundations

### 4. Install and Run

```bash
npm install
npm run dev
```

Open the app at:

```text
http://localhost:5173
```

### 5. Production Build Check

```bash
npm run build
npm run preview
```

## Demo Accounts

These demo accounts are seeded by `supabase/database.sql`:

| Role | Email | Phone | Password |
| --- | --- | --- | --- |
| Patient Admin | `familyadmin@medfamily.demo` | `+919900000001` | `family123` |
| Doctor | `doctor@medfamily.demo` | `+919900000002` | `doctor123` |
| Hospital | `hospital@medfamily.demo` | `+919900000003` | `hospital123` |
| Caretaker | `caretaker@medfamily.demo` | `+919900000004` | `caretaker123` |
| Chemist | `chemist@gmail.com` | `+919900000005` | `chemist123` |
| Patient Demo | `patient@medfamily.demo` | `+919900000006` | `patient123` |

## Current Auth Note

The current build uses a demo-safe database-backed login flow instead of live Supabase Auth and OTP. The schema and app structure are still organized so stronger production authentication can be reintroduced later.


## Docs

- [docs/FEATURE_MATRIX.md](./docs/FEATURE_MATRIX.md)
- [docs/PRD.md](./docs/PRD.md)
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
