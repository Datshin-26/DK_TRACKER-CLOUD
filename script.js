(() => {
const $ = id => document.getElementById(id);
const KEY = 'dk-hab-track-v1';
const API_URL = '/api/state';
const CATS = ['Health','Fitness','Study','Work','Finance','Reading','Meditation'];
const CAT_COL = {Health:'#ea580c',Fitness:'#f59e0b',Study:'#c2410c',Work:'#fb923c',Finance:'#b45309',Reading:'#fdba74',Meditation:'#9a3412'};
const LEVELS = ['Explorer','Achiever','Challenger','Champion','Master','Legend'];
const BADGES = [
  {e:'🌱',n:'Beginner',d:'1 Day Completed',xp:50,t:1},{e:'🔥',n:'Consistent Performer',d:'7-Day Streak',xp:150,t:7},
  {e:'⚡',n:'Habit Builder',d:'15-Day Streak',xp:300,t:15},{e:'👑',n:'Discipline Master',d:'30-Day Streak',xp:500,t:30},
  {e:'🚀',n:'Productivity Expert',d:'100-Day Streak',xp:1000,t:100},{e:'🏆',n:'Habit Champion',d:'365-Day Streak',xp:5000,t:365}];
const QUOTES = [['We are what we repeatedly do. Excellence, then, is not an act, but a habit.','Aristotle'],['Motivation gets you started. Habit keeps you going.','Jim Ryun'],['Small daily improvements are the key to staggering long-term results.','Robin Sharma'],['You do not rise to the level of your goals. You fall to the level of your systems.','James Clear']];
let S = load();
let calMonth = new Date(), selDay = ymd(new Date()), editId = null;
let syncTimer;
let pendingSync = Promise.resolve();

function fresh(){ return {habits:[],logs:{},moods:{},journal:{},xp:0,coins:0,activity:[],theme:'light',name:'DK User'}; }
function load(){ try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)||'{}')); } catch(e){ return fresh(); } }
function setSyncStatus(message){ $('syncStatus').textContent = message; }
function syncSnapshot(snapshot){
  pendingSync = pendingSync.then(async () => {
    const response = await fetch(API_URL, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:snapshot
    });
    if(!response.ok) throw new Error(`Save failed (${response.status})`);
    setSyncStatus('Synced');
  }).catch(error => {
    setSyncStatus('Offline');
    toast(`Backend sync failed: ${error.message}. Your browser copy is kept.`);
  });
  return pendingSync;
}
function save(){
  const snapshot = JSON.stringify(S);
  try {
    localStorage.setItem(KEY, snapshot);
  } catch(e) {
    setSyncStatus('Browser save failed');
    toast('Could not save a local copy of your data.');
  }
  setSyncStatus('Saving…');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncSnapshot(snapshot), 250);
}
function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function addDays(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
const today = () => ymd(new Date());
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = m => { const t=$('toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); };
const active = () => S.habits.filter(h => !h.archived);
const isDone = (id,d) => !!(S.logs[d] && S.logs[d][id] && S.logs[d][id].done);

function streak(id){ let n=0, d=new Date(); if(!isDone(id,ymd(d))) d=addDays(d,-1); while(isDone(id,ymd(d))){ n++; d=addDays(d,-1);} return n; }
function longest(id){ const ds = Object.keys(S.logs).filter(k=>isDone(id,k)).sort(); let best=0,run=0,prev=null;
  ds.forEach(k=>{ const dt=new Date(k+'T00:00:00'); run = prev && Math.round((dt-prev)/864e5)===1 ? run+1 : 1; best=Math.max(best,run); prev=dt; }); return best; }
const bestStreak = () => S.habits.reduce((m,h)=>Math.max(m,longest(h.id)),0);
const totalDone = () => Object.values(S.logs).reduce((a,l)=>a+Object.values(l).filter(x=>x.done).length,0);
const pct = d => { const a=active(); if(!a.length) return 0; return Math.round(a.filter(h=>isDone(h.id,d)).length/a.length*100); };
const lvlInfo = () => { const lvl=Math.floor(S.xp/600)+1; return {lvl, name:LEVELS[Math.min(lvl-1,LEVELS.length-1)], cur:S.xp%600}; };
function log(msg){ S.activity.unshift(msg); S.activity = S.activity.slice(0,6); }

/* ---------- habit actions ---------- */
function toggle(id,d){
  const h = S.habits.find(x=>x.id===id); if(!h) return;
  S.logs[d] = S.logs[d] || {}; const cur = S.logs[d][id] || {done:false,time:0};
  cur.done = !cur.done; S.logs[d][id] = cur;
  const before = lvlInfo().lvl;
  if(cur.done){ S.xp += 50; S.coins += 10; log(`Completed <b>${esc(h.name)}</b> (+50 XP)`);
    const s = streak(id); if(s>0 && s%5===0) log(`Reached ${s}-day streak on <b>${esc(h.name)}</b>`); }
  else { S.xp = Math.max(0,S.xp-50); S.coins = Math.max(0,S.coins-10); }
  save(); renderAll();
  if(cur.done && lvlInfo().lvl>before) toast('🎉 Level up! You are now Level '+lvlInfo().lvl);
}
function logTime(id,d){ const v = prompt('Minutes spent on this habit:', (S.logs[d]&&S.logs[d][id]&&S.logs[d][id].time)||0); if(v===null) return;
  S.logs[d] = S.logs[d]||{}; const c = S.logs[d][id]||{done:false,time:0}; c.time = Math.max(0,parseInt(v)||0); S.logs[d][id]=c; save(); renderAll(); }
function habitRow(h,d){
  const done = isDone(h.id,d), t = (S.logs[d]&&S.logs[d][h.id]&&S.logs[d][h.id].time)||0;
  return `<div class="habit-row ${done?'done':''}"><input type="checkbox" data-t="${h.id}" data-d="${d}" ${done?'checked':''} aria-label="Complete ${esc(h.name)}">
    <div class="meta"><div class="hn">${esc(h.name)}</div><span class="tag">${h.category}</span><span class="tag ${h.priority}">${h.priority}</span><small>${h.target} ${esc(h.unit)}${t?' • '+t+' min logged':''}</small></div>
    <span class="streak">🔥 ${streak(h.id)}</span><button class="btn sm" data-log="${h.id}" data-d="${d}">Log</button></div>`;
}
function bindRows(root){
  root.querySelectorAll('[data-t]').forEach(c=>c.onchange=()=>toggle(c.dataset.t,c.dataset.d));
  root.querySelectorAll('[data-log]').forEach(b=>b.onclick=()=>logTime(b.dataset.log,b.dataset.d));
}

/* ---------- renderers ---------- */
function renderDash(){
  const a = active(), done = a.filter(h=>isDone(h.id,today())).length, sc = pct(today()), li = lvlInfo();
  $('scoreVal').textContent = sc+'%'; $('scoreBar').style.width = sc+'%';
  $('doneVal').textContent = done; $('doneSub').textContent = 'of '+a.length+' habits';
  $('activeVal').textContent = a.length; $('bestStreak').textContent = bestStreak();
  $('statusVal').textContent = a.length && done===a.length ? 'COMPLETE' : 'ACTIVE';
  $('lvlTitle').textContent = `Level ${li.lvl} ${li.name}`; $('coinVal').textContent = S.coins;
  $('xpBar').style.width = (li.cur/600*100)+'%'; $('xpText').textContent = `${li.cur} / 600 XP`; $('xpLeft').textContent = `${600-li.cur} XP to Level Up!`;
  $('hdrLvl').textContent = 'Lvl '+li.lvl; $('hdrName').textContent = S.name;
  $('todayList').innerHTML = a.length ? a.map(h=>habitRow(h,today())).join('') : '<div class="empty">No habits yet. Add your first habit to get started.</div>';
  bindRows($('todayList'));
  const q = QUOTES[new Date().getDate()%QUOTES.length]; $('quoteText').textContent = '"'+q[0]+'"'; $('quoteBy').textContent = '— '+q[1];
  $('activity').innerHTML = S.activity.length ? S.activity.map(x=>`<li>${x}</li>`).join('') : '<li>No activity yet</li>';
  $('insightText').textContent = insight();
}
function insight(){
  const a = active(); if(!a.length) return 'Add a habit and complete it to start getting personalised insights.';
  const week = Array.from({length:7},(_,i)=>pct(ymd(addDays(new Date(),-i))));
  const avg = Math.round(week.reduce((x,y)=>x+y,0)/7);
  const rows = a.map(h=>({h,c:Array.from({length:14},(_,i)=>isDone(h.id,ymd(addDays(new Date(),-i)))).filter(Boolean).length})).sort((x,y)=>x.c-y.c);
  if(avg>=80) return `Excellent! You averaged ${avg}% over the last 7 days. Keep the momentum going.`;
  if(rows[0].c<7) return `Your weakest habit is "${rows[0].h.name}" (${rows[0].c}/14 days). Try pairing it with a habit you never miss.`;
  return `You averaged ${avg}% this week. Aim to finish your high-priority habits before noon.`;
}
function renderHabits(){
  const q = $('hSearch').value.toLowerCase(), c = $('hCat').value, p = $('hPri').value;
  const list = S.habits.filter(h => h.name.toLowerCase().includes(q) && (c==='all'||h.category===c) && (p==='all'||h.priority===p));
  $('habitGrid').innerHTML = list.length ? list.map(h=>`<div class="card hcard ${h.archived?'arch':''}"><h4>${esc(h.name)}</h4>
    <span class="tag">${h.category}</span><span class="tag ${h.priority}">${h.priority}</span><span class="tag">${h.target} ${esc(h.unit)}</span>
    <p><small>Current streak: <b>${streak(h.id)}</b> • Longest: <b>${longest(h.id)}</b></small></p>
    <div class="acts"><button class="btn sm" data-edit="${h.id}">Edit</button><button class="btn sm" data-arch="${h.id}">${h.archived?'Restore':'Archive'}</button><button class="btn sm danger" data-del="${h.id}">Delete</button></div></div>`).join('')
    : '<div class="empty card" style="grid-column:1/-1">No habits match your filters.</div>';
  $('habitGrid').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(b.dataset.edit));
  $('habitGrid').querySelectorAll('[data-arch]').forEach(b=>b.onclick=()=>{ const h=S.habits.find(x=>x.id===b.dataset.arch); h.archived=!h.archived; save(); renderAll(); });
  $('habitGrid').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ if(confirm('Delete this habit and its history?')){ S.habits=S.habits.filter(x=>x.id!==b.dataset.del); save(); renderAll(); } });
}
function renderCal(){
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $('monthTitle').textContent = calMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const first = new Date(y,m,1), start = addDays(first,-first.getDay()); let html='';
  for(let i=0;i<42;i++){ const d=addDays(start,i), k=ymd(d), p=pct(k);
    html += `<button class="cal-cell ${d.getMonth()!==m?'out':''} ${k===today()?'today':''} ${k===selDay?'sel':''}" data-day="${k}">${d.getDate()}<span class="dot ${p===100?'f':p>0?'p':''}"></span></button>`; }
  $('calGrid').innerHTML = html;
  $('calGrid').querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{ selDay=b.dataset.day; renderCal(); });
  $('agendaTitle').textContent = selDay===today() ? 'Today' : new Date(selDay+'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const a = active(); $('agendaList').innerHTML = a.length ? a.map(h=>habitRow(h,selDay)).join('') : '<div class="empty">No habits to show.</div>'; bindRows($('agendaList'));
}
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function renderCharts(){
  // trend line
  const c = $('trendChart'), x = c.getContext('2d'), W=c.width, H=c.height, pad=36;
  x.clearRect(0,0,W,H); x.font='13px sans-serif'; x.fillStyle=cssVar('--mute'); x.strokeStyle=cssVar('--line');
  const days = Array.from({length:7},(_,i)=>addDays(new Date(),i-6)), vals = days.map(d=>pct(ymd(d)));
  for(let g=0;g<=4;g++){ const yy=pad+(H-2*pad)*g/4; x.beginPath(); x.moveTo(pad,yy); x.lineTo(W-10,yy); x.stroke(); x.fillText((100-g*25)+'%',2,yy+4); }
  const px = i => pad+i*(W-pad-20)/6, py = v => H-pad-(H-2*pad)*v/100;
  x.strokeStyle='#ea580c'; x.lineWidth=3; x.beginPath(); vals.forEach((v,i)=>i?x.lineTo(px(i),py(v)):x.moveTo(px(i),py(v))); x.stroke();
  x.fillStyle='rgba(249,115,22,.15)'; x.lineTo(px(6),H-pad); x.lineTo(px(0),H-pad); x.closePath(); x.fill();
  vals.forEach((v,i)=>{ x.fillStyle='#c2410c'; x.beginPath(); x.arc(px(i),py(v),5,0,7); x.fill(); x.fillStyle=cssVar('--mute'); x.fillText(days[i].toLocaleDateString('en-US',{weekday:'short'}),px(i)-14,H-12); });
  // category donut
  const c2 = $('catChart'), y2 = c2.getContext('2d'); y2.clearRect(0,0,c2.width,c2.height);
  const counts = CATS.map(k=>active().filter(h=>h.category===k).length), tot = counts.reduce((a,b)=>a+b,0);
  const cx=c2.width/2, cy=c2.height/2, r=95;
  if(!tot){ y2.fillStyle=cssVar('--mute'); y2.font='15px sans-serif'; y2.fillText('No habits yet',cx-45,cy); }
  else { let a0=-Math.PI/2; counts.forEach((n,i)=>{ if(!n) return; const a1=a0+n/tot*2*Math.PI; y2.beginPath(); y2.moveTo(cx,cy); y2.arc(cx,cy,r,a0,a1); y2.fillStyle=CAT_COL[CATS[i]]; y2.fill(); a0=a1; });
    y2.beginPath(); y2.arc(cx,cy,55,0,7); y2.fillStyle=cssVar('--panel'); y2.fill(); y2.fillStyle=cssVar('--text'); y2.font='bold 22px sans-serif'; y2.textAlign='center'; y2.fillText(tot,cx,cy+4); y2.textAlign='start'; }
  $('catLegend').innerHTML = CATS.map((k,i)=>counts[i]?`<span><i style="background:${CAT_COL[k]}"></i>${k} (${counts[i]})</span>`:'').join('');
  // heatmap
  const end = new Date(), start = addDays(end,-364-end.getDay()); let h='';
  for(let i=0;i<365+end.getDay()+1;i++){ const d=addDays(start,i); if(d>end) break; const p=pct(ymd(d)); h+=`<div class="hc ${p>=100?'l4':p>=67?'l3':p>=34?'l2':p>0?'l1':''}" title="${ymd(d)}: ${p}%"></div>`; }
  $('heatmap').innerHTML = h;
}
function renderBadges(){
  const best = Math.max(bestStreak(), 0), n = totalDone();
  $('badgeGrid').innerHTML = BADGES.map((b,i)=>{ const on = i===0 ? n>=1 : best>=b.t;
    return `<div class="card badge-card ${on?'on':''}"><div class="em">${b.e}</div><h4>${b.n}</h4><small>${b.d}</small><div class="xp">+${b.xp} XP</div><small>${on?'✓ Unlocked':'Locked'}</small></div>`; }).join('');
}
function renderMood(){
  document.querySelectorAll('#moods button').forEach(b=>b.classList.toggle('sel', S.moods[today()]===b.dataset.m));
  $('journal').value = S.journal[today()] || '';
}
function renderReports(){
  const rows=[]; Object.keys(S.logs).sort().reverse().forEach(d=>Object.entries(S.logs[d]).forEach(([id,v])=>{ const h=S.habits.find(x=>x.id===id); if(h) rows.push([d,h.name,h.category,v.done?'Completed':'Missed',(v.time||0)+' min']); }));
  window._rows = rows;
  $('reportBody').innerHTML = rows.length ? rows.map(r=>`<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td>${r[2]}</td><td class="${r[3]==='Completed'?'st-done':'st-miss'}">${r[3]}</td><td>${r[4]}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No logs yet.</td></tr>';
}
function renderAll(){ renderDash(); renderHabits(); renderCal(); renderCharts(); renderBadges(); renderMood(); renderReports(); }

/* ---------- modal ---------- */
function openModal(id){
  editId = id || null; const h = S.habits.find(x=>x.id===id);
  $('modalTitle').textContent = h ? 'Edit Habit' : 'Add New Habit';
  $('fName').value = h?h.name:''; $('fCat').value = h?h.category:'Health'; $('fPri').value = h?h.priority:'Medium'; $('fTarget').value = h?h.target:1; $('fUnit').value = h?h.unit:'times';
  $('habitModal').classList.remove('hidden'); $('fName').focus();
}
const closeModal = () => $('habitModal').classList.add('hidden');
function saveHabit(){
  const name = $('fName').value.trim(); if(!name){ toast('Enter a habit name'); return; }
  const data = {name, category:$('fCat').value, priority:$('fPri').value, target:Math.max(1,+$('fTarget').value||1), unit:$('fUnit').value.trim()||'times'};
  if(editId) Object.assign(S.habits.find(x=>x.id===editId), data);
  else S.habits.push(Object.assign({id:'h'+Date.now()+Math.random().toString(36).slice(2,6), archived:false, created:today()}, data));
  save(); closeModal(); renderAll(); toast('Habit saved');
}

/* ---------- AI assistant (rule-based parser) ---------- */
const CAT_WORDS = {Fitness:['run','jog','gym','workout','exercise','pushup','push-up','yoga','walk','swim','cycle','km'],Health:['water','sleep','eat','vitamin','fruit','veggie','diet','glass'],Study:['study','learn','course','revise','homework','practice','code','coding'],Work:['work','project','email','meeting','focus','deep work'],Finance:['save','budget','invest','expense','money','spend'],Reading:['read','book','page','article'],Meditation:['meditate','meditation','mindful','breath','gratitude']};
function parseHabit(t){
  const low = t.toLowerCase(); let cat='Health', best=0;
  for(const [c,ws] of Object.entries(CAT_WORDS)){ const n = ws.filter(w=>low.includes(w)).length; if(n>best){best=n;cat=c;} }
  const pri = /high|urgent|important|must/.test(low) ? 'High' : /low|optional|easy/.test(low) ? 'Low' : 'Medium';
  const m = low.match(/(\d+(?:\.\d+)?)\s*(km|kms|miles?|pages?|mins?|minutes?|hours?|hrs?|glasses?|liters?|litres?|reps?|times?|rupees?|rs|steps)?/);
  const target = m ? +m[1] : 1; let unit = m && m[2] ? m[2].replace(/s$/,'') : 'times';
  if(unit==='min') unit='mins'; if(unit==='minute') unit='mins';
  let name = t.replace(/,?\s*(high|medium|low)\s*priority/ig,'').replace(/\b(every|each)\s+(day|morning|evening|night|week)\b/ig,'').replace(/\bdaily\b/ig,'').replace(/[.,;]+$/,'').trim();
  name = name.charAt(0).toUpperCase()+name.slice(1) || 'New Habit';
  return {name, category:cat, priority:pri, target, unit};
}
function aiGenerate(){
  const t = $('aiInput').value.trim(); if(!t){ toast('Type a habit request first'); return; }
  const h = parseHabit(t), out = $('aiOut');
  out.innerHTML = `<h4>${esc(h.name)}</h4><span class="tag">${h.category}</span><span class="tag ${h.priority}">${h.priority}</span><span class="tag">${h.target} ${esc(h.unit)}</span>
    <div class="btns mt"><button class="btn primary" id="aiAdd">Add to My Habits</button><button class="btn ghost" id="aiEdit">Edit First</button></div>`;
  out.classList.remove('hidden');
  $('aiAdd').onclick = () => { S.habits.push(Object.assign({id:'h'+Date.now(),archived:false,created:today()},h)); save(); renderAll(); out.classList.add('hidden'); $('aiInput').value=''; toast('Habit added'); show('dashboard'); };
  $('aiEdit').onclick = () => { openModal(); $('fName').value=h.name; $('fCat').value=h.category; $('fPri').value=h.priority; $('fTarget').value=h.target; $('fUnit').value=h.unit; };
}

/* ---------- exports ---------- */
function download(name,text,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); }
function exportCSV(){ const rows=[['Date','Habit Name','Category','Status','Time Spent'],...(window._rows||[])]; download('dk-hab-track-report.csv', rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv'); }
function exportPDF(){
  const w = window.open('','_blank'); if(!w){ toast('Allow pop-ups to download the summary'); return; }
  const a = active(), li = lvlInfo();
  w.document.write(`<html><head><title>DK-HAB_TRACK Summary</title><style>body{font-family:Segoe UI,sans-serif;padding:30px;color:#3b1d08}h1{color:#ea580c}table{border-collapse:collapse;width:100%}td,th{border:1px solid #fed7aa;padding:6px 10px;text-align:left}th{background:#ffedd5}</style></head><body>
  <h1>DK-HAB_TRACK - Habit Summary</h1><p>${esc(S.name)} • Generated ${new Date().toLocaleDateString()}</p>
  <p>Level ${li.lvl} ${li.name} • ${S.xp} XP • ${S.coins} coins • Best streak ${bestStreak()} days • Today ${pct(today())}%</p>
  <h3>Active Habits</h3><table><tr><th>Habit</th><th>Category</th><th>Priority</th><th>Streak</th></tr>${a.map(h=>`<tr><td>${esc(h.name)}</td><td>${h.category}</td><td>${h.priority}</td><td>${streak(h.id)}</td></tr>`).join('')}</table>
  <h3>Recent Logs</h3><table><tr><th>Date</th><th>Habit</th><th>Status</th><th>Time</th></tr>${(window._rows||[]).slice(0,40).map(r=>`<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}</table>
  <script>onload=()=>print()<\/script></body></html>`); w.document.close();
}

/* ---------- navigation & events ---------- */
function show(v){
  document.querySelectorAll('.view').forEach(s=>s.classList.toggle('active',s.id===v));
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  if(v==='analytics') renderCharts(); scrollTo(0,0);
}
function applyTheme(){ document.documentElement.dataset.theme = S.theme; }
$('nav').onclick = e => { const b=e.target.closest('button'); if(b) show(b.dataset.view); };
$('addHabitBtn').onclick = $('addHabitBtn2').onclick = () => openModal();
$('goAI').onclick = () => show('ai');
$('closeModal').onclick = $('cancelModal').onclick = closeModal; $('saveHabit').onclick = saveHabit;
$('habitModal').onclick = e => { if(e.target.id==='habitModal') closeModal(); };
document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
['hSearch','hCat','hPri'].forEach(i=>$(i).oninput=renderHabits);
$('prevM').onclick = () => { calMonth = new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1); renderCal(); };
$('nextM').onclick = () => { calMonth = new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1); renderCal(); };
$('todayM').onclick = () => { calMonth = new Date(); selDay = today(); renderCal(); };
$('moods').onclick = e => { const b=e.target.closest('button'); if(!b) return; S.moods[today()]=b.dataset.m; save(); renderMood(); toast('Mood saved: '+b.dataset.m); };
$('saveJournal').onclick = () => { S.journal[today()] = $('journal').value; save(); toast('Journal entry saved'); };
$('aiGen').onclick = aiGenerate; $('expCSV').onclick = exportCSV; $('expPDF').onclick = exportPDF;
$('themeBtn').onclick = () => { S.theme = S.theme==='dark'?'light':'dark'; save(); applyTheme(); renderCharts(); };
$('nameInput').value = S.name; $('nameInput').oninput = e => { S.name = e.target.value || 'DK User'; save(); $('hdrName').textContent = S.name; };
$('resetBtn').onclick = async () => {
  if(!confirm('Delete ALL data? This cannot be undone.')) return;
  S = fresh();
  const snapshot = JSON.stringify(S);
  try {
    localStorage.setItem(KEY, snapshot);
  } catch(error) {
    setSyncStatus('Browser save failed');
    toast('Could not save the reset locally.');
  }
  clearTimeout(syncTimer);
  setSyncStatus('Saving…');
  pendingSync = pendingSync.then(async () => {
    const response = await fetch(API_URL, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:snapshot
    });
    if(!response.ok) throw new Error(`Reset failed (${response.status})`);
    setSyncStatus('Synced');
    $('nameInput').value = S.name;
    applyTheme();
    renderAll();
    toast('All data has been reset.');
  }).catch(error => {
    setSyncStatus('Offline');
    toast(`Backend reset failed: ${error.message}. Your browser copy is reset.`);
  });
  await pendingSync;
};
async function initialize(){
  $('main').inert = true;
  setSyncStatus('Connecting…');
  try {
    const response = await fetch(API_URL);
    if(!response.ok) throw new Error(`Could not load data (${response.status})`);
    const result = await response.json();
    if(result.state && typeof result.state === 'object' && !Array.isArray(result.state)){
      S = Object.assign(fresh(), result.state);
      localStorage.setItem(KEY, JSON.stringify(S));
    } else if(localStorage.getItem(KEY)){
      save();
    }
    setSyncStatus('Connected');
  } catch(error) {
    setSyncStatus('Offline');
    toast(`Backend unavailable: ${error.message}. Using browser data.`);
  } finally {
    $('main').inert = false;
    $('nameInput').value = S.name;
    applyTheme();
    renderAll();
  }
}
initialize();
})();
