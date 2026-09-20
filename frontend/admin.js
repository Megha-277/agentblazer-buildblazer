/* ============================================================
   AGENTBLAZER CLUB — Production Admin Dashboard Logic
   Department of Computer Science & Engineering, SJEC
   ============================================================ */

(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Session Gate ---------- */
  const session = window.AB ? AB.session() : null;
  if (!session) {
    location.replace("login.html");
    return;
  }

  function getAccessToken() {
    try {
      const raw = sessionStorage.getItem("ab-session");
      if (raw) return JSON.parse(raw).access_token || "";
    } catch (_) {}
    return "";
  }

  const BASE_URL = typeof window.API_BASE_URL !== "undefined" ? window.API_BASE_URL : "";

  /* ---------- Role Gate & State ---------- */
  let CURRENT_USER = { id: "", role: "member", role_level: 0, full_name: "Administrator", email: "" };
  let pendingApprovals = [];
  let allMembers = [];
  let contactSubmissions = [];

  function applyRoleGate() {
    const lvl = CURRENT_USER.role_level;

    // 1. Approvals Queue Tab (Faculty: 5, HOD: 6 only)
    const tabApp = $("#tab-approvals");
    const secApp = $("#sec-approvals");
    if (tabApp && secApp) {
      if (lvl < 5) {
        tabApp.hidden = true;
        secApp.hidden = true;
      } else {
        tabApp.hidden = false;
        secApp.hidden = false;
      }
    }

    // 2. Member Directory & Roles Tab (President: 4, Faculty: 5, HOD: 6)
    const tabMem = $("#tab-members");
    const secMem = $("#sec-members");
    if (tabMem && secMem) {
      if (lvl < 4) {
        tabMem.hidden = true;
        secMem.hidden = true;
      } else {
        tabMem.hidden = false;
        secMem.hidden = false;
      }
    }

    // 3. Contact Enquiries Tab (Secretary: 3, President: 4, Faculty: 5, HOD: 6)
    const tabSub = $("#tab-submissions");
    const secSub = $("#sec-submissions");
    if (tabSub && secSub) {
      if (lvl < 3) {
        tabSub.hidden = true;
        secSub.hidden = true;
      } else {
        tabSub.hidden = false;
        secSub.hidden = false;
      }
    }

    // 4. Events write access (Event Manager: 2, Faculty: 5, HOD: 6)
    if (lvl === 3 || lvl === 4) {
      // Secretary and President are read-only on events
      $$("[data-add='events'], [data-del][data-sec='events'], [data-move][data-sec='events']").forEach(b => {
        b.hidden = true;
        b.disabled = true;
      });
    }

    // 5. Event Manager (2): Only sees events
    if (lvl === 2) {
      $$("#tabs button[data-sec]").forEach(b => {
        if (b.dataset.sec !== "events" && b.dataset.sec !== "settings") b.hidden = true;
      });
      $$(".a-sec:not(#sec-events):not(#sec-settings)").forEach(s => { s.hidden = true; });
    }

    // 6. Tech Lead (1): Read-only preview across all sections
    if (lvl <= 1) {
      $$("[data-add], [data-del], [data-move], #sheet-save, #factory, #restore").forEach(b => {
        b.hidden = true;
        b.disabled = true;
      });
    }
  }

  // Fetch caller profile and apply role hierarchy
  async function fetchProfile() {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${BASE_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const p = await res.json();
        CURRENT_USER = p;
        $("#who-name").textContent = `${p.full_name || p.email} (${p.role ? p.role.toUpperCase() : "LVL " + p.role_level})`;
        $("#who-ini").textContent = initials(p.full_name || p.email || "AB");
        applyRoleGate();

        // Load role-gated data
        if (p.role_level >= 5) loadApprovals();
        if (p.role_level >= 4) loadMembers();
        if (p.role_level >= 3) loadSubmissions();
      }
    } catch (e) {
      console.warn("Could not load backend profile, using local defaults:", e);
    }
  }

  /* ---------- Toast helper ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    $("span", toastEl).textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.remove("on"); }, 2800);
  }

  /* ---------- State & Content Store ---------- */
  let data = AB.load();

  function initials(n) {
    return String(n).replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2)
      .map(w => w[0].toUpperCase()).join("") || "AB";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function get(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function set(obj, path, val) {
    const ks = path.split(".");
    const last = ks.pop();
    let t = obj;
    ks.forEach(k => {
      if (typeof t[k] !== "object" || t[k] === null) t[k] = {};
      t = t[k];
    });
    t[last] = val;
  }

  const COLOURS = [
    { v: "t1", l: "Teal" },
    { v: "t2", l: "Violet" },
    { v: "t3", l: "Gold" },
    { v: "t4", l: "Pink" }
  ];

  /* ---------- Content Schemas ---------- */
  const SCHEMA = {
    events: {
      one: "event", kind: "Event",
      blank: () => ({
        date: "", kind: "Workshop", color: "t1", title: "", tracks: [], note: "", desc: "", hint: "", foot: "",
        gallery: { label: "Event gallery", count: 4, caption: "", sub: "", date: "", images: [] }
      }),
      title: it => it.title || "Untitled event",
      meta: it => `<b>${esc(it.kind || "Event")}</b> · ${esc(it.date || "no date")} ${it.foot ? "· " + esc(it.foot) : ""}`,
      badge: it => initials(it.title || "EV"),
      fields: [
        { k: "title", l: "Event name", t: "text", ph: "PROMPT OPS-2K26 Challenge" },
        { k: "date", l: "Date on card", t: "text", ph: "March 25, 2026" },
        { k: "kind", l: "Badge label", t: "text", ph: "Live Contest" },
        { k: "color", l: "Badge colour", t: "color" },
        { k: "desc", l: "Description", t: "textarea", ph: "What happens at this event?" },
        { k: "note", l: "Extra line / Session lead", t: "text", ph: "Session leads, platform, venue…" },
        { k: "tracks", l: "Tracks (one per line)", t: "list", ph: "Track 1: 1st Year Engineers" },
        { k: "foot", l: "Footer note", t: "text", ph: "80 Shortlisted Students" },
        { k: "hint", l: "Footer hint", t: "text", ph: "Hover to inspect gallery" }
      ]
    },
    officers: {
      one: "member", kind: "Core team",
      blank: () => ({ name: "", badge: "", color: "t1", role: "", desc: "", photo: "" }),
      title: it => it.name || "Unnamed member",
      meta: it => `<b>${esc(it.role || "Member")}</b>${it.badge ? " · " + esc(it.badge) : ""}`,
      badge: it => initials(it.name || "AB"),
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Ruben Saldanha" },
        { k: "role", l: "Position", t: "text", ph: "President" },
        { k: "badge", l: "Portfolio tag", t: "text", ph: "Executive President" },
        { k: "color", l: "Tag colour", t: "color" },
        { k: "desc", l: "Bio & Responsibilities", t: "textarea", ph: "Guiding club vision and collaborations." },
        { k: "photo", l: "Photo URL", t: "upload", ph: "Upload or paste URL" }
      ]
    },
    committee: {
      one: "member", kind: "Committee",
      blank: () => ({ name: "", role: "" }),
      title: it => it.name || "Unnamed member",
      meta: it => `<b>${esc(it.role || "Working group")}</b>`,
      badge: it => initials(it.name || "AB"),
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Alma Roxane Pereira" },
        { k: "role", l: "Working group", t: "text", ph: "Project Operations & Labs" }
      ]
    },
    faculty: {
      one: "coordinator", kind: "Faculty",
      blank: () => ({ name: "", role: "", photo: "" }),
      title: it => it.name || "Unnamed coordinator",
      meta: it => esc(it.role || "Faculty coordinator"),
      badge: it => initials(it.name || "AB"),
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Ms. Nisha Roche" },
        { k: "role", l: "Designation", t: "text", ph: "Assistant Professor, CSE · Faculty Coordinator" },
        { k: "photo", l: "Photo URL", t: "upload", ph: "Upload or paste URL" }
      ]
    },
    guests: {
      one: "guest", kind: "Guest of honour",
      blank: () => ({ name: "", org: "", left: "", right: "", color: "t1" }),
      title: it => it.name || "Unnamed guest",
      meta: it => esc(it.org || "") + (it.right ? " · <b>" + esc(it.right) + "</b>" : ""),
      badge: it => initials(it.name || "AB"),
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Mr. Santosh Rebello" },
        { k: "org", l: "Organisation", t: "text", ph: "Salesforce" },
        { k: "left", l: "Event role", t: "text", ph: "Guest of Honor" },
        { k: "right", l: "Highlight title", t: "text", ph: "Keynote Speaker" },
        { k: "color", l: "Accent colour", t: "color" }
      ]
    }
  };

  /* ---------- Persist changes to local storage & backend ---------- */
  async function persist(msg) {
    AB.save(data);
    renderAll();
    toast(msg);

    // Synchronize to backend /api/content if authenticated
    const token = getAccessToken();
    if (token && CURRENT_USER.role_level >= 2) {
      try {
        await fetch(`${BASE_URL}/api/content`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(data)
        });
      } catch (err) {
        console.warn("Backend sync failed:", err);
      }
    }
  }

  /* ---------- Render Content Rows ---------- */
  function rowHTML(sec, it, i, total) {
    const s = SCHEMA[sec];
    const isReadOnly = CURRENT_USER.role_level <= 1;

    return `
      <article class="a-row">
        <span class="ini">${esc(s.badge(it))}</span>
        <div>
          <h4>${esc(s.title(it))}</h4>
          <p class="meta">${s.meta(it)}</p>
        </div>
        <div class="a-acts">
          ${!isReadOnly ? `
            <button class="a-ico" data-move="-1" data-i="${i}" data-sec="${sec}" aria-label="Move up" ${i === 0 ? "disabled" : ""}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
            <button class="a-ico" data-move="1" data-i="${i}" data-sec="${sec}" aria-label="Move down" ${i === total - 1 ? "disabled" : ""}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            </button>
            <button class="a-ico edit" data-edit="${i}" data-sec="${sec}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>Edit
            </button>
            <button class="a-ico del" data-del="${i}" data-sec="${sec}" aria-label="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
            </button>
          ` : `<span class="badge-status">Read Only</span>`}
        </div>
      </article>
    `;
  }

  function renderSection(sec) {
    const host = $(`#list-${sec}`);
    if (!host) return;
    const arr = data[sec] || [];
    if (!arr.length) {
      host.innerHTML = `<div class="a-empty"><b>Nothing here yet</b><span>Use the button above to add your first ${SCHEMA[sec].one}.</span></div>`;
    } else {
      host.innerHTML = arr.map((it, i) => rowHTML(sec, it, i, arr.length)).join("");
    }
    const c = $(`[data-count="${sec}"]`);
    if (c) c.textContent = arr.length;
  }

  function renderAll() {
    Object.keys(SCHEMA).forEach(renderSection);
  }

  /* ---------- Tabs Navigation ---------- */
  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-sec]");
    if (!b) return;
    $$("#tabs button").forEach(x => x.classList.toggle("on", x === b));
    $$(".a-sec").forEach(s => s.classList.toggle("on", s.id === `sec-${b.dataset.sec}`));
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Dynamically refresh data on tab navigation
    const sec = b.dataset.sec;
    if (sec === "approvals" && CURRENT_USER.role_level >= 5) {
      loadApprovals();
    } else if (sec === "members" && CURRENT_USER.role_level >= 4) {
      loadMembers();
    } else if (sec === "submissions" && CURRENT_USER.role_level >= 3) {
      loadSubmissions();
    }
  });

  /* ---------- Editor Sheet & Field Generation ---------- */
  const sheet = $("#sheet");
  const scrim = $("#scrim");
  const body = $("#sheet-body");
  let editing = { sec: null, index: null, draft: null };
  let currentUploadTargetInputId = null;

  function fieldHTML(f, val) {
    if (f.t === "split") return `<div class="a-split">${esc(f.l)}</div>`;
    const id = `f-${f.k.replace(/\./g, "-")}`;
    const help = f.help ? `<span class="help">${esc(f.help)}</span>` : "";
    const ph = esc(f.ph || "");
    let html = `<div class="f"><label for="${id}">${esc(f.l)}</label>`;

    if (f.t === "textarea") {
      html += `<textarea id="${id}" data-k="${f.k}" placeholder="${ph}">${esc(val || "")}</textarea>`;
    } else if (f.t === "list") {
      html += `<textarea id="${id}" data-k="${f.k}" data-list="1" placeholder="${ph}">${esc((Array.isArray(val) ? val : []).join("\n"))}</textarea>`;
    } else if (f.t === "upload") {
      html += `
        <div class="upload-box">
          <input id="${id}" data-k="${f.k}" type="text" value="${esc(val || "")}" placeholder="${ph}" style="flex:1">
          <button type="button" class="upload-btn" data-upload-target="${id}">Upload Image</button>
        </div>
      `;
    } else if (f.t === "color") {
      html += `<div class="a-swatch">${COLOURS.map(c => `
        <label data-c="${c.v}">
          <input type="radio" name="${id}" data-k="${f.k}" value="${c.v}" ${val === c.v ? "checked" : ""}>
          <i></i>${c.l}
        </label>
      `).join("")}</div>`;
    } else {
      html += `<input id="${id}" data-k="${f.k}" type="text" value="${esc(val || "")}" placeholder="${ph}">`;
    }
    return html + help + `</div>`;
  }

  function openEditor(sec, index) {
    const s = SCHEMA[sec];
    const item = index === null ? s.blank() : AB.clone(data[sec][index]);
    editing = { sec, index, draft: item };

    $("#sheet-kind").textContent = s.kind;
    $("#sheet-title").textContent = `${index === null ? "Add " : "Edit "} ${index === null ? s.one : s.title(item)}`;
    body.innerHTML = s.fields.map(f => fieldHTML(f, f.k ? get(item, f.k) : null)).join("");
    $("#sheet-save").textContent = index === null ? `Add ${s.one}` : "Save changes";

    scrim.classList.add("on");
    sheet.classList.add("on");

    // Wire upload button
    $$(".upload-btn", body).forEach(btn => {
      btn.addEventListener("click", () => {
        currentUploadTargetInputId = btn.dataset.uploadTarget;
        $("#image-upload-input").click();
      });
    });
  }

  function closeEditor() {
    scrim.classList.remove("on");
    sheet.classList.remove("on");
    editing = { sec: null, index: null, draft: null };
  }

  /* ---------- Secure Image Upload Handler ---------- */
  const fileInput = $("#image-upload-input");
  if (fileInput) {
    fileInput.addEventListener("change", async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const token = getAccessToken();
      if (!token) {
        alert("Session expired. Please sign in again.");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        alert("File too large. Maximum size is 2MB.");
        fileInput.value = "";
        return;
      }

      toast("Uploading and verifying image signature...");
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${BASE_URL}/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Upload verification failed.");
        }

        const data = await res.json();
        if (currentUploadTargetInputId) {
          const targetInput = $(`#${currentUploadTargetInputId}`);
          if (targetInput) targetInput.value = data.url;
        }
        toast("Verified & uploaded to club-media bucket!");
      } catch (err) {
        alert(`Upload error: ${err.message}`);
      } finally {
        fileInput.value = "";
      }
    });
  }

  function readEditor() {
    const s = SCHEMA[editing.sec];
    const item = editing.draft;
    $$("[data-k]", body).forEach(el => {
      if (el.type === "radio") {
        if (el.checked) set(item, el.dataset.k, el.value);
        return;
      }
      let v = el.value.trim();
      if (el.dataset.list) {
        v = v.split("\n").map(x => x.trim()).filter(Boolean);
      }
      set(item, el.dataset.k, v);
    });
    return item;
  }

  $("#sheet-save").addEventListener("click", () => {
    const sec = editing.sec;
    if (!sec) return;
    const item = readEditor();
    const nameKey = sec === "events" ? "title" : "name";
    if (!item[nameKey]) {
      toast(sec === "events" ? "Give the event a title first." : "Enter a name first.");
      return;
    }

    if (editing.index === null) {
      data[sec].push(item);
    } else {
      data[sec][editing.index] = item;
    }
    closeEditor();
    persist("Changes saved successfully.");
  });

  $("#sheet-cancel").addEventListener("click", closeEditor);
  $("#sheet-x").addEventListener("click", closeEditor);
  scrim.addEventListener("click", closeEditor);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && sheet.classList.contains("on")) closeEditor();
  });

  /* ---------- Row Actions (Edit, Delete, Move) ---------- */
  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { openEditor(add.dataset.add, null); return; }

    const btn = e.target.closest("[data-sec][data-edit], [data-sec][data-del], [data-sec][data-move]");
    if (!btn) return;
    const sec = btn.dataset.sec;

    if (btn.dataset.edit !== undefined) {
      openEditor(sec, +btn.dataset.edit);
      return;
    }

    if (btn.dataset.del !== undefined) {
      const i = +btn.dataset.del;
      const it = data[sec][i];
      if (!confirm(`Remove “${SCHEMA[sec].title(it)}” from the site?`)) return;
      data[sec].splice(i, 1);
      persist("Removed from site.");
      return;
    }

    if (btn.dataset.move !== undefined) {
      const from = +btn.dataset.i;
      const to = from + (+btn.dataset.move);
      if (to < 0 || to >= data[sec].length) return;
      const row = data[sec].splice(from, 1)[0];
      data[sec].splice(to, 0, row);
      persist("Order updated.");
    }
  });

  /* ============================================================
     APPROVAL QUEUE LOGIC (Faculty / HOD only)
     ============================================================ */
  async function loadApprovals() {
    const host = $("#list-approvals");
    if (!host) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${BASE_URL}/api/pending-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not load approvals queue.");
      pendingApprovals = await res.json();

      const countEl = $("#count-approvals");
      if (countEl) countEl.textContent = pendingApprovals.length;

      if (!pendingApprovals.length) {
        host.innerHTML = `<div class="a-empty"><b>Approval Queue Empty</b><span>No pending student registration applications.</span></div>`;
        return;
      }

      host.innerHTML = pendingApprovals.map(u => `
        <article class="a-row">
          <span class="ini">${initials(u.full_name || u.email)}</span>
          <div>
            <h4>${esc(u.full_name || "Applicant")} <span class="badge-status pending">Pending Approval</span></h4>
            <p class="meta"><b>${esc(u.email)}</b> · Expected Grad: ${esc(u.expected_graduation_year || "N/A")} · Applied: ${new Date(u.created_at).toLocaleDateString()}</p>
          </div>
          <div class="a-acts">
            <button class="a-ico approve" data-approve="${u.id}">Approve</button>
            <button class="a-ico reject" data-reject="${u.id}">Reject</button>
          </div>
        </article>
      `).join("");

      // Wire approve / reject actions
      $$("[data-approve]", host).forEach(b => {
        b.addEventListener("click", async () => {
          const uid = b.dataset.approve;
          b.disabled = true;
          b.textContent = "Approving...";
          try {
            const actRes = await fetch(`${BASE_URL}/api/approve-member`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ user_id: uid })
            });
            if (!actRes.ok) throw new Error("Approval failed.");
            toast("Member approved! Status updated to approved.");
            loadApprovals();
            loadMembers();
          } catch (err) {
            alert(err.message);
            b.disabled = false;
            b.textContent = "Approve";
          }
        });
      });

      $$("[data-reject]", host).forEach(b => {
        b.addEventListener("click", async () => {
          const uid = b.dataset.reject;
          if (!confirm("Reject this registration application?")) return;
          b.disabled = true;
          try {
            const actRes = await fetch(`${BASE_URL}/api/reject-member`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ user_id: uid })
            });
            if (!actRes.ok) throw new Error("Rejection failed.");
            toast("Application rejected.");
            loadApprovals();
          } catch (err) {
            alert(err.message);
            b.disabled = false;
          }
        });
      });
    } catch (err) {
      console.warn("Approvals load error:", err);
    }
  }

  const btnRefreshApp = $("#btn-refresh-approvals");
  if (btnRefreshApp) btnRefreshApp.addEventListener("click", loadApprovals);

  /* ============================================================
     MEMBER DIRECTORY & ROLE MANAGEMENT
     ============================================================ */
  const ALL_ROLES = [
    { r: "hod", l: "HOD (Level 6)", minLvl: 6 },
    { r: "faculty", l: "Faculty (Level 5)", minLvl: 5 },
    { r: "president", l: "President (Level 4)", minLvl: 5 },
    { r: "secretary", l: "Secretary (Level 3)", minLvl: 4 },
    { r: "event_manager", l: "Event Manager (Level 2)", minLvl: 4 },
    { r: "tech_lead", l: "Tech Lead (Level 1)", minLvl: 4 },
    { r: "member", l: "Member (Level 0)", minLvl: 4 },
    { r: "alumni", l: "Alumni (Level 0)", minLvl: 5 }
  ];

  async function loadMembers() {
    const host = $("#list-members");
    if (!host) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${BASE_URL}/api/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not load members.");
      allMembers = await res.json();

      const countEl = $("#count-members");
      if (countEl) countEl.textContent = allMembers.length;

      const callerLvl = CURRENT_USER.role_level;

      host.innerHTML = allMembers.map(u => {
        const isSelf = u.id === CURRENT_USER.id;
        const canModify = !isSelf && (callerLvl >= 5 || (callerLvl === 4 && u.role_level < 4));

        return `
          <article class="a-row">
            <span class="ini">${initials(u.full_name || u.email)}</span>
            <div>
              <h4>${esc(u.full_name || u.email)} ${isSelf ? '<span class="badge-status approved">YOU</span>' : ''}</h4>
              <p class="meta">
                <b>${esc(u.email || "")}</b> · Role: <b>${esc((u.role || "member").toUpperCase())} (Lvl ${u.role_level})</b> · 
                Status: <span class="badge-status ${u.status === 'approved' ? 'approved' : u.status === 'pending_approval' ? 'pending' : 'rejected'}">${esc(u.status || "active")}</span> ·
                Grad: ${esc(u.expected_graduation_year || "N/A")} · Rollover: ${u.auto_managed ? 'Auto' : 'Manual Override'}
              </p>
            </div>
            <div class="a-acts">
              ${canModify ? `
                <select class="role-select" data-user-role="${u.id}">
                  ${ALL_ROLES
                    .filter(opt => callerLvl >= opt.minLvl)
                    .map(opt => `<option value="${opt.r}" ${u.role === opt.r ? 'selected' : ''}>${opt.l}</option>`)
                    .join("")}
                </select>
              ` : `<span style="font-size:12px;color:var(--ink-4)">${isSelf ? 'Self-Locked' : 'Protected'}</span>`}
            </div>
          </article>
        `;
      }).join("");

      // Role change listeners
      $$(".role-select", host).forEach(sel => {
        sel.addEventListener("change", async () => {
          const targetId = sel.dataset.userRole;
          const newRole = sel.value;
          try {
            const roleRes = await fetch(`${BASE_URL}/api/update-role`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ target_user_id: targetId, new_role: newRole })
            });
            if (!roleRes.ok) {
              const err = await roleRes.json().catch(() => ({}));
              throw new Error(err.detail || "Role update rejected.");
            }
            toast(`User role updated to ${newRole.toUpperCase()} (auto_managed = false).`);
            loadMembers();
          } catch (err) {
            alert(err.message);
            loadMembers();
          }
        });
      });
    } catch (err) {
      console.warn("Members load error:", err);
    }
  }

  const btnRefreshMem = $("#btn-refresh-members");
  if (btnRefreshMem) btnRefreshMem.addEventListener("click", loadMembers);

  /* ============================================================
     CONTACT SUBMISSIONS INBOX
     ============================================================ */
  async function loadSubmissions() {
    const host = $("#list-submissions");
    if (!host) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${BASE_URL}/api/contact-submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not load submissions.");
      contactSubmissions = await res.json();

      const countEl = $("#count-submissions");
      if (countEl) countEl.textContent = contactSubmissions.length;

      if (!contactSubmissions.length) {
        host.innerHTML = `<div class="a-empty"><b>No Enquiries Yet</b><span>Messages submitted through contact.html appear here.</span></div>`;
        return;
      }

      host.innerHTML = contactSubmissions.map(s => `
        <article class="a-row">
          <span class="ini">${initials(s.name)}</span>
          <div>
            <h4>${esc(s.name)} <span style="font-weight:400;font-size:13px;color:var(--ink-3)">(${esc(s.email)})</span></h4>
            <p class="meta"><b>${esc(s.subject || "No Subject")}</b> · Received: ${new Date(s.created_at).toLocaleString()}</p>
            <p style="margin-top:8px;font-size:13.5px;color:var(--ink-2);line-height:1.5">${esc(s.message)}</p>
          </div>
          <div class="a-acts">
            <span class="badge-status approved">${esc(s.status || "new")}</span>
          </div>
        </article>
      `).join("");
    } catch (err) {
      console.warn("Submissions load error:", err);
    }
  }

  const btnRefreshSub = $("#btn-refresh-submissions");
  if (btnRefreshSub) btnRefreshSub.addEventListener("click", loadSubmissions);

  /* ---------- Theme Handler ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    $$(".themes button").forEach(b => {
      const on = b.dataset.theme === t;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    try { localStorage.setItem("ab-theme", t); } catch (_) {}
  }
  $$(".themes button").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.theme)));
  try {
    const st = localStorage.getItem("ab-theme");
    if (st) setTheme(st);
  } catch (_) {}

  /* ---------- Log out ---------- */
  $("#logout").addEventListener("click", () => {
    if (window.AB) AB.signOut();
    location.href = "login.html";
  });

  /* ---------- Initial Execution ---------- */
  renderAll();
  fetchProfile();
})();