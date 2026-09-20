-- ============================================================
-- AGENTBLAZER CLUB — Master PostgreSQL Schema & Migrations
-- Department of CS&E, St Joseph Engineering College (SJEC)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'hod',
        'faculty',
        'president',
        'secretary',
        'event_manager',
        'tech_lead',
        'member',
        'alumni'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM (
        'pending_approval',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------
-- 2. TABLES
-- ------------------------------------------------------------

-- PROFILES: Extends auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    role user_role NOT NULL DEFAULT 'member',
    role_level INTEGER NOT NULL DEFAULT 0,
    status approval_status NOT NULL DEFAULT 'pending_approval',
    title TEXT,
    avatar_url TEXT,
    expected_graduation_year INTEGER,
    auto_managed BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure required columns exist if profiles was pre-created
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status approval_status DEFAULT 'pending_approval';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expected_graduation_year INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_managed BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- EVENTS: Club workshops, hackathons, and symposiums
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    kind TEXT DEFAULT 'Workshop',
    color TEXT DEFAULT 't1',
    tracks TEXT[] DEFAULT '{}',
    note TEXT,
    foot TEXT,
    hint TEXT,
    image_url TEXT,
    gallery JSONB DEFAULT '{"label": "Gallery", "count": 4, "caption": "", "sub": "", "date": "", "images": []}'::jsonb,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 't1';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tracks TEXT[] DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS foot TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hint TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '{"label": "Gallery", "count": 4, "caption": "", "sub": "", "date": "", "images": []}'::jsonb;

-- TEAM MEMBERS: Officers, Faculty, Guests of Honor, Committee
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role_title TEXT,
    badge TEXT,
    category TEXT NOT NULL DEFAULT 'officer', -- 'guest', 'faculty', 'officer', 'committee'
    bio TEXT,
    photo_url TEXT,
    color TEXT DEFAULT 't1',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'officer';
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 't1';

-- CONTACT SUBMISSIONS: Public inquiries and club interest
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'archived'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backward compatibility view if submissions table exists
CREATE OR REPLACE VIEW public.submissions AS 
SELECT id, name, email, message, status, created_at FROM public.contact_submissions;

-- AUDIT LOG: Privilege actions and role changes
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    row_id TEXT,
    action TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    diff JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. TRIGGERS & FUNCTIONS
-- ------------------------------------------------------------

-- A. Automatically compute role_level from role
CREATE OR REPLACE FUNCTION public.calc_role_level()
RETURNS TRIGGER AS $$
BEGIN
    NEW.role_level := CASE NEW.role
        WHEN 'hod'::user_role THEN 6
        WHEN 'faculty'::user_role THEN 5
        WHEN 'president'::user_role THEN 4
        WHEN 'secretary'::user_role THEN 3
        WHEN 'event_manager'::user_role THEN 2
        WHEN 'tech_lead'::user_role THEN 1
        WHEN 'member'::user_role THEN 0
        WHEN 'alumni'::user_role THEN 0
        ELSE 0
    END;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_role_level ON public.profiles;
CREATE TRIGGER trg_calc_role_level
    BEFORE INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.calc_role_level();

-- B. Handle new Auth signups -> auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    email_text TEXT;
    join_year INTEGER;
    grad_year INTEGER;
    year_prefix TEXT;
BEGIN
    email_text := NEW.email;

    -- Strict validation: reject non-sjec domains at DB level
    IF email_text NOT LIKE '%@sjec.ac.in' THEN
        RAISE EXCEPTION 'Registration rejected: Institutional email (@sjec.ac.in) required.';
    END IF;

    -- Extract 2-digit joining year from patterns like 26d89.abc@sjec.ac.in
    year_prefix := substring(email_text from '^([0-9]{2})');
    IF year_prefix IS NOT NULL THEN
        join_year := 2000 + year_prefix::integer;
        grad_year := join_year + 4;
    ELSE
        grad_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer + 4;
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        role,
        role_level,
        status,
        expected_graduation_year,
        auto_managed,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        'member',
        0,
        'pending_approval',
        grad_year,
        true,
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- C. July 1 Alumni Rollover Procedure
CREATE OR REPLACE FUNCTION public.run_alumni_rollover()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER := 0;
BEGIN
    UPDATE public.profiles
    SET role = 'alumni',
        role_level = 0,
        updated_at = now()
    WHERE auto_managed = true
      AND expected_graduation_year IS NOT NULL
      AND CURRENT_DATE >= make_date(expected_graduation_year, 7, 1)
      AND role != 'alumni';

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows > 0 THEN
        INSERT INTO public.audit_log (table_name, action, diff, changed_at)
        VALUES ('profiles', 'ALUMNI_ROLLOVER', jsonb_build_object('affected_count', affected_rows), now());
    END IF;

    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles Policies:
-- Anyone can view active, approved profiles
DROP POLICY IF EXISTS "Public can view active profiles" ON public.profiles;
CREATE POLICY "Public can view active profiles" ON public.profiles
    FOR SELECT USING (is_active = true AND status = 'approved');

-- Users can view their own profile even if pending
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Staff (role_level >= 3) can view all profiles including pending
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role_level >= 3
        )
    );

-- Self-Modification Lockdown: A user cannot modify their own role, role_level, or status
DROP POLICY IF EXISTS "Faculty/HOD can update profiles" ON public.profiles;
CREATE POLICY "Faculty/HOD can update profiles" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role_level >= 5
        )
    )
    WITH CHECK (
        -- Lockdown: Cannot modify own profile
        id != auth.uid()
    );

-- Events Policies:
-- Public can view published events
DROP POLICY IF EXISTS "Public can view published events" ON public.events;
CREATE POLICY "Public can view published events" ON public.events
    FOR SELECT USING (is_published = true);

-- Event Manager (role_level >= 2) and above can manage events
DROP POLICY IF EXISTS "Event managers can manage events" ON public.events;
CREATE POLICY "Event managers can ALL on events" ON public.events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role_level >= 2
        )
    );

-- Team Members Policies:
-- Public can view active team members
DROP POLICY IF EXISTS "Public can view active team" ON public.team_members;
CREATE POLICY "Public can view active team" ON public.team_members
    FOR SELECT USING (is_active = true);

-- Secretary (role_level >= 3) and President (>= 4) can manage team members
DROP POLICY IF EXISTS "Officers can manage team members" ON public.team_members;
CREATE POLICY "Officers can manage team members" ON public.team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role_level >= 3
        )
    );

-- Contact Submissions Policies:
-- Anyone can insert a contact submission (public form)
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form" ON public.contact_submissions
    FOR INSERT WITH CHECK (true);

-- Secretary (>= 3) and above can view and update contact submissions
DROP POLICY IF EXISTS "Secretary and above can view submissions" ON public.contact_submissions;
CREATE POLICY "Secretary and above can view submissions" ON public.contact_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role_level >= 3
        )
    );

-- Audit Log Policies:
-- Read-only for tech_lead (>= 1) and above
DROP POLICY IF EXISTS "Officers can view audit log" ON public.audit_log;
CREATE POLICY "Officers can view audit log" ON public.audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role_level >= 1
        )
    );

-- ------------------------------------------------------------
-- 5. INITIAL SEED DATA
-- ------------------------------------------------------------

-- Seed Initial Events
INSERT INTO public.events (title, event_date, kind, color, tracks, note, foot, hint, description, gallery, is_published)
VALUES
(
    'Master the Future: A Hands-on GSoC & LLMs Workshop',
    'February 14, 2026',
    'Flagship Masterclass',
    't1',
    '{}',
    'Guest speaker: Anas Khan · Google DeepMind GSoC Alumni',
    '80 Shortlisted Students',
    'Hands-on Lab Prototype',
    'Practical masterclass on open-source Git PR workflows, Retrieval-Augmented Generation (RAG), Gemini AI, LangChain, LlamaIndex, CrewAI, and live Gradio prototyping.',
    '{"label": "Guest speaker: Anas Khan", "count": 8, "caption": "Master the Future: GSoC & LLMs", "sub": "Anas Khan · Google DeepMind GSoC Alumni", "date": "Feb 14, 2026", "images": []}'::jsonb,
    true
),
(
    'PROMPT OPS-2K26 Challenge',
    'March 25, 2026',
    'Live Contest',
    't2',
    ARRAY['Track 1: 1st Year Engineers', 'Track 2: 2nd Year Engineers'],
    'Fast-paced prompt engineering hackathon',
    '10 Contest Photos',
    'Live Algorithmic Benchmark',
    'Fast-paced prompt engineering hackathon featuring automated test suites, iterative refinement, teamwork, and live algorithmic problem solving.',
    '{"label": "Contest gallery", "count": 10, "caption": "PROMPT OPS-2K26 Challenge", "sub": "CSE Department · AgentBlazer Club", "date": "Mar 25, 2026", "images": []}'::jsonb,
    true
),
(
    'Agentforce Technical Deep-Dive',
    'August 25, 2025',
    'Symposium Keynote',
    't2',
    '{}',
    'Inaugural Technical Session',
    'CSE Auditorium',
    'Keynote Address',
    'Guiding undergraduate engineers from prompt prediction to autonomous agentic architectures, Salesforce Data Cloud integration, and real-time enterprise workflows.',
    '{"label": "Guest speaker: Mr. Suhas Nayak", "count": 3, "caption": "Agentforce Technical Deep-Dive", "sub": "Inaugural symposium · CSE Auditorium", "date": "Aug 25, 2025", "images": []}'::jsonb,
    true
),
(
    'Demystifying Generative Models',
    'March 18, 2026',
    'Student Lab',
    't2',
    '{}',
    'Session Leads: Prajwal Royston Cordiero & Chacko P Abraham',
    'Systems Lab',
    'Hands-on Code Walkthrough',
    'Exploring Transformer mechanics, multi-agent consensus networks, and comparative latency benchmarks of LLaMA, Groq, and Mistral architectures.',
    '{"label": "Student lab gallery", "count": 5, "caption": "Demystifying Generative Models", "sub": "VI Sem CSE Cohort · Systems Lab", "date": "Mar 18, 2026", "images": []}'::jsonb,
    true
),
(
    'Cyber Security & Career Pathways',
    'April 01, 2026',
    'Security Workshop',
    't1',
    '{}',
    'Demonstrations covering Shodan, OSINT & CVE analysis',
    'IV Sem CSE Cohort',
    'Security Demonstration',
    'Interactive demonstrations covering Shodan discovery, OSINT methods, CVE vulnerability analysis, SQL injection scenarios, and the Cyber Kill Chain.',
    '{"label": "Session gallery", "count": 6, "caption": "Cyber Security & Career Pathways", "sub": "Mr. Srinav Nayak · Sen Dev Lead, AgentForce", "date": "Apr 01, 2026", "images": []}'::jsonb,
    true
),
(
    'Hands-on Agentforce & AI Agents',
    'May 22, 2026',
    'Developer Lab',
    't3',
    '{}',
    'Platform: Salesforce Developer Sandbox',
    'Cloud Computing Lab',
    'Guided Practical Exercises',
    'Applied development lab creating Flex Prompts, dynamic contextual Sales Email templates, and autonomous event triggers within modern CRM pipelines.',
    '{"label": "Developer lab gallery", "count": 4, "caption": "Hands-on Agentforce & AI Agents", "sub": "Salesforce Developer Sandbox", "date": "May 22, 2026", "images": []}'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- Seed Initial Team Members
INSERT INTO public.team_members (name, role_title, badge, category, bio, photo_url, color, display_order, is_active)
VALUES
-- Guests
('Mr. Santosh Rebello', 'Guest of Honor', 'Keynote Speaker', 'guest', 'Salesforce', '', 't3', 1, true),
('Mr. Stephen Pinto', 'Technical Mentor', 'Alumni Guide', 'guest', 'Salesforce & SJEC Alumnus', '', 't1', 2, true),
('Dr. Rio D’Souza', 'Patron', 'Presidential Address', 'guest', 'Principal, SJEC', '', 't2', 3, true),
('Dr. Melwyn D’Souza', 'Program Chair', 'Department Head', 'guest', 'HOD, Computer Science & Engg', '', 't4', 4, true),

-- Faculty
('Ms. Nisha Roche', 'Faculty Coordinator', 'CSE Department', 'faculty', 'Assistant Professor, CSE · Faculty Coordinator', '', 't1', 5, true),
('Mr. Keith Fernandes', 'Faculty Coordinator', 'CSE Department', 'faculty', 'Assistant Professor, CSE · Faculty Coordinator', '', 't2', 6, true),

-- Core Officers
('Ruben Saldanha', 'President', 'Executive President', 'officer', 'Guiding club vision, university collaborations, and strategic workshop series.', '', 't2', 10, true),
('Ajay Preenal Dsouza', 'Vice President', 'Executive Vice President', 'officer', 'Coordinating student mentorship, event operations, and community growth.', '', 't2', 11, true),
('Stevin Dsouza', 'Tech Lead', 'Technical Direction', 'officer', 'Technical architectures, hands-on lab environments, and repository supervision.', '', 't1', 12, true),
('Frenny Chrystal Saldanha', 'Resource Head', 'Operations & Logistics', 'officer', 'Managing cloud compute budgets, venue infrastructure, and participant toolkits.', '', 't3', 13, true),
('Joyline Galbao', 'Secretary', 'Administration', 'officer', 'Documentation, accreditation reporting, meeting minutes, and member onboarding.', '', 't2', 14, true),
('Chinthan N V', 'Media Head', 'Creative Outreach', 'officer', 'Brand storytelling, photo documentation, visual design, and social publications.', '', 't4', 15, true),

-- Committee
('Prajwal Royston Cordiero', 'AI & LLM Research Group', 'Research', 'committee', 'Core Working Committee · Departmental Representative', '', 't1', 20, true),
('Chacko P Abraham', 'Model Evaluation Benchmarks', 'Evaluation', 'committee', 'Core Working Committee · Departmental Representative', '', 't2', 21, true),
('Alma Roxane Pereira', 'Project Operations & Labs', 'Operations', 'committee', 'Core Working Committee · Departmental Representative', '', 't3', 22, true)
ON CONFLICT DO NOTHING;
