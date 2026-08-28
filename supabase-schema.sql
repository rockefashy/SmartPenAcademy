-- =========================================================================================
-- SmartPen Academy - Supabase PostgreSQL Schema & Security Script
-- Execute this script directly in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =========================================================================================
-- 1. STUDENTS TABLE
-- =========================================================================================
create table if not exists public.students (
    id text primary key,
    student_id text,
    full_name text not null,
    date_of_birth date,
    gender text default 'Other',
    grade_class text,
    dominant_hand text default 'Right',
    school_name text,
    instruction_medium text default 'English',
    parent_name text not null,
    relationship text default 'Parent',
    whatsapp_mobile text not null,
    email text not null,
    residential_area text,
    scripts_required jsonb default '["Cursive Writing"]'::jsonb,
    academic_modules jsonb default '["Exam Speed & Layouts"]'::jsonb,
    diagnostic_observations jsonb default '[]'::jsonb,
    preferred_days text,
    preferred_slot text,
    practice_commitment boolean default true,
    fee_policy_accepted boolean default true,
    media_consent boolean default true,
    grip_classification text default 'Tripod',
    initial_pressure_level text default 'Optimal',
    baseline_speed_wpm integer default 15,
    recommended_level text default 'Level 1',
    coach_remarks text,
    username text,
    status text default 'Active',
    enrollment_date date default current_date,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 2. USERS & AUTH ROLES TABLE
-- =========================================================================================
create table if not exists public.users (
    id text primary key default ('usr-' || replace(uuid_generate_v4()::text, '-', '')),
    email text unique not null,
    full_name text not null,
    phone text,
    role text not null default 'student' check (role in ('admin', 'coach', 'student', 'parent')),
    student_id text references public.students(id) on delete set null,
    avatar_url text,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 3. ATTENDANCE LOGS TABLE
-- =========================================================================================
create table if not exists public.attendance (
    id text primary key default ('att-' || replace(uuid_generate_v4()::text, '-', '')),
    student_id text not null references public.students(id) on delete cascade,
    date date not null,
    year_month text not null,
    status text not null default 'Present' check (status in ('Present', 'Absent', 'Excused', 'Late')),
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 4. FEES & RECEIPTS TABLE
-- =========================================================================================
create table if not exists public.fees (
    id text primary key default ('fee-' || replace(uuid_generate_v4()::text, '-', '')),
    student_id text not null references public.students(id) on delete cascade,
    date date not null default current_date,
    year_month text not null,
    milestone text,
    is_paid boolean default false,
    status text default 'Pending' check (status in ('Paid', 'Pending', 'Overdue', 'Waived')),
    paid_date date,
    amount numeric(10, 2) not null default 1600.00,
    receipt_number text,
    receipt_no text,
    payment_method text default 'In-Person Reception - Cash',
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 5. PROGRESS TRACKERS TABLE
-- =========================================================================================
create table if not exists public.progress_trackers (
    id text primary key default ('prog-' || replace(uuid_generate_v4()::text, '-', '')),
    student_id text not null references public.students(id) on delete cascade,
    evaluation_date date default current_date,
    evaluation_title text not null default 'After 10 Classes',
    completed_classes integer default 10,
    total_classes integer default 12,
    skills jsonb not null default '[]'::jsonb,
    overall_stars integer default 3,
    overall_remark text,
    teacher_feedback text,
    next_steps jsonb default '[]'::jsonb,
    comments text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 6. STUDENT WORKS / SAMPLES TABLE
-- =========================================================================================
create table if not exists public.student_works (
    id text primary key default ('work-' || replace(uuid_generate_v4()::text, '-', '')),
    student_id text not null references public.students(id) on delete cascade,
    title text default 'Practice Work',
    image_data text not null,
    file_url text,
    capture_date date default current_date,
    category text default 'Before' check (category in ('Before', 'After', 'Daily Practice', 'Exam Paper', 'Assessment', 'Competition')),
    comments text,
    score integer,
    status text default 'Submitted',
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 7. PROGRESS EVALUATION REPORTS TABLE
-- =========================================================================================
create table if not exists public.progress_reports (
    id text primary key default ('rep-' || replace(uuid_generate_v4()::text, '-', '')),
    student_id text not null references public.students(id) on delete cascade,
    report_date date default current_date,
    report_title text not null default 'SMART PEN ACADEMY HANDWRITING PROGRESS REPORT',
    milestone_title text not null default 'After 10 Classes',
    completed_classes integer default 10,
    total_classes integer default 12,
    skills jsonb not null default '[]'::jsonb,
    overall_stars integer default 3,
    overall_remark text,
    teacher_feedback text,
    next_steps jsonb default '[]'::jsonb,
    before_photo_id text,
    before_photo_data text,
    after_photo_id text,
    after_photo_data text,
    comments text,
    saved_to_folder text default '/progress_reports/',
    created_at timestamp with time zone default timezone('utc'::text, now()),
    emailed_to_parent_at timestamp with time zone
);

-- =========================================================================================
-- 8. DEMO CLASS BOOKINGS TABLE
-- =========================================================================================
create table if not exists public.demo_bookings (
    id text primary key default ('demo-' || replace(uuid_generate_v4()::text, '-', '')),
    student_name text not null,
    age text not null,
    contact_number text not null,
    preferred_slot text default 'All days: 5:00 PM - 6:00 PM',
    status text default 'New' check (status in ('New', 'Contacted', 'Scheduled', 'Completed', 'Cancelled')),
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 9. ADMIN NOTIFICATION ALERTS TABLE
-- =========================================================================================
create table if not exists public.alerts (
    id text primary key default ('alt-' || replace(uuid_generate_v4()::text, '-', '')),
    type text default 'demo_booking',
    title text not null,
    message text not null,
    demo_booking_id text,
    student_id text references public.students(id) on delete cascade,
    is_read boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 10. TESTIMONIALS & REVIEWS TABLE
-- =========================================================================================
create table if not exists public.testimonials (
    id text primary key default ('test-' || replace(uuid_generate_v4()::text, '-', '')),
    student_id text references public.students(id) on delete set null,
    student_name text not null,
    parent_name text not null,
    student_grade text,
    grade text,
    school_name text,
    relationship text default 'Parent',
    rating integer not null default 5 check (rating between 1 and 5),
    title text not null,
    review text not null,
    review_text text,
    before_after_tag text default '5 Star Transformation',
    image text,
    media_consent boolean default true,
    status text default 'Featured',
    is_featured boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- 11. FEE REMINDERS TABLE
-- =========================================================================================
create table if not exists public.fee_reminders (
    id text primary key default ('rem-' || replace(uuid_generate_v4()::text, '-', '')),
    student_id text not null references public.students(id) on delete cascade,
    parent_name text not null,
    parent_phone text,
    parent_email text not null,
    amount_due numeric(10, 2) not null default 1600.00,
    due_date date,
    reminder_channel text default 'WhatsApp',
    reminder_count integer default 1,
    status text default 'Sent',
    sent_at timestamp with time zone default timezone('utc'::text, now()),
    notes text
);

-- =========================================================================================
-- 12. AI AGENT TOOL AUDIT LOGS TABLE
-- =========================================================================================
create table if not exists public.tool_audit_logs (
    id text primary key default ('log-' || replace(uuid_generate_v4()::text, '-', '')),
    user_id text,
    user_role text default 'student',
    tool_name text not null,
    action_summary text not null,
    input_payload jsonb,
    output_result jsonb,
    status text default 'success',
    error_message text,
    duration_ms integer,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- =========================================================================================
-- ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- =========================================================================================
alter table public.students enable row level security;
alter table public.users enable row level security;
alter table public.attendance enable row level security;
alter table public.fees enable row level security;
alter table public.progress_trackers enable row level security;
alter table public.student_works enable row level security;
alter table public.progress_reports enable row level security;
alter table public.demo_bookings enable row level security;
alter table public.alerts enable row level security;
alter table public.testimonials enable row level security;
alter table public.fee_reminders enable row level security;
alter table public.tool_audit_logs enable row level security;

-- Drop and recreate permissive access policies
drop policy if exists "Allow all on students" on public.students;
create policy "Allow all on students" on public.students for all using (true) with check (true);

drop policy if exists "Allow all on users" on public.users;
create policy "Allow all on users" on public.users for all using (true) with check (true);

drop policy if exists "Allow all on attendance" on public.attendance;
create policy "Allow all on attendance" on public.attendance for all using (true) with check (true);

drop policy if exists "Allow all on fees" on public.fees;
create policy "Allow all on fees" on public.fees for all using (true) with check (true);

drop policy if exists "Allow all on progress_trackers" on public.progress_trackers;
create policy "Allow all on progress_trackers" on public.progress_trackers for all using (true) with check (true);

drop policy if exists "Allow all on student_works" on public.student_works;
create policy "Allow all on student_works" on public.student_works for all using (true) with check (true);

drop policy if exists "Allow all on progress_reports" on public.progress_reports;
create policy "Allow all on progress_reports" on public.progress_reports for all using (true) with check (true);

drop policy if exists "Allow all on demo_bookings" on public.demo_bookings;
create policy "Allow all on demo_bookings" on public.demo_bookings for all using (true) with check (true);

drop policy if exists "Allow all on alerts" on public.alerts;
create policy "Allow all on alerts" on public.alerts for all using (true) with check (true);

drop policy if exists "Allow all on testimonials" on public.testimonials;
create policy "Allow all on testimonials" on public.testimonials for all using (true) with check (true);

drop policy if exists "Allow all on fee_reminders" on public.fee_reminders;
create policy "Allow all on fee_reminders" on public.fee_reminders for all using (true) with check (true);

drop policy if exists "Allow all on tool_audit_logs" on public.tool_audit_logs;
create policy "Allow all on tool_audit_logs" on public.tool_audit_logs for all using (true) with check (true);

-- =========================================================================================
-- INITIAL SEED: ADMINISTRATOR ACCOUNT ONLY
-- =========================================================================================
insert into public.users (id, email, full_name, role, student_id, is_active)
values (
    'usr-admin',
    'rockefashy@gmail.com',
    'Mrs. Deepthy Rock (Principal Coach)',
    'admin',
    null,
    true
)
on conflict (email) do nothing;

-- Reload schema cache in PostgREST
notify pgrst, 'reload schema';
