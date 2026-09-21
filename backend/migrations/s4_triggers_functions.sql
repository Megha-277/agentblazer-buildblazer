-- ============================================================
-- S4: TRIGGERS & FUNCTIONS
-- Replaces/extends functions from the original schema.sql
-- Run after s1, s2, s3
-- ============================================================

-- ----------------------------------------------------------------
-- A. calc_role_level — kept identical; syncs role_level from role
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_role_level()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.role_level := CASE NEW.role::text
    WHEN 'hod'           THEN 6
    WHEN 'faculty'       THEN 5
    WHEN 'president'     THEN 4
    WHEN 'secretary'     THEN 3
    WHEN 'event_manager' THEN 2
    WHEN 'tech_lead'     THEN 1
    ELSE 0
  END;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_role_level ON public.profiles;
CREATE TRIGGER trg_calc_role_level
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.calc_role_level();

-- ----------------------------------------------------------------
-- B. handle_new_auth_user
--    Updated: sets must_change_password = true and joining_year
--    for every new Auth signup. Old application-flow fields
--    (status, title='pending_approval') are still set for
--    backward compat with existing rows; new flow ignores them.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  email_text  TEXT;
  join_year   INTEGER;
  grad_year   INTEGER;
  yr_prefix   TEXT;
BEGIN
  email_text := NEW.email;

  -- Extract 2-digit joining year from SJEC email pattern (e.g. 26d89.abc@sjec.ac.in)
  yr_prefix := substring(email_text FROM '^([0-9]{2})');
  IF yr_prefix IS NOT NULL THEN
    join_year := 2000 + yr_prefix::integer;
    grad_year := join_year + 4;
  ELSE
    join_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
    grad_year := join_year + 4;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    role_level,
    joining_year,
    current_academic_year,
    expected_graduation_year,
    must_change_password,
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
    join_year,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer,
    grad_year,
    -- must_change_password = true for all new accounts;
    -- admin-created accounts get a temp password and MUST reset on first login
    true,
    true,
    false,   -- is_active = false until President/Faculty activates
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    joining_year = EXCLUDED.joining_year,
    updated_at   = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------
-- C. prevent_self_role_change
--    Nobody can change their own role, role_level, or auto_managed.
--    Enforced at trigger level; not bypassable via RLS misconfiguration.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() = OLD.id THEN
    IF (NEW.role IS DISTINCT FROM OLD.role)
    OR (NEW.role_level IS DISTINCT FROM OLD.role_level)
    OR (NEW.auto_managed IS DISTINCT FROM OLD.auto_managed) THEN
      RAISE EXCEPTION 'Self-privilege modification is forbidden.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- ----------------------------------------------------------------
-- D. run_alumni_rollover
--    Respects auto_managed flag — manually overridden profiles
--    are never touched by the automated rollover.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_alumni_rollover()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  UPDATE public.profiles
    SET role       = 'alumni',
        role_level = 0,
        is_active  = false,
        updated_at = now()
    WHERE auto_managed = true
      AND expected_graduation_year IS NOT NULL
      AND CURRENT_DATE >= make_date(expected_graduation_year, 7, 1)
      AND role::text <> 'alumni';

  GET DIAGNOSTICS affected = ROW_COUNT;

  IF affected > 0 THEN
    INSERT INTO public.audit_log (table_name, action, diff, changed_at)
    VALUES (
      'profiles',
      'ALUMNI_ROLLOVER',
      jsonb_build_object('affected_count', affected),
      now()
    );
  END IF;

  RETURN affected;
END;
$$;

-- ----------------------------------------------------------------
-- E. sync_discussion_reply_count
--    Keeps discussion_threads.reply_count and last_reply_at current.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_reply_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discussion_threads
      SET reply_count  = reply_count + 1,
          last_reply_at = NEW.created_at,
          updated_at   = now()
      WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.discussion_threads
      SET reply_count  = GREATEST(reply_count - 1, 0),
          updated_at   = now()
      WHERE id = OLD.thread_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reply_count ON public.discussion_replies;
CREATE TRIGGER trg_sync_reply_count
  AFTER INSERT OR DELETE ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.sync_reply_count();

-- ----------------------------------------------------------------
-- F. Updated updated_at on announcements
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_threads_updated_at ON public.discussion_threads;
CREATE TRIGGER trg_threads_updated_at
  BEFORE UPDATE ON public.discussion_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_replies_updated_at ON public.discussion_replies;
CREATE TRIGGER trg_replies_updated_at
  BEFORE UPDATE ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_notif_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
