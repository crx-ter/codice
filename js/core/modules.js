/* ═══════════════════════════════════
   CÓDICE — modules.js
   Responsabilidad: Constantes globales de tipos de módulo (MOD_TYPES, DAYS, DAY_NAMES)
                    y toda la UI del selector de módulos (pantalla de inicio).
   Depende de: storage.js (uid, ld, sv, esc, toast, getModules, createModule, etc.)
   Expone: DAYS, DAY_NAMES, DAY_SHORT, MOD_TYPES,
           renderModuleGrid, showModuleSelector, selectModule, confirmDelModule,
           pickModType, pickModuleSchedMode, createModulo, getCfgColor
═══════════════════════════════════ */

const DAYS      = ['dom','lun','mar','mie','jue','vie','sab'];
const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DAY_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const MOD_TYPES = {
  general:   { icon:'📚', name:'General',      features:['classes','exams','errors','training','progress','schedule'] },
  math:      { icon:'🧮', name:'Matemáticas',  features:['classes','exams','errors','training','progress','schedule'], math:true },
  chemistry: { icon:'🧪', name:'Química',       features:['classes','exams','errors','training','progress','schedule'] },
  theory:    { icon:'🌍', name:'Teoría',        features:['classes','progress','schedule'] },
  language:  { icon:'🌐', name:'Idiomas',       features:['classes','training','progress','schedule'] },
  physics:   { icon:'⚛️', name:'Física',        features:['classes','exams','errors','training','progress','schedule'], math:true }
};

/* ── Estado del selector de módulos ── */
let selColor    = '#c79a38';
let selModType  = 'general';
let selSchedMode= 'single';
let selDiff     = 'easy';

function getCfgColor(t) {
  const map = { general:'#c79a38', math:'#2868cc', chemistry:'#28985e', theory:'#7240cc', language:'#20a0c0', physics:'#b83050' };
  return map[t] || '#c79a38';
}

function renderModuleGrid() {
  try {
    const grid = document.getElementById('moduleGrid');
    if (!grid) return;
    const mods = getModules();
    if (mods.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 0">
          <div style="font-size:48px;margin-bottom:16px">📚</div>
          <h3 style="color:var(--txt2);margin-bottom:8px">Sin módulos aún</h3>
          <p style="color:var(--txt4);font-size:13px;margin-bottom:20px">Crea tu primer módulo para empezar a estudiar</p>
          <button class="btn btn-gold" onclick="openM('mModulo')">+ Crear Módulo</button>
        </div>`;
      return;
    }
    grid.innerHTML = mods.map(m => {
      const cfg  = MOD_TYPES[m.type] || MOD_TYPES.general;
      const data = getModData(m.id);
      const date = m.lastAccessed
        ? new Date(m.lastAccessed).toLocaleDateString('es', { day:'numeric', month:'short' })
        : 'Nuevo';
      const clCount  = m.scheduleMode === 'multiple'
        ? (data.divisions||[]).reduce((s,d)=>s+(d.classes||[]).length,0)
        : (data.classes||[]).length;
      const divCount = (data.divisions||[]).length;
      const exCount  = (data.exams||[]).length;
      const modeLabel = m.scheduleMode === 'multiple' ? '🔄 Horarios múltiples' : '📆 Horario único';
      return `
        <div class="ms-module-card" onclick="selectModule('${m.id}')" style="border-top:3px solid ${getCfgColor(m.type)}">
          <div class="ms-mc-head">
            <div class="ms-mc-icon">${cfg.icon}</div>
            <div class="ms-mc-info">
              <div class="ms-mc-name">${esc(m.name)}</div>
              <div class="ms-mc-type">${cfg.name} · ${date}</div>
            </div>
            <button class="ms-mc-del" onclick="event.stopPropagation();confirmDelModule('${m.id}')" title="Eliminar módulo">×</button>
          </div>
          <div class="ms-mc-stats">
            <div class="ms-mc-stat">
              <div class="ms-mc-stat-n">${clCount}</div>
              <div class="ms-mc-stat-l">Clases</div>
            </div>
            ${m.scheduleMode==='multiple' ? `
            <div class="ms-mc-stat">
              <div class="ms-mc-stat-n">${divCount}</div>
              <div class="ms-mc-stat-l">Divisiones</div>
            </div>` : ''}
            <div class="ms-mc-stat">
              <div class="ms-mc-stat-n">${exCount}</div>
              <div class="ms-mc-stat-l">Exámenes</div>
            </div>
          </div>
          <div style="font-size:10px;color:var(--txt4);margin-top:8px">${modeLabel}</div>
        </div>`;
    }).join('');

    // Al hacer clic fuera de las tarjetas
    grid.onclick = (e) => {
      const card = e.target.closest('.ms-module-card');
      if (!card) return;
    };
  } catch(e) {
    console.error('renderModuleGrid:', e);
    toast('Error al cargar módulos', 'err');
  }
}

function showModuleSelector() {
  try {
    const ms = document.getElementById('moduleSelector');
    const ac = document.getElementById('appContainer');
    if (ms) { ms.style.display = ''; ms.style.cssText = ''; }
    if (ac) ac.classList.add('hidden');
    // Reset active module so going back doesn't auto-reload
    // (but don't clear localStorage - user can come back)
    renderModuleGrid();
  } catch(e) { console.error('showModuleSelector:', e); }
}

function selectModule(id) {
  try {
    const mod = setActiveModule(id);
    if (!mod) { toast('Módulo no encontrado', 'err'); return; }
    CURRENT_MODULE = mod;
    const ms = document.getElementById('moduleSelector');
    const ac = document.getElementById('appContainer');
    if (ms) ms.style.display = 'none';
    if (ac) ac.classList.remove('hidden');
    initApp();
    go('home');
  } catch(e) {
    toast('Error al cargar módulo: ' + e.message, 'err');
  }
}

function confirmDelModule(id) {
  try {
    const mod = getModules().find(m => m.id === id);
    if (!mod) return;
    if (!confirm(`¿Eliminar el módulo "${mod.name}"?\nSe borrarán todas sus clases, exámenes y datos. Esta acción no se puede deshacer.`)) return;
    deleteModule(id);
    toast('Módulo eliminado', 'ok');
    renderModuleGrid();
  } catch(e) {
    toast('Error al eliminar: ' + e.message, 'err');
  }
}

function pickModType(el) {
  try {
    document.querySelectorAll('#mModulo .mto').forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    selModType = el.dataset.type || 'general';
  } catch(e) {}
}

function pickModuleSchedMode(el) {
  try {
    const c = document.querySelector('#mModulo .schedule-mode-pick');
    if (c) c.querySelectorAll('.smp').forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    selSchedMode = el.dataset.mode || 'single';
  } catch(e) {}
}

function createModulo() {
  try {
    const n = document.getElementById('mMN')?.value.trim();
    if (!n) { toast('Escribe un nombre para el módulo', 'err'); return; }
    const id = createModule(n, selModType, selSchedMode);
    if (!id) return;
    closeM('mModulo');
    const mnEl = document.getElementById('mMN');
    if (mnEl) mnEl.value = '';
    // Resetear selecciones
    document.querySelectorAll('#mModulo .mto').forEach(e => e.classList.toggle('on', e.dataset.type==='general'));
    document.querySelectorAll('#mModulo .smp').forEach(e => e.classList.toggle('on', e.dataset.mode==='single'));
    selModType   = 'general';
    selSchedMode = 'single';
    toast('✓ Módulo creado', 'ok');
    renderModuleGrid();
  } catch(e) {
    toast('Error al crear módulo: ' + e.message, 'err');
  }
}

/* ── Color picker genérico ── */
function pickC(el) {
  try {
    el.closest('.m-color-picker').querySelectorAll('.cdot').forEach(d => d.classList.remove('on'));
    el.classList.add('on');
    selColor = el.dataset.c || '#c79a38';
  } catch(e) {}
}

/* ── Dificultad (para training) ── */
function pickDiff(el, rowId) {
  try {
    const row = document.getElementById(rowId);
    if (row) row.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
    selDiff = el.dataset.diff || 'easy';
  } catch(e) {}
}
