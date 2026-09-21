-- ============================================================
-- S5: SEED / DEFAULT DATA
-- Run after s1–s4
-- ============================================================

-- ----------------------------------------------------------------
-- A. Seed announcements (sample pinned announcement)
-- ----------------------------------------------------------------
INSERT INTO public.announcements
  (title, body, category, is_published, is_pinned, published_at)
VALUES
  (
    'Welcome to AgentBlazer Club — Academic Year 2025–2026',
    'The AgentBlazer Club officially kicks off its inaugural cohort for the 2025–2026 academic year at SJEC CSE. Our mission: equip engineers with autonomous AI, Salesforce Agentforce, and open-source agentic system skills. Stay tuned for workshop announcements, competitions, and recruitment openings.',
    'general',
    true,
    true,
    now()
  ),
  (
    'PROMPT OPS-2K26 Challenge — Registration Open',
    'Fast-paced prompt engineering hackathon for 1st and 2nd year CSE engineers. Two tracks, automated test suites, and live algorithmic benchmarks. Shortlisting underway. Check the Events page for full details.',
    'competition',
    true,
    false,
    now()
  )
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- B. Default notification preferences are created on-demand
--    by the backend when a user first accesses the dashboard.
--    No seed needed here — the table starts empty.
-- ----------------------------------------------------------------

-- ----------------------------------------------------------------
-- C. Ensure the site_content row (legacy payload store) exists
-- ----------------------------------------------------------------
INSERT INTO public.site_content (id, payload)
VALUES (1, '{
  "events":    [],
  "officers":  [],
  "committee": [],
  "faculty":   [],
  "guests":    []
}'::jsonb)
ON CONFLICT (id) DO NOTHING;
