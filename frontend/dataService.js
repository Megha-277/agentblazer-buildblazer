/* ============================================================
   AGENTBLAZER CLUB — Dynamic Data Service
   Department of Computer Science & Engineering, SJEC
   ------------------------------------------------------------
   Fetches dynamic data directly from Supabase with graceful
   fallback to backend API / local cache.
   Zero hardcoding in HTML files.
   ============================================================ */

(function () {
  "use strict";

  const BASE_URL = typeof window.API_BASE_URL !== "undefined" ? window.API_BASE_URL : "";

  // Helper to safely sanitize and escape text
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Fetch events dynamically from Supabase
  async function getEvents() {
    try {
      if (typeof getSupabaseClient === "function") {
        const client = await getSupabaseClient();
        const { data, error } = await client
          .table("events")
          .select("*")
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map(e => ({
            id: e.id,
            title: e.title,
            date: e.event_date || "",
            kind: e.kind || "Workshop",
            color: e.color || "t1",
            desc: e.description || "",
            tracks: Array.isArray(e.tracks) ? e.tracks : [],
            note: e.note || "",
            foot: e.foot || "",
            hint: e.hint || "Hover to inspect gallery",
            gallery: e.gallery || { label: "Gallery", count: 4, caption: e.title, date: e.event_date, images: [] }
          }));
        }
      }
    } catch (err) {
      console.warn("Supabase events fetch failed, falling back:", err);
    }

    // Secondary fallback: backend API or default data
    if (window.AB && typeof AB.load === "function") {
      const fallback = AB.load();
      return fallback.events || [];
    }
    return [];
  }

  // Fetch team members dynamically from Supabase
  async function getTeamMembers() {
    try {
      if (typeof getSupabaseClient === "function") {
        const client = await getSupabaseClient();
        const { data, error } = await client
          .table("team_members")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (!error && data && data.length > 0) {
          const guests = [];
          const faculty = [];
          const officers = [];
          const committee = [];

          data.forEach(m => {
            const cat = m.category || (m.display_order < 5 ? "guest" : m.display_order < 10 ? "faculty" : m.display_order < 20 ? "officer" : "committee");
            if (cat === "guest") {
              guests.push({
                name: m.name,
                org: m.bio || "Salesforce / SJEC",
                left: m.role_title || "Honored Guest",
                right: m.badge || "Keynote Speaker",
                color: m.color || "t3"
              });
            } else if (cat === "faculty") {
              faculty.push({
                name: m.name,
                role: m.role_title || m.bio || "Assistant Professor, CSE",
                photo: m.photo_url || ""
              });
            } else if (cat === "officer") {
              officers.push({
                name: m.name,
                role: m.role_title || "Officer",
                badge: m.badge || "Core Team",
                color: m.color || "t2",
                desc: m.bio || "",
                photo: m.photo_url || ""
              });
            } else {
              committee.push({
                name: m.name,
                role: m.role_title || m.bio || "Working Group"
              });
            }
          });

          return { guests, faculty, officers, committee };
        }
      }
    } catch (err) {
      console.warn("Supabase team fetch failed, falling back:", err);
    }

    // Secondary fallback: default data
    if (window.AB && typeof AB.load === "function") {
      const fallback = AB.load();
      return {
        guests: fallback.guests || [],
        faculty: fallback.faculty || [],
        officers: fallback.officers || [],
        committee: fallback.committee || []
      };
    }
    return { guests: [], faculty: [], officers: [], committee: [] };
  }

  // Submit Contact Form
  async function submitContact(formPayload) {
    // 1. Honeypot defense check on client
    if (formPayload.b_hp_check) {
      throw new Error("Bot submission rejected by security filter.");
    }

    // 2. Submit via backend endpoint
    const res = await fetch(`${BASE_URL}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Unable to send message. Please try again.");
    }

    return await res.json();
  }

  // Submit Member Registration Form
  async function submitSignup(formPayload) {
    // 1. Honeypot check
    if (formPayload.b_hp_check) {
      throw new Error("Bot registration rejected.");
    }

    // 2. Domain check
    const email = String(formPayload.email || "").trim().toLowerCase();
    if (!email.endsWith("@sjec.ac.in")) {
      throw new Error("Registration strictly restricted to institutional @sjec.ac.in emails.");
    }

    // 3. Post to backend signup endpoint
    const res = await fetch(`${BASE_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Registration failed. Please verify your details.");
    }

    return await res.json();
  }

  // Check Application Status
  async function checkStatus(email) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail.endsWith("@sjec.ac.in")) {
      throw new Error("Please enter a valid institutional @sjec.ac.in email address.");
    }

    const res = await fetch(`${BASE_URL}/api/check-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Could not check application status.");
    }

    return await res.json();
  }

  window.DataService = {
    esc,
    getEvents,
    getTeamMembers,
    submitContact,
    submitSignup,
    checkStatus
  };
})();
