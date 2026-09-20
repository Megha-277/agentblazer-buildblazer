// login.js — handles the login form on login.html
// Assumes supabaseClient.js is loaded first and the form has:
//   <form id="login-form">
//     <input id="login-email" type="email" required>
//     <input id="login-password" type="password" required>
//     <button type="submit">Log in</button>
//   </form>
//   <p id="login-error" hidden></p>

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;

  try {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      // Backend always returns the same generic message for any failure —
      // don't add more specific handling here, or you reintroduce the
      // user-enumeration leak the backend was written to avoid.
      throw new Error("Invalid email or password.");
    }

    const { access_token, refresh_token } = await res.json();

    // Session lives in sessionStorage (cleared when the tab closes) rather
    // than localStorage — slightly reduces the window an XSS bug could
    // exfiltrate a long-lived token. Not as strong as an httpOnly cookie,
    // but a reasonable middle ground without a full backend-proxy rewrite.
    sessionStorage.setItem("ab-session", JSON.stringify({ access_token, refresh_token }));

    const client = await getSupabaseClient();
    await client.auth.setSession({ access_token, refresh_token });

    window.location.href = "/admin";
  } catch (err) {
    errorEl.textContent = err.message || "Something went wrong. Please try again.";
    errorEl.hidden = false;
  }
});