---
trigger: model_decision
description: Applies to domain workflows, business logic, student enrollment, attendance tracking, fee management, progress tracking, coach assignment, demo bookings, and portal features.
---

# Smart Pen Academy – Business Flows

This file defines the current agreed business flows for Smart Pen Academy.

These flows represent the approved behavior. They must not be changed implicitly via code changes.  
If a requirement change affects any flow in this file, the flow must be updated here first, with an explicit impact analysis, before implementation.

For architecture and stack invariants, see `Architecture.md`.  
For security mechanisms, see `Security.md`.  
For global engineering behavior, see `~/.gemini/GEMINI.md`.  
For UI/mobile patterns, see `.agents/rules/mobile.md`.

---

## 0. Business Flow Change Protocol

If a requested change affects any flow in this file:

1. **Identify impacted flow(s).**  
   Locate the section(s) in this file that describe the current behavior.

2. **Propose the change here.**  
   Document the new intended behavior in this file (or as a PR against it).

3. **Analyze and record impact** on at least:
   - User experience and expectations  
   - Data model and schema (including migrations/backfill if needed)  
   - Security and authorization (roles, RLS, access boundaries)  
   - Existing reports, audits, and integrations  
   - Any affected admin or operational processes  

4. **Obtain explicit approval** for the change.

5. **Then implement** the change in code, following:
   - Data Field Change Flow in `Architecture.md` for field-level changes  
   - Security Change Protocol in `Security.md` for security-sensitive changes  

Do not silently change business behavior in code without updating this file.

---

## 1. Student Enrollment Flow

**Goal:** Admit a new student and link them to a parent and coach.

**Actors:** Parent, Admin, Coach (as applicable)

**Steps:**
1. Parent creates an account (or admin creates on their behalf).
2. Parent/admin adds student details:
   - Structured fields: `firstName`, `lastName`, `age`, `grade`, `schoolName`, `parentName`, `phoneNumber`, `email`, `handwritingStyle`, `coachId`, `status`.
3. System links student to parent (supports multiple students per parent for siblings).
4. Admin/coach assigns a coach to the student (if not auto-assigned).
5. System records enrollment timestamp and initial status.

**Constraints:**
- No mock or fallback student records.
- All fields must conform to the current DB schema and TypeScript contracts.
- Sibling relationships must be preserved (multiple students per parent).

**See also:** Data Field Change Flow in `Architecture.md`.

---

## 2. Attendance Tracking Flow

**Goal:** Record and view student attendance for coaching sessions.

**Actors:** Coach, Admin, Parent, Student

**Steps:**
1. Coach marks attendance for a scheduled session (present/absent/late, as defined).
2. System records attendance with timestamp, session reference, and coach ID.
3. Parent and student can view attendance history via their portals.
4. Admin can view and audit attendance records.

**Constraints:**
- Attendance records are authoritative from PostgreSQL; no in-memory mirrors.
- RLS ensures:
  - Coaches see only their assigned students’ attendance.
  - Parents/students see only their own attendance.
  - Admins have broader access as per permission model.

---

## 3. Fee Management Flow

**Goal:** Create, track, and record fee payments for students.

**Actors:** Admin, Parent

**Steps:**
1. Admin creates a fee record for a student (amount, period, description, status).
2. System stores fee record with structured fields and status (e.g., pending/paid/overdue).
3. Parent views fees for their children in the parent portal.
4. Admin records payments against fee records (partial/full as supported).
5. System updates fee status and maintains payment history.

**Constraints:**
- Fee data is sourced from PostgreSQL only; no hardcoded or fake fee records.
- RLS ensures parents see only their children’s fees.
- Only authorized roles (admin) can create/modify fee records.

---

## 4. Progress Tracking Flow

**Goal:** Record and review student progress in handwriting and academic skills.

**Actors:** Coach, Parent, Student, Admin

**Steps:**
1. Coach records progress entries for a student (skills, observations, milestones).
2. System stores progress records linked to student, coach, and timestamp.
3. Parent and student view progress history in their portals.
4. Admin can audit progress records.

**Constraints:**
- Progress data must conform to the current schema (e.g., `progress_trackers`, `student_works`).
- RLS ensures:
  - Coaches see only students they are assigned to.
  - Parents/students see only their own progress.
- No mock progress entries or fake testimonials.

---

## 5. Coach Assignment & Management Flow

**Goal:** Create coach profiles and assign coaches to students.

**Actors:** Admin

**Steps:**
1. Admin creates a coach record with structured fields:
   - `firstName`, `lastName`, `designation`, `specializations`, `email`, `phoneNumber`, `status`, etc.
2. Admin assigns coaches to students (one-to-many or many-to-many as designed).
3. Admin can modify coach details or status (active/inactive).
4. System enforces that only admins can create/modify/delete coach records unless otherwise specified.

**Constraints:**
- Coach data is structured, not compressed into untyped strings.
- RLS and backend authorization prevent non-admins from modifying coach records.
- Public-facing coach data (if any) uses explicit column projections (see `Security.md`).

---

## 6. Free Demo Booking Flow

**Goal:** Allow prospective parents to schedule a free in-person demo coaching class for their child.

**Actors:** Parent, Admin, Coach

**Steps:**
1. Parent opens Free Demo Class modal (via navbar top strip, hero CTA, or `/free-demo` route).
2. Parent inputs student and contact information:
   - Student details: `studentName`, `age`, `grade`, `schoolName`
   - Parent contact: `parentName`, `phoneNumber`, `email`
   - Session schedule: `preferredDate` (format: `YYYY-MM-DD`), `preferredTimeSlot` (e.g., "04:00 PM", "05:00 PM", "06:00 PM")
3. Backend validates input payload using Zod create schema.
4. System records demo booking in PostgreSQL with timestamp and status (`pending` / `confirmed`).
5. Confirmation dispatched to parent (email / WhatsApp dispatch).
6. Admin audits demo bookings and coordinates coach allocation or subsequent enrollment conversion.

**Constraints:**
- Demo bookings strictly use structured `preferredDate` (YYYY-MM-DD) and `preferredTimeSlot` (e.g., "04:00 PM").
- Public demo booking API endpoints must enforce rate limiting.
- Zero mock or placeholder demo records in production.
- Conforms strictly to Data Field Change Flow in `Architecture.md`.

---

## 7. Parent/Student Portal Flows

**Goal:** Provide parents and students with access to their data (attendance, fees, progress, etc.).

**Actors:** Parent, Student

**Key Capabilities:**
- Login with JWT-based authentication.
- View linked students (for parents with multiple children).
- Switch between siblings where applicable.
- View:
  - Attendance history
  - Fee records and payment status
  - Progress tracking entries
  - Coach information (as permitted)

**Constraints:**
- Frontend authorization is NOT a security boundary; backend + RLS enforce access.
- Sibling-switching logic must preserve existing contracts and relationships.
- No mock data; empty states shown where no records exist.

---

## 8. Admin Operations Flow

**Goal:** Define administrative capabilities and constraints.

**Actors:** Admin

**Key Capabilities:**
- Create/modify/delete coach records.
- Enroll students and assign coaches.
- Create/modify fee records and record payments.
- View and audit attendance, fees, and progress across all students.
- Manage user roles and access (within the defined role model).

**Constraints:**
- All admin actions must respect:
  - Backend RBAC
  - RLS policies
  - Audit logging requirements (`recordAudit()` / `tool_audit_logs`)
- Security-sensitive actions (role changes, coach/student assignments, fee modifications) must be logged.

---

## 9. Testimonials & Reviews Flow (if applicable)

**Goal:** Collect and display parent/student testimonials.

**Actors:** Parent, Student, Admin

**Steps:**
1. Enrolled parents/students can submit testimonials via the parent portal (if enabled).
2. Admin reviews and approves testimonials before publication.
3. Approved testimonials are displayed on public/appropriate pages.

**Constraints:**
- No fake or placeholder testimonials.
- Testimonials must be stored in DB with proper schema and audit trail (if implemented).
- If this flow is not implemented, do not add testimonial UI or APIs merely as placeholders.

---

## 10. Other Flows

Add additional flows here as needed, for example:

- Workshop registration and participation  
- Holiday camp enrollment  
- Certificate generation and distribution  
- Coach offboarding and data handover  

For each flow, document:

- Goal  
- Actors  
- Steps (high level)  
- Constraints (security, data, and architectural)  

---

## 11. Relationship to Other Documents

- Global engineering behavior: `~/.gemini/GEMINI.md`  
- Architecture & stack: `Architecture.md`  
- Security mechanisms: `Security.md`  
- UI/mobile patterns: `.agents/rules/mobile.md`

For business flows, this file (`Business_flows.md`) is authoritative for Smart Pen Academy.