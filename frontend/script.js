/* ============================================================
   AGENTBLAZER CLUB — Shared Frontend Scripts
   Department of Computer Science & Engineering, SJEC
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ACCENT = { t1: "a1", t2: "a2", t3: "a3", t4: "a4" };
const accent = c => `var(--${ACCENT[c] || "a1"})`;

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(n) {
  return String(n)
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("") || "AB";
}

/* --------- placeholder portrait / gallery generators --------- */
const PALETTES = [
  ["#123a2e", "#2f6f52"],
  ["#1b2b4d", "#3d5d8a"],
  ["#3a1f4d", "#6b4a8f"],
  ["#4d3a1f", "#8a6b3d"],
  ["#1f3f4d", "#3d7a8a"],
  ["#4d1f2e", "#8a3d55"]
];

function portrait(name, i) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const ini = initials(name);
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="400" height="500" fill="url(#g)"/>
  <g fill="rgba(255,255,255,.1)"><circle cx="200" cy="205" r="76"/><path d="M60 500c0-83 63-140 140-140s140 57 140 140Z"/></g>
  <text x="200" y="470" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="rgba(255,255,255,.34)" letter-spacing="6">${ini}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
}

function photoOf(p, i) {
  return p.photo || p.photo_url || portrait(p.name, i);
}

function placeholderShot(i, seed) {
  const hues = [188, 265, 32, 150, 320, 210];
  const h = hues[(i + seed) % hues.length];
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},42%,22%)"/><stop offset="1" stop-color="hsl(${(h+40)%360},48%,34%)"/></linearGradient></defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <g fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2">
    <rect x="42" y="66" width="140" height="96" rx="6"/><rect x="220" y="96" width="140" height="130" rx="6"/>
    <path d="M0 232h400M62 232v-40h100v40"/></g>
  <circle cx="300" cy="66" r="24" fill="rgba(255,255,255,.14)"/>
  <text x="200" y="285" text-anchor="middle" font-family="sans-serif" font-size="15" fill="rgba(255,255,255,.4)">Event photo ${i+1}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
}

function shotCount(e) {
  const g = e.gallery || {};
  return (g.images && g.images.length) ? g.images.length : Math.max(1, +g.count || 1);
}

function galleryShot(e, i, seed) {
  const g = e.gallery || {};
  return (g.images && g.images.length) ? g.images[i % g.images.length] : placeholderShot(i, seed);
}

/* ============================================================
   DYNAMIC DATA POPULATION (SUPABASE FIRST)
   ============================================================ */

async function populatePageData() {
  try {
    // 1. Load Events if containers exist
    const evContainer = $("#events");
    const featContainer = $("#featured-events");
    if (evContainer || featContainer) {
      const events = window.DataService ? await DataService.getEvents() : [];
      window._AB_EVENTS = events;

      if (evContainer && events.length > 0) {
        evContainer.innerHTML = events.map((e, i) => `
          <article class="ev glass" data-pop="gallery" data-i="${i}">
            <span class="fill"></span>
            <div class="ev-top"><span class="ev-date">${esc(e.date)}</span><span class="kind" style="color:${accent(e.color)}">${esc(e.kind)}</span></div>
            <h3>${esc(e.title)}</h3>
            ${(e.tracks && e.tracks.length) ? `<div class="tracks">${e.tracks.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
            ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
            <p>${esc(e.desc)}</p>
            <div class="ev-foot"><span class="hint"><i></i>${esc(e.hint || "Hover to inspect gallery")}</span><b>${esc(e.foot)}</b></div>
          </article>
        `).join("");
      }

      if (featContainer && events.length > 0) {
        const top3 = events.slice(0, 3);
        featContainer.innerHTML = top3.map((e, i) => `
          <article class="ev glass" data-pop="gallery" data-i="${i}">
            <span class="fill"></span>
            <div class="ev-top"><span class="ev-date">${esc(e.date)}</span><span class="kind" style="color:${accent(e.color)}">${esc(e.kind)}</span></div>
            <h3>${esc(e.title)}</h3>
            <p>${esc(e.desc)}</p>
            <div class="ev-foot"><span class="hint"><i></i>${esc(e.hint || "Hover to inspect")}</span><b>${esc(e.foot)}</b></div>
          </article>
        `).join("");
      }
    }

    // 2. Load Team Members (Guests, Faculty, Officers, Committee)
    const guestsEl = $("#guests");
    const facultyEl = $("#faculty");
    const officersEl = $("#officers");
    const committeeEl = $("#committee");

    if (guestsEl || facultyEl || officersEl || committeeEl) {
      const team = window.DataService ? await DataService.getTeamMembers() : { guests: [], faculty: [], officers: [], committee: [] };

      if (guestsEl && team.guests && team.guests.length > 0) {
        guestsEl.innerHTML = team.guests.map(g => `
          <article class="person glass tilt">
            <div class="person-top">
              <span class="ini">${initials(g.name)}</span>
              <div><h3>${esc(g.name)}</h3><p class="role">${esc(g.org)}</p></div>
            </div>
            <div class="person-foot"><span>${esc(g.left)}</span><b style="color:${accent(g.color)}">${esc(g.right)}</b></div>
          </article>
        `).join("");
      }

      if (facultyEl && team.faculty && team.faculty.length > 0) {
        facultyEl.innerHTML = team.faculty.map((f, i) => `
          <article class="fac glass" data-pop="portrait" data-name="${esc(f.name)}" data-role="${esc(f.role)}" data-tag="Faculty" data-img="${esc(photoOf(f, i + 4))}">
            <span class="ini">${initials(f.name)}</span>
            <div><h4>${esc(f.name)}</h4><p>${esc(f.role)}</p></div>
            <span class="mini">Portrait view</span>
          </article>
        `).join("");
      }

      if (officersEl && team.officers && team.officers.length > 0) {
        officersEl.innerHTML = team.officers.map((o, i) => `
          <article class="off glass" data-pop="portrait" data-name="${esc(o.name)}" data-role="${esc(o.role)} · AgentBlazer Club" data-tag="Leadership" data-img="${esc(photoOf(o, i))}">
            <span class="fill"></span>
            <span class="tag ${o.color || "t1"}">${esc(o.badge)}</span>
            <h3>${esc(o.name)}</h3>
            <span class="badge" style="color:${accent(o.color)}">${esc(o.role)}</span>
            <p>${esc(o.desc)}</p>
          </article>
        `).join("");
      }

      if (committeeEl && team.committee && team.committee.length > 0) {
        committeeEl.innerHTML = team.committee.map(c => `
          <div class="cm glass">
            <span class="ini">${initials(c.name)}</span>
            <div><h4>${esc(c.name)}</h4><p>${esc(c.role)}</p></div>
          </div>
        `).join("");
      }
    }

    // Re-init tilt if VanillaTilt is present
    if (window.VanillaTilt && !matchMedia("(pointer:coarse)").matches) {
      VanillaTilt.init($$(".tilt"), { max: 5, speed: 900, glare: true, "max-glare": 0.14, scale: 1.008, gyroscope: false });
    }
  } catch (err) {
    console.error("Error populating dynamic page data:", err);
  }
}

/* ============================================================
   FORM WORKFLOWS & DOMAIN VALIDATION (contact.html)
   ============================================================ */

function setupForms() {
  // 1. Triple Tab Switcher
  const tabSignup = $("#tab-signup");
  const tabStatus = $("#tab-status");
  const tabContact = $("#tab-contact");
  const boxSignup = $("#box-signup");
  const boxStatus = $("#box-status");
  const boxContact = $("#box-contact");

  function switchTab(activeTab, activeBox) {
    [tabSignup, tabStatus, tabContact].forEach(t => {
      if (t) {
        const on = t === activeTab;
        t.classList.toggle("on", on);
        t.setAttribute("aria-selected", String(on));
      }
    });
    [boxSignup, boxStatus, boxContact].forEach(b => {
      if (b) b.style.display = (b === activeBox) ? "block" : "none";
    });
  }

  if (tabSignup) tabSignup.addEventListener("click", () => switchTab(tabSignup, boxSignup));
  if (tabStatus) tabStatus.addEventListener("click", () => switchTab(tabStatus, boxStatus));
  if (tabContact) tabContact.addEventListener("click", () => switchTab(tabContact, boxContact));

  // Helper for displaying accessible, visible form alerts
  function showFormStatus(box, htmlContent, isSuccess) {
    if (!box) return;
    box.innerHTML = htmlContent;
    box.className = "form-status " + (isSuccess ? "success" : "error");
    box.style.display = "block";
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearFormStatus(box) {
    if (!box) return;
    box.innerHTML = "";
    box.className = "form-status";
    box.style.display = "none";
  }

  // 2. Member Signup Form
  const signupForm = $("#signup-form");
  if (signupForm) {
    const emailInput = $("#reg-email");
    const batchInput = $("#reg-batch");
    const batchHint = $("#batch-hint");
    const statusBox = $("#signup-status");
    const submitBtn = $("#signup-btn");

    // Real-time batch extraction from email (e.g. 26d89.alex@sjec.ac.in -> 2026 join -> 2030 grad)
    if (emailInput && batchInput) {
      emailInput.addEventListener("input", () => {
        const val = emailInput.value.trim();
        const match = val.match(/^(\d{2})/);
        if (match) {
          const joinYear = 2000 + parseInt(match[1], 10);
          const gradYear = joinYear + 4;
          batchInput.value = gradYear;
          if (batchHint) {
            batchHint.textContent = `Joining year ${joinYear} → Expected graduation ${gradYear}`;
            batchHint.style.color = "var(--a1)";
          }
        }
      });
    }

    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormStatus(statusBox);

      const fullName = $("#reg-name").value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const password = $("#reg-password").value;
      const expectedGradYear = parseInt(batchInput.value, 10) || null;
      const hp = $("#signup-hp") ? $("#signup-hp").value : "";

      // Honeypot spam check
      if (hp) {
        showFormStatus(statusBox, "<strong>Security Alert:</strong> Submission rejected by automated bot filter.", false);
        return;
      }

      // Input validations
      if (!fullName) {
        showFormStatus(statusBox, "<strong>Required Field:</strong> Please provide your full name as registered with SJEC.", false);
        $("#reg-name").focus();
        return;
      }

      // Strict institutional domain validation
      if (!email.endsWith("@sjec.ac.in")) {
        showFormStatus(statusBox, "<strong>Domain Error:</strong> Registration is strictly restricted to institutional <code>@sjec.ac.in</code> email addresses.", false);
        emailInput.focus();
        return;
      }

      if (password.length < 8) {
        showFormStatus(statusBox, "<strong>Password Requirements:</strong> Password must be at least 8 characters long.", false);
        $("#reg-password").focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting application...";

      try {
        const result = await DataService.submitSignup({
          full_name: fullName,
          email: email,
          password: password,
          expected_graduation_year: expectedGradYear,
          b_hp_check: hp
        });

        const gradText = result.expected_graduation_year || expectedGradYear || "Auto-assigned";
        
        showFormStatus(statusBox, `
          <div style="text-align:left">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--a1);flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <h4 style="margin:0;font-size:18px;font-weight:700;color:var(--a1)">Application Submitted Successfully!</h4>
            </div>
            <p style="margin:6px 0 12px;font-size:14px;color:var(--ink-1);line-height:1.5">
              Your registration application has been placed in the <strong>Faculty Approval Queue</strong> with status <code style="padding:2px 6px;border-radius:4px;background:rgba(234,179,8,0.2);color:#facc15;font-weight:600">pending_approval</code>.
            </p>
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7;margin-bottom:14px;color:var(--ink-2)">
              <div><strong>Applicant:</strong> ${esc(fullName)}</div>
              <div><strong>Institutional Email:</strong> ${esc(email)}</div>
              <div><strong>Expected Graduation Batch:</strong> ${esc(gradText)}</div>
              <div><strong>Next Step:</strong> Faculty coordinators will verify your institutional status.</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
              <a href="/dashboard/login.html" class="btn btn-1" style="font-size:13.5px;padding:9px 18px;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
                Go to Club Sign In
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
              </a>
              <button type="button" class="btn btn-2" id="btn-reset-signup" style="font-size:13.5px;padding:9px 16px;cursor:pointer">
                Submit Another Application
              </button>
            </div>
          </div>
        `, true);

        signupForm.reset();
        if (batchHint) batchHint.textContent = "Auto-parsed from email format (e.g. 26... → 2030)";

        const btnReset = $("#btn-reset-signup");
        if (btnReset) {
          btnReset.addEventListener("click", () => {
            clearFormStatus(statusBox);
            $("#reg-name").focus();
          });
        }
      } catch (err) {
        showFormStatus(statusBox, `<strong>Registration Issue:</strong> ${esc(err.message || "Registration could not be processed. Please verify your details.")}`, false);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Submit Membership Application <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
      }
    });
  }

  // 3. Application Status Checker Form
  const statusForm = $("#status-form");
  if (statusForm) {
    const statusBox = $("#check-status-box");
    const submitBtn = $("#check-btn");

    statusForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormStatus(statusBox);

      const email = $("#check-email").value.trim().toLowerCase();
      if (!email.endsWith("@sjec.ac.in")) {
        showFormStatus(statusBox, "<strong>Domain Error:</strong> Please enter a valid institutional <code>@sjec.ac.in</code> email address.", false);
        $("#check-email").focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Checking status...";

      try {
        const res = await DataService.checkStatus(email);
        const isApp = res.status === "approved";
        const isRej = res.status === "rejected";
        const badgeClass = isApp ? "approved" : isRej ? "rejected" : "pending";
        const badgeLabel = isApp ? "APPROVED" : isRej ? "NOT APPROVED" : "PENDING FACULTY APPROVAL";
        const badgeColor = isApp ? "#22c55e" : isRej ? "#ef4444" : "#facc15";

        showFormStatus(statusBox, `
          <div style="text-align:left">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
              <h4 style="margin:0;font-size:17px;font-weight:700;color:var(--ink-1)">Application Record Found</h4>
              <span class="badge-status ${badgeClass}" style="background:${badgeColor}22;color:${badgeColor};border:1px solid ${badgeColor}66;padding:4px 10px;border-radius:6px;font-weight:700;font-size:12px">
                ${badgeLabel}
              </span>
            </div>
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7;color:var(--ink-2)">
              <div><strong>Applicant Name:</strong> ${esc(res.full_name)}</div>
              <div><strong>Institutional Email:</strong> ${esc(res.email)}</div>
              <div><strong>Graduation Batch:</strong> ${esc(res.expected_graduation_year || "N/A")}</div>
              <div style="margin-top:6px;font-weight:600;color:var(--ink-1)">${esc(res.message)}</div>
            </div>
            ${isApp ? `
              <div style="margin-top:12px">
                <a href="/dashboard/login.html" class="btn btn-1" style="font-size:13px;padding:8px 16px;text-decoration:none">Sign in to Member Portal &rarr;</a>
              </div>
            ` : ''}
          </div>
        `, isApp);
      } catch (err) {
        showFormStatus(statusBox, `<strong>Status Check:</strong> ${esc(err.message || "Could not retrieve status.")}`, false);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Check Live Application Status <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
      }
    });
  }

  // 4. General Contact Form
  const contactForm = $("#contact-form");
  if (contactForm) {
    const statusBox = $("#contact-status");
    const submitBtn = $("#contact-btn");

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormStatus(statusBox);

      const name = $("#c-name").value.trim();
      const email = $("#c-email").value.trim();
      const subject = $("#c-subject").value.trim();
      const message = $("#c-msg").value.trim();
      const hp = $("#contact-hp") ? $("#contact-hp").value : "";

      if (hp) {
        showFormStatus(statusBox, "<strong>Spam Alert:</strong> Bot submission rejected by security filter.", false);
        return;
      }

      if (!name) {
        showFormStatus(statusBox, "Please enter your name.", false);
        $("#c-name").focus();
        return;
      }
      if (!email || !email.includes("@")) {
        showFormStatus(statusBox, "Please provide a valid contact email.", false);
        $("#c-email").focus();
        return;
      }
      if (!message) {
        showFormStatus(statusBox, "Please enter your enquiry or message.", false);
        $("#c-msg").focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending message...";

      try {
        await DataService.submitContact({
          name: name,
          email: email,
          subject: subject,
          message: message,
          b_hp_check: hp
        });

        showFormStatus(statusBox, `
          <div style="text-align:left">
            <h4 style="margin:0 0 6px;color:var(--a1);font-size:16px">Enquiry Delivered Successfully!</h4>
            <p style="margin:0;font-size:13.5px;color:var(--ink-1);line-height:1.5">
              Thank you, <strong>${esc(name)}</strong>. Your message regarding <em>${esc(subject || 'General Enquiry')}</em> has been delivered to the SJEC CSE Department coordinators and club leadership.
            </p>
          </div>
        `, true);
        contactForm.reset();
      } catch (err) {
        showFormStatus(statusBox, `<strong>Error:</strong> ${esc(err.message || "Could not send message. Please try again.")}`, false);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Send Message to Coordinators <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
      }
    });
  }
}

/* ============================================================
   SPLASH VIDEO (index.html only) & APP DISPLAY
   ============================================================ */

const splash = $("#splash");
const app = $("#app");

if (splash && app) {
  const vid = $("#splash-video");

  function dismissSplash() {
    if (splash._dismissed) return;
    splash._dismissed = true;
    splash.style.transition = "opacity .6s ease";
    splash.style.opacity = "0";
    setTimeout(() => {
      splash.style.display = "none";
      app.classList.add("on");
      if (vid) { vid.pause(); }
    }, 600);
  }

  splash.addEventListener("click", dismissSplash);
  splash.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") dismissSplash(); });

  if (vid) {
    // Segment loop: play intro (0→end), then loop the phoenix segment (5s→9.9s) continuously.
    // User must explicitly click "Tap to continue" — video ending does NOT auto-dismiss.
    const LOOP_START = 5.0;   // phoenix segment start (seconds)
    const LOOP_END   = 9.85;  // seek back just before hard end to avoid black frame

    // Attempt autoplay; browsers may block until user interaction
    const tryPlay = () => vid.play().catch(() => {});
    tryPlay();
    // Retry on first pointer interaction in case autoplay was blocked
    splash.addEventListener("pointerdown", tryPlay, { once: true });
    // Resume if the tab comes back into focus (mobile background tab)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !splash._dismissed) tryPlay();
    });

    let introFinished = false;
    vid.addEventListener("timeupdate", () => {
      if (vid.currentTime >= LOOP_START) introFinished = true;
      if (introFinished && vid.currentTime >= LOOP_END) {
        vid.currentTime = LOOP_START;
        tryPlay();
      }
    });

    // If video is unavailable (network/codec) show the site after 4 s
    setTimeout(() => {
      if (!app.classList.contains("on") && vid.readyState === 0) {
        app.classList.add("on");
      }
    }, 4000);
  } else {
    // No video element on this page — show immediately
    app.classList.add("on");
  }
} else if (app) {
  app.classList.add("on");
}

/* ============================================================
   MOBILE BURGER NAVIGATION
   ============================================================ */

const burger = $("#burger");
const nav = $("#nav");
if (burger && nav) {
  burger.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(isOpen));
  });
}

/* ============================================================
   THEME SWITCHER
   ============================================================ */

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
  const storedTheme = localStorage.getItem("ab-theme");
  if (storedTheme) setTheme(storedTheme);
} catch (_) {}

/* ============================================================
   HOVER POPUPS (Portrait + Gallery)
   ============================================================ */

const pop = $("#pop");
let popTimer = null;
let galTimer = null;

function hidePop() {
  if (pop) pop.classList.remove("on");
  clearInterval(galTimer);
}

function placePop(el) {
  if (!pop) return;
  const r = el.getBoundingClientRect();
  const pw = pop.offsetWidth || 300;
  const ph = pop.offsetHeight || 380;
  let x = r.right + 18;
  let y = r.top;
  if (x + pw > innerWidth - 14) x = r.left - pw - 18;
  if (x < 14) x = Math.min(r.left + 16, innerWidth - pw - 14);
  if (y + ph > innerHeight - 14) y = Math.max(14, innerHeight - ph - 14);
  pop.style.left = x + "px";
  pop.style.top = y + "px";
}

function portraitPop(el) {
  if (!pop) return;
  pop.className = "pop";
  pop.innerHTML = `
    <div class="pop-media"><img alt="${esc(el.dataset.name)}" src="${el.dataset.img}">
      <span class="pop-tag">${esc(el.dataset.tag)}</span><span class="pop-org">SJEC CSE</span>
    </div>
    <div class="pop-body"><h4>${esc(el.dataset.name)}</h4><p>${esc(el.dataset.role)}</p></div>
  `;
  placePop(el);
  requestAnimationFrame(() => { placePop(el); pop.classList.add("on"); });
}

function galleryPop(el) {
  if (!pop) return;
  const seed = +el.dataset.i;
  const EVENTS = window._AB_EVENTS || [];
  const e = EVENTS[seed] || { gallery: {}, title: "", date: "" };
  const g = e.gallery || {};
  const n = shotCount(e);
  let idx = 0;

  pop.className = "pop wide";
  pop.innerHTML = `
    <div class="pop-head"><b><i></i>${esc(g.label || "Gallery")}</b><span id="pc">1 / ${n}</span></div>
    <div class="pop-media"><img id="pi" alt="${esc(g.caption || e.title)}" src="${galleryShot(e, 0, seed)}"></div>
    <div class="pop-cap"><b>${esc(g.caption || e.title)}<i>${esc(g.date || e.date)}</i></b><span>${esc(g.sub || "")}</span></div>
  `;
  placePop(el);
  requestAnimationFrame(() => { placePop(el); pop.classList.add("on"); });

  clearInterval(galTimer);
  if (n < 2) return;
  galTimer = setInterval(() => {
    idx = (idx + 1) % n;
    const img = $("#pi");
    const c = $("#pc");
    if (!img) return clearInterval(galTimer);
    img.style.opacity = .2;
    setTimeout(() => {
      img.src = galleryShot(e, idx, seed);
      img.style.transition = "opacity .3s";
      img.style.opacity = 1;
    }, 130);
    c.textContent = (idx + 1) + " / " + n;
  }, 1500);
}

document.addEventListener("mouseover", e => {
  const el = e.target.closest("[data-pop]");
  if (!el) return;
  clearTimeout(popTimer);
  popTimer = setTimeout(() => {
    el.dataset.pop === "gallery" ? galleryPop(el) : portraitPop(el);
  }, 110);
});

document.addEventListener("mouseout", e => {
  const el = e.target.closest("[data-pop]");
  if (el && !el.contains(e.relatedTarget)) {
    clearTimeout(popTimer);
    hidePop();
  }
});

window.addEventListener("scroll", hidePop, { passive: true });

/* ============================================================
   CANVAS STARFIELD & MOUSE TRAIL
   ============================================================ */

(function initCanvases() {
  const sc = $("#stars");
  if (!sc) return;
  const sx = sc.getContext("2d");
  let stars = [];
  let W, H;
  let mx = -999, my = -999;

  function size() {
    W = innerWidth;
    H = innerHeight;
    sc.width = W * devicePixelRatio;
    sc.height = H * devicePixelRatio;
    sc.style.width = W + "px";
    sc.style.height = H + "px";
    sx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const n = Math.min(100, Math.round((W * H) / 16000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: Math.random() * 1.4 + 0.4,
      tw: Math.random() * 6.28
    }));
  }

  size();
  addEventListener("resize", size);
  addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sc.style.display = "none";
    return;
  }

  (function loop() {
    const cs = getComputedStyle(document.documentElement);
    const col = cs.getPropertyValue("--star").trim() || "rgba(160,190,255,.85)";
    const lin = cs.getPropertyValue("--line").trim() || "rgba(120,160,220,.16)";
    sx.clearRect(0, 0, W, H);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.x += s.vx;
      s.y += s.vy;
      s.tw += 0.02;

      if (s.x < -12) s.x = W + 12;
      if (s.x > W + 12) s.x = -12;
      if (s.y < -12) s.y = H + 12;
      if (s.y > H + 12) s.y = -12;

      const dist = Math.hypot(s.x - mx, s.y - my);
      if (dist < 150) {
        s.x -= (mx - s.x) * 0.0016;
        s.y -= (my - s.y) * 0.0016;
      }

      sx.globalAlpha = 0.4 + Math.sin(s.tw) * 0.3;
      sx.fillStyle = col;
      sx.beginPath();
      sx.arc(s.x, s.y, s.r, 0, 7);
      sx.fill();

      for (let j = i + 1; j < stars.length; j++) {
        const o = stars[j];
        const dx = s.x - o.x;
        const dy = s.y - o.y;
        const dd = dx * dx + dy * dy;
        if (dd < 19000) {
          sx.globalAlpha = (1 - dd / 19000) * 0.5;
          sx.strokeStyle = lin;
          sx.lineWidth = 0.7;
          sx.beginPath();
          sx.moveTo(s.x, s.y);
          sx.lineTo(o.x, o.y);
          sx.stroke();
        }
      }
    }

    sx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })();
})();

// Cursor ring follower
(function initCursor() {
  const ring = $(".cur-ring");
  const dot = $(".cur-dot");
  if (!ring || !dot || matchMedia("(pointer:coarse)").matches) return;

  let rx = -100, ry = -100, dx = -100, dy = -100;
  addEventListener("pointermove", e => {
    dx = e.clientX;
    dy = e.clientY;
    dot.style.transform = `translate3d(${dx}px,${dy}px,0)`;
  }, { passive: true });

  (function follow() {
    rx += (dx - rx) * 0.2;
    ry += (dy - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(follow);
  })();
})();

// Initialize on DOM Ready (handling deferred script execution)
function initApp() {
  populatePageData();
  setupForms();
  populateAnnouncements();
  setupSubscribeForm();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

/* ============================================================
   ANNOUNCEMENTS (announcements.html + homepage strip)
   ============================================================ */

const CATEGORY_LABELS = {
  general: "General", competition: "Competition", registration: "Registration",
  workshop: "Workshop", achievement: "Achievement", notice: "Notice",
};

function fmtAnnDate(iso) {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch (_) { return iso || ""; }
}

function annCardHTML(a) {
  const cat = a.category || "general";
  return `<article class="ann-card${a.is_pinned ? " pinned" : ""}">
    <div class="ann-meta">
      ${a.is_pinned ? `<span class="ann-badge pinned-badge">📌 Pinned</span>` : ""}
      <span class="ann-badge cat">${esc(CATEGORY_LABELS[cat] || cat)}</span>
      <span class="ann-date">${fmtAnnDate(a.published_at || a.created_at)}</span>
    </div>
    <h3 class="ann-title">${esc(a.title)}</h3>
    <p class="ann-body">${esc(a.body)}</p>
  </article>`;
}

async function populateAnnouncements() {
  // Full page list (announcements.html)
  const fullList = $("#ann-list");
  if (fullList && window.DataService) {
    const filterBtns = $$("#ann-filter button");
    let allAnns = [];
    let activeFilter = "all";

    function renderFiltered() {
      const filtered = activeFilter === "all" ? allAnns : allAnns.filter(a => a.category === activeFilter);
      if (!filtered.length) {
        fullList.innerHTML = `<div class="a-empty" style="grid-column:1/-1"><b>No announcements yet</b><span>Check back soon for updates from the club.</span></div>`;
        return;
      }
      // Pinned first, then by date
      const sorted = [...filtered].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at);
      });
      fullList.innerHTML = sorted.map(annCardHTML).join("");
    }

    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.cat;
        filterBtns.forEach(b => b.classList.toggle("on", b === btn));
        renderFiltered();
      });
    });

    try {
      allAnns = await DataService.getAnnouncements();
      renderFiltered();
    } catch (err) {
      fullList.innerHTML = `<div class="a-empty" style="grid-column:1/-1"><b>Could not load announcements</b></div>`;
    }
  }

  // Homepage strip (index.html — show 3 most recent, pinned first)
  const strip = $("#homepage-announcements");
  if (strip && window.DataService) {
    try {
      const anns = await DataService.getAnnouncements();
      if (!anns.length) { strip.innerHTML = `<p style="color:var(--ink-4);font-size:14px">No announcements yet.</p>`; return; }
      const sorted = [...anns].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at);
      }).slice(0, 3);
      strip.innerHTML = sorted.map(a => `
        <article class="ann-card${a.is_pinned ? " pinned" : ""}" style="margin-bottom:14px">
          <div class="ann-meta">
            ${a.is_pinned ? `<span class="ann-badge pinned-badge">📌 Pinned</span>` : ""}
            <span class="ann-badge cat">${esc(CATEGORY_LABELS[a.category] || a.category || "general")}</span>
            <span class="ann-date">${fmtAnnDate(a.published_at || a.created_at)}</span>
          </div>
          <h3 class="ann-title" style="font-size:16px">${esc(a.title)}</h3>
          <p class="ann-body" style="font-size:13px">${esc(a.body.slice(0, 200))}${a.body.length > 200 ? "…" : ""}</p>
        </article>`).join("");
    } catch (_) {}
  }
}

/* ============================================================
   SUBSCRIBER FORM (index.html)
   ============================================================ */

function setupSubscribeForm() {
  const form = $("#subscribe-form");
  if (!form || !window.DataService) return;

  const statusEl = $("#sub-status");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#sub-email").value.trim();
    if (!email || !email.includes("@")) {
      if (statusEl) { statusEl.style.color = "#ef4444"; statusEl.textContent = "Please enter a valid email address."; }
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;
    try {
      await DataService.subscribeEmail(email);
      if (statusEl) { statusEl.style.color = "#22c55e"; statusEl.textContent = "✓ You're subscribed! We'll keep you updated."; }
      form.reset();
    } catch (err) {
      if (statusEl) {
        statusEl.style.color = err.message && err.message.includes("already") ? "#2ee6d6" : "#ef4444";
        statusEl.textContent = err.message && err.message.includes("already")
          ? "✓ You're already subscribed."
          : "Could not subscribe. Please try again.";
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
