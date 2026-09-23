-- ============================================================
-- S2: ROLES & PERMISSIONS (RLS POLICIES)
-- Run after s1_tables.sql
-- ============================================================

-- ----------------------------------------------------------------
-- HELPER FUNCTIONS
-- Explicitly dropping with CASCADE first allows changing return types 
-- or signatures without triggering PostgreSQL error 42P13 or 3BP01.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.current_role_level() CASCADE;

CREATE OR REPLACE FUNCTION public.current_role_level()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role_level FROM public.profiles WHERE id = auth.uid()),
    0
  );
$$;

DROP FUNCTION IF EXISTS public.current_role() CASCADE;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.profiles WHERE id = auth.uid()),
    'member'
  );
$$;

-- ================================================================
-- TEAM_MEMBERS
-- ================================================================
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Officers can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "team_write_senior"                ON public.team_members;
DROP POLICY IF EXISTS "team_update_secretary"            ON public.team_members;
DROP POLICY IF EXISTS "Public can view active team"      ON public.team_members;
DROP POLICY IF EXISTS "team_select_public"               ON public.team_members;
DROP POLICY IF EXISTS "team_write_event_manager_and_above" ON public.team_members;

CREATE POLICY "team_select_public"
  ON public.team_members FOR SELECT
  USING (is_active = true OR public.current_role_level() >= 1);

-- Event Manager (2) and above can fully manage team members
CREATE POLICY "team_write_event_manager_and_above"
  ON public.team_members FOR ALL
  TO authenticated
  USING  (public.current_role_level() >= 2)
  WITH CHECK (public.current_role_level() >= 2);

-- ================================================================
-- ANNOUNCEMENTS
-- ================================================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_public" ON public.announcements;
DROP POLICY IF EXISTS "announcements_write"         ON public.announcements;

-- Public: only published announcements
CREATE POLICY "announcements_select_public"
  ON public.announcements FOR SELECT
  USING (
    is_published = true
    OR public.current_role_level() >= 2
  );

-- Event Manager (2) and above: create/edit/delete
CREATE POLICY "announcements_write"
  ON public.announcements FOR ALL
  TO authenticated
  USING  (public.current_role_level() >= 2)
  WITH CHECK (public.current_role_level() >= 2);

-- ================================================================
-- SUBSCRIBERS
-- ================================================================
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscribers_insert_public" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_select_staff"  ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_update_staff"  ON public.subscribers;

-- Anyone can subscribe (public insert)
CREATE POLICY "subscribers_insert_public"
  ON public.subscribers FOR INSERT
  WITH CHECK (true);

-- Only staff (level >= 3) can read the subscriber list
CREATE POLICY "subscribers_select_staff"
  ON public.subscribers FOR SELECT
  TO authenticated
  USING (public.current_role_level() >= 3);

-- Staff can update (e.g. mark unsubscribed)
CREATE POLICY "subscribers_update_staff"
  ON public.subscribers FOR UPDATE
  TO authenticated
  USING  (public.current_role_level() >= 3)
  WITH CHECK (public.current_role_level() >= 3);

-- ================================================================
-- DISCUSSION_THREADS
-- ================================================================
ALTER TABLE public.discussion_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_select_members"     ON public.discussion_threads;
DROP POLICY IF EXISTS "threads_insert_members"     ON public.discussion_threads;
DROP POLICY IF EXISTS "threads_update_own_or_staff" ON public.discussion_threads;
DROP POLICY IF EXISTS "threads_delete_staff"       ON public.discussion_threads;

-- All active members (level >= 0) can read threads
CREATE POLICY "threads_select_members"
  ON public.discussion_threads FOR SELECT
  TO authenticated
  USING (public.current_role_level() >= 0);

-- Any active member can create a thread
CREATE POLICY "threads_insert_members"
  ON public.discussion_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_role_level() >= 0
    AND auth.uid() = created_by
  );

-- Author can update their own thread; staff (>=3) can update any
CREATE POLICY "threads_update_own_or_staff"
  ON public.discussion_threads FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.current_role_level() >= 3
  )
  WITH CHECK (
    auth.uid() = created_by
    OR public.current_role_level() >= 3
  );

-- Only staff (>=3) can delete threads
CREATE POLICY "threads_delete_staff"
  ON public.discussion_threads FOR DELETE
  TO authenticated
  USING (public.current_role_level() >= 3);

-- ================================================================
-- DISCUSSION_REPLIES
-- ================================================================
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "replies_select_members"     ON public.discussion_replies;
DROP POLICY IF EXISTS "replies_insert_members"     ON public.discussion_replies;
DROP POLICY IF EXISTS "replies_update_own_or_staff" ON public.discussion_replies;
DROP POLICY IF EXISTS "replies_delete_own_or_staff" ON public.discussion_replies;

CREATE POLICY "replies_select_members"
  ON public.discussion_replies FOR SELECT
  TO authenticated
  USING (public.current_role_level() >= 0);

CREATE POLICY "replies_insert_members"
  ON public.discussion_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_role_level() >= 0
    AND auth.uid() = created_by
  );

CREATE POLICY "replies_update_own_or_staff"
  ON public.discussion_replies FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.current_role_level() >= 3
  )
  WITH CHECK (
    auth.uid() = created_by
    OR public.current_role_level() >= 3
  );

CREATE POLICY "replies_delete_own_or_staff"
  ON public.discussion_replies FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.current_role_level() >= 3
  );

-- ================================================================
-- UNREAD_MARKERS
-- ================================================================
ALTER TABLE public.unread_markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unread_own" ON public.unread_markers;

-- Users can only see/manage their own unread markers
CREATE POLICY "unread_own"
  ON public.unread_markers FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- NOTIFICATION_PREFERENCES
-- ================================================================
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_own" ON public.notification_preferences;

-- Users manage their own preferences; staff can read all
CREATE POLICY "notif_prefs_own"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.current_role_level() >= 3
  )
  WITH CHECK (auth.uid() = user_id);