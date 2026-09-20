// supabaseClient.js — shared across index.html, admin.html, login.html
// Loaded as a plain <script> (no build step needed), AFTER config.js:
//   <script src="config.js" defer></script>
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
//   <script src="supabaseClient.js" defer></script>
//   <script src="your-page-script.js" defer></script>
//
// Fetches URL + anon key from the backend's /api/config instead of a
// frontend .env file — the anon key is meant to be public (RLS protects
// the actual data), this just avoids duplicating config in two places.

let supabaseClient = null;

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const res = await fetch(`${API_BASE_URL}/api/config`);
  if (!res.ok) throw new Error("Could not load Supabase config from backend.");
  const { supabaseUrl, supabaseAnonKey } = await res.json();

  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

// If a login session was stored earlier (see login.js), restore it so
// the client is authenticated on every subsequent page load.
async function restoreSession() {
  const client = await getSupabaseClient();
  const stored = sessionStorage.getItem("ab-session");
  if (stored) {
    const { access_token, refresh_token } = JSON.parse(stored);
    await client.auth.setSession({ access_token, refresh_token });
  }
  return client;
}