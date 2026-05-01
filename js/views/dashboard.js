/* ═══════════════════════════════════
   CÓDICE — dashboard.js
   Responsabilidad: Priority Engine, Dashboard, Horario (modo single), Clases (lista),
                    Progreso, Errores, Entrenamiento, Sesiones y gestión de clases (modo single).
   Depende de: storage.js, modules.js, router.js
   Expone: renderDashboard, renderHorario, renderClasses, renderProgress, renderErrors,
           renderTraining, renderSesiones, startSmartSession, calcPriority,
           getRankedClasses, getMastery, addError, saveClase, saveDivision, saveSesion
═══════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   PRIORITY ENGINE
═══════════════════════════════════════════════════════════════ */
function calcPriority(cls, data) {
  const clErrors = data.errors.filter(e => (e.source||'').includes(cls.nombre));
  const errCount = clErrors.length;
  const lastStudied = getLastStudied(cls, data);
  const daysSince = lastStudied ? (Date.now() - lastStudied) / 86400000 : 30;
  return (errCount * 2) + daysSince;
}
function getLastStudied(cls, data) {
  let latest = 0;
  if (cls.lastStudied && cls.lastStudied > latest) latest = cls.lastStudied;
  return latest;
}
function getPriorityLabel(score) {
  if (score >= 20) return {label:'Alta',   cls:'high',   icon:'🔴'};
  if (score >= 10) return {label:'Media',  cls:'medium', icon:'🟡'};
  return                  {label:'Baja',   cls:'low',    icon:'🟢'};
}
function getRankedClasses(data) {
  const all = [...data.classes];
  (data.divisions || []).forEach(d =>
    (d.classes||[]).forEach(c => { if (!all.find(x => x.id === c.id)) all.push(c); })
  );
  return all.map(c => ({...c, priority:calcPriority(c,data)}))
            .sort((a,b) => b.priority - a.priority);
}
function getAISuggestion(data) {
  const errors  = data.errors.filter(e => (Date.now()-(e.timestamp||0)) < 7*86400000);
  const ranked  = getRankedClasses(data);
  const weak    = ranked.filter(c => c.priority >= 10);
  if (errors.length > 5) return `Analizando ${errors.length} errores recientes · Enfócate en corrección`;
  if (weak.length > 0)   return `Repasa ${weak[0].nombre} · Tema prioritario detectado`;
  return `Todo va bien · Continúa estudiando`;
}
function getMastery(cls, data) {
  const exams = data.exams.filter(e =>
    e.titulo.toLowerCase().includes(cls.nombre.toLowerCase()) ||
    (e.desc||'').toLowerCase().includes(cls.nombre.toLowerCase())
  );
  if (!exams.length) return 0;
  let total = 0, correct = 0;
  exams.forEach(e => {
    if (e.resultados && e.resultados.length) {
      const r = e.resultados[e.resultados.length-1];
      correct += r.respuestas.filter(x => x.correcta).length;
      total   += r.respuestas.length;
    }
  });
  return total > 0 ? Math.round(correct/total*100) : 0;
}
function getMasteryLabel(pct) {
  if (pct >= 90) return {label:'Experto',     cls:'mastery-expert'};
  if (pct >= 70) return {label:'Competente',  cls:'mastery-proficient'};
  if (pct >= 40) return {label:'Aprendiendo', cls:'mastery-learning'};
  return               {label:'Débil',        cls:'mastery-weak'};
}

/* ═══════════════════════════════════════════════════════════════
   SMART DASHBOARD
═══════════════════════════════════════════════════════════════ */
function calcStreak(data) {
  const dates = new Set();
  [...data.classes, ...data.exams].forEach(x => {
    if (x.created || x.createdAt) dates.add(new Date(x.created || x.createdAt).toDateString());
  });
  const sorted = Array.from(dates).sort((a,b) => new Date(b)-new Date(a));
  const today  = new Date().toDateString();
  let streak = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { if (sorted[0] === today) streak++; else break; }
    else { const diff = (new Date(sorted[i-1]) - new Date(sorted[i])) / 86400000; if (diff===1) streak++; else break; }
  }
  return streak;
}
function getTodayScheduleClasses(data) {
  if (!data.schedules || !data.schedules.length) return [];
  const sched = data.activeScheduleId
    ? data.schedules.find(s => s.id === data.activeScheduleId)
    : data.schedules[0];
  if (!sched) return [];
  const todayKey = DAYS[new Date().getDay()];
  return ((sched.days && sched.days[todayKey]) || []).map(e => {
    const cls = data.classes.find(c => c.id === e.classId);
    return cls ? {...cls, time:e.time||''} : null;
  }).filter(Boolean);
}
function renderDashboard() {
  const data        = getModData(CURRENT_MODULE.id);
  const cfg         = MOD_TYPES[CURRENT_MODULE.type] || MOD_TYPES.general;
  const streak      = calcStreak(data);
  const todayName   = DAY_NAMES[new Date().getDay()];
  const todayClasses= getTodayScheduleClasses(data);
  const ranked      = getRankedClasses(data).slice(0, 6);
  const pendingExams= data.exams.filter(e => e.tipo ? true : (!e.resultados||!e.resultados.length));
  const recentErrors= data.errors.filter(e => (Date.now()-(e.timestamp||0)) < 7*86400000);

  return `<div class="fade">
    <div class="dash-header">
      <div class="dash-title">Buenos días 👋</div>
      <div class="dash-sub">${esc(CURRENT_MODULE.name)} · ${esc(todayName)}</div>
      <div class="dash-meta-row">
        ${streak>0 ? `<div class="streak-badge">🔥 ${streak} día${streak>1?'s':''} de racha</div>` : ''}
        <div class="today-badge">📅 ${esc(todayName)}</div>
      </div>
    </div>
    <div class="stat-row fade2">
      <div class="stat-box"><div class="stat-n">${data.classes.length}</div><div class="stat-l">Clases</div></div>
      ${cfg.features.includes('exams') ? `<div class="stat-box"><div class="stat-n">${data.exams.length}</div><div class="stat-l">Exámenes</div></div>` : ''}
      <div class="stat-box"><div class="stat-n" style="color:var(--redL)">${recentErrors.length}</div><div class="stat-l">Errores (7d)</div></div>
      <div class="stat-box"><div class="stat-n" style="color:var(--goldL)">${streak}</div><div class="stat-l">Racha 🔥</div></div>
    </div>
    <div class="card fade2" style="border-color:var(--goldBd);background:linear-gradient(135deg,var(--goldBg),rgba(199,154,56,.06))">
      <div class="card-head"><div><div class="card-title" style="color:var(--goldL)">🎯 ¿Qué estudiar hoy?</div></div></div>
      <p style="color:var(--txt2);margin-bottom:16px">${getAISuggestion(data)}</p>
      ${ranked.length > 0 ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        ${ranked.slice(0,3).map(c => `<span class="tag tag-gold">${esc(c.nombre)}</span>`).join('')}
      </div>` : ''}
    </div>
    <button class="smart-session-btn fade2" onclick="startSmartSession()">
      <div class="ssb-icon">🧠</div>
      <div class="ssb-text">
        <div class="ssb-title">Sesión Inteligente</div>
        <div class="ssb-desc">${getAISuggestion(data)}</div>
      </div>
      <div class="ssb-arrow">→</div>
    </button>
    ${todayClasses.length > 0 ? `
    <div class="today-classes fade3">
      <div class="tc-title">📅 Clases de hoy — ${esc(todayName)}</div>
      <div class="tc-grid">
        ${todayClasses.map(c => `<div class="tc-card" onclick="go('cl_${c.id}')">
          <div class="tc-dot" style="background:${c.color}"></div>
          <div class="tc-info"><div class="tc-name">${esc(c.nombre)}</div>${c.time?`<div class="tc-time">⏰ ${esc(c.time)}</div>`:''}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}
    ${pendingExams.length > 0 ? `
    <div class="card fade3" style="border-color:var(--redBd)">
      <div class="card-head">
        <div><div class="card-title" style="color:var(--redL)">📝 ${pendingExams.length} examen${pendingExams.length>1?'es':''} pendiente${pendingExams.length>1?'s':''}</div></div>
        <button class="btn btn-r" onclick="go('examenes')">Ver →</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${pendingExams.slice(0,3).map(e => `<span class="tag tag-r">${esc(e.titulo)}</span>`).join('')}
      </div>
    </div>` : ''}
    ${ranked.length > 0 ? `
    <div class="fade3">
      <div class="tc-title" style="margin-bottom:12px">🎯 Prioridades de Estudio</div>
      <div class="priority-grid">
        ${ranked.map(c => {
          const pLabel  = getPriorityLabel(c.priority);
          const mastery = getMastery(c, data);
          const maxP    = Math.max(...ranked.map(x => x.priority), 1);
          const errCount= data.errors.filter(e => (e.source||'').includes(c.nombre)).length;
          return `<div class="priority-card ${pLabel.cls}" onclick="go('cl_${c.id}')">
            <div class="pc-top">
              <div class="pc-name">${esc(c.nombre)}</div>
              <div class="pc-priority">${pLabel.icon} ${pLabel.label}</div>
            </div>
            <div class="pc-bar"><div class="pc-bar-fill" style="width:${Math.min(c.priority/maxP*100,100)}%;background:${pLabel.cls==='high'?'var(--redL)':pLabel.cls==='medium'?'var(--gold)':'var(--greenL)'}"></div></div>
            <div class="pc-stats"><span>❌ ${errCount} errores</span><span>📊 ${mastery}% dominio</span></div>
          </div>`;
        }).join('')}
      </div>
    </div>` : `
    <div class="empty fade3">
      <div class="empty-icon">📚</div>
      <h3>Sin clases aún</h3>
      <p>Crea clases y agrega contenido para ver tus prioridades</p>
      <button class="btn btn-gold" onclick="openM('mClase')" style="margin-top:16px">📘 Crear primera clase</button>
    </div>`}
  </div>`;
}

/* ── SMART SESSION ── */
function startSmartSession() {
  const data      = getModData(CURRENT_MODULE.id);
  const ranked    = getRankedClasses(data);
  const questions = [];
  ranked.forEach(c => {
    (c.bloques||[]).forEach(b => {
      if (b.quiz && b.quiz.pregunta)
        questions.push({question:b.quiz.pregunta,options:b.quiz.opciones,correct:b.quiz.correcta,source:c.nombre,priority:c.priority});
    });
    (c.weeks||[]).forEach(w => {
      (w.bloques||[]).forEach(b => {
        if (b.quiz && b.quiz.pregunta)
          questions.push({question:b.quiz.pregunta,options:b.quiz.opciones,correct:b.quiz.correcta,source:c.nombre,priority:c.priority});
      });
    });
  });
  if (!questions.length) { toast('Agrega quizzes a tus clases primero', 'err'); return; }
  questions.sort((a,b) => b.priority - a.priority);
  const selected = questions.slice(0, Math.min(questions.length, 15));
  selected.sort(() => Math.random() - .5);
  trainingSession = {questions:selected, idx:0, answers:[], score:0, wrongQueue:[], isSmartSession:true};
  go('training');
}

/* ── HORARIO VIEW ── */

let _pickSchedMode = 'single';

/* ── CLASSES VIEW ── */

/* ── TRAINING VIEW ── */
function renderTraining() {
  if (trainingSession) return renderTrainingSession();
  const data = getModData(CURRENT_MODULE.id);
  const totalQ = data.classes.reduce((s,c) =>
    s + (c.bloques||[]).filter(b=>b.quiz).length +
    (c.weeks||[]).reduce((ws,w)=>ws+(w.bloques||[]).filter(b=>b.quiz).length,0), 0);
  return `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon sh-icon-v">🎯</div>
        <div><div class="sh-title">Entrenamiento</div>
        <div class="sh-meta">${totalQ} pregunta${totalQ!==1?'s':''} disponibles</div></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div class="card" style="cursor:pointer;border-color:var(--goldBd)" onclick="startTraining('all')">
        <div style="font-size:32px;margin-bottom:10px">🎲</div>
        <div class="card-title" style="color:var(--goldL)">Sesión Normal</div>
        <div class="card-meta">Preguntas aleatorias de todas las clases</div>
      </div>
      <div class="card" style="cursor:pointer;border-color:var(--blBd)" onclick="startSmartSession()">
        <div style="font-size:32px;margin-bottom:10px">🧠</div>
        <div class="card-title" style="color:var(--blueL)">Sesión Inteligente</div>
        <div class="card-meta">Prioriza temas débiles y errores recientes</div>
      </div>
    </div>
    ${totalQ === 0 ? `<div class="empty"><div class="empty-icon">🎯</div><h3>Sin preguntas aún</h3><p>Agrega quizzes a tus bloques de clase para entrenar</p></div>` : ''}
  </div>`;
}
function startTraining(mode) {
  const data = getModData(CURRENT_MODULE.id);
  const questions = [];
  data.classes.forEach(c => {
    (c.bloques||[]).forEach(b => { if(b.quiz&&b.quiz.pregunta) questions.push({question:b.quiz.pregunta,options:b.quiz.opciones,correct:b.quiz.correcta,source:c.nombre,priority:calcPriority(c,data)}); });
    (c.weeks||[]).forEach(w => { (w.bloques||[]).forEach(b => { if(b.quiz&&b.quiz.pregunta) questions.push({question:b.quiz.pregunta,options:b.quiz.opciones,correct:b.quiz.correcta,source:c.nombre,priority:calcPriority(c,data)}); }); });
  });
  if (!questions.length) { toast('No hay preguntas. Agrega quizzes a tus bloques.', 'err'); return; }
  const adapted = [];
  questions.forEach(q => { adapted.push(q); if(q.priority>=15) adapted.push({...q}); });
  adapted.sort(() => Math.random()-.5);
  trainingSession = {questions:adapted.slice(0,Math.min(adapted.length,20)), idx:0, answers:[], score:0, wrongQueue:[], isSmartSession:false};
  go('training');
}
function renderTrainingSession() {
  const s = trainingSession;
  if (s.idx >= s.questions.length) {
    const pct = Math.round(s.score / s.questions.length * 100);
    return `<div class="fade"><div class="training-widget">
      <div class="training-summary">
        <h3>${pct>=80?'🏆 ¡Excelente!':'🎉 Sesión completada'}</h3>
        <div class="stat-row">
          <div class="stat-box"><div class="stat-n" style="color:var(--greenL)">${s.score}</div><div class="stat-l">Correctas</div></div>
          <div class="stat-box"><div class="stat-n" style="color:var(--redL)">${s.questions.length-s.score}</div><div class="stat-l">Incorrectas</div></div>
          <div class="stat-box"><div class="stat-n" style="color:var(--goldL)">${pct}%</div><div class="stat-l">Precisión</div></div>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-b" onclick="startTraining('all')">🔄 Otra sesión</button>
          <button class="btn btn-gold" onclick="startSmartSession()">🧠 Sesión Inteligente</button>
          <button class="btn" onclick="endTraining()">✓ Finalizar</button>
        </div>
      </div>
    </div></div>`;
  }
  const cur = s.questions[s.idx];
  const answered = s.answers[s.idx] !== undefined;
  const ua = s.answers[s.idx];
  const correct = answered && ua === cur.correct;
  const prog = Math.round(s.idx / s.questions.length * 100);
  return `<div class="fade"><div class="training-widget">
    <div class="training-header">
      <div class="training-title">Pregunta ${s.idx+1} / ${s.questions.length}</div>
      <div class="training-progress">✓ ${s.score} correctas</div>
    </div>
    <div class="training-prog-bar"><div class="training-prog-fill" style="width:${prog}%"></div></div>
    <div class="training-source">📚 ${esc(cur.source||'—')}</div>
    <div class="training-q-text">${esc(cur.question)}</div>
    <div class="training-opts">
      ${cur.options.map((opt,i) => {
        let cls = 'training-opt';
        if (answered) { if(i===cur.correct) cls+=' correct'; else if(i===ua&&i!==cur.correct) cls+=' incorrect'; }
        return `<div class="${cls}" onclick="${answered?'':'answerT('+i+')'}">${esc(opt)}</div>`;
      }).join('')}
    </div>
    ${answered ? `<div class="training-feedback ${correct?'correct':'incorrect'}">${correct?'✓ ¡Correcto! Bien hecho.':'✗ Incorrecto. Correcta: '+esc(cur.options[cur.correct])}</div>
    <div class="training-actions"><button class="btn btn-b" onclick="nextT()">Siguiente →</button></div>` : ''}
  </div></div>`;
}
function answerT(i) {
  const s = trainingSession; const cur = s.questions[s.idx];
  s.answers[s.idx] = i;
  if (i === cur.correct) { s.score++; }
  else { addError(cur.question, cur.options[i], cur.options[cur.correct], 'Entrenamiento: '+cur.source); if(s.questions.length<30) s.questions.push({...cur}); }
  go('training');
}
function nextT()     { trainingSession.idx++; go('training'); }
function endTraining(){ trainingSession = null; go('training'); }

/* ── SESIONES VIEW ── */
function renderSesiones() {
  const data = getModData(CURRENT_MODULE.id);
  const ses  = data.sessions || [];
  const tot  = ses.reduce((s,x) => s+(parseInt(x.duracion)||0), 0);
  const h = Math.floor(tot/60), m = tot % 60;
  const avg = ses.length ? Math.round(tot/ses.length) : 0;
  return `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon sh-icon-b">⏱️</div>
        <div><div class="sh-title">Sesiones</div><div class="sh-meta">${h}h ${m}m total</div></div></div>
      <button class="btn btn-gold" onclick="openM('mSesion')">+ Registrar</button>
    </div>
    <div class="stat-row" style="margin-bottom:20px">
      <div class="stat-box"><div class="stat-n" style="color:var(--blueL)">${ses.length}</div><div class="stat-l">Sesiones</div></div>
      <div class="stat-box"><div class="stat-n" style="color:var(--goldL)">${h}h ${m}m</div><div class="stat-l">Total</div></div>
      <div class="stat-box"><div class="stat-n" style="color:var(--greenL)">${avg}</div><div class="stat-l">Min/Sesión</div></div>
    </div>
    ${ses.length === 0
      ? `<div class="empty"><div class="empty-icon">⏱️</div><h3>Sin sesiones</h3><p>Registra tu tiempo de estudio</p></div>`
      : ses.slice().reverse().map(s => `<div class="ses-card">
          <div class="ses-dt">${new Date(s.fecha||Date.now()).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}<br>
            <span style="color:var(--gold);font-size:12px">${new Date(s.fecha||Date.now()).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</span></div>
          <div class="ses-body"><div class="ses-t">${esc(s.temas||'—')}</div>${s.notas?`<div class="ses-n">${esc(s.notas)}</div>`:''}</div>
          <div><span class="tag tag-g">${s.duracion||0} min</span></div>
        </div>`).join('')}
  </div>`;
}



function saveClase() {
  const n = document.getElementById('mCN')?.value.trim();
  if (!n) { toast('Escribe un nombre','err'); return; }
  const data = getModData(CURRENT_MODULE.id);
  if (data.classes.some(c => c.nombre.trim().toLowerCase()===n.toLowerCase())) {
    toast('Ya existe una clase con ese nombre','err'); return;
  }
  const id = uid();
  data.classes.push({id, nombre:n, color:selColor, bloques:[], weeks:[], created:Date.now()});
  saveModData(CURRENT_MODULE.id, data); closeM('mClase');
  document.getElementById('mCN').value = ''; toast('Clase creada: '+n,'ok'); go('cl_'+id);
}
function saveDivision() {
  const n = document.getElementById('mDN')?.value.trim();
  if (!n) { toast('Escribe un nombre','err'); return; }
  const rows = parseInt(document.getElementById('mDScheduleRows')?.value) || 6;
  const data = getModData(CURRENT_MODULE.id);
  if (data.divisions.some(d => d.nombre.trim().toLowerCase()===n.toLowerCase())) {
    toast('Ya existe una división con ese nombre','err'); return;
  }
  const id      = uid();
  const allDays = ['lun','mar','mie','jue','vie','sab','dom'];
  const safeRows= Math.max(1, Math.min(20, rows));
  const rowsData= [];
  for (let r=0; r<safeRows; r++) { const row={hora:'',idx:r}; allDays.forEach(d=>row[d]=''); rowsData.push(row); }
  const schedule = {type:'table', rows:safeRows, table:{week:allDays, rows:rowsData}};
  data.divisions.push({id, nombre:n, color:selColor, classes:[], created:Date.now(), schedule});
  saveModData(CURRENT_MODULE.id, data); closeM('mDivision');
  document.getElementById('mDN').value = ''; toast('División creada: '+n,'ok'); go('div_'+id);
}
function saveSesion() {
  const t = document.getElementById('mST')?.value.trim();
  if (!t) { toast('Escribe los temas','err'); return; }
  const d = parseInt(document.getElementById('mSD')?.value) || 60;
  const n = document.getElementById('mSN')?.value.trim() || '';
  const data = getModData(CURRENT_MODULE.id);
  data.sessions.push({id:uid(), fecha:Date.now(), temas:t, duracion:d, notas:n});
  saveModData(CURRENT_MODULE.id, data); closeM('mSesion');
  document.getElementById('mST').value = ''; document.getElementById('mSN').value = '';
  toast(`Sesión guardada: ${d} min`,'ok'); go('sesiones');
}