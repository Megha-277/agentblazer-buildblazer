/* ============================================================
   AGENTBLAZER CLUB — Dashboard Logic v3
   Yearly-cycle model: no approval flow, invite-based onboarding.
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ─── Session gate (sessionStorage only) ─────────────────── */
  function getSession() {
    try {
      var raw = sessionStorage.getItem("ab-session");
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.access_token) ? s : null;
    } catch (_) { return null; }
  }

  var session = getSession();
  if (!session) { location.replace("login.html"); return; }

  function getToken() {
    var s = getSession();
    return s ? s.access_token : "";
  }

  const BASE = typeof window.API_BASE_URL !== "undefined" ? window.API_BASE_URL : "";

  /* ─── Shared state ────────────────────────────────────────── */
  var CURRENT_USER = { id: "", role: "member", role_level: 0, full_name: "Loading…", email: "" };
  var allMembers = [], contactSubmissions = [], announcements = [], threads = [];
  var data = window.AB ? AB.load() : { events:[], officers:[], committee:[], faculty:[], guests:[] };

  /* ─── Utilities ───────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function initials(n) {
    return String(n||"").replace(/[^A-Za-z ]/g,"").split(" ").filter(Boolean)
      .slice(0,2).map(w=>w[0].toUpperCase()).join("") || "AB";
  }
  function get(obj,path){ return path.split(".").reduce((o,k)=>o==null?undefined:o[k],obj); }
  function set(obj,path,val){
    var ks=path.split("."),last=ks.pop(),t=obj;
    ks.forEach(k=>{if(typeof t[k]!=="object"||t[k]===null)t[k]={};t=t[k];});
    t[last]=val;
  }
  function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }catch(_){return iso||"";} }

  /* ─── Toast ───────────────────────────────────────────────── */
  var toastEl = $("#toast"), toastT;
  function toast(msg) {
    if(!toastEl) return;
    $("span",toastEl).textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(()=>toastEl.classList.remove("on"), 2800);
  }

  /* ─── Auth header ─────────────────────────────────────────── */
  function authHdr() { return { "Content-Type":"application/json", "Authorization":"Bearer "+getToken() }; }
  async function api(method, path, body) {
    var opts = { method, headers: authHdr() };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(BASE + path, opts);
    if (!res.ok) { var e = await res.json().catch(()=>({})); throw new Error(e.detail||"Request failed"); }
    return res.json();
  }

  /* ─── Password strength (settings panel) ─────────────────── */
  var PW_RULES = [
    { test: v=>v.length>=8,      msg:"at least 8 characters" },
    { test: v=>/[A-Z]/.test(v),  msg:"one uppercase letter" },
    { test: v=>/[a-z]/.test(v),  msg:"one lowercase letter" },
    { test: v=>/[0-9]/.test(v),  msg:"one number" },
    { test: v=>/[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/`~\\]/.test(v), msg:"one special character" },
  ];
  function validatePw(v) {
    var errors = PW_RULES.filter(r=>!r.test(v)).map(r=>r.msg);
    return errors;
  }

  /* ─── Role gate ───────────────────────────────────────────── */
  function applyRoleGate() {
    var lvl = CURRENT_USER.role_level;

    // Members tab: President (4)+
    var $mem = $("#tab-members"), $smem = $("#sec-members");
    if ($mem) { $mem.hidden = lvl < 3; if($smem) $smem.hidden = lvl < 3; }

    // Enquiries tab: Secretary (3)+
    var $sub = $("#tab-submissions"), $ssub = $("#sec-submissions");
    if ($sub) { $sub.hidden = lvl < 3; if($ssub) $ssub.hidden = lvl < 3; }

    // Announcements: Event Manager (2)+
    var $ann = $("#tab-announcements"), $sann = $("#sec-announcements");
    if ($ann) { $ann.hidden = lvl < 2; if($sann) $sann.hidden = lvl < 2; }

    // Discussions: all members
    // (already visible; no gate)

    // Events write: Event Manager (2)+ ; Secretary/President are read-only on events
    if (lvl === 3 || lvl === 4) {
      $$("[data-add='events'],[data-del][data-sec='events'],[data-move][data-sec='events']").forEach(b=>{b.hidden=true;b.disabled=true;});
    }
    // Invite buttons: Secretary (3)+
    var $inv = $("#btn-invite-member"), $bulk = $("#btn-bulk-invite");
    if ($inv)  { $inv.hidden  = lvl < 3; }
    if ($bulk) { $bulk.hidden = lvl < 4; } // bulk only for President+

    // Tech Lead (1) and below: read-only everywhere
    if (lvl <= 1) {
      $$("[data-add],[data-del],[data-move],#sheet-save").forEach(b=>{b.hidden=true;b.disabled=true;});
      $$("#btn-add-announcement,#btn-invite-member,#btn-bulk-invite,#btn-new-thread").forEach(b=>{if(b)b.hidden=true;});
    }

    // Hide nav groups for Event Manager (2): only content + notifications + settings
    if (lvl === 2) {
      var $gp = $("#group-people"); if($gp) $gp.hidden = true;
    }
  }

  /* ─── Profile fetch ───────────────────────────────────────── */
  async function fetchProfile() {
    try {
      var p = await api("GET", "/api/profile");
      CURRENT_USER = p;
      var whoName = $("#who-name"), whoIni = $("#who-ini"), whoRole = $("#who-role");
      if (whoName) whoName.textContent = p.full_name || p.email || "Member";
      if (whoIni)  whoIni.textContent  = initials(p.full_name || p.email);
      if (whoRole) whoRole.textContent = p.role ? p.role.toUpperCase() + " ("+p.role_level+")" : "";
      applyRoleGate();
      if (p.role_level >= 3) loadMembers();
      if (p.role_level >= 3) loadSubmissions();
      if (p.role_level >= 2) loadAnnouncements();
      loadThreads();
      loadNotifPrefs();
    } catch (err) {
      console.warn("Profile fetch failed:", err);
    }
  }

  /* ══════════════════════════════════════════════════════════
     CONTENT SECTIONS (events, officers, committee, faculty, guests)
     ══════════════════════════════════════════════════════════ */
  const COLOURS = [{ v:"t1",l:"Teal"},{v:"t2",l:"Violet"},{v:"t3",l:"Gold"},{v:"t4",l:"Pink"}];
  const SCHEMA = {
    events: {
      one:"event", kind:"Event",
      blank:()=>({ date:"",kind:"Workshop",color:"t1",title:"",tracks:[],note:"",desc:"",hint:"",foot:"",
        gallery:{label:"Event gallery",count:4,caption:"",sub:"",date:"",images:[]}}),
      title:it=>it.title||"Untitled event",
      meta:it=>`<b>${esc(it.kind||"Event")}</b> · ${esc(it.date||"no date")} ${it.foot?"· "+esc(it.foot):""}`,
      badge:it=>initials(it.title||"EV"),
      fields:[
        {k:"title",l:"Event name",t:"text",ph:"PROMPT OPS-2K26 Challenge"},
        {k:"date",l:"Date on card",t:"text",ph:"March 25, 2026"},
        {k:"kind",l:"Badge label",t:"text",ph:"Live Contest"},
        {k:"color",l:"Badge colour",t:"color"},
        {k:"desc",l:"Description",t:"textarea",ph:"What happens at this event?"},
        {k:"note",l:"Extra line / Session lead",t:"text",ph:"Session leads, platform, venue…"},
        {k:"tracks",l:"Tracks (one per line)",t:"list",ph:"Track 1: 1st Year Engineers"},
        {k:"foot",l:"Footer note",t:"text",ph:"80 Shortlisted Students"},
        {k:"hint",l:"Footer hint",t:"text",ph:"Hover to inspect gallery"},
        {k:"gallery.images",l:"Gallery images (up to 10)",t:"upload_list",max:10,help:"Upload or paste URLs, one per line.",ph:"Upload or paste image URLs…"}
      ]
    },
    officers:{
      one:"member",kind:"Core team",
      blank:()=>({name:"",badge:"",color:"t1",role:"",desc:"",photo:""}),
      title:it=>it.name||"Unnamed member",
      meta:it=>`<b>${esc(it.role||"Member")}</b>${it.badge?" · "+esc(it.badge):""}`,
      badge:it=>initials(it.name||"AB"),
      fields:[
        {k:"name",l:"Full name",t:"text",ph:"Ruben Saldanha"},
        {k:"role",l:"Position",t:"text",ph:"President"},
        {k:"badge",l:"Portfolio tag",t:"text",ph:"Executive President"},
        {k:"color",l:"Tag colour",t:"color"},
        {k:"desc",l:"Bio",t:"textarea",ph:"Guiding club vision…"},
        {k:"photo",l:"Photo",t:"upload",ph:"Upload or paste URL"}
      ]
    },
    committee:{
      one:"member",kind:"Committee",
      blank:()=>({name:"",role:""}),
      title:it=>it.name||"Unnamed",
      meta:it=>`<b>${esc(it.role||"Working group")}</b>`,
      badge:it=>initials(it.name||"AB"),
      fields:[{k:"name",l:"Full name",t:"text",ph:"Alma Roxane Pereira"},{k:"role",l:"Working group",t:"text",ph:"Project Operations & Labs"}]
    },
    faculty:{
      one:"coordinator",kind:"Faculty",
      blank:()=>({name:"",role:"",photo:""}),
      title:it=>it.name||"Unnamed",
      meta:it=>esc(it.role||"Faculty coordinator"),
      badge:it=>initials(it.name||"AB"),
      fields:[
        {k:"name",l:"Full name",t:"text",ph:"Ms. Nisha Roche"},
        {k:"role",l:"Designation",t:"text",ph:"Assistant Professor, CSE"},
        {k:"photo",l:"Photo",t:"upload",ph:"Upload or paste URL"}
      ]
    },
    guests:{
      one:"guest",kind:"Guest of honour",
      blank:()=>({name:"",org:"",left:"",right:"",color:"t1"}),
      title:it=>it.name||"Unnamed guest",
      meta:it=>esc(it.org||"")+(it.right?" · <b>"+esc(it.right)+"</b>":""),
      badge:it=>initials(it.name||"AB"),
      fields:[
        {k:"name",l:"Full name",t:"text",ph:"Mr. Santosh Rebello"},
        {k:"org",l:"Organisation",t:"text",ph:"Salesforce"},
        {k:"left",l:"Event role",t:"text",ph:"Guest of Honor"},
        {k:"right",l:"Highlight title",t:"text",ph:"Keynote Speaker"},
        {k:"color",l:"Accent colour",t:"color"}
      ]
    }
  };

  async function persist(msg) {
    if (window.AB) AB.save(data);
    renderAll();
    toast(msg);
    var token = getToken();
    if (token && CURRENT_USER.role_level >= 2) {
      try {
        await fetch(BASE+"/api/content",{method:"POST",headers:authHdr(),body:JSON.stringify(data)});
      } catch (_) {}
    }
  }

  function rowHTML(sec, it, i, total) {
    var s = SCHEMA[sec];
    var ro = CURRENT_USER.role_level <= 1;
    return `<article class="a-row">
      <span class="ini">${esc(s.badge(it))}</span>
      <div><h4>${esc(s.title(it))}</h4><p class="meta">${s.meta(it)}</p></div>
      <div class="a-acts">${!ro?`
        <button class="a-ico" data-move="-1" data-i="${i}" data-sec="${sec}" aria-label="Up" ${i===0?"disabled":""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
        <button class="a-ico" data-move="1" data-i="${i}" data-sec="${sec}" aria-label="Down" ${i===total-1?"disabled":""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        </button>
        <button class="a-ico edit" data-edit="${i}" data-sec="${sec}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>Edit
        </button>
        <button class="a-ico del" data-del="${i}" data-sec="${sec}" aria-label="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
        </button>`:`<span style="font-size:12px;color:var(--ink-4)">Read only</span>`}
      </div></article>`;
  }

  function renderSection(sec) {
    var host = $(`#list-${sec}`); if (!host) return;
    var arr = data[sec] || [];
    host.innerHTML = arr.length
      ? arr.map((it,i)=>rowHTML(sec,it,i,arr.length)).join("")
      : `<div class="a-empty"><b>Nothing here yet</b><span>Use the button above to add your first ${SCHEMA[sec].one}.</span></div>`;
    var c = $(`[data-count="${sec}"]`); if(c) c.textContent = arr.length;
  }

  function renderAll() { Object.keys(SCHEMA).forEach(renderSection); }

  /* ─── Tabs ────────────────────────────────────────────────── */
  $("#tabs").addEventListener("click", e => {
    var b = e.target.closest("button[data-sec]"); if(!b) return;
    $$("#tabs button").forEach(x=>x.classList.toggle("on",x===b));
    $$(".a-sec").forEach(s=>s.classList.toggle("on",s.id===`sec-${b.dataset.sec}`));
    window.scrollTo({top:0,behavior:"smooth"});
    var sec = b.dataset.sec;
    if(sec==="members")     loadMembers();
    if(sec==="submissions") loadSubmissions();
    if(sec==="announcements") loadAnnouncements();
    if(sec==="discussions") { loadThreads(); loadUnread(); }
    if(sec==="notifications") loadNotifPrefs();
  });

  /* ─── Editor sheet ────────────────────────────────────────── */
  var sheet=$("#sheet"),scrim=$("#scrim"),sheetBody=$("#sheet-body");
  var editing={sec:null,index:null,draft:null};
  var uploadTargetId=null;

  function fieldHTML(f,val){
    if(f.t==="split") return `<div class="a-split">${esc(f.l)}</div>`;
    var id=`f-${f.k.replace(/\./g,"-")}`;
    var help=f.help?`<span class="help">${esc(f.help)}</span>`:"";
    var ph=esc(f.ph||"");
    var html=`<div class="f"><label for="${id}">${esc(f.l)}</label>`;
    if(f.t==="textarea"){
      html+=`<textarea id="${id}" data-k="${f.k}" placeholder="${ph}">${esc(val||"")}</textarea>`;
    } else if(f.t==="list"){
      html+=`<textarea id="${id}" data-k="${f.k}" data-list="1" placeholder="${ph}">${esc((Array.isArray(val)?val:[]).join("\n"))}</textarea>`;
    } else if(f.t==="upload_list"){
      var urls=(Array.isArray(val)?val:[]).join("\n");
      html+=`<div style="display:flex;flex-direction:column;gap:8px">
        <textarea id="${id}" data-k="${f.k}" data-list="1" data-max="${f.max||10}" placeholder="${ph}" style="min-height:90px">${esc(urls)}</textarea>
        <button type="button" class="upload-btn a-mini" data-upload-target="${id}" style="align-self:flex-start">+ Upload image</button>
      </div>`;
    } else if(f.t==="upload"){
      html+=`<div class="upload-box"><input id="${id}" data-k="${f.k}" type="text" value="${esc(val||"")}" placeholder="${ph}" style="flex:1">
        <button type="button" class="upload-btn" data-upload-target="${id}">Upload</button></div>`;
    } else if(f.t==="color"){
      html+=`<div class="a-swatch">${COLOURS.map(c=>`<label data-c="${c.v}"><input type="radio" name="${id}" data-k="${f.k}" value="${c.v}"${val===c.v?" checked":""}><i></i>${c.l}</label>`).join("")}</div>`;
    } else {
      html+=`<input id="${id}" data-k="${f.k}" type="text" value="${esc(val||"")}" placeholder="${ph}">`;
    }
    return html+help+`</div>`;
  }

  function openEditor(sec,index){
    var s=SCHEMA[sec];
    var item=index===null?s.blank():AB.clone(data[sec][index]);
    editing={sec,index,draft:item};
    $("#sheet-kind").textContent=s.kind;
    $("#sheet-title").textContent=(index===null?"Add ":"Edit ")+(index===null?"a new "+s.one:s.title(item));
    sheetBody.innerHTML=s.fields.map(f=>fieldHTML(f,f.k?get(item,f.k):null)).join("");
    $("#sheet-save").textContent=index===null?`Add ${s.one}`:"Save changes";
    $$(".upload-btn",sheetBody).forEach(btn=>{
      btn.addEventListener("click",()=>{ uploadTargetId=btn.dataset.uploadTarget; $("#image-upload-input").click(); });
    });
    scrim.classList.add("on"); sheet.classList.add("on");
    var first=sheetBody.querySelector("input[type=text],textarea"); if(first) setTimeout(()=>first.focus(),100);
  }

  function closeEditor(){ scrim.classList.remove("on"); sheet.classList.remove("on"); editing={sec:null,index:null,draft:null}; }

  /* Image upload */
  var fileInput=$("#image-upload-input");
  if(fileInput){
    fileInput.addEventListener("change",async e=>{
      var file=e.target.files&&e.target.files[0]; if(!file) return;
      var token=getToken(); if(!token){ alert("Session expired."); return; }
      if(file.size>2*1024*1024){ alert("Max 2 MB."); fileInput.value=""; return; }
      toast("Uploading…");
      var fd=new FormData(); fd.append("file",file);
      try{
        var res=await fetch(BASE+"/api/upload",{method:"POST",headers:{"Authorization":"Bearer "+token},body:fd});
        if(!res.ok){ var err=await res.json().catch(()=>({})); throw new Error(err.detail||"Upload failed"); }
        var d=await res.json();
        var target=$(`#${uploadTargetId}`);
        if(target){
          if(target.tagName.toLowerCase()==="textarea"){
            var lines=target.value.trim()?target.value.trim().split("\n").map(x=>x.trim()).filter(Boolean):[];
            if(lines.length>=10){ alert("Max 10 gallery images."); }
            else{ lines.push(d.url); target.value=lines.join("\n"); }
          } else { target.value=d.url; }
        }
        toast("Image uploaded!");
      }catch(err){ alert("Upload error: "+err.message); }
      finally{ fileInput.value=""; }
    });
  }

  function readEditor(){
    var item=editing.draft;
    $$("[data-k]",sheetBody).forEach(el=>{
      if(el.type==="radio"){ if(el.checked) set(item,el.dataset.k,el.value); return; }
      var v=el.value.trim();
      if(el.dataset.list){ v=v.split("\n").map(x=>x.trim()).filter(Boolean); if(el.dataset.max) v=v.slice(0,+el.dataset.max); }
      set(item,el.dataset.k,v);
    });
    return item;
  }

  $("#sheet-save").addEventListener("click",()=>{
    var sec=editing.sec; if(!sec) return;
    var item=readEditor();
    var key=sec==="events"?"title":"name";
    if(!item[key]){ toast(sec==="events"?"Add a title first.":"Enter a name first."); return; }
    if(editing.index===null){ data[sec].push(item); } else { data[sec][editing.index]=item; }
    closeEditor(); persist("Saved.");
  });

  ["#sheet-cancel","#sheet-x"].forEach(id=>{ var el=$(id); if(el) el.addEventListener("click",closeEditor); });
  if(scrim) scrim.addEventListener("click",closeEditor);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&sheet&&sheet.classList.contains("on")) closeEditor(); });

  /* Row actions */
  document.addEventListener("click",e=>{
    var add=e.target.closest("[data-add]");
    if(add){ openEditor(add.dataset.add,null); return; }
    var btn=e.target.closest("[data-sec][data-edit],[data-sec][data-del],[data-sec][data-move]");
    if(!btn) return;
    var sec=btn.dataset.sec;
    if(btn.dataset.edit!==undefined){ openEditor(sec,+btn.dataset.edit); return; }
    if(btn.dataset.del!==undefined){
      var it=data[sec][+btn.dataset.del];
      if(!confirm(`Remove "${SCHEMA[sec].title(it)}"?`)) return;
      data[sec].splice(+btn.dataset.del,1); persist("Removed.");
      return;
    }
    if(btn.dataset.move!==undefined){
      var from=+btn.dataset.i,to=from+(+btn.dataset.move);
      if(to<0||to>=data[sec].length) return;
      var row=data[sec].splice(from,1)[0]; data[sec].splice(to,0,row); persist("Order updated.");
    }
  });

  /* ══════════════════════════════════════════════════════════
     BACKUP EXPORT
     ══════════════════════════════════════════════════════════ */
  var backupBtn=$("#backup");
  if(backupBtn){
    backupBtn.addEventListener("click",()=>{
      var payload=JSON.stringify(data,null,2);
      var blob=new Blob([payload],{type:"application/json"});
      var a=document.createElement("a");
      var d=new Date(),pad=n=>(n<10?"0":"")+n;
      a.href=URL.createObjectURL(blob);
      a.download=`agentblazer-backup-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      toast("Backup exported.");
    });
  }

  /* ══════════════════════════════════════════════════════════
     ANNOUNCEMENTS
     ══════════════════════════════════════════════════════════ */
  async function loadAnnouncements(){
    try{
      var all=await api("GET","/api/announcements?pinned_only=false&include_unpublished=1");
      // Backend actually returns published only via anon; use admin route below
      var token=getToken();
      var res=await fetch(BASE+"/api/announcements",{headers:authHdr()});
      if(res.ok) announcements=await res.json();
      else announcements=all||[];
    }catch(_){ announcements=[]; }
    renderAnnouncements();
  }

  // Re-fetch with auth to get unpublished too
  async function loadAnnouncementsAdmin(){
    try{
      var res=await fetch(BASE+"/api/announcements",{headers:authHdr()});
      if(res.ok) announcements=await res.json();
    }catch(_){}
    renderAnnouncements();
  }

  function renderAnnouncements(){
    var host=$("#list-announcements"); if(!host) return;
    var c=$("[data-count='announcements']"); if(c) c.textContent=announcements.length;
    if(!announcements.length){
      host.innerHTML=`<div class="a-empty"><b>No announcements yet</b><span>Use the button above to create one.</span></div>`;
      return;
    }
    host.innerHTML=announcements.map(a=>`
      <article class="a-row">
        <span class="ini">${esc(a.category?a.category.slice(0,2).toUpperCase():"GN")}</span>
        <div>
          <h4>${esc(a.title)}${a.is_pinned?` <span class="badge-status approved" style="font-size:10px">PINNED</span>`:""}</h4>
          <p class="meta">
            <span class="badge-status ${a.is_published?"approved":"pending"}">${a.is_published?"Published":"Draft"}</span>
            · ${esc(a.category||"general")} · ${fmtDate(a.published_at||a.created_at)}
          </p>
        </div>
        <div class="a-acts">
          <button class="a-ico edit" data-ann-edit="${a.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>Edit
          </button>
          <button class="a-ico del" data-ann-del="${a.id}" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </article>`).join("");

    // Wire edit/delete
    $$("[data-ann-edit]",host).forEach(btn=>{
      btn.addEventListener("click",()=>{ var a=announcements.find(x=>x.id===btn.dataset.annEdit); if(a) openAnnEditor(a); });
    });
    $$("[data-ann-del]",host).forEach(btn=>{
      btn.addEventListener("click",async()=>{
        if(!confirm("Delete this announcement?")) return;
        try{ await api("DELETE",`/api/announcements/${btn.dataset.annDel}`); toast("Deleted."); loadAnnouncementsAdmin(); }
        catch(err){ toast("Error: "+err.message); }
      });
    });
  }

  function openAnnEditor(existing){
    var isNew=!existing;
    var title  = existing?existing.title:"";
    var body   = existing?existing.body:"";
    var cat    = existing?existing.category:"general";
    var pub    = existing?existing.is_published:false;
    var pinned = existing?existing.is_pinned:false;

    // Re-use the editor sheet
    var s={kind:"Announcement",one:"announcement"};
    $("#sheet-kind").textContent="Announcement";
    $("#sheet-title").textContent=isNew?"New announcement":"Edit announcement";
    sheetBody.innerHTML=`
      <div class="f"><label>Title</label><input id="ann-title" type="text" value="${esc(title)}" maxlength="200" placeholder="e.g. Registration open for PROMPT OPS-2K26"></div>
      <div class="f"><label>Body</label><textarea id="ann-body" style="min-height:130px">${esc(body)}</textarea></div>
      <div class="f"><label>Category</label>
        <select id="ann-cat">
          ${["general","competition","registration","workshop","achievement","notice"].map(c=>`<option value="${c}"${c===cat?" selected":""}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join("")}
        </select>
      </div>
      <div class="f" style="flex-direction:row;align-items:center;gap:12px">
        <input type="checkbox" id="ann-published"${pub?" checked":""} style="width:16px;height:16px">
        <label for="ann-published" style="margin:0;cursor:pointer">Publish immediately</label>
      </div>
      <div class="f" style="flex-direction:row;align-items:center;gap:12px">
        <input type="checkbox" id="ann-pinned"${pinned?" checked":""} style="width:16px;height:16px">
        <label for="ann-pinned" style="margin:0;cursor:pointer">Pin to homepage</label>
      </div>`;
    $("#sheet-save").textContent = isNew ? "Create announcement" : "Save changes";
    // Override save button for announcements
    var savedHandler=null;
    function annSaveHandler(){
      var t=$("#ann-title").value.trim();
      var b=$("#ann-body").value.trim();
      if(!t||!b){ toast("Title and body are required."); return; }
      var payload={title:t,body:b,category:$("#ann-cat").value,
        is_published:$("#ann-published").checked,is_pinned:$("#ann-pinned").checked};
      var promise=isNew?api("POST","/api/announcements",payload):api("PATCH",`/api/announcements/${existing.id}`,payload);
      promise.then(()=>{ toast(isNew?"Announcement created.":"Announcement updated."); closeEditor(); loadAnnouncementsAdmin(); })
             .catch(err=>toast("Error: "+err.message));
    }
    if(savedHandler) $("#sheet-save").removeEventListener("click",savedHandler);
    // Temporarily replace save handler (store on element)
    var el=$("#sheet-save");
    var clone=el.cloneNode(true); el.parentNode.replaceChild(clone,el);
    clone.addEventListener("click",annSaveHandler);
    scrim.classList.add("on"); sheet.classList.add("on");
  }

  var btnNewAnn=$("#btn-add-announcement");
  if(btnNewAnn) btnNewAnn.addEventListener("click",()=>openAnnEditor(null));

  /* ══════════════════════════════════════════════════════════
     MEMBERS
     ══════════════════════════════════════════════════════════ */
  async function loadMembers(){
    var host=$("#list-members"); if(!host) return;
    try{
      allMembers=await api("GET","/api/members");
      var c=$("#count-members"); if(c) c.textContent=allMembers.length;
      var callerLvl=CURRENT_USER.role_level;
      host.innerHTML=allMembers.map(u=>{
        var isSelf=u.id===CURRENT_USER.id;
        var canModify=!isSelf&&(callerLvl>=5||(callerLvl===4&&u.role_level<4)||(callerLvl===3&&u.role_level===0));
        var canDeactivate=!isSelf&&u.is_active&&(callerLvl>=5||(callerLvl>=4&&u.role_level<callerLvl));
        var statusCls=u.is_active?"approved":"rejected";
        var statusTxt=u.is_active?"Active":"Inactive";
        return `<article class="a-row">
          <span class="ini">${initials(u.full_name||u.email)}</span>
          <div>
            <h4>${esc(u.full_name||u.email)}${isSelf?` <span class="badge-status approved" style="font-size:10px">YOU</span>`:""}</h4>
            <p class="meta"><b>${esc(u.email||"")}</b> · <b>${esc((u.role||"member").toUpperCase())} (Lvl ${u.role_level||0})</b>
              · <span class="badge-status ${statusCls}">${statusTxt}</span>
              · Joins: ${esc(u.joining_year||"—")} · Grad: ${esc(u.expected_graduation_year||"—")}
            </p>
          </div>
          <div class="a-acts">
            ${canModify?`<select class="role-select" data-user-role="${u.id}" style="padding:4px 8px;border-radius:4px;border:1px solid var(--ink-3);background:var(--bg);color:var(--ink-1)">
              ${Object.keys({hod:6,faculty:5,president:4,secretary:3,event_manager:2,tech_lead:1,member:0,alumni:0})
                .filter(r=>{ var rl={hod:6,faculty:5,president:4,secretary:3,event_manager:2,tech_lead:1,member:0,alumni:0}[r];
                  return callerLvl>=5||(callerLvl===4&&rl<4)||(callerLvl===3&&rl===0); })
                .map(r=>`<option value="${r}"${u.role===r?" selected":""}>${r.toUpperCase()}</option>`).join("")}
            </select>`:""}
            ${canDeactivate?`<button class="a-ico del" data-deactivate="${u.id}" aria-label="Deactivate" title="Deactivate account">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
            </button>`:""}
          </div>
        </article>`;
      }).join("");

      // Role change
      $$(".role-select",host).forEach(sel=>{
        sel.addEventListener("change",async()=>{
          try{
            await api("POST","/api/update-role",{target_user_id:sel.dataset.userRole,new_role:sel.value});
            toast("Role updated to "+sel.value.toUpperCase());
            loadMembers();
          }catch(err){ toast("Error: "+err.message); loadMembers(); }
        });
      });
      // Deactivate
      $$("[data-deactivate]",host).forEach(btn=>{
        btn.addEventListener("click",async()=>{
          if(!confirm("Deactivate this member's account?")) return;
          try{
            await api("POST","/api/members/deactivate",{user_id:btn.dataset.deactivate});
            toast("Account deactivated."); loadMembers();
          }catch(err){ toast("Error: "+err.message); }
        });
      });
    }catch(err){ console.warn("Members load error:",err); }
  }

  var btnRefMem=$("#btn-refresh-members"); if(btnRefMem) btnRefMem.addEventListener("click",loadMembers);

  /* Invite panel */
  var invPanel=$("#invite-panel"),invBtn=$("#btn-invite-member"),invCancel=$("#btn-invite-cancel");
  if(invBtn)    invBtn.addEventListener("click",()=>{ if(invPanel){invPanel.style.display="block";invBtn.hidden=true;} });
  if(invCancel) invCancel.addEventListener("click",()=>{ if(invPanel){invPanel.style.display="none";if(invBtn)invBtn.hidden=false;} });

  var btnInvSubmit=$("#btn-invite-submit");
  if(btnInvSubmit){
    btnInvSubmit.addEventListener("click",async()=>{
      var errEl=$("#invite-error"),sucEl=$("#invite-success"),manEl=$("#manual-creds"),manText=$("#manual-creds-text");
      errEl.hidden=true; sucEl.hidden=true; if(manEl)manEl.style.display="none";
      var name=$("#inv-name").value.trim(), email=$("#inv-email").value.trim(),
          role=$("#inv-role").value, year=parseInt($("#inv-year").value)||new Date().getFullYear();
      if(!name||!email){ errEl.textContent="Name and email are required."; errEl.hidden=false; return; }
      btnInvSubmit.disabled=true; btnInvSubmit.textContent="Creating account…";
      try{
        var res=await api("POST","/api/members/invite",{
          full_name:name,email:email,role:role,joining_year:year,send_email_credentials:true
        });
        sucEl.textContent=`Account created for ${name} (${email}). Role: ${res.role.toUpperCase()}.`+
          (res.email_sent?" Welcome email sent.":" Email not configured — see credentials below.");
        sucEl.hidden=false;
        if(!res.email_sent&&res.manual_credentials&&manEl){
          manEl.style.display="block";
          if(manText) manText.textContent=res.manual_credentials;
        }
        toast("Member invited!");
        loadMembers();
        // Reset form
        ["inv-name","inv-email","inv-year"].forEach(id=>{ var el=$(("#"+id)); if(el)el.value=""; });
      }catch(err){ errEl.textContent=err.message; errEl.hidden=false; }
      finally{ btnInvSubmit.disabled=false; btnInvSubmit.textContent="Create account & send credentials"; }
    });
  }

  var copyCredsBtn=$("#btn-copy-creds");
  if(copyCredsBtn){
    copyCredsBtn.addEventListener("click",()=>{
      var t=$("#manual-creds-text"); if(!t) return;
      navigator.clipboard.writeText(t.textContent).then(()=>toast("Copied to clipboard!")).catch(()=>toast("Select and copy manually."));
    });
  }

  /* Bulk upload panel */
  var bulkPanel=$("#bulk-panel"),bulkBtn=$("#btn-bulk-invite"),bulkCancel=$("#btn-bulk-cancel");
  if(bulkBtn)    bulkBtn.addEventListener("click",()=>{ if(bulkPanel)bulkPanel.style.display="block"; });
  if(bulkCancel) bulkCancel.addEventListener("click",()=>{ if(bulkPanel)bulkPanel.style.display="none"; });

  var btnBulkUpload=$("#btn-bulk-upload");
  if(btnBulkUpload){
    btnBulkUpload.addEventListener("click",async()=>{
      var fileEl=$("#bulk-file"),errEl=$("#bulk-error"),resultsEl=$("#bulk-results");
      errEl.hidden=true; if(resultsEl)resultsEl.style.display="none";
      if(!fileEl||!fileEl.files[0]){ errEl.textContent="Please select a CSV or Excel file."; errEl.hidden=false; return; }
      btnBulkUpload.disabled=true; btnBulkUpload.textContent="Processing…";
      try{
        var fd=new FormData(); fd.append("file",fileEl.files[0]);
        var res=await fetch(BASE+"/api/members/bulk-invite",{method:"POST",headers:{"Authorization":"Bearer "+getToken()},body:fd});
        var data=await res.json();
        if(data.status==="validation_failed"){
          var errHtml=`<b>Validation errors — no accounts created:</b><ul style="margin:8px 0 0;padding-left:20px">`+
            data.errors.map(e=>`<li>Row ${e.row}: ${esc(e.error)}</li>`).join("")+"</ul>";
          errEl.innerHTML=errHtml; errEl.hidden=false;
        } else {
          if(resultsEl){
            var successes=data.results.filter(r=>r.status==="created");
            var failures=data.results.filter(r=>r.status==="failed");
            resultsEl.innerHTML=`<div class="a-alert" style="background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3);color:#22c55e;margin-bottom:8px">
              Created ${data.created} account(s)${failures.length?" · "+failures.length+" failed":""}.</div>`+
              (failures.length?`<ul style="font-size:12px;color:#ef4444;padding-left:16px">`+failures.map(f=>`<li>Row ${f.row} (${esc(f.email)}): ${esc(f.error)}</li>`).join("")+"</ul>":"")+
              (data.results.some(r=>r.temp_password)?`<p style="font-size:12px;color:var(--ink-3);margin-top:8px">Some credentials could not be emailed — download the list below:</p>
              <pre style="background:rgba(255,255,255,.05);border-radius:6px;padding:10px;font-size:11px;max-height:160px;overflow:auto">`+
              data.results.filter(r=>r.temp_password).map(r=>`${r.email}: ${r.temp_password}`).join("\n")+"</pre>":"");
            resultsEl.style.display="block";
          }
          toast("Bulk invite complete: "+data.created+" created.");
          loadMembers();
        }
      }catch(err){ errEl.textContent="Error: "+err.message; errEl.hidden=false; }
      finally{ btnBulkUpload.disabled=false; btnBulkUpload.textContent="Upload & create accounts"; if(fileEl)fileEl.value=""; }
    });
  }

  /* ══════════════════════════════════════════════════════════
     SUBMISSIONS
     ══════════════════════════════════════════════════════════ */
  async function loadSubmissions(){
    var host=$("#list-submissions"); if(!host) return;
    try{
      contactSubmissions=await api("GET","/api/contact-submissions");
      var c=$("#count-submissions"); if(c) c.textContent=contactSubmissions.length;
      if(!contactSubmissions.length){
        host.innerHTML=`<div class="a-empty"><b>No enquiries yet</b><span>Public contact form submissions appear here.</span></div>`;
        return;
      }
      host.innerHTML=contactSubmissions.map(s=>`
        <article class="a-row">
          <span class="ini">${initials(s.name||s.email)}</span>
          <div>
            <h4>${esc(s.name||"Visitor")}<span class="badge-status ${s.status==="pending"?"pending":"approved"}" style="margin-left:8px;font-size:10px">${esc(s.status||"new")}</span></h4>
            <p class="meta"><b>${esc(s.email)}</b>${s.subject?" · "+esc(s.subject):""} · ${fmtDate(s.created_at)}</p>
            ${s.message?`<p style="margin:6px 0 0;font-size:13px;color:var(--ink-3);max-width:520px">${esc(s.message.slice(0,180))}${s.message.length>180?"…":""}</p>`:""}
          </div>
        </article>`).join("");
    }catch(err){ console.warn("Submissions load error:",err); }
  }

  var btnRefSub=$("#btn-refresh-submissions"); if(btnRefSub) btnRefSub.addEventListener("click",loadSubmissions);

  /* ══════════════════════════════════════════════════════════
     DISCUSSIONS
     ══════════════════════════════════════════════════════════ */
  var currentThreadId=null;

  async function loadThreads(){
    var host=$("#list-threads"); if(!host) return;
    try{
      threads=await api("GET","/api/discussions");
      if(!threads.length){
        host.innerHTML=`<div class="a-empty"><b>No threads yet</b><span>Start the first discussion.</span></div>`;
        return;
      }
      host.innerHTML=threads.map(t=>`
        <article class="a-row" style="cursor:pointer" data-thread="${t.id}">
          <span class="ini">${initials(t.title)}</span>
          <div>
            <h4>${esc(t.title)}</h4>
            <p class="meta"><b>${esc(t.category||"general")}</b> · ${t.reply_count||0} ${t.reply_count===1?"reply":"replies"}
              ${t.last_reply_at?" · last reply "+fmtDate(t.last_reply_at):" · "+fmtDate(t.created_at)}
              ${t.profiles?` · by <em>${esc(t.profiles.full_name||"Member")}</em>`:""}
            </p>
          </div>
        </article>`).join("");
      $$("[data-thread]",host).forEach(el=>{
        el.addEventListener("click",()=>openThread(el.dataset.thread, threads.find(t=>t.id===el.dataset.thread)));
      });
    }catch(err){ console.warn("Threads load error:",err); }
  }

  async function openThread(id,thread){
    currentThreadId=id;
    var title=thread?thread.title:"Discussion";
    var repl=$("#replies-panel"),rTitle=$("#replies-title"),rList=$("#list-replies");
    if(!repl) return;
    if(rTitle) rTitle.textContent=title;
    repl.style.display="block";
    try{
      var replies=await api("GET",`/api/discussions/${id}/replies`);
      if(rList){
        rList.innerHTML=replies.length?replies.map(r=>`
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px 14px">
            <p style="margin:0 0 4px;font-size:12px;color:var(--ink-4)">
              <b style="color:var(--ink-2)">${esc(r.profiles?r.profiles.full_name:"Member")}</b> · ${fmtDate(r.created_at)}</p>
            <p style="margin:0;font-size:14px;color:var(--ink-1)">${esc(r.body)}</p>
          </div>`).join(""):
          `<p style="font-size:13px;color:var(--ink-4)">No replies yet. Be the first!</p>`;
      }
      loadUnread();
    }catch(err){ if(rList) rList.innerHTML=`<p style="color:#ef4444">Could not load replies: ${esc(err.message)}</p>`; }
  }

  var btnCloseReplies=$("#btn-close-replies");
  if(btnCloseReplies) btnCloseReplies.addEventListener("click",()=>{ var p=$("#replies-panel"); if(p)p.style.display="none"; currentThreadId=null; });

  var btnPostReply=$("#btn-post-reply");
  if(btnPostReply){
    btnPostReply.addEventListener("click",async()=>{
      if(!currentThreadId) return;
      var bodyEl=$("#reply-body");
      var body=(bodyEl?bodyEl.value.trim():"");
      if(!body) return;
      btnPostReply.disabled=true;
      try{
        await api("POST",`/api/discussions/${currentThreadId}/replies`,{body:body});
        if(bodyEl) bodyEl.value="";
        toast("Reply posted.");
        openThread(currentThreadId, threads.find(t=>t.id===currentThreadId));
        loadThreads();
      }catch(err){ toast("Error: "+err.message); }
      finally{ btnPostReply.disabled=false; }
    });
  }

  /* New thread form */
  var btnNewThread=$("#btn-new-thread"),threadFormPanel=$("#thread-form-panel");
  if(btnNewThread) btnNewThread.addEventListener("click",()=>{ if(threadFormPanel)threadFormPanel.style.display="block"; });
  var btnThreadCancel=$("#btn-thread-cancel");
  if(btnThreadCancel) btnThreadCancel.addEventListener("click",()=>{ if(threadFormPanel)threadFormPanel.style.display="none"; });
  var btnThreadSubmit=$("#btn-thread-submit");
  if(btnThreadSubmit){
    btnThreadSubmit.addEventListener("click",async()=>{
      var title=$("#thread-title").value.trim(),body=$("#thread-body").value.trim(),cat=$("#thread-cat").value;
      if(!title||!body){ toast("Title and body required."); return; }
      btnThreadSubmit.disabled=true;
      try{
        await api("POST","/api/discussions",{title,body,category:cat});
        $("#thread-title").value=""; $("#thread-body").value="";
        if(threadFormPanel) threadFormPanel.style.display="none";
        toast("Thread posted."); loadThreads();
      }catch(err){ toast("Error: "+err.message); }
      finally{ btnThreadSubmit.disabled=false; }
    });
  }

  async function loadUnread(){
    try{
      var data=await api("GET","/api/unread");
      var c=$("#count-unread"); if(c) c.textContent=data.count>0?data.count:"";
    }catch(_){}
  }

  /* ══════════════════════════════════════════════════════════
     NOTIFICATION PREFERENCES
     ══════════════════════════════════════════════════════════ */
  async function loadNotifPrefs(){
    try{
      var p=await api("GET","/api/notifications/prefs");
      var r=$("#pref-reply"),t=$("#pref-thread"),a=$("#pref-announcements");
      if(r) r.checked=p.email_on_reply!==false;
      if(t) t.checked=p.email_on_new_thread===true;
      if(a) a.checked=p.email_on_announcements!==false;
    }catch(_){}
  }

  var btnSavePrefs=$("#btn-save-prefs");
  if(btnSavePrefs){
    btnSavePrefs.addEventListener("click",async()=>{
      var statusEl=$("#notif-status");
      try{
        await api("POST","/api/notifications/prefs",{
          email_on_reply:        $("#pref-reply")?.checked,
          email_on_new_thread:   $("#pref-thread")?.checked,
          email_on_announcements:$("#pref-announcements")?.checked,
        });
        if(statusEl){ statusEl.textContent="Preferences saved."; statusEl.hidden=false; setTimeout(()=>statusEl.hidden=true,2000); }
        toast("Notification preferences saved.");
      }catch(err){ toast("Error: "+err.message); }
    });
  }

  /* ══════════════════════════════════════════════════════════
     SETTINGS — password change
     ══════════════════════════════════════════════════════════ */
  $$(".peek-btn-s").forEach(btn=>{
    var input=btn.closest(".f-pw")?.querySelector("input");
    if(!input) return;
    btn.addEventListener("click",()=>{
      var show=input.type==="password"; input.type=show?"text":"password";
      btn.textContent=show?"Hide":"Show";
    });
  });

  var btnSetSave=$("#set-save");
  if(btnSetSave){
    btnSetSave.addEventListener("click",async()=>{
      var newPw=$("#set-new")?.value||"",conf=$("#set-new2")?.value||"";
      var errEl=$("#set-err"),sucEl=$("#set-success");
      if(errEl) errEl.hidden=true; if(sucEl) sucEl.hidden=true;
      var errors=validatePw(newPw);
      if(errors.length){ if(errEl){errEl.textContent="Password needs: "+errors.join(", ")+".";errEl.hidden=false;} return; }
      if(newPw!==conf){ if(errEl){errEl.textContent="Passwords do not match.";errEl.hidden=false;} return; }
      btnSetSave.disabled=true;
      try{
        await api("POST","/api/change-password",{new_password:newPw});
        if(sucEl){sucEl.textContent="Password updated.";sucEl.hidden=false;}
        if($("#set-new")) $("#set-new").value="";
        if($("#set-new2")) $("#set-new2").value="";
        toast("Password updated.");
      }catch(err){ if(errEl){errEl.textContent=err.message;errEl.hidden=false;} }
      finally{ btnSetSave.disabled=false; }
    });
  }

  /* ══════════════════════════════════════════════════════════
     THEME & LOGOUT
     ══════════════════════════════════════════════════════════ */
  function setTheme(t){
    document.documentElement.dataset.theme=t;
    $$(".themes button").forEach(b=>{ var on=b.dataset.theme===t; b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); });
    try{ localStorage.setItem("ab-theme",t); }catch(_){}
  }
  $$(".themes button").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.theme)));
  try{ var st=localStorage.getItem("ab-theme"); if(st) setTheme(st); }catch(_){}

  var logoutBtn=$("#logout");
  if(logoutBtn){
    logoutBtn.addEventListener("click",()=>{
      try{ sessionStorage.removeItem("ab-session"); localStorage.removeItem("ab-session"); }catch(_){}
      if(window.AB) AB.signOut();
      location.href="login.html";
    });
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */
  renderAll();
  fetchProfile();
})();
