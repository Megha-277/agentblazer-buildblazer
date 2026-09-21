-- ============================================================
-- S1: NEW TABLES
-- AgentBlazer Club — Part A additions
-- Run this FIRST, before s2–s5.
-- ============================================================

-- ----------------------------------------------------------------
-- A. Add new columns to existing profiles table
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS joining_year             INTEGER,
  ADD COLUMN IF NOT EXISTS current_academic_year    INTEGER,
  ADD COLUMN IF NOT EXISTS must_change_password     BOOLEAN NOT NULL DEFAULT false;

-- Populate joining_year for existing rows that have expected_graduation_year
UPDATE public.profiles
  SET joining_year = expected_graduation_year - 4
  WHERE joining_year IS NULL AND expected_graduation_year IS NOT NULL;

-- ----------------------------------------------------------------
-- B. ANNOUNCEMENTS
--    Public announcements from the club; pinnable on homepage.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body           TEXT         NOT NULL CHECK (char_length(body) <= 5000),
  category       TEXT         NOT NULL DEFAULT 'general'
                              CHECK (category IN (
                                'general','competition','registration',
                                'workshop','achievement','notice'
                              )),
  is_published   BOOLEAN      NOT NULL DEFAULT false,
  is_pinned      BOOLEAN      NOT NULL DEFAULT false,
  published_at   TIMESTAMPTZ,
  created_by     UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published
  ON public.announcements (is_published, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_pinned
  ON public.announcements (is_pinned) WHERE is_pinned = true;

-- ----------------------------------------------------------------
-- C. SUBSCRIBERS
--    Public email opt-in for club updates.
--    Designed to support unsubscribe later via status/unsubscribed_at.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscribers (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT         NOT NULL UNIQUE CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name             TEXT,
  status           TEXT         NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','unsubscribed')),
  unsubscribed_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email
  ON public.subscribers (email);

CREATE INDEX IF NOT EXISTS idx_subscribers_status
  ON public.subscribers (status);

-- ----------------------------------------------------------------
-- D. DISCUSSION THREADS
--    Internal members-only discussion platform.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_threads (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body         TEXT         NOT NULL CHECK (char_length(body) <= 10000),
  category     TEXT         NOT NULL DEFAULT 'general'
               CHECK (category IN (
                 'general','events','projects','recruitment','technical'
               )),
  created_by   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_pinned    BOOLEAN      NOT NULL DEFAULT false,
  reply_count  INTEGER      NOT NULL DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_category
  ON public.discussion_threads (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_threads_created_by
  ON public.discussion_threads (created_by);

-- ----------------------------------------------------------------
-- E. DISCUSSION REPLIES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID         NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  body        TEXT         NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_by  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replies_thread
  ON public.discussion_replies (thread_id, created_at ASC);

-- ----------------------------------------------------------------
-- F. UNREAD MARKERS
--    Tracks which threads/replies each member has seen.
--    A row's absence = unread. Inserted on first view.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unread_markers (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id  UUID        NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  last_read  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_unread_user
  ON public.unread_markers (user_id);

-- ----------------------------------------------------------------
-- G. NOTIFICATION PREFERENCES
--    Per-user toggle for email notifications on unread/replies.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id                   UUID     PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_on_reply            BOOLEAN  NOT NULL DEFAULT true,
  email_on_new_thread       BOOLEAN  NOT NULL DEFAULT false,
  email_on_announcements    BOOLEAN  NOT NULL DEFAULT true,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
