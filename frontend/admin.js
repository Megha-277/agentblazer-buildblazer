/* ============================================================
   AGENTBLAZER CLUB — dashboard logic
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ---------- gate ---------- */
  var session = AB.session();
  if (!session) { location.replace("login.html"); return; }

  /* ---------- theme ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    $$(".themes button").forEach(function (b) {
      var on = b.dataset.theme === t;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on);
    });
    try { localStorage.setItem("ab-theme", t); } catch (e) {}
  }
  $$(".themes button").forEach(function (b) { b.addEventListener("click", function () { setTheme(b.dataset.theme); }); });
  try { var st = localStorage.getItem("ab-theme"); if (st) setTheme(st); } catch (e) {}

  /* ---------- state ---------- */
  var data = AB.load();

  function initials(n) {
    return String(n).replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); }).join("") || "AB";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return (o == null ? undefined : o[k]); }, obj);
  }
  function set(obj, path, val) {
    var ks = path.split("."), last = ks.pop(), t = obj;
    ks.forEach(function (k) { if (typeof t[k] !== "object" || t[k] === null) t[k] = {}; t = t[k]; });
    t[last] = val;
  }

  var COLOURS = [
    { v: "t1", l: "Teal" }, { v: "t2", l: "Violet" }, { v: "t3", l: "Gold" }, { v: "t4", l: "Pink" }
  ];

  /* ---------- schemas ---------- */
  var SCHEMA = {
    events: {
      one: "event", kind: "Event",
      blank: function () {
        return { date: "", kind: "Workshop", color: "t1", title: "", tracks: [], note: "", desc: "", hint: "", foot: "",
                 gallery: { label: "Event gallery", count: 4, caption: "", sub: "", date: "", images: [] } };
      },
      title: function (it) { return it.title || "Untitled event"; },
      meta: function (it) { return "<b>" + esc(it.kind || "Event") + "</b> · " + esc(it.date || "no date yet") + (it.foot ? " · " + esc(it.foot) : ""); },
      badge: function (it) { return initials(it.title || "EV"); },
      fields: [
        { k: "title", l: "Event name", t: "text", ph: "PROMPT OPS-2K26 Challenge" },
        { k: "date", l: "Date on the card", t: "text", ph: "March 25, 2026", help: "Type it exactly as it should read on the site." },
        { k: "kind", l: "Badge label", t: "text", ph: "Live Contest", help: "The small pill at the top-right of the card." },
        { k: "color", l: "Badge colour", t: "color" },
        { k: "desc", l: "Description", t: "textarea", ph: "What happens at this event?" },
        { k: "note", l: "Extra line (optional)", t: "text", ph: "Session leads, platform, venue…", help: "Shown in the accent colour above the description." },
        { k: "tracks", l: "Tracks (optional)", t: "list", ph: "Track 1: 1st Year Engineers", help: "One per line. Leave empty if the event has no tracks." },
        { k: "foot", l: "Footer note", t: "text", ph: "80 Shortlisted Students", help: "Bottom-right of the card — venue, cohort or headcount." },
        { k: "hint", l: "Footer hint (optional)", t: "text", ph: "Hover to inspect gallery" },
        { t: "split", l: "Photo gallery pop-up" },
        { k: "gallery.label", l: "Gallery heading", t: "text", ph: "Guest speaker: Anas Khan" },
        { k: "gallery.caption", l: "Gallery caption", t: "text", ph: "PROMPT OPS-2K26 Challenge" },
        { k: "gallery.sub", l: "Caption sub-line", t: "text", ph: "CSE Department · AgentBlazer Club" },
        { k: "gallery.date", l: "Short date", t: "text", ph: "Mar 25, 2026" },
        { k: "gallery.images", l: "Photo links (optional)", t: "list", ph: "assets/photos/contest-1.jpg",
          help: "One link per line. Leave empty and placeholder artwork is used instead." },
        { k: "gallery.count", l: "Placeholder photo count", t: "number", help: "Only used when no photo links are given." }
      ]
    },

    officers: {
      one: "member", kind: "Core team",
      blank: function () { return { name: "", badge: "", color: "t1", role: "", desc: "", photo: "" }; },
      title: function (it) { return it.name || "Unnamed member"; },
      meta: function (it) { return "<b>" + esc(it.role || "Member") + "</b>" + (it.badge ? " · " + esc(it.badge) : ""); },
      badge: function (it) { return initials(it.name || "AB"); },
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Ruben Saldanha" },
        { k: "role", l: "Position", t: "text", ph: "President", help: "Shown in the highlighted box on the card." },
        { k: "badge", l: "Portfolio tag", t: "text", ph: "Executive President", help: "The small pill above the name." },
        { k: "color", l: "Tag colour", t: "color" },
        { k: "desc", l: "What they look after", t: "textarea", ph: "Guiding club vision, collaborations and the workshop series." },
        { k: "photo", l: "Photo link (optional)", t: "text", ph: "assets/team/ruben.jpg", help: "Leave empty to use the generated portrait." }
      ]
    },

    committee: {
      one: "member", kind: "Committee",
      blank: function () { return { name: "", role: "" }; },
      title: function (it) { return it.name || "Unnamed member"; },
      meta: function (it) { return "<b>" + esc(it.role || "Working group") + "</b>"; },
      badge: function (it) { return initials(it.name || "AB"); },
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Alma Roxane Pereira" },
        { k: "role", l: "Working group", t: "text", ph: "Project Operations & Labs" }
      ]
    },

    faculty: {
      one: "coordinator", kind: "Faculty",
      blank: function () { return { name: "", role: "", photo: "" }; },
      title: function (it) { return it.name || "Unnamed coordinator"; },
      meta: function (it) { return esc(it.role || "Faculty coordinator"); },
      badge: function (it) { return initials(it.name || "AB"); },
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Ms. Nisha Roche" },
        { k: "role", l: "Designation", t: "text", ph: "Assistant Professor, CSE · Faculty Coordinator" },
        { k: "photo", l: "Photo link (optional)", t: "text", ph: "assets/faculty/nisha.jpg", help: "Leave empty to use the generated portrait." }
      ]
    },

    guests: {
      one: "guest", kind: "Guest of honour",
      blank: function () { return { name: "", org: "", left: "", right: "", color: "t1" }; },
      title: function (it) { return it.name || "Unnamed guest"; },
      meta: function (it) { return esc(it.org || "") + (it.right ? " · <b>" + esc(it.right) + "</b>" : ""); },
      badge: function (it) { return initials(it.name || "AB"); },
      fields: [
        { k: "name", l: "Full name", t: "text", ph: "Mr. Santosh Rebello" },
        { k: "org", l: "Organisation or designation", t: "text", ph: "Salesforce" },
        { k: "left", l: "Role at the event", t: "text", ph: "Guest of Honor", help: "Bottom-left of the card." },
        { k: "right", l: "Highlighted title", t: "text", ph: "Keynote Speaker", help: "Bottom-right, in the accent colour." },
        { k: "color", l: "Accent colour", t: "color" }
      ]
    }
  };

  /* ---------- toast ---------- */
  var toastEl = $("#toast"), toastT;
  function toast(msg) {
    $("span", toastEl).textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 2600);
  }

  function persist(msg) {
    if (AB.save(data)) { toast(msg); }
    else { toast("Couldn’t save — your browser is blocking storage."); }
    renderAll();
  }

  /* ---------- lists ---------- */
  function rowHTML(sec, it, i, total) {
    var s = SCHEMA[sec];
    return '<article class="a-row">' +
      '<span class="ini">' + esc(s.badge(it)) + '</span>' +
      '<div><h4>' + esc(s.title(it)) + '</h4><p class="meta">' + s.meta(it) + '</p></div>' +
      '<div class="a-acts">' +
        '<button class="a-ico" data-move="-1" data-i="' + i + '" data-sec="' + sec + '" aria-label="Move up"' + (i === 0 ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' +
        '<button class="a-ico" data-move="1" data-i="' + i + '" data-sec="' + sec + '" aria-label="Move down"' + (i === total - 1 ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></button>' +
        '<button class="a-ico edit" data-edit="' + i + '" data-sec="' + sec + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>Edit</button>' +
        '<button class="a-ico del" data-del="' + i + '" data-sec="' + sec + '" aria-label="Remove">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>' +
      '</div></article>';
  }

  function renderSection(sec) {
    var host = $("#list-" + sec); if (!host) return;
    var arr = data[sec] || [];
    if (!arr.length) {
      host.innerHTML = '<div class="a-empty"><b>Nothing here yet</b><span>Use the button above to add your first ' + SCHEMA[sec].one + '.</span></div>';
    } else {
      host.innerHTML = arr.map(function (it, i) { return rowHTML(sec, it, i, arr.length); }).join("");
    }
    var c = $('[data-count="' + sec + '"]'); if (c) c.textContent = arr.length;
  }

  function renderAll() { Object.keys(SCHEMA).forEach(renderSection); }

  /* ---------- tabs ---------- */
  $("#tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sec]"); if (!b) return;
    $$("#tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
    $$(".a-sec").forEach(function (s) { s.classList.toggle("on", s.id === "sec-" + b.dataset.sec); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- editor sheet ---------- */
  var sheet = $("#sheet"), scrim = $("#scrim"), body = $("#sheet-body");
  var editing = { sec: null, index: null };

  function fieldHTML(f, val) {
    if (f.t === "split") return '<div class="a-split">' + esc(f.l) + "</div>";
    var id = "f-" + f.k.replace(/\./g, "-");
    var help = f.help ? '<span class="help">' + esc(f.help) + "</span>" : "";
    var ph = esc(f.ph || "");
    var html = '<div class="f"><label for="' + id + '">' + esc(f.l) + "</label>";

    if (f.t === "textarea") {
      html += '<textarea id="' + id + '" data-k="' + f.k + '" placeholder="' + ph + '">' + esc(val || "") + "</textarea>";
    } else if (f.t === "list") {
      html += '<textarea id="' + id + '" data-k="' + f.k + '" data-list="1" placeholder="' + ph + '">' +
        esc((Array.isArray(val) ? val : []).join("\n")) + "</textarea>";
    } else if (f.t === "number") {
      html += '<input id="' + id + '" data-k="' + f.k + '" type="number" min="1" max="30" value="' + esc(val || 4) + '">';
    } else if (f.t === "color") {
      html += '<div class="a-swatch">' + COLOURS.map(function (c) {
        return '<label data-c="' + c.v + '"><input type="radio" name="' + id + '" data-k="' + f.k + '" value="' + c.v + '"' +
          (val === c.v ? " checked" : "") + '><i></i>' + c.l + "</label>";
      }).join("") + "</div>";
    } else {
      html += '<input id="' + id + '" data-k="' + f.k + '" type="text" value="' + esc(val || "") + '" placeholder="' + ph + '">';
    }
    return html + help + "</div>";
  }

  function openEditor(sec, index) {
    var s = SCHEMA[sec];
    var item = index === null ? s.blank() : AB.clone(data[sec][index]);
    editing = { sec: sec, index: index, draft: item };

    $("#sheet-kind").textContent = s.kind;
    $("#sheet-title").textContent = (index === null ? "Add " : "Edit ") + (index === null ? "a new " + s.one : s.title(item));
    body.innerHTML = s.fields.map(function (f) { return fieldHTML(f, f.k ? get(item, f.k) : null); }).join("");
    $("#sheet-save").textContent = index === null ? "Add " + s.one : "Save changes";

    scrim.classList.add("on"); sheet.classList.add("on");
    var first = body.querySelector("input[type=text], textarea");
    if (first) setTimeout(function () { first.focus(); }, 120);
  }

  function closeEditor() {
    scrim.classList.remove("on"); sheet.classList.remove("on");
    editing = { sec: null, index: null };
  }

  function readEditor() {
    var s = SCHEMA[editing.sec], item = editing.draft;
    $$("[data-k]", body).forEach(function (el) {
      if (el.type === "radio") { if (el.checked) set(item, el.dataset.k, el.value); return; }
      var v = el.value;
      if (el.dataset.list) {
        v = v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      } else if (el.type === "number") {
        v = Math.max(1, Math.min(30, parseInt(v, 10) || 1));
      } else {
        v = v.trim();
      }
      set(item, el.dataset.k, v);
    });
    return item;
  }

  $("#sheet-save").addEventListener("click", function () {
    var sec = editing.sec; if (!sec) return;
    var item = readEditor();
    var nameKey = sec === "events" ? "title" : "name";
    if (!item[nameKey]) {
      toast(sec === "events" ? "Give the event a name first." : "Enter a name first.");
      var el = body.querySelector('[data-k="' + nameKey + '"]'); if (el) el.focus();
      return;
    }
    if (editing.index === null) { data[sec].push(item); }
    else { data[sec][editing.index] = item; }
    var was = editing.index === null;
    closeEditor();
    persist(was ? "Added. It’s live on the site now." : "Saved. The site is updated.");
  });

  $("#sheet-cancel").addEventListener("click", closeEditor);
  $("#sheet-x").addEventListener("click", closeEditor);
  scrim.addEventListener("click", closeEditor);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet.classList.contains("on")) closeEditor(); });

  /* ---------- row + add actions ---------- */
  document.addEventListener("click", function (e) {
    var add = e.target.closest("[data-add]");
    if (add) { openEditor(add.dataset.add, null); return; }

    var btn = e.target.closest("[data-sec][data-edit], [data-sec][data-del], [data-sec][data-move]");
    if (!btn) return;
    var sec = btn.dataset.sec;

    if (btn.dataset.edit !== undefined) { openEditor(sec, +btn.dataset.edit); return; }

    if (btn.dataset.del !== undefined) {
      var i = +btn.dataset.del, it = data[sec][i];
      if (!confirm("Remove “" + SCHEMA[sec].title(it) + "” from the site?\n\nThis can’t be undone, but a backup file will restore it.")) return;
      data[sec].splice(i, 1);
      persist("Removed from the site.");
      return;
    }

    if (btn.dataset.move !== undefined) {
      var from = +btn.dataset.i, to = from + (+btn.dataset.move);
      if (to < 0 || to >= data[sec].length) return;
      var row = data[sec].splice(from, 1)[0];
      data[sec].splice(to, 0, row);
      persist("Order updated.");
    }
  });

  /* ---------- backup / restore / reset ---------- */
  $("#backup").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var d = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
    a.href = URL.createObjectURL(blob);
    a.download = "agentblazer-content-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("Backup downloaded.");
  });

  $("#restore").addEventListener("click", function () { $("#file").click(); });
  $("#file").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var parsed = JSON.parse(r.result);
        var ok = ["guests", "faculty", "officers", "committee", "events"].some(function (k) { return Array.isArray(parsed[k]); });
        if (!ok) throw new Error("bad");
        if (!confirm("Replace everything on the site with the contents of this backup?")) return;
        AB.save(parsed);
        data = AB.load();
        persist("Backup restored.");
      } catch (err) {
        toast("That file isn’t an AgentBlazer backup.");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  });

  $("#factory").addEventListener("click", function () {
    if (!confirm("Reset all events and members back to the original content?\n\nEverything you’ve added here will be lost. Download a backup first if you’re unsure.")) return;
    data = AB.reset();
    renderAll();
    toast("Reset to the original content.");
  });

  /* ---------- log out ---------- */
  $("#logout").addEventListener("click", function () {
    AB.signOut();
    location.href = "login.html";
  });

  /* ---------- settings ---------- */
  var acct = AB.account();
  $("#who-name").textContent = acct.name || "Administrator";
  $("#who-ini").textContent = initials(acct.name || "Administrator");
  $("#set-name").value = acct.name || "";
  $("#set-user").value = acct.user || "";

  function setErr(msg) {
    var box = $("#set-err");
    if (!msg) { box.classList.remove("on"); return; }
    box.textContent = msg;
    box.classList.remove("on"); void box.offsetWidth; box.classList.add("on");
  }

  $("#set-save").addEventListener("click", function () {
    var name = $("#set-name").value.trim(), user = $("#set-user").value.trim();
    var old = $("#set-old").value, np = $("#set-new").value, np2 = $("#set-new2").value;
    var cur = AB.account();

    if (!user) return setErr("Enter a username.");
    if (!old) return setErr("Enter your current password to confirm the change.");
    if (AB.hash(old) !== cur.pass) return setErr("That current password isn’t right.");
    if (np || np2) {
      if (np.length < 8) return setErr("The new password needs at least 8 characters.");
      if (np !== np2) return setErr("The two new passwords don’t match.");
    }
    setErr("");
    var next = { user: user, name: name || "Administrator", pass: np ? AB.hash(np) : cur.pass };
    AB.saveAccount(next);
    $("#set-old").value = $("#set-new").value = $("#set-new2").value = "";
    $("#who-name").textContent = next.name;
    $("#who-ini").textContent = initials(next.name);
    toast("Sign-in details saved.");
  });

  /* ---------- go ---------- */
  renderAll();
})();