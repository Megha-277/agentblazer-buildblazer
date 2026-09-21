// dashboard/login.js — handles login.html form submission

document.getElementById("login-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  var email    = document.getElementById("login-email").value.trim().slice(0, 254);
  var password = document.getElementById("login-password").value.slice(0, 128);
  var errorEl  = document.getElementById("login-error");
  var btn      = document.getElementById("login-btn");

  if (!email || !password) return;

  if (errorEl) { errorEl.hidden = true; errorEl.textContent = ""; }

  var baseUrl = (typeof window.API_BASE_URL !== "undefined") ? window.API_BASE_URL : "";

  btn.disabled = true;
  btn.textContent = "Signing in…";

  try {
    var res = await fetch(baseUrl + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    });

    if (!res.ok) {
      var errData = await res.json().catch(function () { return {}; });
      throw new Error(errData.detail || "Entered password and email mismatch.");
    }

    var data = await res.json();
    var access_token  = data.access_token;
    var refresh_token = data.refresh_token;
    var must_change   = data.must_change_password || false;

    // SESSION BEHAVIOR: store ONLY in sessionStorage.
    // sessionStorage is cleared on browser close / hard reload — satisfying
    // the "hard reload = logout" requirement. It persists across JS-driven
    // tab switches within the same browser tab (no forced re-login on nav).
    sessionStorage.setItem("ab-session", JSON.stringify({ access_token: access_token, refresh_token: refresh_token }));
    // Remove any stale localStorage copy from the old system
    try { localStorage.removeItem("ab-session"); localStorage.removeItem("ab-session-v1"); } catch (_) {}

    // Sync Supabase client session
    if (typeof getSupabaseClient === "function") {
      try {
        var client = await getSupabaseClient();
        await client.auth.setSession({ access_token: access_token, refresh_token: refresh_token });
      } catch (_) {}
    }

    // If first login, go to change-password before the dashboard
    if (must_change) {
      window.location.href = "change-password.html";
    } else {
      window.location.href = "admin.html";
    }

  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Something went wrong. Please try again.";
      errorEl.hidden = false;
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Sign in <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  }
});
