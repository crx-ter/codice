/* ═══════════════════════════════════
   CÓDICE — progress.js
   Responsabilidad: Vista de Progreso y vista de Errores.
   Depende de: storage.js, modules.js, router.js, dashboard.js (getMastery, calcPriority)
   Expone: renderProgress, renderErrors, clearErrors, addError
═══════════════════════════════════ */

/* ── PROGRESS VIEW ── */
function renderProgress() {
  const data   = getModData(CURRENT_MODULE.id);
  const ranked = getRankedClasses(data);
  return `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon">📊</div><div><div class="sh-title">Progreso</div></div></div>
    </div>
    ${ranked.length === 0
      ? `<div class="empty"><div class="empty-icon">📊</div><h3>Sin datos aún</h3><p>Completa quizzes y exámenes para ver tu progreso</p></div>`
      : ranked.map(c => {
          const mastery = getMastery(c, data);
          const ml      = getMasteryLabel(mastery);
          const errCount= data.errors.filter(e => (e.source||'').includes(c.nombre)).length;
          const pLabel  = getPriorityLabel(c.priority);
          const totalB  = (c.bloques||[]).length + (c.weeks||[]).reduce((s,w)=>s+(w.bloques||[]).length,0);
          const quizzes = (c.bloques||[]).filter(b=>b.quiz).length + (c.weeks||[]).reduce((s,w)=>s+(w.bloques||[]).filter(b=>b.quiz).length,0);
          return `<div class="card" style="border-left:3px solid ${pLabel.cls==='high'?'var(--red)':pLabel.cls==='medium'?'var(--gold)':'var(--green)'}">
            <div class="card-head">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:10px;height:10px;border-radius:50%;background:${c.color||'#c79a38'}"></div>
                <div><div class="card-title">${esc(c.nombre)}</div>
                <div class="card-meta">${totalB} bloques · ${quizzes} quizzes</div></div>
              </div>
              <span class="mastery-badge ${ml.cls}">${ml.label} ${mastery>0?mastery+'%':''}</span>
            </div>
            <div class="pc-bar" style="margin-bottom:8px"><div class="pc-bar-fill" style="width:${mastery}%;background:${mastery>=70?'var(--greenL)':mastery>=40?'var(--gold)':'var(--redL)'}"></div></div>
            <div style="display:flex;gap:16px;font-size:12px;color:var(--txt3)">
              <span>❌ ${errCount} errores</span>
              <span>${pLabel.icon} Prioridad ${pLabel.label}</span>
            </div>
          </div>`;
        }).join('')}
  </div>`;
}

/* ── ERRORS VIEW ── */
function renderErrors() {
  const data    = getModData(CURRENT_MODULE.id);
  const errors  = data.errors || [];
  const map     = new Map();
  errors.forEach(e => {
    const k = (e.question||'') + '|' + (e.correctAnswer||'');
    if (!map.has(k)) map.set(k, {...e, count:1, dates:[e.timestamp||Date.now()]});
    else { const en = map.get(k); en.count++; en.dates.push(e.timestamp||Date.now()); }
  });
  const grouped = Array.from(map.values()).sort((a,b) => b.count - a.count);
  return `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon sh-icon-r">❌</div>
        <div><div class="sh-title">Registro de Errores</div>
        <div class="sh-meta">${errors.length} total · ${grouped.length} únicos</div></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${errors.length > 0 ? `<button class="btn btn-b" onclick="startSmartSession()">🧠 Practicar</button>
          <button class="btn btn-r" onclick="clearErrors()">🗑️ Limpiar</button>` : ''}
      </div>
    </div>
    ${grouped.length === 0
      ? `<div class="empty"><div class="empty-icon">✅</div><h3>¡Sin errores!</h3><p>Completa quizzes y exámenes para registrar áreas de mejora</p></div>`
      : grouped.map(e => `<div class="error-card">
          <div class="error-header"><div class="error-q">${esc(e.question)}</div><div class="error-count">×${e.count}</div></div>
          <div class="error-details">
            <div class="error-label">Respuesta errónea:</div><div class="error-value wrong">${esc(e.wrongAnswer||'—')}</div>
            <div class="error-label">Correcta:</div><div class="error-value correct">${esc(e.correctAnswer||'—')}</div>
            <div class="error-label">Fuente:</div><div class="error-value">${esc(e.source||'—')}</div>
            <div class="error-label">Última vez:</div><div class="error-value">${new Date(e.dates[e.dates.length-1]).toLocaleString('es-MX')}</div>
          </div></div>`).join('')}
  </div>`;
}
function clearErrors() {
  if (!confirm('¿Limpiar todos los errores?')) return;
  const data = getModData(CURRENT_MODULE.id);
  data.errors = []; saveModData(CURRENT_MODULE.id, data);
  go('errors'); toast('Errores limpiados', 'ok');
}
function addError(question, wrongAnswer, correctAnswer, source) {
  try {
    const data = getModData(CURRENT_MODULE.id);
    data.errors.push({id:uid(), question, wrongAnswer, correctAnswer, source, timestamp:Date.now()});
    saveModData(CURRENT_MODULE.id, data);
  } catch(e) {}
}

/* ── TRAINING VIEW ── */
