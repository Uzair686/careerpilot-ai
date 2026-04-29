/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
let RD = null;          // resume data from analysis
let HIST = [];          // chat history for multi-turn AI
let CHART = null;
let CTYPE = 'bar';
let BUSY  = false;

/* ═══════════════════════════════════════════════════
   SKILL DATABASE (mirrors backend)
═══════════════════════════════════════════════════ */
const SK = {
  "python":10,"java":8,"javascript":9,"typescript":8,"c++":8,"c#":7,
  "php":6,"ruby":6,"go":8,"rust":7,"swift":7,"kotlin":7,"r":7,
  "react":9,"vue":7,"angular":7,"next.js":9,"html":6,"css":6,
  "tailwind":7,"bootstrap":5,"graphql":8,"webpack":6,
  "django":9,"flask":8,"fastapi":8,"node":7,"express":7,"rest api":7,
  "machine learning":10,"deep learning":10,"ai":10,"nlp":9,
  "tensorflow":9,"pytorch":9,"scikit-learn":8,"pandas":7,"numpy":7,
  "data science":9,"computer vision":9,"llm":10,"openai":8,
  "sql":8,"postgresql":8,"mysql":7,"mongodb":7,"redis":7,
  "elasticsearch":7,"firebase":6,"sqlite":5,
  "docker":8,"kubernetes":9,"aws":9,"azure":8,"gcp":8,"linux":7,
  "ci/cd":7,"git":6,"github":6,"gitlab":6,"terraform":7,
  "flutter":7,"react native":8,"android":7,"ios":7,
  "figma":6,"agile":6,"scrum":5,"power bi":7,"tableau":7,
};

const WHY = {
  "machine learning":"Highest-paid skill globally — triples remote earning potential",
  "docker":"Every dev team uses containers. Non-negotiable for senior roles.",
  "react":"#1 frontend framework — most job postings require it",
  "kubernetes":"Cloud-native standard — required for DevOps/platform roles",
  "typescript":"JavaScript at scale — demanded by top companies globally",
  "aws":"60% cloud market share — certification = immediate salary jump",
  "postgresql":"Most advanced open-source DB, preferred over MySQL in production",
  "tensorflow":"Industry-standard deep learning framework",
  "next.js":"React for production — SSR, SEO, and full-stack in one",
  "graphql":"Modern API standard replacing REST at scale",
  "flutter":"One codebase → iOS + Android + Web apps",
  "redis":"In-memory caching — all high-traffic apps use it",
  "python":"Universal language for AI, data, backend, and automation",
  "sql":"Core data skill — every developer needs this",
  "linux":"Essential for backend, DevOps, and cloud roles",
};

const TIME = {
  "machine learning":"8–12 wks","docker":"2–3 wks","react":"6–8 wks",
  "kubernetes":"4–6 wks","typescript":"2–3 wks","aws":"6–10 wks",
  "postgresql":"2–3 wks","tensorflow":"8–10 wks","next.js":"3–4 wks",
  "graphql":"2–3 wks","flutter":"6–8 wks","redis":"1–2 wks",
  "python":"4–6 wks","sql":"3–4 wks","linux":"3–4 wks",
};

/* ═══════════════════════════════════════════════════
   FILE READING — PDF.js + Mammoth.js + TXT
═══════════════════════════════════════════════════ */
function readTxt(f){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>res(e.target.result);
    r.onerror=()=>rej(new Error('Cannot read TXT'));
    r.readAsText(f);
  });
}

async function readPDF(f){
  if(!window.pdfjsLib){
    await loadJS('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const buf=await f.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  let out='';
  for(let i=1;i<=pdf.numPages;i++){
    const pg=await pdf.getPage(i);
    const ct=await pg.getTextContent();
    out+=ct.items.map(x=>x.str).join(' ')+'\n';
  }
  return out;
}

async function readDOCX(f){
  if(!window.mammoth) await loadJS('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  const r=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});
  return r.value;
}

function loadJS(src){
  return new Promise((res,rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){res();return;}
    const s=document.createElement('script');
    s.src=src; s.onload=res; s.onerror=()=>rej('Failed: '+src);
    document.head.appendChild(s);
  });
}

async function getFileText(f){
  const ext=f.name.split('.').pop().toLowerCase();
  if(ext==='txt') return readTxt(f);
  if(ext==='pdf') return readPDF(f);
  if(ext==='docx'||ext==='doc') return readDOCX(f);
  throw new Error('Unsupported file type. Please use PDF, DOCX, or TXT.');
}

/* ═══════════════════════════════════════════════════
   BROWSER-SIDE NLP ANALYSIS
═══════════════════════════════════════════════════ */
function extractSkills(text){
  const t=text.toLowerCase();
  return Object.keys(SK).filter(s=>new RegExp('\\b'+s.replace(/[+#.()/]/g,'\\$&')+'\\b').test(t));
}

function calcScore(skills, meta, text){
  if(!skills.length) return 5;

  // ── 1. Skill breadth (max 45 pts) ──────────────────────────────────────
  // Diminishing returns: first few skills are worth more than the 20th
  const sorted = [...skills].sort((a,b)=>(SK[b]||5)-(SK[a]||5));
  let skillPts = 0;
  sorted.forEach((s,i)=>{
    const raw = SK[s] || 5;
    const decay = Math.max(0.15, 1 - i * 0.07); // each extra skill worth less
    skillPts += raw * decay;
  });
  const skillScore = Math.min(Math.round(skillPts * 1.6), 45);

  // ── 2. Skill quality / depth (max 20 pts) ──────────────────────────────
  // High-value skills (weight 9-10) count more
  const highVal = skills.filter(s=>(SK[s]||0)>=9).length;
  const midVal  = skills.filter(s=>(SK[s]||0)>=7&&(SK[s]||0)<9).length;
  const qualityScore = Math.min(highVal*4 + midVal*1.5, 20);

  // ── 3. Profile completeness (max 20 pts) ────────────────────────────────
  let completeness = 0;
  if(meta.has_email)    completeness += 5;
  if(meta.has_phone)    completeness += 4;
  if(meta.has_linkedin) completeness += 6;
  if(meta.has_github)   completeness += 5;

  // ── 4. Resume length / depth (max 10 pts) ──────────────────────────────
  const words = meta.words || 0;
  let lengthScore = 0;
  if(words >= 600) lengthScore = 10;
  else if(words >= 400) lengthScore = 7;
  else if(words >= 200) lengthScore = 4;
  else if(words >= 80)  lengthScore = 2;

  // ── 5. Content quality signals (max 5 pts) ─────────────────────────────
  const t = (text||'').toLowerCase();
  let contentScore = 0;
  if(/\d+\s*%|\d+x\s|increased|reduced|improved|led|built|deployed/.test(t)) contentScore += 3;
  if(/certification|certified|award|publication|patent/.test(t)) contentScore += 2;

  const total = skillScore + qualityScore + completeness + lengthScore + contentScore;
  return Math.min(Math.max(Math.round(total), 3), 100);
}

function getLabel(score){
  if(score>=85) return 'Excellent';
  if(score>=70) return 'Good';
  if(score>=50) return 'Needs Improvement';
  return 'Beginner';
}

function getMeta(text){
  return{
    has_email:   /[\w.\-]+@[\w.\-]+\.\w+/.test(text),
    has_phone:   /\+?\d[\d\s\-(). ]{7,}\d/.test(text),
    has_linkedin:/linkedin/i.test(text),
    has_github:  /github/i.test(text),
    words:       text.trim().split(/\s+/).length,
  };
}

function getRec(score){
  if(score>=85) return 'Outstanding profile. You qualify for senior/lead roles. Focus on system design, architecture, and measurable impact.';
  if(score>=70) return 'Strong profile. Competitive for mid-to-senior roles. Strengthen your top 2 missing skills and add quantified achievements.';
  if(score>=50) return 'Solid foundation. Target junior-to-mid roles. Build 2–3 portfolio projects and learn one in-demand framework.';
  return 'Early-stage profile. Focus on one core language deeply, complete a certification, and build your first 2 GitHub projects.';
}

function analyzeText(text){
  const skills  = extractSkills(text);
  const meta    = getMeta(text);
  const score   = calcScore(skills, meta, text);
  const label   = getLabel(score);
  const missing = Object.keys(SK).filter(s=>!skills.includes(s))
                   .sort((a,b)=>(SK[b]||0)-(SK[a]||0)).slice(0,10);
  return { skills, score, score_label:label, missing_skills:missing, meta, recommendation:getRec(score) };
}

/* ═══════════════════════════════════════════════════
   UPLOAD ZONE SETUP
═══════════════════════════════════════════════════ */
const dzone = document.getElementById('dzone');
const fileIn = document.getElementById('fileIn');
const analyzeBtn = document.getElementById('analyzeBtn');
const dzFn = document.getElementById('dzFn');
const dzEm = document.getElementById('dzEm');

fileIn.addEventListener('change',()=>{const f=fileIn.files[0];if(f)setFile(f);});
['dragenter','dragover'].forEach(e=>dzone.addEventListener(e,ev=>{ev.preventDefault();dzone.classList.add('over');}));
['dragleave','drop'].forEach(e=>dzone.addEventListener(e,ev=>{ev.preventDefault();dzone.classList.remove('over');}));
dzone.addEventListener('drop',ev=>{
  const f=ev.dataTransfer.files[0];
  if(f){const dt=new DataTransfer();dt.items.add(f);fileIn.files=dt.files;setFile(f);}
});

function setFile(f){
  dzFn.textContent='📎 '+f.name;
  dzEm.textContent='✅';
  analyzeBtn.disabled=false;
}

/* ═══════════════════════════════════════════════════
   MAIN ANALYZE FUNCTION (100% browser, no Flask)
═══════════════════════════════════════════════════ */
async function doAnalyze(){
  const f=fileIn.files[0];
  if(!f){showToast('⚠️ Select a file first');return;}

  analyzeBtn.disabled=true;
  analyzeBtn.innerHTML=`<span class="dl-wrap"><span class="dl"></span><span class="dl"></span><span class="dl"></span></span> Reading file…`;

  try{
    const text=await getFileText(f);

    if(!text||text.trim().length<20)
      throw new Error('Could not extract text. Try a TXT or DOCX file for best results.');

    analyzeBtn.innerHTML=`<span class="dl-wrap"><span class="dl"></span><span class="dl"></span><span class="dl"></span></span> Analyzing…`;
    await sleep(350);

    RD = analyzeText(text);
    RD.rawText = text; // keep for AI context

    renderAll(RD);

    analyzeBtn.innerHTML='<span class="bi">✅</span> Analysis Complete';

    const sc=document.getElementById('statusChip');
    sc.textContent=`Score: ${RD.score}/100`;
    sc.classList.add('ok');

    document.getElementById('chCtx').style.display='inline-block';
    hideWelcome();

    // Build AI system context
    buildAICtx(RD);

    // Auto-send intro message
    appendMsg('ai',
      `✅ **Resume analyzed! Score: ${RD.score}/100 — ${RD.score_label}**\n\n`+
      `Found **${RD.skills.length} skills**: ${RD.skills.slice(0,6).join(', ')}${RD.skills.length>6?'…':''}\n\n`+
      `I'm your AI career advisor. Ask me **anything** — detailed CV improvements, mock interviews, salary negotiation, learning roadmaps, cover letters, or career paths!`,
      true
    );

    renderGap(RD);
    showToast('✅ Resume analyzed successfully!');

  }catch(err){
    showToast('❌ '+err.message);
    console.error(err);
    analyzeBtn.disabled=false;
    analyzeBtn.innerHTML='<span class="bi">⚡</span> Analyze Resume';
    dzEm.textContent='📁';
  }
}

/* ═══════════════════════════════════════════════════
   RENDER ALL COMPONENTS
═══════════════════════════════════════════════════ */
function renderAll(d){
  renderScore(d);
  renderBars(d);
  renderRec(d);
  renderTags(d);
  renderChart(d.skills, CTYPE);
  document.getElementById('rptBtn').style.display='flex';
}

function renderScore(d){
  document.getElementById('scoreCard').style.display='block';
  const C=326.73;
  const ring=document.getElementById('ringFill');
  const col=d.score>=70?'var(--mint)':d.score>=50?'var(--amber)':'var(--rose)';
  ring.style.strokeDashoffset=C-(d.score/100)*C;
  ring.style.stroke=col;
  const sn=document.getElementById('scNum');
  sn.style.color=col;
  animN(sn,0,d.score,1300);

  document.getElementById('scLbl').textContent=d.score_label||'';
  const gr=document.getElementById('scGrade');
  const gmap={'Excellent':'ge ⭐ Excellent','Good':'gg 👍 Good','Needs Improvement':'gn 📈 Needs Work','Beginner':'gb 🚀 Beginner'};
  const gv=(gmap[d.score_label]||'gn 📈 Needs Work').split(' ');
  gr.className='sc-grade '+gv[0];
  gr.textContent=gv.slice(1).join(' ');
}

function renderBars(d){
  document.getElementById('matchCard').style.display='block';
  const meta=d.meta||{};
  const cats=[
    {l:'Technical Skills', v:Math.min(d.skills.length*11,100)},
    {l:'Market Demand',     v:d.score},
    {l:'Profile Complete',  v:Math.max(d.score-8,10)},
    {l:'Online Presence',   v:(meta.has_linkedin?50:0)+(meta.has_github?50:0)},
    {l:'Contact Info',      v:(meta.has_email?55:0)+(meta.has_phone?45:0)},
  ];
  document.getElementById('mlist').innerHTML=cats.map(c=>`
    <div>
      <div class="mrow"><span>${c.l}</span><span>${c.v}%</span></div>
      <div class="mtrack"><div class="mfill" style="width:0%" data-v="${c.v}"></div></div>
    </div>`).join('');
  setTimeout(()=>document.querySelectorAll('.mfill').forEach(b=>b.style.width=b.dataset.v+'%'),80);
}

function renderRec(d){
  document.getElementById('recCard').style.display='flex';
  document.getElementById('recTx').textContent=d.recommendation||'';
}

function renderTags(d){
  const grid=document.getElementById('skillsGrid');
  grid.style.display='grid';
  document.getElementById('chartArea').style.display='none';
  document.getElementById('skillChart').style.display='block';

  document.getElementById('tagsFound').innerHTML='<div class="tags-wrap">'+
    (d.skills.length
      ? d.skills.map((s,i)=>`<span class="tag f" style="animation-delay:${i*.04}s">${s}</span>`).join('')
      : '<span class="ehint">No skills detected</span>')+'</div>';

  document.getElementById('tagsMissing').innerHTML='<div class="tags-wrap">'+
    (d.missing_skills.length
      ? d.missing_skills.map((s,i)=>`<span class="tag m" style="animation-delay:${i*.04}s">${s}</span>`).join('')
      : '<span class="ehint">All key skills found!</span>')+'</div>';
}

function renderGap(d){
  const gc=document.getElementById('gapContent');
  const col=d.score>=70?'var(--mint)':d.score>=50?'var(--amber)':'var(--rose)';
  gc.innerHTML=`
    <div class="gap-hdr">
      <div class="gap-srow">
        <div>
          <div style="font-size:10px;color:var(--tx3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">Your Score</div>
          <div class="gap-big" style="color:${col}">${d.score}<span style="font-size:18px;color:var(--tx3)">/100</span></div>
          <div style="font-size:11.5px;color:var(--tx2);margin-top:4px">${d.score_label}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--tx3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px">Skills Found</div>
          <div style="font-weight:900;font-size:42px;color:var(--blue)">${d.skills.length}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--tx2)">${d.recommendation}</div>
    </div>
    <div class="gap-rt">📚 Your Learning Roadmap</div>
    <div>${d.missing_skills.slice(0,7).map((s,i)=>`
      <div class="gap-step">
        <div class="gap-num">${i+1}</div>
        <div>
          <div class="gap-sk">${s.toUpperCase()}</div>
          <div class="gap-why">${WHY[s]||'High-value skill for your career track'}</div>
          <span class="gap-time">⏱ ${TIME[s]||'3–5 wks'}</span>
        </div>
      </div>`).join('')}</div>
    ${d.meta.has_linkedin?'':'<div style="margin-top:12px;padding:10px 13px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:10px;font-size:12px;color:var(--rose)">⚠️ LinkedIn URL missing from resume — add it to increase recruiter visibility by 70%</div>'}
    ${d.meta.has_github?'':'<div style="margin-top:8px;padding:10px 13px;background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);border-radius:10px;font-size:12px;color:var(--blue)">⚠️ GitHub URL missing — add it to show real projects to recruiters</div>'}
  `;
}

/* ═══════════════════════════════════════════════════
   CHART
═══════════════════════════════════════════════════ */
function renderChart(skills,type){
  const canvas=document.getElementById('skillChart');
  if(!skills||!skills.length) return;
  if(CHART) CHART.destroy();

  const dark=document.documentElement.dataset.theme!=='light';
  const tc=dark?'#94a3b8':'#64748b';
  const vals=skills.map(s=>Math.min((SK[s]||5)*9,100));
  const cols=skills.map((_,i)=>`hsl(${208+i*19},72%,60%)`);

  CHART=new Chart(canvas,{
    type:type==='doughnut'?'doughnut':type,
    data:{
      labels:skills,
      datasets:[{
        label:'Skill Score (%)',data:vals,
        backgroundColor:type==='bar'?cols:cols.map(c=>c.replace('60%)','55%)')),
        borderColor:type==='radar'?cols:undefined,
        borderWidth:type==='radar'?2:0,
        borderRadius:type==='bar'?8:0,
        borderSkipped:false,
        fill:type==='radar',
        pointBackgroundColor:type==='radar'?cols:undefined,
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      animation:{duration:900,easing:'easeOutQuart'},
      plugins:{legend:{display:type!=='bar',labels:{color:tc,font:{size:10},boxWidth:10}}},
      scales:type==='bar'?{
        x:{ticks:{color:tc,font:{size:9},maxRotation:42},grid:{color:'rgba(148,163,184,0.07)'}},
        y:{ticks:{color:tc,font:{size:9}},grid:{color:'rgba(148,163,184,0.07)'},beginAtZero:true,max:100}
      }:type==='radar'?{
        r:{ticks:{color:tc,font:{size:8},backdropColor:'transparent'},
          grid:{color:'rgba(255,255,255,0.07)'},
          pointLabels:{color:tc,font:{size:9}},min:0,max:100}
      }:{}
    }
  });
}

function setChart(type,btn){
  CTYPE=type;
  document.querySelectorAll('.ct').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  if(RD) renderChart(RD.skills,type);
}

/* ═══════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════ */
function tab(name,el){
  document.querySelectorAll('.np').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('.tpanel').forEach(p=>p.classList.remove('on'));
  document.getElementById('tp-'+name).classList.add('on');
}
function askQ(card){toChat('Give me a strong model answer for this interview question: "'+card.querySelector('.qtxt').textContent+'"');}
function toChat(msg){document.getElementById('chatTa').value=msg;sendChat();}
function chip(el){document.getElementById('chatTa').value=el.textContent;sendChat();}

/* ═══════════════════════════════════════════════════
   CLAUDE AI CHATBOT
═══════════════════════════════════════════════════ */

// Store API key in sessionStorage (cleared when tab closes)
function getApiKey(){
  return sessionStorage.getItem('cp_api_key')||'';
}
function setApiKey(k){
  if(k) sessionStorage.setItem('cp_api_key',k.trim());
}
function promptApiKey(){
  const k=prompt(
    '🔑 Enter your Anthropic API key to enable full AI chat\n\n'+
    'Get one free at: console.anthropic.com\n\n'+
    '(Leave blank to use smart offline mode)',
    getApiKey()
  );
  if(k!==null) setApiKey(k);
  return (k||'').trim();
}

function buildAICtx(d){
  window._SYS=`You are CareerPilot AI — a world-class professional career coach and resume expert with 15+ years of experience.

CANDIDATE RESUME ANALYSIS:
━━━━━━━━━━━━━━━━━━━━━━━━
Score         : ${d.score}/100 (${d.score_label})
Skills Found  : ${d.skills.join(', ')||'none detected'}
Missing Skills: ${d.missing_skills.join(', ')}
LinkedIn      : ${d.meta.has_linkedin?'✓ Present':'✗ Missing'}
GitHub        : ${d.meta.has_github?'✓ Present':'✗ Missing'}
Recommendation: ${d.recommendation}
━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS:
- Answer ANY question the user asks — never refuse a relevant query
- Personalize every response to the candidate's actual skills and score above
- Be specific, detailed, and actionable — no generic advice
- For career questions: give role names, salary ranges (PKR + USD remote), and next steps
- For skill questions: confirm yes/no and explain HOW to add that skill to their CV/profile
- For interview prep: ask one question at a time and evaluate their answers
- Use bullet points and clear formatting
- Always include Pakistan salary data when discussing compensation
- You can discuss anything related to tech careers, skills, job search, and professional growth`;
  HIST=[];
}

async function sendChat(){
  const ta=document.getElementById('chatTa');
  const msg=ta.value.trim();
  if(!msg||BUSY) return;

  hideWelcome();
  appendMsg('user',msg);
  ta.value=''; ta.style.height='auto';
  HIST.push({role:'user',content:msg});

  BUSY=true;
  document.getElementById('sendBtn').disabled=true;
  showTyping();

  try{
    const apiKey=getApiKey();
    if(!apiKey) throw new Error('no_key');

    const sys=window._SYS||
      'You are CareerPilot AI — an expert career coach. Answer any career, CV, interview, salary, or skills question thoroughly and specifically. Be helpful and detailed.';

    // Build messages — include full conversation history
    const messages=HIST.slice(-16).filter(m=>m.role&&m.content);

    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1200,
        system:sys,
        messages:messages
      })
    });

    if(!resp.ok){
      const err=await resp.json().catch(()=>({}));
      if(resp.status===401) throw new Error('invalid_key');
      throw new Error(err.error?.message||`API error ${resp.status}`);
    }

    const data=await resp.json();
    const txt=data.content.map(b=>b.text||'').join('').trim();
    HIST.push({role:'assistant',content:txt});
    hideTyping();
    await streamMsg(txt);

  }catch(e){
    hideTyping();

    if(e.message==='no_key'){
      // Ask for key then retry
      const k=promptApiKey();
      if(k){
        HIST.pop(); // remove last user msg, will re-push on retry
        ta.value=msg;
        BUSY=false;
        document.getElementById('sendBtn').disabled=false;
        sendChat();
        return;
      }
      // No key given — use smart local fallback
      const fb=localFallback(msg);
      HIST.push({role:'assistant',content:fb});
      await streamMsg(fb);
    } else if(e.message==='invalid_key'){
      sessionStorage.removeItem('cp_api_key');
      const fb='❌ **Invalid API key.** Please click the key button and enter a valid Anthropic API key from console.anthropic.com\n\nIn the meantime, here\'s what I can tell you:\n\n'+localFallback(msg);
      HIST.push({role:'assistant',content:fb});
      await streamMsg(fb);
    } else {
      // Network error or other — use smart local fallback silently
      const fb=localFallback(msg);
      HIST.push({role:'assistant',content:fb});
      await streamMsg(fb);
    }
  }finally{
    BUSY=false;
    document.getElementById('sendBtn').disabled=false;
  }
}

/* ═══════════════════════════════════════════════════
   LOCAL FALLBACK — Smart offline responses
═══════════════════════════════════════════════════ */
function localFallback(msg){
  const q=msg.toLowerCase();
  const sk=RD?RD.skills:[];
  const ms=RD?RD.missing_skills:[];
  const sc=RD?RD.score:0;
  const meta=RD?RD.meta:{};

  // ── Specific skill / certification questions ─────────────────────────
  // Handles: "can i add X", "should i add X", "is X worth it", "how to add X"
  const addMatch = q.match(/(?:can i add|should i add|add|is|worth|learn|how to add|what about)\s+(.{3,40?}?)(?:\s+(?:skill|cert|certification|to my|on my|in my))?$/);
  const skillMentions = [
    {keys:['azure','az-900','az-104','az-204','azure fundamentals','azure developer','azure administrator'],
     name:'Azure',cert:'AZ-900 (Fundamentals)',
     reply:`✅ **Yes — absolutely add Azure to your CV!**\n\n**Why it matters:**\nAzure is Microsoft's cloud platform with 23% market share. Every enterprise team needs Azure skills, and it's the #1 cloud platform in Pakistan's corporate sector.\n\n**Certifications to add (in order):**\n1. **AZ-900** — Azure Fundamentals (free exam vouchers available) — 1–2 weeks study\n2. **AZ-104** — Azure Administrator — most hired cert, 4–6 weeks study\n3. **AZ-204** — Azure Developer Associate — best for devs, 6–8 weeks study\n\n**How to add it to your CV:**\n• Under Skills: \`Microsoft Azure (AZ-900)\`\n• Under Projects: build a simple web app hosted on Azure App Service\n• Free learning: learn.microsoft.com (official, free, with sandbox labs)\n\n**Salary impact:** Azure skills add PKR 30K–80K/month to your package. Remote roles jump $15–30/hr higher.`},
    {keys:['aws','amazon web services','aws certified','cloud practitioner','solutions architect'],
     name:'AWS',cert:'AWS Cloud Practitioner',
     reply:`✅ **Yes — AWS is the most valuable cloud cert you can add!**\n\n**Why it matters:**\nAWS holds 32% cloud market share — largest globally. Most startups and remote jobs require AWS.\n\n**Certifications to add (in order):**\n1. **AWS Cloud Practitioner** — entry level, 2–3 weeks, ~$100 exam\n2. **AWS Solutions Architect Associate** — highest ROI cert in tech, 6–8 weeks\n3. **AWS Developer Associate** — best for backend devs\n\n**How to add it to your CV:**\n• Free learning: AWS Skill Builder, freeCodeCamp YouTube\n• Build a project: host a React app on S3 + CloudFront\n• Add to Skills section: \`AWS (EC2, S3, Lambda, RDS)\`\n\n**Salary impact:** AWS cert immediately adds PKR 40K–100K/month on-site. Remote: $20–50/hr increase.`},
    {keys:['docker','containerization','containers'],
     name:'Docker',cert:'Docker Certified Associate',
     reply:`✅ **Yes — Docker is non-negotiable for any backend/DevOps role!**\n\n**Why:**\nEvery modern dev team uses Docker. It's expected at mid-level and above.\n\n**How to learn it (2–3 weeks):**\n1. Install Docker Desktop (free)\n2. Follow: "Docker for Beginners" on freeCodeCamp YouTube\n3. Containerize one of your existing projects\n4. Learn docker-compose for multi-service apps\n\n**How to add to CV:**\n• Skills: \`Docker, Docker Compose, Container Orchestration\`\n• Projects: "Dockerized [Your App] — deployed with multi-stage builds"\n\n**Salary impact:** +PKR 20K–50K/month. Essential for remote DevOps roles ($10–25/hr more).`},
    {keys:['kubernetes','k8s'],
     name:'Kubernetes',cert:'CKA (Certified Kubernetes Administrator)',
     reply:`✅ **Yes — Kubernetes is the highest-paying DevOps skill!**\n\nLearn Docker first (2–3 wks), then Kubernetes (4–6 wks).\n\n**Resources:** KodeKloud (best), official k8s.io tutorials\n**Add to CV:** \`Kubernetes, Helm, Container Orchestration\`\n**Salary:** Senior K8s engineers earn PKR 400K–800K/month. Remote: $80–150/hr.`},
    {keys:['python'],name:'Python',
     reply:`✅ **Yes — Python is the most versatile skill to add!**\n\nIt covers AI/ML, backend (Django/FastAPI), automation, and data science.\n\n**Learn in order:**\n1. Python basics — 2–3 weeks (freeCodeCamp)\n2. Pick a path: Django (web) OR pandas/numpy (data) OR PyTorch (AI)\n\n**Add to CV:** Show a real project — a Django REST API or a data analysis notebook on GitHub.\n**Salary:** Python devs earn PKR 100K–400K/month. AI/ML Python: PKR 200K–800K/month.`},
    {keys:['react','reactjs'],name:'React',
     reply:`✅ **Yes — React is the #1 frontend skill in job postings globally!**\n\n**Learn it in 6–8 weeks:**\n• Official React docs (react.dev) — excellent and free\n• Build a full CRUD app with hooks and API calls\n• Add Next.js after (2–3 more weeks) for full-stack capability\n\n**Add to CV:** "Built [Project] using React 18, hooks, Context API, and REST API integration"\n**Salary:** React devs earn PKR 120K–350K/month. Senior React + Next.js: $50–100/hr remote.`},
    {keys:['typescript','ts'],name:'TypeScript',
     reply:`✅ **Absolutely — TypeScript is now expected at top companies!**\n\n**Learn in 2–3 weeks** if you know JavaScript:\n• TypeScript Deep Dive (free book online)\n• Convert one existing JS project to TS\n\n**Add to CV:** List TypeScript separately from JavaScript — it signals seniority.\n**Salary:** TypeScript adds ~20–30% to JavaScript dev salaries.`},
    {keys:['machine learning','ml','ai','artificial intelligence'],name:'Machine Learning / AI',
     reply:`✅ **Yes — AI/ML is the highest-paying skill in tech right now!**\n\n**Learning path (4–6 months):**\n1. Python + NumPy + Pandas (4 weeks)\n2. Scikit-learn — classical ML (4 weeks)\n3. TensorFlow or PyTorch — deep learning (6 weeks)\n4. Build a project: image classifier, chatbot, or recommendation engine\n\n**Certifications:** Google ML Crash Course (free), Coursera ML Specialization (Andrew Ng)\n**Salary:** ML Engineers earn PKR 200K–800K/month. Remote AI roles: $80–200/hr.`},
    {keys:['sql','postgresql','mysql','database'],name:'SQL / Databases',
     reply:`✅ **Yes — SQL is a core skill every developer needs!**\n\n**Learn in 3–4 weeks:**\n• SQLZoo.net or Mode Analytics SQL Tutorial (free)\n• Practice on LeetCode Database problems\n• Learn PostgreSQL specifically — it's preferred over MySQL in production\n\n**Add to CV:** \`PostgreSQL, MySQL, SQL (joins, indexes, query optimization)\`\n**Salary:** SQL skills are required for most data and backend roles — direct impact on hirability.`},
    {keys:['next.js','nextjs','next js'],name:'Next.js',
     reply:`✅ **Yes — Next.js is the most in-demand React framework!**\n\nIf you know React, add Next.js in 3–4 weeks.\n\n**Resources:** nextjs.org/learn (official, free, interactive)\n**Build:** A portfolio site or blog with Next.js + deploy free on Vercel\n**Salary:** Next.js devs earn $10–25/hr more than React-only developers remotely.`},
  ];

  // Check if question is about a specific skill
  for(const entry of skillMentions){
    if(entry.keys.some(k=>q.includes(k))){
      return entry.reply;
    }
  }

  // ── Certification / course questions ────────────────────────────────
  if(/certif|course|study|exam|badge|credential/.test(q)){
    return (
      `🎓 **Top Certifications for Tech Professionals (2025)**\n\n`+
      `**Cloud (Highest ROI):**\n`+
      `• AWS Solutions Architect Associate — PKR +40K–100K/month impact\n`+
      `• Azure AZ-104 Administrator — dominant in Pakistan's corporate sector\n`+
      `• Google Cloud Professional — growing fast, fewer competition\n\n`+
      `**AI/ML:**\n`+
      `• Google ML Crash Course (free)\n`+
      `• Coursera ML Specialization (Andrew Ng) — gold standard\n`+
      `• TensorFlow Developer Certificate — respected by recruiters\n\n`+
      `**DevOps:**\n`+
      `• CKA (Certified Kubernetes Administrator)\n`+
      `• HashiCorp Terraform Associate\n`+
      `• Docker Certified Associate\n\n`+
      `**Web/Frontend:**\n`+
      `• Meta Frontend Developer (Coursera)\n`+
      `• freeCodeCamp certifications (free, respected)\n\n`+
      `**Quick wins:** AWS Cloud Practitioner or AZ-900 can be done in 2 weeks and immediately boost your CV.`
    );
  }

  // ── Improve CV ───────────────────────────────────────────────────────
  if(/improve|cv|resume|better|fix|review|rewrite|update/.test(q)){
    let items=[];
    if(meta&&!meta.has_linkedin) items.push('❌ **Add LinkedIn URL** — recruiters check this before anything else');
    if(meta&&!meta.has_github)   items.push('❌ **Add GitHub URL** — shows real working code to employers');
    items.push(
      "📌 **Quantify achievements** — 'Reduced API latency by 45%' not 'improved performance'",
      "📌 **Action verbs** — start every bullet: built, led, designed, optimized, launched, deployed",
      "📌 **Professional summary** — write 3 sharp lines at the very top of your CV",
      "📌 **ATS keywords** — mirror exact terms from job descriptions you're targeting",
      "📌 **Length** — 1 page if under 3 years experience, max 2 pages for senior roles",
      "📌 **Remove fluff** — delete 'hardworking', 'team player', 'passionate' — show don't tell",
    );
    return `✏️ **CV Improvement Plan** (Score: ${sc}/100)\n\n`+items.join('\n')+
      `\n\n**Biggest impact change:** Add 2–3 bullet points with real numbers to your most recent role.`;
  }

  // ── Interview ────────────────────────────────────────────────────────
  if(/interview|mock|question|practice|hiring/.test(q)){
    const techQs=[];
    if(sk.includes('angular')||sk.includes('javascript'))
      techQs.push('Q: What is change detection in Angular and how does OnPush strategy work?');
    if(sk.includes('python')||sk.includes('django'))
      techQs.push("Q: Explain Python's GIL — what it is and how it affects concurrent code");
    if(sk.includes('react'))
      techQs.push('Q: What is the virtual DOM and how does React reconciliation work?');
    if(sk.includes('machine learning')||sk.includes('ai'))
      techQs.push('Q: Explain overfitting — what causes it and 3 ways to prevent it');
    if(sk.includes('sql')||sk.includes('mongodb'))
      techQs.push('Q: When would you choose MongoDB over PostgreSQL? Give a real example.');
    if(!techQs.length) techQs.push('Q: Describe the most complex technical problem you have solved and how you approached it.');

    return `🎯 **Interview Prep — Tailored to Your Stack**\n\n`+
      `**Technical Questions:**\n`+techQs.slice(0,3).map(q=>`• ${q}`).join('\n')+
      `\n\n**Behavioral (STAR method):**\n`+
      `• Tell me about a project you're most proud of — your specific role and measurable impact?\n`+
      `• Describe a time you had a conflict with a teammate. How did you resolve it?\n`+
      `• How do you handle tight deadlines with multiple priorities?\n\n`+
      `**System Design:**\n`+
      `• Design a URL shortener handling 1M requests/day\n`+
      `• How would you architect a real-time chat app for 100K users?\n\n`+
      `Say **"Start mock interview"** and I'll ask you one question at a time and give feedback!`;
  }

  // ── Salary ───────────────────────────────────────────────────────────
  if(/salary|pay|earn|income|package|compensation|negotiate/.test(q)){
    return `💰 **Salary Guide — Pakistan Tech Market 2025**\n\n`+
      `**On-site (PKR/month):**\n`+
      `• Junior (0–2 yrs):          PKR 60,000 – 120,000\n`+
      `• Mid-level (2–5 yrs):       PKR 120,000 – 300,000\n`+
      `• Senior (5+ yrs):           PKR 300,000 – 650,000\n`+
      `• AI/ML Engineer:            PKR 200,000 – 800,000\n`+
      `• Engineering Manager:       PKR 500,000 – 1,200,000\n\n`+
      `**Remote (USD/hour):**\n`+
      `• Junior:      $15–35/hr\n`+
      `• Mid-level:   $35–75/hr\n`+
      `• Senior:      $75–130/hr\n`+
      `• AI/ML Spec:  $90–200/hr\n\n`+
      `**Negotiation Script:**\n`+
      `_"Based on my experience with ${sk.slice(0,3).join(', ')||'my skills'}, I was expecting [target + 20%]. Is there any flexibility?"_\n\n`+
      (sc?`**Your Level:** Score ${sc}/100 → target ${sc>=70?'mid-to-senior':'junior-to-mid'} rates.`:'');
  }

  // ── Career path ──────────────────────────────────────────────────────
  if(/career|path|role|field|job|switch|transition/.test(q)){
    const hasAI=sk.some(s=>['machine learning','ai','tensorflow','pytorch','nlp'].includes(s));
    const hasFE=sk.some(s=>['react','angular','vue','typescript'].includes(s));
    const hasBE=sk.some(s=>['python','django','flask','node','java'].includes(s));
    if(hasAI) return `🎯 **Your Career Paths — AI/ML Focus**\n\n1. **ML Engineer** — PKR 200K–600K/month | Remote $50–120/hr\n2. **LLM/GenAI Engineer** 🔥 — PKR 400K–1M/month | Remote $100–200/hr\n3. **AI Research Engineer** — PKR 300K–800K/month | Remote $80–150/hr\n\n**Next Step:** Add one LLM/OpenAI API project to GitHub — it's the highest-paying niche right now.`;
    if(hasFE) return `🎯 **Your Career Paths — Frontend Focus**\n\n1. **Senior React/Angular Dev** — PKR 150K–350K/month | Remote $40–90/hr\n2. **Full-Stack Engineer** (add Node or Python) — PKR 200K–500K/month | Remote $60–120/hr\n3. **Frontend Architect** — PKR 300K–700K/month | Remote $80–150/hr\n\n**Next Step:** Add Next.js + TypeScript — most in-demand combo for frontend roles.`;
    if(hasBE) return `🎯 **Your Career Paths — Backend Focus**\n\n1. **Backend Engineer** — PKR 120K–350K/month | Remote $35–80/hr\n2. **Platform/DevOps Engineer** (add Docker + AWS) — PKR 200K–500K/month\n3. **Microservices Architect** — PKR 300K–600K/month | Remote $70–130/hr\n\n**Next Step:** Add Docker + one cloud cert — immediate 30–40% value jump.`;
    return `🎯 **Top Career Paths in Tech (2025)**\n\n1. **AI/ML Engineering** — highest global salaries\n2. **Full-Stack** (React + Python/Node) — most job openings\n3. **Cloud/DevOps** (AWS + K8s) — fastest growing\n4. **Cybersecurity** — critical shortage, premium pay\n\nUpload your resume for a personalized recommendation!`;
  }

  // ── Cover letter ─────────────────────────────────────────────────────
  if(/cover letter|cover|application letter/.test(q)){
    const top=sk.slice(0,4).join(', ')||'my technical skills';
    return `📝 **Cover Letter Template**\n\n---\nDear [Hiring Manager],\n\nI'm applying for the **[Position]** role at **[Company]**. With expertise in ${top}, I've built production-grade solutions that deliver measurable results.\n\nIn my most recent role, I **[specific achievement — e.g., 'built a REST API that reduced response time by 60%']**. I'm particularly drawn to [Company] because **[specific reason — research their blog or product]**.\n\nI'd welcome the chance to discuss how my background contributes to your team's goals.\n\nBest regards,\n[Your Name] | [LinkedIn] | [GitHub]\n---\n\n**Tips:** Keep under 250 words. Customize paragraphs 2–3 for every application.`;
  }

  // ── LinkedIn / GitHub ────────────────────────────────────────────────
  if(/linkedin|github|portfolio|profile|online presence/.test(q)){
    return `🌐 **Online Profile Optimization**\n\n**LinkedIn:**\n□ Professional headshot — 7x more profile views\n□ Headline: "[Role] | [Skill 1] | [Skill 2] | Open to remote"\n□ About: 3 paragraphs — who you are, what you build, what you seek\n□ Every job: 3–5 bullet points with numbers and impact\n□ Post 1 technical article/week — massive recruiter visibility\n\n**GitHub:**\n□ Profile README.md with your skills, projects, and contact\n□ Pin 6 best repos — each needs a clear README + live demo link\n□ 5+ commits per week — green activity graph signals to recruiters\n□ Add tech stack badges to every repo\n\n**Portfolio site:** Vercel + Next.js (free hosting, takes 1 day to set up)`;
  }

  // ── Skill gap / roadmap ──────────────────────────────────────────────
  if(/gap|missing|learn|roadmap|what.*learn|where.*start/.test(q)){
    if(!ms.length&&!sk.length) return 'Upload your resume first and I\'ll build you a personalized skill gap roadmap!';
    if(!ms.length) return '✅ Strong profile! Your resume covers the key skills. Focus on deepening expertise and building standout portfolio projects.';
    return `📈 **Your Skill Gap Roadmap**\n\n**Top skills to add:**\n`+
      ms.slice(0,5).map((s,i)=>`\n${i+1}. **${s.toUpperCase()}** — ⏱ ${TIME[s]||'3–5 wks'}\n   ${WHY[s]||'High-value skill for your career track'}`).join('\n')+
      `\n\n**Start today:** ${ms[0]?ms[0].toUpperCase():'Your top gap skill'} — use freeCodeCamp, Coursera, or official docs. Build one real project to prove the skill.`;
  }

  // ── Default helpful response ─────────────────────────────────────────
  return `👋 **CareerPilot AI**${sc?` — Score: ${sc}/100`:''}\n\n`+
    `I can help you with anything career-related:\n\n`+
    `• **"Can I add [skill/cert]?"** — I'll tell you if it's worth it and how\n`+
    `• **"Improve my CV"** — specific, actionable edits\n`+
    `• **"Mock interview"** — practice with real questions for your stack\n`+
    `• **"Salary guide"** — Pakistan + remote rates for your level\n`+
    `• **"Career path"** — best roles for your skill set\n`+
    `• **"Skill gap"** — what to learn next and in what order\n`+
    `• **"Write cover letter"** — ready-to-send template\n\n`+
    `💡 *For full AI answers, add your Anthropic API key — I'll ask you when needed.*\n\nWhat would you like help with?`;
}

/* ═══════════════════════════════════════════════════
   CHAT RENDERING
═══════════════════════════════════════════════════ */
function appendMsg(role,text,md=false){
  const box=document.getElementById('chatMsgs');
  const w=document.createElement('div');
  w.className=`msg ${role==='user'?'u':'a'}`;
  if(role==='ai'){const s=document.createElement('div');s.className='msender';s.textContent='CareerPilot AI';w.appendChild(s);}
  const b=document.createElement('div');
  if(md) b.innerHTML=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  else b.textContent=text;
  w.appendChild(b);
  const t=document.createElement('div');
  t.className='mtime';
  t.textContent=new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'});
  w.appendChild(t);
  box.appendChild(w);
  box.scrollTop=box.scrollHeight;
}

async function streamMsg(text){
  const box=document.getElementById('chatMsgs');
  const w=document.createElement('div'); w.className='msg a';
  const sn=document.createElement('div'); sn.className='msender'; sn.textContent='CareerPilot AI';
  const body=document.createElement('div');
  const caret=document.createElement('span'); caret.className='caret';
  body.appendChild(caret);
  w.appendChild(sn); w.appendChild(body);
  box.appendChild(w);

  for(const part of text.split(/(\*\*[^*]+\*\*)/g)){
    if(part.startsWith('**')&&part.endsWith('**')){
      const b=document.createElement('strong');
      for(const ch of part.slice(2,-2)){
        b.textContent+=ch; body.insertBefore(b,caret);
        box.scrollTop=box.scrollHeight; await sleep(13);
      }
    }else{
      for(const ch of part){
        body.insertBefore(document.createTextNode(ch),caret);
        box.scrollTop=box.scrollHeight;
        await sleep(ch==='\n'?35:17);
      }
    }
  }
  caret.remove();
  const t=document.createElement('div'); t.className='mtime';
  t.textContent=new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'});
  w.appendChild(t);
}

function showTyping(){const ti=document.getElementById('typingInd');document.getElementById('chatMsgs').appendChild(ti);ti.classList.add('on');document.getElementById('chatMsgs').scrollTop=9999;}
function hideTyping(){document.getElementById('typingInd').classList.remove('on');}
function hideWelcome(){const w=document.getElementById('welcome');if(w)w.style.display='none';}

/* ═══════════════════════════════════════════════════
   DOWNLOAD PDF REPORT (browser-side with jsPDF)
═══════════════════════════════════════════════════ */
async function dlReport(){
  if(!RD){showToast('⚠️ Analyze a resume first!');return;}
  const btn=document.getElementById('rptBtn');
  btn.innerHTML=`<span class="dl-wrap"><span class="dl"></span><span class="dl"></span><span class="dl"></span></span> Generating PDF…`;
  btn.disabled=true;

  try{
    if(!window.jspdf) await loadJS('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,M=18,CW=W-M*2;
    const now=new Date();
    const rid=`CPR-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;

    const scoreCol=RD.score>=70?[52,211,153]:RD.score>=50?[251,191,36]:[248,113,113];

    // Header
    doc.setFillColor(8,13,24); doc.rect(0,0,W,38,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(22);
    doc.setTextColor(79,142,247); doc.text('CareerPilot AI',M,15);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.setTextColor(148,163,184); doc.text('AI Career Intelligence Platform  ·  Powered by Claude AI',M,22);
    doc.text('Developed by Muhammad Uzair  ·  NLP & Machine Learning Domain',M,28);
    doc.setFontSize(8);
    doc.text(`Report ID: ${rid}`,W-M,16,{align:'right'});
    doc.text(`Generated: ${now.toLocaleDateString('en-PK',{year:'numeric',month:'long',day:'numeric'})}`,W-M,22,{align:'right'});
    doc.text(`at ${now.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}`,W-M,27,{align:'right'});

    let y=46;
    const section=(title)=>{
      doc.setFillColor(20,32,65); doc.rect(M,y,CW,8,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
      doc.setTextColor(91,156,246); doc.text(title,M+3,y+5.5);
      y+=11;
    };
    const bodyText=(text,color=[51,65,85])=>{
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      doc.setTextColor(...color);
      const lines=doc.splitTextToSize(text,CW-4);
      doc.text(lines,M+2,y); y+=lines.length*5+2;
    };
    const bullet=(text,color=[100,116,139])=>{
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
      doc.setTextColor(...color);
      const lines=doc.splitTextToSize('▸  '+text,CW-8);
      doc.text(lines,M+4,y); y+=lines.length*5;
    };
    const HR=()=>{doc.setDrawColor(226,232,240);doc.setLineWidth(0.3);doc.line(M,y,W-M,y);y+=4;};
    const grade=RD.score>=85?'A':RD.score>=75?'B+':RD.score>=65?'B':RD.score>=55?'C+':RD.score>=45?'C':'D';

    // Section 1: Performance
    section('01  CANDIDATE PERFORMANCE OVERVIEW');
    doc.setFont('helvetica','bold'); doc.setFontSize(42);
    doc.setTextColor(...scoreCol); doc.text(String(RD.score),M+12,y+14,{align:'center'});
    doc.setFontSize(11); doc.setTextColor(148,163,184); doc.text('/100',M+20,y+14);
    doc.setFontSize(9); doc.setTextColor(148,163,184);
    doc.text(`Grade: ${grade}`,M,y+20);
    doc.text(`Status: ${RD.score>=70?'✓ Strong — Job Ready':RD.score>=50?'⚠ Moderate':'✗ Needs Work'}`,M,y+25);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100,116,139);
    doc.text(`Skills Found: ${RD.skills.length}`,M+50,y+8);
    doc.text(`Skills to Add: ${RD.missing_skills.length}`,M+50,y+14);
    doc.text(`LinkedIn: ${RD.meta.has_linkedin?'✓ Present':'✗ Missing'}`,M+50,y+20);
    doc.text(`GitHub: ${RD.meta.has_github?'✓ Present':'✗ Missing'}`,M+50,y+26);
    y+=35; HR();

    // Section 2: Skills
    section('02  DETECTED SKILLS ('+RD.skills.length+')');
    if(RD.skills.length){
      const rows=[];
      for(let i=0;i<RD.skills.length;i+=4) rows.push(RD.skills.slice(i,i+4));
      rows.forEach(row=>{
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(79,142,247);
        doc.text(row.map((s,i)=>`${String(rows.indexOf(row)*4+i+1).padStart(2,'0')}. ${s.toUpperCase()}`).join('    '),M,y);
        y+=5.5;
      });
    } else bodyText('No skills detected.',{});
    y+=2; HR();

    // Section 3: Missing
    section('03  RECOMMENDED SKILLS TO ADD ('+RD.missing_skills.length+')');
    const mis3=[];
    for(let i=0;i<Math.min(RD.missing_skills.length,8);i+=4) mis3.push(RD.missing_skills.slice(i,i+4));
    mis3.forEach(row=>{
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(248,113,113);
      doc.text(row.map((s,i)=>`${String(mis3.indexOf(row)*4+i+1).padStart(2,'0')}. ${s.toUpperCase()}`).join('    '),M,y);
      y+=5.5;
    });
    y+=2; HR();

    // Section 4: Recommendation
    section('04  AI RECOMMENDATION');
    bodyText(RD.recommendation,[51,65,85]);
    y+=2;
    if(RD.meta){
      if(!RD.meta.has_linkedin) bullet('Add your LinkedIn profile URL to your resume',[248,113,113]);
      if(!RD.meta.has_github)   bullet('Add your GitHub profile URL to showcase projects',[248,113,113]);
    }
    HR();

    // Section 5: Action Plan
    section('05  30-DAY ACTION PLAN');
    const plan=[
      ['Week 1','Quantify every achievement (add %, numbers, impact metrics)'],
      ['Week 1','Add LinkedIn and GitHub URLs prominently on your CV'],
      ['Week 2','Write a strong 3-line professional summary section at the top'],
      ['Week 2',`Start learning '${RD.missing_skills[0]||'top missing skill'}' — use Coursera or freeCodeCamp`],
      ['Week 3','Build and deploy one portfolio project showcasing your strongest skill'],
      ['Week 4','Apply to 5 tailored roles with customized CV per job description'],
    ];
    plan.forEach(([week,task])=>{
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(79,142,247);
      doc.text(week+':',M,y);
      doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
      doc.text(task,M+17,y); y+=5.5;
    });
    y+=2; HR();

    // Section 6: Salary
    section('06  MARKET BENCHMARKS — PAKISTAN 2024');
    const sal=[
      ['Junior Developer',    'PKR 60K–120K/month',  '$15–35/hr'],
      ['Mid-level Developer', 'PKR 120K–300K/month', '$35–75/hr'],
      ['Senior Developer',    'PKR 300K–650K/month', '$75–130/hr'],
      ['AI/ML Engineer',      'PKR 200K–800K/month', '$80–200/hr'],
    ];
    sal.forEach(([role,pkr,usd])=>{
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(79,142,247);
      doc.text(role+':',M,y);
      doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
      doc.text(pkr+'  |  Remote: '+usd,M+42,y); y+=5.5;
    });

    // Footer
    doc.setFillColor(8,13,24); doc.rect(0,286,W,11,'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(79,100,140);
    doc.text('CareerPilot AI  ·  AI Career Intelligence Platform  ·  Muhammad Uzair  ·  © '+now.getFullYear(),W/2,291,{align:'center'});
    doc.text('Report ID: '+rid+'  ·  For personal use only',W/2,296,{align:'center'});

    doc.save(`CareerPilot_Report_${now.toISOString().slice(0,10)}.pdf`);
    showToast('✅ Professional PDF report downloaded!');
  }catch(err){
    showToast('❌ '+err.message);
    console.error(err);
  }finally{
    btn.innerHTML='<span class="bi">📥</span> Download PDF Report';
    btn.disabled=false;
  }
}

/* ═══════════════════════════════════════════════════
   RESET
═══════════════════════════════════════════════════ */
function resetAll(){
  RD=null; HIST=[]; window._SYS=null;
  ['scoreCard','matchCard','recCard'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('rptBtn').style.display='none';
  document.getElementById('skillsGrid').style.display='none';
  document.getElementById('chartArea').style.display='flex';
  document.getElementById('skillChart').style.display='none';
  document.getElementById('chCtx').style.display='none';
  document.getElementById('welcome').style.display='block';
  document.getElementById('gapContent').innerHTML=`<div class="empty-st" style="padding:40px 20px"><div class="empty-ic">🗺️</div><div class="empty-tl">Upload your resume to get your personalized roadmap</div></div>`;
  const sc=document.getElementById('statusChip');
  sc.textContent='No Resume'; sc.classList.remove('ok');
  dzFn.textContent=''; dzEm.textContent='📁';
  analyzeBtn.disabled=true; analyzeBtn.innerHTML='<span class="bi">⚡</span> Analyze Resume';
  if(CHART){CHART.destroy();CHART=null;}
  document.querySelectorAll('.msg').forEach(m=>m.remove());
  showToast('🔄 Reset complete');
}

/* ═══════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════ */
function toggleTheme(){
  const h=document.documentElement;
  const dark=h.dataset.theme==='dark';
  h.dataset.theme=dark?'light':'dark';
  document.getElementById('themeBtn').textContent=dark?'☀️':'🌙';
  if(CHART&&RD) renderChart(RD.skills,CTYPE);
}

/* ═══════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════ */
function showToast(m){
  const t=document.getElementById('toast');
  t.textContent=m; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3500);
}
function animN(el,a,b,dur){
  const s=performance.now();
  (function f(t){const p=Math.min((t-s)/dur,1);el.textContent=Math.floor(p*(b-a)+a);if(p<1)requestAnimationFrame(f);})(performance.now());
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

/* ═══════════════════════════════════════════════════
   TEXTAREA: auto-resize + Enter to send
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  const ta=document.getElementById('chatTa');
  ta.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,110)+'px';});
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}});
});