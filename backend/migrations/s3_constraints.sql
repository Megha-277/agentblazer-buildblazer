-- ============================================================
-- S3: CONSTRAINTS
-- Partial unique indexes enforcing single active President
-- and single active Secretary at the database level.
-- Run after s1_tables.sql
-- ============================================================

-- ONE active President at a time
-- Assigning a second president while one is already active will
-- raise a unique violation at the DB level — not just UI gating.
DROP INDEX IF EXISTS public.uq_active_president;
CREATE UNIQUE INDEX uq_active_president
  ON public.profiles (role)
  WHERE role = 'president' AND is_active = true;

-- ONE active Secretary at a time
DROP INDEX IF EXISTS public.uq_active_secretary;
CREATE UNIQUE INDEX uq_active_secretary
  ON public.profiles (role)
  WHERE role = 'secretary' AND is_active = true;

-- NOTE: All other roles (event_manager, tech_lead, member, alumni,
-- faculty, hod) allow multiple concurrent active members — no
-- uniqueness constraint on those.