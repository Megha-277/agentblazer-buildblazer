-- ============================================================
-- S6: CLEANUP — Remove unwanted seeded accounts
-- Run this in Supabase SQL Editor ONCE.
-- Removes any auto-created profiles with role = 'event_manager'
-- that are not linked to a real invited member.
-- SAFE: only deletes rows where is_active=true AND auto_managed=true
-- (i.e. machine-created, never touched by a human admin).
-- ============================================================

-- Preview first — run SELECT to confirm what will be deleted
SELECT id, full_name, email, role, role_level, is_active, auto_managed, created_at
FROM public.profiles
WHERE role = 'event_manager'
  AND auto_managed = true;

-- After confirming, delete those auth users (cascades to profiles)
-- Replace the UUIDs below with actual IDs from the SELECT above
-- OR use the DELETE directly if you trust the filter:

DELETE FROM auth.users
WHERE id IN (
  SELECT id FROM public.profiles
  WHERE role = 'event_manager'
    AND auto_managed = true
);

-- Verify cleanup
SELECT COUNT(*) AS remaining_event_managers
FROM public.profiles
WHERE role = 'event_manager';
