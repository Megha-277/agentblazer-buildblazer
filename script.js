/* ============================================================
   DATA
   ============================================================ */
const GUESTS=[
  {n:"Mr. Santosh Rebello",o:"Salesforce",l:"Guest of Honor",r:"Keynote Speaker",c:"t3"},
  {n:"Mr. Stephen Pinto",o:"Salesforce &amp; SJEC Alumnus",l:"Technical Mentor",r:"Alumni Guide",c:"t1"},
  {n:"Dr. Rio D’Souza",o:"Principal, SJEC",l:"Presidential Address",r:"Patron",c:"t2"},
  {n:"Dr. Melwyn D’Souza",o:"HOD, Computer Science &amp; Engg",l:"Program Chair",r:"Department Head",c:"t4"}
];
const FACULTY=[
  {n:"Ms. Nisha Roche",o:"Assistant Professor, CSE · Faculty Coordinator",tag:"Faculty",ph:"NR"},
  {n:"Mr. Keith Fernandes",o:"Assistant Professor, CSE · Faculty Coordinator",tag:"Faculty",ph:"KF"}
];
const OFFICERS=[
  {n:"Ruben Saldanha",k:"Executive President",c:"t2",role:"President",d:"Guiding club vision, university collaborations, and strategic workshop series."},
  {n:"Ajay Preenal Dsouza",k:"Executive Vice President",c:"t2",role:"Vice President",d:"Coordinating student mentorship, event operations, and community growth."},
  {n:"Stevin Dsouza",k:"Technical Direction",c:"t1",role:"Tech Lead",d:"Technical architectures, hands-on lab environments, and repository supervision."},
  {n:"Frenny Chrystal Saldanha",k:"Operations &amp; Logistics",c:"t3",role:"Resource Head",d:"Managing cloud compute budgets, venue infrastructure, and participant toolkits."},
  {n:"Joyline Galbao",k:"Administration",c:"t2",role:"Secretary",d:"Documentation, accreditation reporting, meeting minutes, and member onboarding."},
  {n:"Chinthan N V",k:"Creative Outreach",c:"t4",role:"Media Head",d:"Brand storytelling, photo documentation, visual design, and social publications."}
];
const COMMITTEE=[
  {n:"Prajwal Royston Cordiero",o:"AI &amp; LLM Research Group"},
  {n:"Chacko P Abraham",o:"Model Evaluation Benchmarks"},
  {n:"Alma Roxane Pereira",o:"Project Operations &amp; Labs"}
];
const EVENTS=[
  {d:"February 14, 2026",k:"Flagship Masterclass",c:"t1",
   t:"Master the Future: A Hands-on GSoC &amp; LLMs Workshop",
   p:"Practical masterclass on open-source Git PR workflows, Retrieval-Augmented Generation (RAG), Gemini AI, LangChain, LlamaIndex, CrewAI, and live Gradio prototyping.",
   f:"80 Shortlisted Students",
   g:{label:"Guest speaker: Anas Khan",n:8,cap:"Master the Future: GSoC &amp; LLMs",sub:"Anas Khan · Google DeepMind GSoC Alumni",date:"Feb 14, 2026"}},
  {d:"March 25, 2026",k:"Live Contest",c:"t2",
   t:"PROMPT OPS-2K26 Challenge",
   tracks:["Track 1: 1st Year Engineers","Track 2: 2nd Year Engineers"],
   p:"Fast-paced prompt engineering hackathon featuring automated test suites, iterative refinement, teamwork, and live algorithmic problem solving.",
   f:"10 Contest Photos",
   g:{label:"Contest gallery",n:10,cap:"PROMPT OPS-2K26 Challenge",sub:"CSE Department · AgentBlazer Club",date:"Mar 25, 2026"}},
  {d:"August 25, 2025",k:"Symposium Keynote",c:"t2",
   t:"Agentforce Technical Deep-Dive",
   p:"Guiding undergraduate engineers from prompt prediction to autonomous agentic architectures, Salesforce Data Cloud integration, and real-time enterprise workflows.",
   note:"Inaugural Technical Session",f:"CSE Auditorium",
   g:{label:"Guest speaker: Mr. Suhas Nayak",n:3,cap:"Agentforce Technical Deep-Dive",sub:"Inaugural symposium · CSE Auditorium",date:"Aug 25, 2025"}},
  {d:"March 18, 2026",k:"Student Lab",c:"t2",
   t:"Demystifying Generative Models",
   note:"Session Leads: Prajwal Royston Cordiero &amp; Chacko P Abraham",
   p:"Exploring Transformer mechanics, multi-agent consensus networks, and comparative latency benchmarks of LLaMA, Groq, and Mistral architectures.",
   hint:"Hands-on Code Walkthrough",f:"Systems Lab",
   g:{label:"Student lab gallery",n:5,cap:"Demystifying Generative Models",sub:"VI Sem CSE Cohort · Systems Lab",date:"Mar 18, 2026"}},
  {d:"April 01, 2026",k:"Security Workshop",c:"t1",
   t:"Cyber Security &amp; Career Pathways",
   p:"Interactive demonstrations covering Shodan discovery, OSINT methods, CVE vulnerability analysis, SQL injection scenarios, and the Cyber Kill Chain.",
   f:"IV Sem CSE Cohort",
   g:{label:"Session gallery",n:6,cap:"Cyber Security &amp; Career Pathways",sub:"Mr. Srinav Nayak · Sen Dev Lead, AgentForce",date:"Apr 01, 2026"}},
  {d:"May 22, 2026",k:"Developer Lab",c:"t3",
   t:"Hands-on Agentforce &amp; AI Agents",
   note:"Platform: Salesforce Developer Sandbox",
   p:"Applied development lab creating Flex Prompts, dynamic contextual Sales Email templates, and autonomous event triggers within modern CRM pipelines.",
   hint:"Guided Practical Exercises",f:"Cloud Computing Lab",
   g:{label:"Developer lab gallery",n:4,cap:"Hands-on Agentforce &amp; AI Agents",sub:"Salesforce Developer Sandbox",date:"May 22, 2026"}}
];

/* --------- placeholder portrait generator (swap for real photos) --------- */
const PALETTES=[["#123a2e","#2f6f52"],["#1b2b4d","#3d5d8a"],["#3a1f4d","#6b4a8f"],["#4d3a1f","#8a6b3d"],["#1f3f4d","#3d7a8a"],["#4d1f2e","#8a3d55"]];
function portrait(name,i){
  const [a,b]=PALETTES[i%PALETTES.length];
  const ini=name.replace(/&[a-z]+;/g,"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("");
  const s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="400" height="500" fill="url(#g)"/>
  <g fill="rgba(255,255,255,.1)"><circle cx="200" cy="205" r="76"/><path d="M60 500c0-83 63-140 140-140s140 57 140 140Z"/></g>
  <text x="200" y="470" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="rgba(255,255,255,.34)" letter-spacing="6">${ini}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
}
function galleryShot(i,seed){
  const hues=[188,265,32,150,320,210];const h=hues[(i+seed)%hues.length];
  const s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},42%,22%)"/><stop offset="1" stop-color="hsl(${(h+40)%360},48%,34%)"/></linearGradient></defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <g fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2">
    <rect x="42" y="66" width="140" height="96" rx="6"/><rect x="220" y="96" width="140" height="130" rx="6"/>
    <path d="M0 232h400M62 232v-40h100v40"/></g>
  <circle cx="300" cy="66" r="24" fill="rgba(255,255,255,.14)"/>
  <text x="200" y="285" text-anchor="middle" font-family="sans-serif" font-size="15" fill="rgba(255,255,255,.4)">Event photo ${i+1}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
}
function initials(n){return n.replace(/&[a-z]+;/g,"").replace(/[^A-Za-z ]/g,"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")}

/* ============================================================
   RENDER
   ============================================================ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

$("#guests").innerHTML=GUESTS.map(g=>`
  <article class="person glass tilt">
    <div class="person-top">
      <span class="ini">${initials(g.n)}</span>
      <div><h3>${g.n}</h3><p class="role">${g.o}</p></div>
    </div>
    <div class="person-foot"><span>${g.l}</span><b class="${g.c==="t1"?"":""}" style="color:var(--${g.c==="t1"?"a1":g.c==="t2"?"a2":g.c==="t3"?"a3":"a4"})">${g.r}</b></div>
  </article>`).join("");

$("#faculty").innerHTML=FACULTY.map((f,i)=>`
  <article class="fac glass" data-pop="portrait" data-name="${f.n}" data-role="${f.o}" data-tag="Faculty" data-img="${portrait(f.n,i+4)}">
    <span class="ini">${initials(f.n)}</span>
    <div><h4>${f.n}</h4><p>${f.o}</p></div>
    <span class="mini">Portrait view</span>
  </article>`).join("");

$("#officers").innerHTML=OFFICERS.map((o,i)=>`
  <article class="off glass" data-pop="portrait" data-name="${o.n}" data-role="${o.role} · AgentBlazer Club" data-tag="Leadership" data-img="${portrait(o.n,i)}">
    <span class="fill"></span>
    <span class="tag ${o.c}">${o.k}</span>
    <h3>${o.n}</h3>
    <span class="badge ${o.c==="t1"?"":""}" style="color:var(--${o.c==="t1"?"a1":o.c==="t2"?"a1":o.c==="t3"?"a3":"a1"})">${o.role}</span>
    <p>${o.d}</p>
  </article>`).join("");

$("#committee").innerHTML=COMMITTEE.map(c=>`
  <div class="cm glass"><span class="ini">${initials(c.n)}</span><div><h4>${c.n}</h4><p>${c.o}</p></div></div>`).join("");

$("#events").innerHTML=EVENTS.map((e,i)=>`
  <article class="ev glass" data-pop="gallery" data-i="${i}">
    <span class="fill"></span>
    <div class="ev-top"><span class="ev-date">${e.d}</span><span class="kind" style="color:var(--${e.c==="t1"?"a1":e.c==="t2"?"a2":e.c==="t3"?"a3":"a4"})">${e.k}</span></div>
    <h3>${e.t}</h3>
    ${e.tracks?`<div class="tracks">${e.tracks.map(t=>`<span>${t}</span>`).join("")}</div>`:""}
    ${e.note?`<p class="note">${e.note}</p>`:""}
    <p>${e.p}</p>
    <div class="ev-foot"><span class="hint"><i></i>${e.hint||"Hover to inspect gallery"}</span><b>${e.f}</b></div>
  </article>`).join("");

/* ============================================================
   TABS
   ============================================================ */
const views={home:$("#v-home"),about:$("#v-about"),events:$("#v-events"),join:$("#v-join")};
function go(id){
  if(!views[id])return;
  Object.entries(views).forEach(([k,v])=>v.classList.toggle("on",k===id));
  $$(".nav button").forEach(b=>b.classList.toggle("on",b.dataset.go===id));
  $$(".nav button").forEach(b=>{if(b.dataset.go===id&&!b.querySelector(".pip"))b.insertAdjacentHTML("afterbegin",'<i class="pip"></i>')});
  window.scrollTo({top:0,behavior:"smooth"});
  hidePop();
  $("#nav").classList.remove("open");
}
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-go]");
  if(t){e.preventDefault();go(t.dataset.go);}
});
$("#burger").addEventListener("click",()=>{
  const n=$("#nav");const o=n.classList.toggle("open");
  $("#burger").setAttribute("aria-expanded",o);
});

/* ============================================================
   THEMES
   ============================================================ */
function setTheme(t){
  document.documentElement.dataset.theme=t;
  $$(".themes button").forEach(b=>{
    const on=b.dataset.theme===t;
    b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);
  });
  try{localStorage.setItem("ab-theme",t)}catch(_){}
}
$$(".themes button").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.theme)));
try{const s=localStorage.getItem("ab-theme");if(s)setTheme(s)}catch(_){}

/* ============================================================
   HOVER POPUPS (portrait + gallery)
   ============================================================ */
const pop=$("#pop");let popTimer=null,galTimer=null;
function hidePop(){pop.classList.remove("on");clearInterval(galTimer)}
function placePop(el){
  const r=el.getBoundingClientRect(),pw=pop.offsetWidth||300,ph=pop.offsetHeight||380;
  let x=r.right+18, y=r.top;
  if(x+pw>innerWidth-14) x=r.left-pw-18;
  if(x<14) x=Math.min(r.left+16,innerWidth-pw-14);
  if(y+ph>innerHeight-14) y=Math.max(14,innerHeight-ph-14);
  pop.style.left=x+"px";pop.style.top=y+"px";
}
function portraitPop(el){
  pop.className="pop";
  pop.innerHTML=`<div class="pop-media"><img alt="${el.dataset.name}" src="${el.dataset.img}">
    <span class="pop-tag">${el.dataset.tag}</span><span class="pop-org">SJEC CSE</span></div>
    <div class="pop-body"><h4>${el.dataset.name}</h4><p>${el.dataset.role}</p></div>`;
  placePop(el);requestAnimationFrame(()=>{placePop(el);pop.classList.add("on")});
}
function galleryPop(el){
  const e=EVENTS[+el.dataset.i],n=e.g.n;let idx=0;
  pop.className="pop wide";
  pop.innerHTML=`<div class="pop-head"><b><i></i>${e.g.label}</b><span id="pc">1 / ${n}</span></div>
    <div class="pop-media"><img id="pi" alt="${e.g.cap}" src="${galleryShot(0,+el.dataset.i)}"></div>
    <div class="pop-cap"><b>${e.g.cap}<i>${e.g.date}</i></b><span>${e.g.sub}</span></div>`;
  placePop(el);requestAnimationFrame(()=>{placePop(el);pop.classList.add("on")});
  clearInterval(galTimer);
  galTimer=setInterval(()=>{
    idx=(idx+1)%n;
    const img=$("#pi"),c=$("#pc");if(!img)return clearInterval(galTimer);
    img.style.opacity=.2;
    setTimeout(()=>{img.src=galleryShot(idx,+el.dataset.i);img.style.transition="opacity .3s";img.style.opacity=1;},130);
    c.textContent=(idx+1)+" / "+n;
  },1500);
}
document.addEventListener("mouseover",e=>{
  const el=e.target.closest("[data-pop]");
  if(!el)return;
  clearTimeout(popTimer);
  popTimer=setTimeout(()=>{el.dataset.pop==="gallery"?galleryPop(el):portraitPop(el)},110);
});
document.addEventListener("mouseout",e=>{
  const el=e.target.closest("[data-pop]");
  if(el&&!el.contains(e.relatedTarget)){clearTimeout(popTimer);hidePop();}
});
window.addEventListener("scroll",hidePop,{passive:true});

/* ============================================================
   3D TILT
   ============================================================ */
function tiltInit(){
  if(!window.VanillaTilt||matchMedia("(pointer:coarse)").matches)return;
  VanillaTilt.init($$(".tilt"),{max:5,speed:900,glare:true,"max-glare":.14,scale:1.008,gyroscope:false});
}
window.addEventListener("load",tiltInit);

/* lightweight 3D tilt for the interactive cards (composes with the hover lift) */
(function(){
  if(matchMedia("(pointer:coarse)").matches)return;
  const sel=".off, .ev";
  document.addEventListener("pointermove",e=>{
    const c=e.target.closest(sel);if(!c)return;
    const r=c.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
    c.style.transform=`perspective(900px) translateY(-7px) rotateX(${(-py*7).toFixed(2)}deg) rotateY(${(px*8).toFixed(2)}deg)`;
  },{passive:true});
  document.addEventListener("pointerout",e=>{
    const c=e.target.closest(sel);
    if(c&&!c.contains(e.relatedTarget))c.style.transform="";
  });
})();

/* ============================================================
   MAGNETIC BUTTONS + CURSOR
   ============================================================ */
const dot=$(".cur-dot"),ring=$(".cur-ring");
let mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my;
addEventListener("pointermove",e=>{
  mx=e.clientX;my=e.clientY;
  dot.style.transform=`translate(${mx}px,${my}px)`;
  spawn(mx,my);
},{passive:true});
(function ringLoop(){rx+=(mx-rx)*.16;ry+=(my-ry)*.16;ring.style.transform=`translate(${rx}px,${ry}px)`;requestAnimationFrame(ringLoop)})();

document.addEventListener("pointerover",e=>{
  document.body.classList.toggle("mag",!!e.target.closest("button,a,.off,.ev,.fac,.chip"));
});
$$(".mag").forEach(b=>{
  b.addEventListener("pointermove",e=>{
    const r=b.getBoundingClientRect();
    b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.16}px,${(e.clientY-r.top-r.height/2)*.28}px)`;
  });
  b.addEventListener("pointerleave",()=>{b.style.transform=""});
});

/* ---------- cursor particle trail ---------- */
const tc=$("#trail"),tx=tc.getContext("2d");let parts=[];
function sizeTrail(){tc.width=innerWidth*devicePixelRatio;tc.height=innerHeight*devicePixelRatio;tc.style.width=innerWidth+"px";tc.style.height=innerHeight+"px";tx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
sizeTrail();addEventListener("resize",sizeTrail);
function spawn(x,y){
  if(matchMedia("(pointer:coarse)").matches)return;
  for(let i=0;i<2;i++)parts.push({x,y,vx:(Math.random()-.5)*1.5,vy:(Math.random()-.5)*1.5-.35,r:Math.random()*2.6+.8,life:1,
    c:Math.random()>.5?getComputedStyle(document.documentElement).getPropertyValue("--trail-a"):getComputedStyle(document.documentElement).getPropertyValue("--trail-b")});
  if(parts.length>170)parts.splice(0,parts.length-170);
}
(function trailLoop(){
  tx.clearRect(0,0,innerWidth,innerHeight);
  tx.globalCompositeOperation="lighter";
  parts=parts.filter(p=>p.life>0);
  parts.forEach(p=>{
    p.x+=p.vx;p.y+=p.vy;p.vy-=.012;p.life-=.024;
    tx.globalAlpha=Math.max(p.life,0)*.85;
    tx.fillStyle=p.c.trim()||"#a855f7";
    tx.beginPath();tx.arc(p.x,p.y,p.r*p.life,0,7);tx.fill();
  });
  tx.globalAlpha=1;tx.globalCompositeOperation="source-over";
  requestAnimationFrame(trailLoop);
})();

/* ============================================================
   STARFIELD + CONSTELLATION
   ============================================================ */
const sc=$("#stars"),sx=sc.getContext("2d");let stars=[],W,H;
function sizeStars(){
  W=innerWidth;H=innerHeight;
  sc.width=W*devicePixelRatio;sc.height=H*devicePixelRatio;
  sc.style.width=W+"px";sc.style.height=H+"px";
  sx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  const n=Math.min(130,Math.round(W*H/13000));
  stars=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,
    vx:(Math.random()-.5)*.14,vy:(Math.random()-.5)*.14,r:Math.random()*1.5+.4,tw:Math.random()*6.28}));
}
sizeStars();addEventListener("resize",sizeStars);
(function starLoop(){
  const cs=getComputedStyle(document.documentElement);
  const col=cs.getPropertyValue("--star").trim()||"rgba(160,190,255,.85)";
  const lin=cs.getPropertyValue("--line").trim()||"rgba(120,160,220,.16)";
  sx.clearRect(0,0,W,H);
  for(let i=0;i<stars.length;i++){
    const s=stars[i];
    s.x+=s.vx;s.y+=s.vy;s.tw+=.02;
    if(s.x<-12)s.x=W+12;if(s.x>W+12)s.x=-12;
    if(s.y<-12)s.y=H+12;if(s.y>H+12)s.y=-12;
    const d=Math.hypot(s.x-mx,s.y-my);
    if(d<150){s.x-=(mx-s.x)*.0016;s.y-=(my-s.y)*.0016;}
    sx.globalAlpha=.4+Math.sin(s.tw)*.3;
    sx.fillStyle=col;
    sx.beginPath();sx.arc(s.x,s.y,s.r,0,7);sx.fill();
    for(let j=i+1;j<stars.length;j++){
      const o=stars[j],dx=s.x-o.x,dy=s.y-o.y,dd=dx*dx+dy*dy;
      if(dd<19000){
        sx.globalAlpha=(1-dd/19000)*.5;
        sx.strokeStyle=lin;sx.lineWidth=.7;
        sx.beginPath();sx.moveTo(s.x,s.y);sx.lineTo(o.x,o.y);sx.stroke();
      }
    }
  }
  sx.globalAlpha=1;
  requestAnimationFrame(starLoop);
})();

/* ============================================================
   HERO EMBLEM (generated hexagon crest)
   ============================================================ */
$("#emblem").innerHTML=`
<svg viewBox="0 0 300 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AgentBlazer Club crest">
  <defs>
    <linearGradient id="hx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0a6ff"/><stop offset=".5" stop-color="#c084fc"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
    <linearGradient id="cir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#f0b429"/><stop offset="1" stop-color="#ec4899"/></linearGradient>
    <clipPath id="hc"><path d="M150 14 271 84v140l-121 70-121-70V84Z"/></clipPath>
    <filter id="gl"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g clip-path="url(#hc)">
    <rect width="300" height="330" fill="#0a0413"/>
    <g stroke="url(#cir)" stroke-width="1.1" opacity=".55" fill="none">
      <path d="M20 60h58v34h44M20 120h40v52h40M282 70h-56v40h-46M282 150h-48v44h-36M40 250h64v-38h52M260 250h-70v-30h-44"/>
      <path d="M150 40v34M150 296v-40M96 300l24-34M204 300l-24-34"/>
    </g>
    <g fill="url(#cir)" opacity=".8">
      <circle cx="78" cy="94" r="3"/><circle cx="60" cy="172" r="3"/><circle cx="226" cy="110" r="3"/>
      <circle cx="234" cy="194" r="3"/><circle cx="104" cy="212" r="3"/><circle cx="190" cy="220" r="3"/>
    </g>
    <g filter="url(#gl)">
      <path d="M150 74c26 16 40 40 38 68-2 30-24 52-38 66-14-14-36-36-38-66-2-28 12-52 38-68Z" fill="none" stroke="url(#cir)" stroke-width="2.4"/>
      <path d="M150 96c14 12 20 28 18 44-2 18-11 30-18 38-7-8-16-20-18-38-2-16 4-32 18-44Z" fill="none" stroke="#f0b429" stroke-width="1.6" opacity=".9"/>
      <circle cx="150" cy="150" r="13" fill="none" stroke="#22d3ee" stroke-width="2.6"/>
      <circle cx="150" cy="150" r="5" fill="#f0b429"/>
      <path d="M118 128c-16-10-28-6-34 6M182 128c16-10 28-6 34 6M112 176c-18 4-26 16-24 30M188 176c18 4 26 16 24 30" fill="none" stroke="#ec4899" stroke-width="1.8" opacity=".75"/>
    </g>
  </g>
  <path d="M150 14 271 84v140l-121 70-121-70V84Z" fill="none" stroke="url(#hx)" stroke-width="7" stroke-linejoin="round" filter="url(#gl)"/>
  <path d="M150 26 261 90v128l-111 64-111-64V90Z" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

/* ============================================================
   SPLASH — looping intro video
   ============================================================ */
const splash = $("#splash"), splashVideo = $("#splash-video");
let splashOn = true;

// Loop boundary timestamps in seconds based on video length
const PHOENIX_LOOP_START = 5.0; // Eyes disappear at 0:05
const PHOENIX_LOOP_END = 9.9;   // Jump back right before full end at 0:10 to prevent hitching

if (splashVideo) {
  const tryPlay = () => splashVideo.play().catch(() => {});
  tryPlay();
  splash.addEventListener("pointerdown", tryPlay, { once: true });

  let introFinished = false;

  // Track playback time to loop only the phoenix portion
  splashVideo.addEventListener("timeupdate", () => {
    if (splashVideo.currentTime >= PHOENIX_LOOP_START) {
      introFinished = true;
    }

    // Once it hits the end of the video, seek back to 0:05
    if (introFinished && splashVideo.currentTime >= PHOENIX_LOOP_END) {
      splashVideo.currentTime = PHOENIX_LOOP_START;
      splashVideo.play();
    }
  });
}

function enter() {
  if (!splashOn) return;
  splashOn = false;
  splash.classList.add("gone");
  $("#app").classList.add("on");
  if (splashVideo) { splashVideo.pause(); }
  setTimeout(() => { splash.remove(); }, 1000);
}

splash.addEventListener("click", enter);
splash.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    enter();
  }
});
splash.focus?.();