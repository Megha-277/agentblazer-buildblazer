/* ============================================================
   AGENTBLAZER CLUB — content store
   ------------------------------------------------------------
   This file holds the DEFAULT content of the site and the small
   helper (window.AB) that the public site and the admin
   dashboard both use to read / write content.

   Edits made in admin.html are saved to the browser's
   localStorage, so the site reads:  saved content -> else DEFAULTS.
   Use "Download backup" in the dashboard to keep a copy, and
   paste the JSON into DEFAULTS below when you want the change to
   ship with the code itself.
   ============================================================ */
(function () {
  "use strict";

  var CONTENT_KEY = "ab-content-v1";
  var AUTH_KEY    = "ab-admin-v1";
  var SESSION_KEY = "ab-session-v1";

  /* ---------------- DEFAULT CONTENT ---------------- */
  var DEFAULTS = {
    version: 1,

    guests: [
      { name: "Mr. Santosh Rebello", org: "Salesforce", left: "Guest of Honor", right: "Keynote Speaker", color: "t3" },
      { name: "Mr. Stephen Pinto", org: "Salesforce & SJEC Alumnus", left: "Technical Mentor", right: "Alumni Guide", color: "t1" },
      { name: "Dr. Rio D’Souza", org: "Principal, SJEC", left: "Presidential Address", right: "Patron", color: "t2" },
      { name: "Dr. Melwyn D’Souza", org: "HOD, Computer Science & Engg", left: "Program Chair", right: "Department Head", color: "t4" }
    ],

    faculty: [
      { name: "Ms. Nisha Roche", role: "Assistant Professor, CSE · Faculty Coordinator", photo: "" },
      { name: "Mr. Keith Fernandes", role: "Assistant Professor, CSE · Faculty Coordinator", photo: "" }
    ],

    officers: [
      { name: "Ruben Saldanha", badge: "Executive President", color: "t2", role: "President",
        desc: "Guiding club vision, university collaborations, and strategic workshop series.", photo: "" },
      { name: "Ajay Preenal Dsouza", badge: "Executive Vice President", color: "t2", role: "Vice President",
        desc: "Coordinating student mentorship, event operations, and community growth.", photo: "" },
      { name: "Stevin Dsouza", badge: "Technical Direction", color: "t1", role: "Tech Lead",
        desc: "Technical architectures, hands-on lab environments, and repository supervision.", photo: "" },
      { name: "Frenny Chrystal Saldanha", badge: "Operations & Logistics", color: "t3", role: "Resource Head",
        desc: "Managing cloud compute budgets, venue infrastructure, and participant toolkits.", photo: "" },
      { name: "Joyline Galbao", badge: "Administration", color: "t2", role: "Secretary",
        desc: "Documentation, accreditation reporting, meeting minutes, and member onboarding.", photo: "" },
      { name: "Chinthan N V", badge: "Creative Outreach", color: "t4", role: "Media Head",
        desc: "Brand storytelling, photo documentation, visual design, and social publications.", photo: "" }
    ],

    committee: [
      { name: "Prajwal Royston Cordiero", role: "AI & LLM Research Group" },
      { name: "Chacko P Abraham", role: "Model Evaluation Benchmarks" },
      { name: "Alma Roxane Pereira", role: "Project Operations & Labs" }
    ],

    events: [
      {
        date: "February 14, 2026", kind: "Flagship Masterclass", color: "t1",
        title: "Master the Future: A Hands-on GSoC & LLMs Workshop",
        tracks: [], note: "",
        desc: "Practical masterclass on open-source Git PR workflows, Retrieval-Augmented Generation (RAG), Gemini AI, LangChain, LlamaIndex, CrewAI, and live Gradio prototyping.",
        hint: "", foot: "80 Shortlisted Students",
        gallery: { label: "Guest speaker: Anas Khan", count: 8, caption: "Master the Future: GSoC & LLMs",
                   sub: "Anas Khan · Google DeepMind GSoC Alumni", date: "Feb 14, 2026", images: [] }
      },
      {
        date: "March 25, 2026", kind: "Live Contest", color: "t2",
        title: "PROMPT OPS-2K26 Challenge",
        tracks: ["Track 1: 1st Year Engineers", "Track 2: 2nd Year Engineers"], note: "",
        desc: "Fast-paced prompt engineering hackathon featuring automated test suites, iterative refinement, teamwork, and live algorithmic problem solving.",
        hint: "", foot: "10 Contest Photos",
        gallery: { label: "Contest gallery", count: 10, caption: "PROMPT OPS-2K26 Challenge",
                   sub: "CSE Department · AgentBlazer Club", date: "Mar 25, 2026", images: [] }
      },
      {
        date: "August 25, 2025", kind: "Symposium Keynote", color: "t2",
        title: "Agentforce Technical Deep-Dive",
        tracks: [], note: "Inaugural Technical Session",
        desc: "Guiding undergraduate engineers from prompt prediction to autonomous agentic architectures, Salesforce Data Cloud integration, and real-time enterprise workflows.",
        hint: "", foot: "CSE Auditorium",
        gallery: { label: "Guest speaker: Mr. Suhas Nayak", count: 3, caption: "Agentforce Technical Deep-Dive",
                   sub: "Inaugural symposium · CSE Auditorium", date: "Aug 25, 2025", images: [] }
      },
      {
        date: "March 18, 2026", kind: "Student Lab", color: "t2",
        title: "Demystifying Generative Models",
        tracks: [], note: "Session Leads: Prajwal Royston Cordiero & Chacko P Abraham",
        desc: "Exploring Transformer mechanics, multi-agent consensus networks, and comparative latency benchmarks of LLaMA, Groq, and Mistral architectures.",
        hint: "Hands-on Code Walkthrough", foot: "Systems Lab",
        gallery: { label: "Student lab gallery", count: 5, caption: "Demystifying Generative Models",
                   sub: "VI Sem CSE Cohort · Systems Lab", date: "Mar 18, 2026", images: [] }
      },
      {
        date: "April 01, 2026", kind: "Security Workshop", color: "t1",
        title: "Cyber Security & Career Pathways",
        tracks: [], note: "",
        desc: "Interactive demonstrations covering Shodan discovery, OSINT methods, CVE vulnerability analysis, SQL injection scenarios, and the Cyber Kill Chain.",
        hint: "", foot: "IV Sem CSE Cohort",
        gallery: { label: "Session gallery", count: 6, caption: "Cyber Security & Career Pathways",
                   sub: "Mr. Srinav Nayak · Sen Dev Lead, AgentForce", date: "Apr 01, 2026", images: [] }
      },
      {
        date: "May 22, 2026", kind: "Developer Lab", color: "t3",
        title: "Hands-on Agentforce & AI Agents",
        tracks: [], note: "Platform: Salesforce Developer Sandbox",
        desc: "Applied development lab creating Flex Prompts, dynamic contextual Sales Email templates, and autonomous event triggers within modern CRM pipelines.",
        hint: "Guided Practical Exercises", foot: "Cloud Computing Lab",
        gallery: { label: "Developer lab gallery", count: 4, caption: "Hands-on Agentforce & AI Agents",
                   sub: "Salesforce Developer Sandbox", date: "May 22, 2026", images: [] }
      }
    ]
  };

  /* ---------------- storage helpers ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    var data = null;
    try {
      var raw = localStorage.getItem(CONTENT_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }
    var base = clone(DEFAULTS);
    if (!data || typeof data !== "object") return base;
    ["guests", "faculty", "officers", "committee", "events"].forEach(function (k) {
      if (Array.isArray(data[k])) base[k] = data[k];
    });
    return base;
  }

  function save(data) {
    try {
      localStorage.setItem(CONTENT_KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function reset() {
    try { localStorage.removeItem(CONTENT_KEY); } catch (e) {}
    return clone(DEFAULTS);
  }

  /* ---------------- sha256 (pure JS, no secure-context needed) ---------------- */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, maxWord = mp(2, 32), lp = "length", i, j, result = "";
    var words = [], bitLength = ascii[lp] * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], pc = k[lp];
    var composite = {};
    for (var c = 2; pc < 64; c++) {
      if (!composite[c]) {
        for (i = 0; i < 313; i += c) composite[i] = c;
        hash[pc] = (mp(c, 0.5) * maxWord) | 0;
        k[pc++] = (mp(c, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while (ascii[lp] % 64 - 56) ascii += "\x00";
    for (i = 0; i < ascii[lp]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lp]] = ((bitLength / maxWord) | 0);
    words[words[lp]] = bitLength;
    for (j = 0; j < words[lp];) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] +
            (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : "") + b.toString(16);
    }
    return result;
  }

  function utf8(str) { return unescape(encodeURIComponent(String(str))); }
  function hash(pw) { return sha256(utf8("ab.salt.v1:" + pw)); }

  /* ---------------- account ---------------- */
  /* Default sign-in — change it from Settings after your first login.
     user: admin     password: agentblazer@2026                       */
  var DEFAULT_ACCOUNT = {
    user: "admin",
    pass: "58e65fe48ad32ef35513263ec6e2ab033d50350cf7672fce76380a7c3985b7d6",
    name: "Club Administrator"
  };

  function account() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        var a = JSON.parse(raw);
        if (a && a.user && a.pass) return a;
      }
    } catch (e) {}
    return clone(DEFAULT_ACCOUNT);
  }

  function saveAccount(a) {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); return true; }
    catch (e) { return false; }
  }

  function signIn(user, pw, remember) {
    var a = account();
    var ok = String(user).trim().toLowerCase() === String(a.user).trim().toLowerCase() && hash(pw) === a.pass;
    if (!ok) return false;
    var token = JSON.stringify({ user: a.user, at: Date.now() });
    try {
      sessionStorage.setItem(SESSION_KEY, token);
      if (remember) localStorage.setItem(SESSION_KEY, token);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    return true;
  }

  function session() {
    try {
      // Check the local-auth session token first (set by AB.signIn)
      var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);

      // Also accept a Supabase session stored by login.js under "ab-session"
      var supaRaw = sessionStorage.getItem("ab-session") || localStorage.getItem("ab-session");
      if (supaRaw) {
        var supaSession = JSON.parse(supaRaw);
        // A valid Supabase session has an access_token
        if (supaSession && supaSession.access_token) {
          return { user: "supabase", at: Date.now() };
        }
      }
      return null;
    } catch (e) { return null; }
  }

  function signOut() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      // Also clear the Supabase token stored by login.js
      sessionStorage.removeItem("ab-session");
      localStorage.removeItem("ab-session");
    } catch (e) {}
  }

  window.AB = {
    DEFAULTS: DEFAULTS,
    clone: clone,
    load: load,
    save: save,
    reset: reset,
    hash: hash,
    account: account,
    saveAccount: saveAccount,
    signIn: signIn,
    session: session,
    signOut: signOut
  };
})();