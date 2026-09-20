// frontend/login.js — handles the login form on login.html

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim().slice(0, 254);
  const password = document.getElementById("login-password").value.slice(0, 128);
  const errorEl = document.getElementById("login-error");

  // Basic client-side guards — real validation happens on the backend
  if (!email || !password) return;

  if (errorEl) {
    errorEl.classList.remove("on");
    errorEl.style.display = "none";
    errorEl.hidden = true;
    errorEl.textContent = "";   // clear any previous message before a new attempt
  }

  // Fallback to window.API_BASE_URL or empty relative string if config.js variable isn't globally bound
  const baseUrl = typeof window.API_BASE_URL !== "undefined" 
    ? window.API_BASE_URL 
    : (typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "");

  try {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      // Backend returns message for invalid credentials / status check
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Entered password and email mismatch");
    }

    const { access_token, refresh_token } = await res.json();

    // Store tokens in sessionStorage
    sessionStorage.setItem("ab-session", JSON.stringify({ access_token, refresh_token }));

    // Sync session state with Supabase client if helper exists
    if (typeof getSupabaseClient === "function") {
      const client = await getSupabaseClient();
      await client.auth.setSession({ access_token, refresh_token });
    } else if (typeof supabaseClient !== "undefined") {
      await supabaseClient.auth.setSession({ access_token, refresh_token });
    }

    // Redirect to static admin page
    window.location.href = "admin.html";

  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Entered password and email mismatch";
      errorEl.classList.add("on");
      errorEl.style.display = "flex";
      errorEl.hidden = false;
    } else {
      console.error("Login Error:", err);
    }
  }
});