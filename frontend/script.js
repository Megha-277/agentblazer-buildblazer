/* ============================================================
   SHARED UTILITIES — used by both the render block and popup handlers
   ============================================================ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

const ACCENT={t1:"a1",t2:"a2",t3:"a3",t4:"a4"};
const accent=c=>`var(--${ACCENT[c]||"a1"})`;
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function initials(n){return String(n).replace(/[^A-Za-z ]/g,"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")}

/* --------- placeholder portrait / gallery generators --------- */
const PALETTES=[["#123a2e","#2f6f52"],["#1b2b4d","#3d5d8a"],["#3a1f4d","#6b4a8f"],["#4d3a1f","#8a6b3d"],["#1f3f4d","#3d7a8a"],["#4d1f2e","#8a3d55"]];
function portrait(name,i){
  const [a,b]=PALETTES[i%PALETTES.length];
  const ini=String(name).split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("");
  const s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="400" height="500" fill="url(#g)"/>
  <g fill="rgba(255,255,255,.1)"><circle cx="200" cy="205" r="76"/><path d="M60 500c0-83 63-140 140-140s140 57 140 140Z"/></g>
  <text x="200" y="470" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="rgba(255,255,255,.34)" letter-spacing="6">${ini}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
}
function photoOf(p,i){return p.photo?p.photo:portrait(p.name,i)}
function placeholderShot(i,seed){
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
function shotCount(e){const g=e.gallery||{};return (g.images&&g.images.length)?g.images.length:Math.max(1,+g.count||1)}
function galleryShot(e,i,seed){const g=e.gallery||{};return (g.images&&g.images.length)?g.images[i%g.images.length]:placeholderShot(i,seed)}

/* ============================================================
   DATA  — loaded from /api/content (API-first), falling back to
   data.js (localStorage / hardcoded defaults) if unreachable.
   ============================================================ */

async function loadContent() {
  try {
    const base = (typeof window.API_BASE_URL !== "undefined" ? window.API_BASE_URL : "");
    const res = await fetch(`${base}/api/content`);
    if (res.ok) {
      const remote = await res.json();
      // Only use remote if it has at least one non-empty section
      const hasData = ["guests","faculty","officers","committee","events"]
        .some(k => Array.isArray(remote[k]) && remote[k].length > 0);
      if (hasData) return remote;
    }
  } catch (_) { /* network error — fall through to local */ }
  // Fallback: localStorage edits or hardcoded defaults via data.js
  return window.AB ? AB.load() : { guests: [], faculty: [], officers: [], committee: [], events: [] };
}

// Kick off data fetch then render once resolved
loadContent().then(function(CONTENT) {
  const GUESTS    = CONTENT.guests;
  const FACULTY   = CONTENT.faculty;
  const OFFICERS  = CONTENT.officers;
  const COMMITTEE = CONTENT.committee;
  const EVENTS    = CONTENT.events;

  // Expose EVENTS globally so galleryPop (below) can read it after render
  window._AB_EVENTS = EVENTS;

  GUESTS.length && ($("#guests").innerHTML=GUESTS.map(g=>`
  <article class="person glass tilt">
    <div class="person-top">
      <span class="ini">${initials(g.name)}</span>
      <div><h3>${esc(g.name)}</h3><p class="role">${esc(g.org)}</p></div>
    </div>
    <div class="person-foot"><span>${esc(g.left)}</span><b style="color:${accent(g.color)}">${esc(g.right)}</b></div>
  </article>`).join(""));

$("#faculty").innerHTML=FACULTY.map((f,i)=>`
  <article class="fac glass" data-pop="portrait" data-name="${esc(f.name)}" data-role="${esc(f.role)}" data-tag="Faculty" data-img="${esc(photoOf(f,i+4))}">
    <span class="ini">${initials(f.name)}</span>
    <div><h4>${esc(f.name)}</h4><p>${esc(f.role)}</p></div>
    <span class="mini">Portrait view</span>
  </article>`).join("");

$("#officers").innerHTML=OFFICERS.map((o,i)=>`
  <article class="off glass" data-pop="portrait" data-name="${esc(o.name)}" data-role="${esc(o.role)} · AgentBlazer Club" data-tag="Leadership" data-img="${esc(photoOf(o,i))}">
    <span class="fill"></span>
    <span class="tag ${o.color||"t1"}">${esc(o.badge)}</span>
    <h3>${esc(o.name)}</h3>
    <span class="badge" style="color:${accent(o.color)}">${esc(o.role)}</span>
    <p>${esc(o.desc)}</p>
  </article>`).join("");

$("#committee").innerHTML=COMMITTEE.map(c=>`
  <div class="cm glass"><span class="ini">${initials(c.name)}</span><div><h4>${esc(c.name)}</h4><p>${esc(c.role)}</p></div></div>`).join("");

$("#events").innerHTML=EVENTS.map((e,i)=>`
  <article class="ev glass" data-pop="gallery" data-i="${i}">
    <span class="fill"></span>
    <div class="ev-top"><span class="ev-date">${esc(e.date)}</span><span class="kind" style="color:${accent(e.color)}">${esc(e.kind)}</span></div>
    <h3>${esc(e.title)}</h3>
    ${(e.tracks&&e.tracks.length)?`<div class="tracks">${e.tracks.map(t=>`<span>${esc(t)}</span>`).join("")}</div>`:""}
    ${e.note?`<p class="note">${esc(e.note)}</p>`:""}
    <p>${esc(e.desc)}</p>
    <div class="ev-foot"><span class="hint"><i></i>${esc(e.hint||"Hover to inspect gallery")}</span><b>${esc(e.foot)}</b></div>
  </article>`).join("");

  // Re-init tilt on newly rendered cards if VanillaTilt is already loaded
  if(window.VanillaTilt && !matchMedia("(pointer:coarse)").matches){
    VanillaTilt.init($$(".tilt"),{max:5,speed:900,glare:true,"max-glare":.14,scale:1.008,gyroscope:false});
  }
}); // end loadContent().then()

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
  pop.innerHTML=`<div class="pop-media"><img alt="${esc(el.dataset.name)}" src="${el.dataset.img}">
    <span class="pop-tag">${esc(el.dataset.tag)}</span><span class="pop-org">SJEC CSE</span></div>
    <div class="pop-body"><h4>${esc(el.dataset.name)}</h4><p>${esc(el.dataset.role)}</p></div>`;
  placePop(el);requestAnimationFrame(()=>{placePop(el);pop.classList.add("on")});
}
function galleryPop(el){
  const seed=+el.dataset.i, EVENTS=window._AB_EVENTS||[], e=EVENTS[seed]||{gallery:{},title:"",date:""}, g=e.gallery||{}, n=shotCount(e);let idx=0;
  pop.className="pop wide";
  pop.innerHTML=`<div class="pop-head"><b><i></i>${esc(g.label||"Gallery")}</b><span id="pc">1 / ${n}</span></div>
    <div class="pop-media"><img id="pi" alt="${esc(g.caption||e.title)}" src="${galleryShot(e,0,seed)}"></div>
    <div class="pop-cap"><b>${esc(g.caption||e.title)}<i>${esc(g.date||e.date)}</i></b><span>${esc(g.sub||"")}</span></div>`;
  placePop(el);requestAnimationFrame(()=>{placePop(el);pop.classList.add("on")});
  clearInterval(galTimer);
  if(n<2)return;
  galTimer=setInterval(()=>{
    idx=(idx+1)%n;
    const img=$("#pi"),c=$("#pc");if(!img)return clearInterval(galTimer);
    img.style.opacity=.2;
    setTimeout(()=>{img.src=galleryShot(e,idx,seed);img.style.transition="opacity .3s";img.style.opacity=1;},130);
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
   HERO EMBLEM (club logo)
   ============================================================ */
$("#emblem").innerHTML=`
<picture>
  <source srcset="assets/logo.webp" type="image/webp">
  <img src="assets/logo.png" alt="AgentBlazer Club crest" width="752" height="886" decoding="async" fetchpriority="high">
</picture>`;

/* ============================================================
   SPLASH — looping intro video
   ============================================================ */
const splash=$("#splash"),splashVideo=$("#splash-video");
let splashOn=true;
const reduceMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;

// Loop boundary timestamps in seconds based on video length
const PHOENIX_LOOP_START=5.0; // Eyes disappear at 0:05
const PHOENIX_LOOP_END=9.9;   // Jump back right before full end at 0:10 to prevent hitching

if(splashVideo && !reduceMotion){
  // Autoplay can be blocked until the user interacts; retry play on first touch/click.
  const tryPlay=()=>splashVideo.play().catch(()=>{});
  tryPlay();
  splash.addEventListener("pointerdown",tryPlay,{once:true});

  // iOS/Android can pause background video on tab switch or orientation change —
  // resume so the loop keeps running instead of freezing on a single frame.
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden && splashOn) tryPlay();
  });

  let introFinished=false;

  // Track playback time to loop only the phoenix portion
  splashVideo.addEventListener("timeupdate",()=>{
    if(splashVideo.currentTime>=PHOENIX_LOOP_START){
      introFinished=true;
    }

    // Once it hits the end of the video, seek back to 0:05
    if(introFinished && splashVideo.currentTime>=PHOENIX_LOOP_END){
      splashVideo.currentTime=PHOENIX_LOOP_START;
      splashVideo.play();
    }
  });
}
// When reduced motion is on, #splash-video is display:none (see CSS) and
// #splash shows the static poster image instead — no playback started at all.

function enter(){
  if(!splashOn)return;
  splashOn=false;
  splash.classList.add("gone");
  $("#app").classList.add("on");
  if(splashVideo){splashVideo.pause();}
  setTimeout(()=>{splash.remove();},1000);
}
splash.addEventListener("click",enter);
splash.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();enter();}});
splash.focus?.();