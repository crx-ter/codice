/* ═══════════════════════════════════
   CÓDICE — horario.js
   Responsabilidad: Vista de Horario (modo single), con gestión de schedules y timetable.
   Depende de: storage.js, modules.js, router.js
   Expone: renderHorario, renderTimetableFull, buildHorarioTable, saveHorarioTabla,
           saveHorario, setActiveSchedule, deleteSchedule, openAddDay, saveAddDay,
           removeFromDay, renameSchedule, pickScheduleMode
═══════════════════════════════════ */

/* ── HORARIO VIEW ── */
function renderHorario() {
  const data     = getModData(CURRENT_MODULE.id);
  const schedules= data.schedules || [];
  const active   = schedules.find(s => s.id === data.activeScheduleId) || schedules[0] || null;
  const todayIdx = new Date().getDay();
  const weekDays = [{key:'lun',label:'Lunes',idx:1},{key:'mar',label:'Martes',idx:2},
    {key:'mie',label:'Miércoles',idx:3},{key:'jue',label:'Jueves',idx:4},{key:'vie',label:'Viernes',idx:5}];

  return `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon">📅</div><div><div class="sh-title">Horario</div>
        <div class="sh-meta">${schedules.length} horario${schedules.length!==1?'s':''}</div></div></div>
      <button class="btn btn-gold" onclick="openM('mHorario');_scheduleDivisionId=null;document.getElementById('mHorarioTitle').textContent='📅 Nuevo Horario';buildHorarioTable(null)">+ Nuevo</button>
    </div>
    ${schedules.length === 0 ? `<div class="empty"><div class="empty-icon">📅</div><h3>Sin horarios</h3><p>Crea un horario para ver tus clases del día</p></div>` :
    `<div class="schedule-selector">
      ${schedules.map(s => `<div class="schedule-tab ${active&&active.id===s.id?'on':''}" onclick="setActiveSchedule('${s.id}')">${esc(s.name)}</div>`).join('')}
    </div>
    ${active ? renderTimetableFull(active, data, weekDays, todayIdx) : ''}`}
  </div>`;
}
function renderTimetableFull(sched, data, weekDays, todayIdx) {
  const todayKey = DAYS[todayIdx];
  const allKeys  = ['dom','lun','mar','mie','jue','vie','sab'];
  return `<div class="timetable-full">
    <div class="tt-grid" style="grid-template-columns:72px repeat(5,1fr)">
      <div class="tt-header-cell">HORAS</div>
      ${weekDays.map(d => `<div class="tt-header-cell ${d.key===todayKey?'today-col':''}">${d.label.slice(0,3).toUpperCase()}</div>`).join('')}
      ${['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'].map(h =>
        `<div class="tt-hours-label">${h}</div>
        ${weekDays.map(d => {
          const entries = (sched.days && sched.days[d.key]) || [];
          return `<div class="tt-cell ${d.key===todayKey?'today-col':''}">
            <div class="tt-cell-inner">
              ${entries.map(e => {
                const cls = data.classes.find(c => c.id === e.classId);
                if (!cls) return '';
                return `<div class="tt-chip" style="background:${cls.color}22;border-left-color:${cls.color}" onclick="go('cl_${cls.id}')">
                  <span class="tt-chip-name">${esc(cls.nombre)}</span>
                  ${e.time ? `<span class="tt-chip-time">${esc(e.time)}</span>` : ''}
                  <button class="tt-chip-del" onclick="event.stopPropagation();removeFromDay('${sched.id}','${d.key}','${e.id}')">×</button>
                </div>`;
              }).join('')}
              <div class="tt-add-cell" onclick="openAddDay('${sched.id}','${d.key}','${h}')">+ añadir</div>
            </div>
          </div>`;
        }).join('')}`
      ).join('')}
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
    <button class="btn btn-r" onclick="deleteSchedule('${sched.id}')">🗑️ Eliminar</button>
    <button class="btn" onclick="renameSchedule('${sched.id}')">✏️ Renombrar</button>
  </div>`;
}

let _pickSchedMode = 'single';
function pickScheduleMode(el) {
  const c = document.querySelector('#mHorario .schedule-mode-pick');
  if (c) c.querySelectorAll('.smp').forEach(e => e.classList.remove('on'));
  el.classList.add('on'); _pickSchedMode = el.dataset.mode;
}
function buildHorarioTable(divId) {
  // Used for simple schedule creation (non-division)
  document.getElementById('mHorarioTableWrap').innerHTML = `
    <p style="color:var(--txt3);font-size:13px;margin-bottom:12px">Crea el horario y luego agrega clases haciendo clic en las celdas del calendario.</p>`;
}
function saveHorarioTabla() {
  const did = _scheduleDivisionId;
  if (did) { _saveDivHorario(did); return; }
  // Simple schedule creation
  const n = document.getElementById('hNombre')?.value?.trim() || ('Horario ' + (getModData(CURRENT_MODULE.id).schedules.length+1));
  saveHorario(n);
}
function saveHorario(nombre) {
  const n = nombre || ('Horario ' + (getModData(CURRENT_MODULE.id).schedules.length+1));
  const data = getModData(CURRENT_MODULE.id);
  const sched = {id:uid(), name:n, mode:'single',
    days:{dom:[],lun:[],mar:[],mie:[],jue:[],vie:[],sab:[]},
    createdAt:Date.now(), divisionId:null};
  data.schedules.push(sched);
  if (!data.activeScheduleId) data.activeScheduleId = sched.id;
  saveModData(CURRENT_MODULE.id, data);
  closeM('mHorario');
  toast(`Horario creado: ${n}`, 'ok');
  go('horario');
}
function setActiveSchedule(id) {
  const data = getModData(CURRENT_MODULE.id);
  data.activeScheduleId = id; saveModData(CURRENT_MODULE.id, data);
  go('horario'); toast('Horario activo cambiado', 'ok');
}
function deleteSchedule(id) {
  if (!confirm('¿Eliminar este horario?')) return;
  const data = getModData(CURRENT_MODULE.id);
  data.schedules = data.schedules.filter(s => s.id !== id);
  if (data.activeScheduleId === id)
    data.activeScheduleId = data.schedules.length ? data.schedules[0].id : null;
  saveModData(CURRENT_MODULE.id, data); go('horario'); toast('Horario eliminado', 'ok');
}
function openAddDay(schedId, dayKey, prefilledTime) {
  _addDaySchedId = schedId; _addDayKey = dayKey;
  const data = getModData(CURRENT_MODULE.id);
  const sel  = document.getElementById('addDayClass');
  const allClasses = [...data.classes];
  (data.divisions||[]).forEach(d => (d.classes||[]).forEach(c => { if (!allClasses.find(x => x.id===c.id)) allClasses.push(c); }));
  sel.innerHTML = allClasses.length
    ? allClasses.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')
    : '<option value="">Sin clases</option>';
  document.getElementById('mAddDayTitle').textContent = `Agregar clase — ${DAY_NAMES[DAYS.indexOf(dayKey)]||dayKey}`;
  document.getElementById('addDayTime').value = prefilledTime || '';
  openM('mAddDay');
}
function saveAddDay() {
  const clsId = document.getElementById('addDayClass').value;
  const time  = document.getElementById('addDayTime').value.trim();
  if (!clsId) { toast('Selecciona una clase', 'err'); return; }
  const data  = getModData(CURRENT_MODULE.id);
  const sched = data.schedules.find(s => s.id === _addDaySchedId); if (!sched) return;
  if (!sched.days[_addDayKey]) sched.days[_addDayKey] = [];
  sched.days[_addDayKey].push({classId:clsId, time, id:uid()});
  saveModData(CURRENT_MODULE.id, data); closeM('mAddDay');
  go('horario'); toast('Clase agregada al horario', 'ok');
}
function removeFromDay(schedId, dayKey, entryId) {
  const data  = getModData(CURRENT_MODULE.id);
  const sched = data.schedules.find(s => s.id === schedId); if (!sched) return;
  sched.days[dayKey] = (sched.days[dayKey]||[]).filter(e => e.id !== entryId);
  saveModData(CURRENT_MODULE.id, data); go('horario');
}
function renameSchedule(id) {
  const data  = getModData(CURRENT_MODULE.id);
  const sched = data.schedules.find(s => s.id === id); if (!sched) return;
  const n = prompt('Nuevo nombre:', sched.name); if (!n) return;
  sched.name = n; saveModData(CURRENT_MODULE.id, data);
  go('horario'); toast('Nombre actualizado', 'ok');
}

/* ── CLASSES VIEW ── */
function renderClasses() {
  const data = getModData(CURRENT_MODULE.id);
  return `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon sh-icon-b">📚</div>
        <div><div class="sh-title">Clases</div>
        <div class="sh-meta">${data.classes.length} clase${data.classes.length===1?'':'s'}</div></div></div>
      <button class="btn btn-gold" onclick="openM('mClase')">+ Nueva Clase</button>
    </div>
    ${data.classes.length === 0
      ? `<div class="empty"><div class="empty-icon">📚</div><h3>Sin clases aún</h3><p>Crea tu primera clase para comenzar</p></div>`
      : `<div style="display:flex;flex-direction:column;gap:12px">
          ${data.classes.map(c => `<div class="card" style="border-color:${c.color}40">
            <div class="card-head">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:12px;height:12px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
                <div><div class="card-title">${esc(c.nombre)}</div>
                <div class="card-meta">${(c.bloques||[]).length} bloques · ${(c.weeks||[]).reduce((s,w)=>s+(w.bloques||[]).length,0)} en semanas</div></div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-b btn-sm" onclick="go('cl_${c.id}')">Abrir →</button>
                <button class="btn btn-sm" onclick="editItemName('class','${c.id}')">✎</button>
                <button class="btn btn-r btn-sm" onclick="delCl(event,'${c.id}')">×</button>
              </div>
            </div>
          </div>`).join('')}
        </div>`}
  </div>`;
}

