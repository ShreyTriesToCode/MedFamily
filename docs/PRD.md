# Patient Healthcare Management System — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** February 14, 2026  
**Status:** Approved for Development  

---

## 1. Executive Summary

### 1.1 Product Vision
MedFamily is a centralized, secure digital healthcare platform that empowers families to manage patient records, prescriptions, and medicine reminders in one place. It eliminates fragmented paper-based workflows and ensures critical health information is accessible instantly — especially during emergencies.

### 1.2 Value Proposition
- **Single source of truth** for all family medical records
- **Automated medicine reminders** generated from prescriptions
- **Family-wide access control** so trusted members can manage health data
- **Secure, cloud-backed storage** with phone-based authentication

### 1.3 Target Users
| Segment | Description |
|---------|-------------|
| Family Admin | Age 30-50, tech-savvy, manages elderly parents' and children's health |
| Caretaker | Spouse or adult child managing multiple family members' records |
| Individual Patient | Anyone wanting a personal digital health vault |

### 1.4 Key Success Metrics
| Metric | Target |
|--------|--------|
| Time to retrieve a patient record | < 10 seconds (vs. minutes with paper) |
| Medicine adherence rate | > 80% with reminders enabled |
| User activation (signup → first record upload) | > 60% within first session |
| Weekly active users (WAU) retention at 4 weeks | > 40% |

---

## 2. Problem & Opportunity

### 2.1 Current Pain Points
1. **Fragmented data**: Medical records scattered across paper files, WhatsApp photos, and email attachments.
2. **Data loss**: Paper records degrade, get misplaced, or are destroyed.
3. **Slow retrieval**: Finding a specific lab report during a doctor visit can take 10+ minutes.
4. **Missed medications**: Patients forget medicine timings; no automated reminder system.
5. **Poor coordination**: Family members cannot share or access each other's records during emergencies.
6. **Duplicate records**: Without a central system, tests are repeated unnecessarily.

### 2.2 Market Gap
Existing health apps are either enterprise-grade (hospitals/clinics), overly complex for families, or lack offline-friendly file storage. There is no lightweight, family-centric solution that combines record storage + prescription management + automated reminders with simple phone OTP auth.

### 2.3 User Impact Scenarios
- **Emergency room visit**: Caretaker instantly pulls up parent's allergy list and medication history on phone.
- **Chronic disease management**: Diabetic patient receives timely insulin reminders; family admin monitors adherence.
- **Multi-city family**: Daughter in another city uploads father's lab reports for the local sibling taking him to the doctor.

---

## 3. Goals & Objectives

### 3.1 Primary Objectives (SMART)
| # | Objective | Measure | Target | Timeline |
|---|-----------|---------|--------|----------|
| G1 | Digitize family health records | Records uploaded per family | ≥ 5 in first week | Week 2 |
| G2 | Automate medicine reminders | Reminders auto-created from prescriptions | 100% | Week 4 |
| G3 | Enable family-wide access | Family groups with ≥ 2 members | > 50% of users | Week 5 |
| G4 | Reduce missed medications | Reminders marked "taken" | > 70% | Week 6 |

### 3.2 Success Criteria
- All five core modules (Auth, Records, Prescriptions, Reminders, Access Control) fully functional.
- Responsive on mobile (320px+) and desktop.
- Page load < 2 seconds on 4G connection.
- Zero critical security vulnerabilities in RLS policies.

---

## 4. User Personas & Stories

### 4.1 Persona: Rajesh (Family Admin)
- **Age:** 42, IT professional
- **Context:** Manages health records for parents (70s), wife, and two children
- **Goals:** Quick access to records during hospital visits; ensure parents take medicines on time
- **Frustrations:** Paper files scattered at home; parents forget medicines daily

### 4.2 Persona: Priya (Caretaker)
- **Age:** 35, homemaker
- **Context:** Manages husband's diabetes records and children's vaccination schedules
- **Goals:** Upload prescriptions after each visit; get reminder notifications
- **Frustrations:** Husband's prescriptions are handwritten and hard to track

### 4.3 User Stories

#### Authentication
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-01 | As a user, I want to sign up with my phone number so I don't need to remember a password | OTP sent within 30s; session persists across browser restarts |
| US-02 | As a user, I want to log in via OTP so access is secure yet simple | 6-digit OTP validates; wrong OTP shows error; 3 retry limit |
| US-03 | As a user, I want to log out securely | Session cleared; redirect to login; back button doesn't restore session |

#### Patient Records
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-04 | As a user, I want to upload medical documents for a family member | PDF/image accepted; file < 10MB; progress shown; record saved to DB |
| US-05 | As a user, I want to categorize records by type | Dropdown with Lab Report, X-Ray, MRI, CT Scan, Prescription, Consultation, Other |
| US-06 | As a user, I want to search and filter records | Filter by member, type, date range; search by filename |
| US-07 | As a user, I want to download and delete records | Download returns original file; delete removes file + DB entry with confirmation |

#### Prescriptions
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-08 | As a user, I want to upload a prescription with medicine details | File upload + form for doctor name, date, medicines array |
| US-09 | As a user, I want reminders auto-created from prescriptions | On prescription save, medicine_reminders rows created for each medicine |
| US-10 | As a user, I want to view all prescriptions for a family member | List sorted by date; expandable to show medicines |

#### Medicine Reminders
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-11 | As a user, I want browser notifications at scheduled medicine times | Web Notification API; permission requested on first visit |
| US-12 | As a user, I want to mark medicines as taken | Status updated; log entry created with timestamp |
| US-13 | As a user, I want to snooze a reminder | Snooze options: 15min, 30min, 1hr; rescheduled notification |
| US-14 | As a user, I want to see today's, upcoming, and missed reminders | Three grouped sections; missed = past scheduled time + not taken |

#### Access Control
| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-15 | As a new user, I want a family group auto-created for me | DB trigger creates group on signup; user is admin |
| US-16 | As admin, I want to add/edit/remove family members | CRUD operations; relationship types enforced |
| US-17 | As admin, I want to manage all family member records | Admin sees all members' records, prescriptions, reminders |

---

## 5. Functional Requirements

### 5.1 Authentication Module
| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Phone OTP Login | Supabase Auth with phone provider |
| P0 | Session Persistence | Auth state persisted via Supabase session |
| P0 | Protected Routes | Unauthenticated users redirected to /login |
| P1 | Auto-logout | Session expires after 30 days of inactivity |

### 5.2 Patient Records Module
| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | File Upload | PDF, JPEG, PNG; max 10MB; progress indicator |
| P0 | Record Metadata | Member, type, notes, upload date |
| P0 | View/Download | View inline or download original |
| P0 | Delete | Soft confirmation → remove file + DB row |
| P1 | Search & Filter | By member, type, date, filename |
| P2 | Thumbnail Preview | Generate preview for images |

### 5.3 Prescription Module
| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Upload Prescription File | Image or PDF of prescription |
| P0 | Medicine Data Entry | Name, dosage, frequency, duration per medicine |
| P0 | Auto-create Reminders | DB trigger on prescription insert |
| P1 | Doctor & Date Metadata | Doctor name, prescription date |
| P2 | Prescription History | List all prescriptions per member |

### 5.4 Medicine Reminders Module
| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Today's Reminders | List grouped by time |
| P0 | Mark as Taken | Log entry with timestamp |
| P0 | Browser Notifications | Web Notifications API |
| P1 | Snooze | 15min / 30min / 1hr |
| P1 | Missed Reminders | Past scheduled, not taken |
| P1 | Manual Reminder | Add reminder without prescription |
| P2 | Upcoming View | Next 7 days |

### 5.5 Access Control Module
| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Auto Family Group | Created on signup via DB trigger |
| P0 | Add Family Member | Name, relation, DOB, phone |
| P0 | Edit/Delete Member | Admin-only operations |
| P1 | Member Stats | Record count, active reminders per member |

---

## 6. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Initial page load | < 2s on 4G |
| Performance | File upload feedback | Progress bar; < 5s for 5MB file |
| Security | Row Level Security | All tables have RLS enabled |
| Security | Authentication | Phone OTP; no password storage |
| Security | File Storage | Private buckets; signed URLs |
| Scalability | Concurrent users | 10,000+ |
| Reliability | Uptime | 99.9% (Supabase SLA) |
| Usability | Responsive design | 320px – 1920px+ |
| Usability | Accessibility | WCAG 2.1 AA |
| Compatibility | Browsers | Chrome, Firefox, Safari, Edge (latest 2 versions) |

---

## 7. Technical Architecture

### 7.1 System Architecture
```
┌─────────────────────────────────────────────────┐
│                   Client (Browser)               │
│  Vite + React + TypeScript + Tailwind CSS        │
│  ┌─────────┐ ┌──────────┐ ┌─────────────────┐   │
│  │  Pages   │ │Components│ │  Context/Hooks   │   │
│  └────┬────┘ └────┬─────┘ └───────┬─────────┘   │
│       └───────────┴───────────────┘              │
│                     │                            │
│            Supabase JS Client                    │
└─────────────────────┬───────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────┐
│                 Supabase Cloud                    │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐   │
│  │   Auth    │ │ Storage  │ │   PostgreSQL    │   │
│  │ (Phone   │ │ (Files)  │ │ (Data + RLS)    │   │
│  │  OTP)    │ │          │ │                 │   │
│  └──────────┘ └──────────┘ └─────────────────┘   │
│  ┌──────────────────────────────────────────┐     │
│  │         Database Functions/Triggers       │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### 7.2 Component Hierarchy
```
App
├── AuthProvider (Context)
│   └── NotificationProvider (Context)
│       ├── Login (public)
│       └── ProtectedRoute
│           └── Layout
│               ├── Header
│               ├── Page Content
│               │   ├── Dashboard
│               │   ├── PatientRecords
│               │   ├── PrescriptionUpload
│               │   ├── MedicineReminders
│               │   └── AccessControl
│               └── MobileNav
```

### 7.3 Data Flow
1. **Auth Flow:** Phone → OTP → Session → AuthContext → Protected Routes
2. **Upload Flow:** File → Validate → Supabase Storage → DB Record → UI Update
3. **Prescription Flow:** Upload Prescription → Enter Medicines → DB Trigger → Auto-create Reminders
4. **Reminder Flow:** Scheduled Time → Check Pending → Browser Notification → User Action → Log

---

## 8. Database Schema

### Tables

#### `family_groups`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default uuid_generate_v4() |
| admin_id | UUID | FK → auth.users(id), NOT NULL |
| group_name | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `family_members`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| group_id | UUID | FK → family_groups(id) ON DELETE CASCADE |
| name | TEXT | NOT NULL |
| relation | TEXT | NOT NULL |
| date_of_birth | DATE | |
| phone | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `patient_records`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| member_id | UUID | FK → family_members(id) ON DELETE CASCADE |
| file_url | TEXT | NOT NULL |
| file_name | TEXT | NOT NULL |
| file_type | TEXT | NOT NULL |
| record_type | TEXT | NOT NULL |
| notes | TEXT | |
| upload_date | TIMESTAMPTZ | DEFAULT NOW() |
| uploaded_by | UUID | FK → auth.users(id) |

#### `prescriptions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| member_id | UUID | FK → family_members(id) ON DELETE CASCADE |
| file_url | TEXT | NOT NULL |
| doctor_name | TEXT | |
| prescription_date | DATE | NOT NULL |
| medicines | JSONB | NOT NULL |
| uploaded_by | UUID | FK → auth.users(id) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `medicine_reminders`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| prescription_id | UUID | FK → prescriptions(id) ON DELETE CASCADE, NULLABLE |
| member_id | UUID | FK → family_members(id) ON DELETE CASCADE |
| medicine_name | TEXT | NOT NULL |
| dosage | TEXT | NOT NULL |
| frequency | TEXT | NOT NULL |
| reminder_times | JSONB | NOT NULL |
| start_date | DATE | NOT NULL |
| end_date | DATE | NOT NULL |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

#### `reminder_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| reminder_id | UUID | FK → medicine_reminders(id) ON DELETE CASCADE |
| scheduled_time | TIMESTAMPTZ | NOT NULL |
| taken_at | TIMESTAMPTZ | |
| status | TEXT | NOT NULL (pending/taken/missed/snoozed/skipped) |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### Indexes
- `idx_family_members_group_id` on family_members(group_id)
- `idx_patient_records_member_id` on patient_records(member_id)
- `idx_prescriptions_member_id` on prescriptions(member_id)
- `idx_medicine_reminders_member_id` on medicine_reminders(member_id)
- `idx_reminder_logs_reminder_id` on reminder_logs(reminder_id)
- `idx_reminder_logs_scheduled_time` on reminder_logs(scheduled_time)

---

## 9. UI/UX Specifications

### 9.1 Design System
| Token | Value |
|-------|-------|
| Primary | Blue #3B82F6 |
| Secondary | Green #10B981 |
| Accent | Purple #8B5CF6 |
| Danger | Red #EF4444 |
| Warning | Amber #F59E0B |
| Background | #F9FAFB (light), #111827 (dark) |
| Surface | White #FFFFFF |
| Text Primary | #111827 |
| Text Secondary | #6B7280 |
| Border | #E5E7EB |
| Font Family | Inter, system-ui, sans-serif |
| Border Radius | 8px (cards), 6px (inputs), 9999px (pills) |

### 9.2 Page Layouts
- **Login:** Centered card, 400px max width, brand logo above
- **Dashboard:** 2x2 card grid (mobile: stack), stats bar, recent activity
- **Records:** Filter bar + masonry/grid of record cards
- **Prescriptions:** Split — form top, history list bottom
- **Reminders:** Tabbed sections (Today / Upcoming / Missed)
- **Access Control:** Member cards grid + add member FAB

### 9.3 Navigation
- **Desktop:** Top header with nav links
- **Mobile:** Bottom tab bar (5 icons), hamburger for secondary actions

---

## 10. Security & Compliance

- **RLS** enabled on all tables; users see only their family group's data.
- **Storage buckets** are private; files accessed via short-lived signed URLs.
- **Phone OTP** — no password stored; Supabase handles token management.
- **Input sanitization** — all user inputs validated client-side and enforced by DB constraints.
- **HTTPS only** — enforced by hosting platform (Vercel/Netlify).
- **HIPAA awareness** — while not fully HIPAA certified, architecture follows best practices: encryption at rest (Supabase), encryption in transit (TLS), access controls (RLS).

---

## 11. Testing Strategy

| Level | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest + React Testing Library | Utility functions, validators, hooks |
| Integration | Vitest | Context providers, hook + API integration |
| E2E | Playwright (future) | Signup → upload → reminder flow |
| Performance | Lighthouse | Score > 90 on all metrics |
| Security | Manual + Supabase Dashboard | RLS policy verification |

---

## 12. Deployment & DevOps

| Aspect | Choice |
|--------|--------|
| Hosting | Vercel (primary) or Netlify |
| Build | `tsc && vite build` |
| CI/CD | Vercel Git integration (auto-deploy on push) |
| Environments | Production (main branch), Preview (PR branches) |
| Monitoring | Vercel Analytics + Sentry (optional) |
| Backup | Supabase automatic daily backups |

---

## 13. Dependencies & Constraints

### External Services
- Supabase (Auth, DB, Storage) — free tier supports MVP
- SMS Provider (Twilio/MessageBird via Supabase) — required for OTP

### Third-Party Libraries
react, react-dom, react-router-dom, @supabase/supabase-js, tailwindcss, lucide-react, react-hot-toast, react-hook-form, date-fns

### Constraints
- Browser Notifications API requires HTTPS and user permission grant
- Supabase free tier: 500MB DB, 1GB storage, 50K monthly active users
- Phone OTP has rate limits (Supabase default: 30 OTPs/hour)

---

## 14. Timeline & Milestones

| Week | Milestone | Deliverables |
|------|-----------|-------------|
| 1 | Foundation | Project setup, Auth module, Layout components |
| 2 | Records | Patient Records CRUD, file upload/download |
| 3 | Prescriptions | Prescription upload, medicine entry, auto-reminders |
| 4 | Reminders | Reminder views, notifications, taken/snooze/skip |
| 5 | Access Control | Family groups, member management, permissions |
| 6 | Polish & Deploy | Testing, bug fixes, deployment, documentation |

---

## 15. Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| SMS OTP rate limiting | Users can't log in | Medium | Implement resend cooldown; consider email fallback |
| Browser notification denied | Reminders not received | High | In-app reminder list always visible; educate users |
| Large file uploads fail | Record not saved | Medium | Client-side compression; chunked upload; retry logic |
| Supabase free tier limits | Service degradation | Low (MVP) | Monitor usage; upgrade plan before limits hit |

---

## 16. Out of Scope (v1.0)

- Doctor/pharmacy portal
- Telemedicine / video consultation
- AI-based prescription OCR (manual entry only in v1)
- Offline mode / PWA
- Push notifications (mobile app)
- Multi-language / i18n
- Dark mode toggle (future enhancement)
- Export records as ZIP
- Integration with hospital EMR systems

---

## 17. Open Questions

1. Should we support email + password as a fallback auth method?
2. What is the maximum number of family members per group?
3. Should reminder logs be retained indefinitely or auto-purged after 90 days?
4. Do we need audit logging for record access (who viewed what, when)?

---

## 18. Appendix

### Glossary
| Term | Definition |
|------|-----------|
| RLS | Row Level Security — PostgreSQL feature to restrict data access per user |
| OTP | One-Time Password — 6-digit code sent via SMS |
| JSONB | PostgreSQL binary JSON data type for flexible schema |
| Family Group | A logical container linking one admin user to multiple family members |

### References
- [Supabase Docs](https://supabase.com/docs)
- [React Router v6 Docs](https://reactrouter.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Web Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
