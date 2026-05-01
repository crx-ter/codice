/* ═══════════════════════════════════
   CÓDICE — router.js
   Responsabilidad: Estado global (CURRENT_MODULE, VIEW), router go(), buildSidebar(),
                    initApp(), modales (openM/closeM), toggleSidebar, y funciones UI globales.
   Depende de: storage.js, modules.js
   Expone: CURRENT_MODULE, VIEW, go, buildSidebar, initApp,
           openM, closeM, toggleSidebar, closeSidebar,
           _pendingExamId, _quizCid, _quizBid, _quizWid,
           _editCid, _editBid, _scheduleDivisionId,
           _addDaySchedId, _addDayKey, _weekCid,
           trainingSession, examEnCurso, cronoInterval
═══════════════════════════════════ */

/* ── ESTADO GLOBAL ── */
let CURRENT_MODULE = null;
let VIEW = 'home';

/* ── Estado de modales y acciones pendientes ── */
let _pendingExamId = null;
let _quizCid = null, _quizBid = null, _quizWid = null;
let _editCid = null, _editBid = null;
let _scheduleDivisionId = null;
let _addDaySchedId = null, _addDayKey = null;
let _weekCid = null;
let _divBlockDid = null, _divBlockCid = null;
let trainingSession = null;
let examEnCurso = null;
let cronoInterval = null;
let _codeFontSize = 14;
let _resizeState = null;

/* ── INIT APP ── */
function initApp() {
  try {
    if (!CURRENT_MODULE) return;
    const cfg    = MOD_TYPES[CURRENT_MODULE.type] || MOD_TYPES.general;
    const iconEl = document.getElementById('curModIcon');
    const nameEl = document.getElementById('curModName');
    const typeEl = document.getElementById('curModType');
    if (iconEl) iconEl.textContent = cfg.icon;
    if (nameEl) nameEl.textContent = CURRENT_MODULE.name;
    if (typeEl) typeEl.textContent = cfg.name + (CURRENT_MODULE.scheduleMode==='multiple' ? ' · Múltiple' : '');
    loadTheme();
    buildSidebar();
  } catch(e) {
    console.error('initApp error:', e);
  }
}

/* ── SIDEBAR ── */
function buildSidebar() {
  try {
    if (!CURRENT_MODULE) return;
    const cfg  = MOD_TYPES[CURRENT_MODULE.type] || MOD_TYPES.general;
    const data = getModData(CURRENT_MODULE.id);

    // ── NAV items ──
    const navDefs = [{ id:'home', icon:'🏠', label:'Dashboard' }];
    if (CURRENT_MODULE.scheduleMode === 'single') {
      navDefs.push({ id:'horario', icon:'📅', label:'Horario' });
      navDefs.push({ id:'classes', icon:'📚', label:'Clases' });
    }
    navDefs.push({ id:'progress',  icon:'📊', label:'Progreso' });
    navDefs.push({ id:'training',  icon:'🎯', label:'Entrenamiento' });
    navDefs.push({ id:'errors',    icon:'❌', label:'Errores' });
    navDefs.push({ id:'sesiones',  icon:'⏱️', label:'Sesiones' });
    if (cfg.features.includes('exams'))
      navDefs.push({ id:'examenes', icon:'📝', label:'Exámenes' });
    navDefs.push({ id:'libros', icon:'📖', label:'Biblioteca' });

    const sbNav = document.getElementById('sbNav');
    if (sbNav) {
      sbNav.innerHTML = navDefs.map(n =>
        `<div class="nav-item ${VIEW===n.id?'on':''}" onclick="go('${n.id}')">
          <span class="nav-icon">${n.icon}</span><span>${n.label}</span>
        </div>`
      ).join('');
    }

    // ── Lista inferior (clases o divisiones) ──
    let html = '';

    if (CURRENT_MODULE.scheduleMode === 'multiple') {
      // MODO MULTIPLE: mostrar divisiones
      html += `<div class="sb-sect">
        <div class="sb-sect-head">
          <div class="sb-sect-t">Divisiones (${(data.divisions||[]).length})</div>
          <div class="sb-sect-add" onclick="openM('mDivision')">+</div>
        </div>
        ${(data.divisions||[]).length === 0
          ? '<div style="font-size:12px;color:var(--txt4);padding:6px 3px">Sin divisiones aún</div>'
          : ''}
        ${(data.divisions||[]).map(d =>
          `<div class="sb-item ${VIEW==='div_'+d.id?'on':''}" onclick="go('div_${d.id}')">
            <div class="sb-item-dot" style="background:${d.color||'#c79a38'}"></div>
            <div class="sb-item-t">${esc(d.nombre)}</div>
            <div style="display:flex;align-items:center;gap:4px">
              <button class="sb-item-edit" onclick="event.stopPropagation();editItemName('division','${d.id}')">✎</button>
              <button class="sb-item-del" onclick="event.stopPropagation();delDivision(event,'${d.id}')">×</button>
            </div>
          </div>`
        ).join('')}
      </div>`;
    } else {
      // MODO SINGLE: mostrar clases directas
      if (cfg.features.includes('classes')) {
        html += `<div class="sb-sect">
          <div class="sb-sect-head">
            <div class="sb-sect-t">Clases (${(data.classes||[]).length})</div>
            <div class="sb-sect-add" onclick="openM('mClase')">+</div>
          </div>
          ${(data.classes||[]).length === 0
            ? '<div style="font-size:12px;color:var(--txt4);padding:6px 3px">Sin clases aún</div>'
            : ''}
          ${(data.classes||[]).map(c =>
            `<div class="sb-item ${VIEW==='cl_'+c.id?'on':''}" onclick="go('cl_${c.id}')">
              <div class="sb-item-dot" style="background:${c.color||'#c79a38'}"></div>
              <div class="sb-item-t">${esc(c.nombre)}</div>
              <div style="display:flex;align-items:center;gap:4px">
                <button class="sb-item-edit" onclick="event.stopPropagation();editItemName('class','${c.id}')">✎</button>
                <button class="sb-item-del" onclick="event.stopPropagation();delCl(event,'${c.id}')">×</button>
              </div>
            </div>`
          ).join('')}
        </div>`;
      }
    }

    // ── Exámenes (ambos modos) ──
    if (cfg.features.includes('exams') && (data.exams||[]).length > 0) {
      html += `<div class="sb-sect">
        <div class="sb-sect-head">
          <div class="sb-sect-t">Exámenes (${data.exams.length})</div>
          <div class="sb-sect-add" onclick="openM('mExamen')">+</div>
        </div>
        ${data.exams.map(e =>
          `<div class="sb-item ${VIEW==='ex_'+e.id?'on':''}" onclick="go('ex_${e.id}')">
            <div class="sb-item-dot" style="background:${e.tipo==='html'?'var(--orange)':'var(--green)'}"></div>
            <div class="sb-item-t">${e.tipo==='html'?'🌐':'🐍'} ${esc(e.titulo)}</div>
            <button class="sb-item-del" onclick="event.stopPropagation();delEx(event,'${e.id}')">×</button>
          </div>`
        ).join('')}
      </div>`;
    }

    const sbList = document.getElementById('sbList');
    if (sbList) sbList.innerHTML = html;

    // Actualizar pathDisplay de la IA
    try {
      const pd = document.getElementById('aiPathDisplay');
      if (pd) {
        let path = CURRENT_MODULE.name;
        if (VIEW.startsWith('div_')) {
          const divId = VIEW.slice(4);
          const d = (data.divisions||[]).find(x=>x.id===divId);
          if (d) path += ' › ' + d.nombre;
        } else if (VIEW.startsWith('cl_')) {
          // Buscar clase en single o en divisiones
          let clNombre = null;
          if (CURRENT_MODULE.scheduleMode === 'single') {
            const cl = (data.classes||[]).find(c=>c.id===VIEW.slice(3));
            if (cl) clNombre = cl.nombre;
          } else {
            for (const div of (data.divisions||[])) {
              const cl = (div.classes||[]).find(c=>c.id===VIEW.slice(3));
              if (cl) { path += ' › ' + div.nombre; clNombre = cl.nombre; break; }
            }
          }
          if (clNombre) path += ' › ' + clNombre;
        }
        pd.textContent = path;
      }
    } catch(e) {}
  } catch(e) {
    console.error('buildSidebar error:', e);
  }
}

/* ── ROUTER ── */
function go(v) {
  try {
    VIEW = v;
    try { buildSidebar(); } catch(e) { console.warn('buildSidebar:', e); }
    closeSidebar();

    const vp = document.getElementById('viewport');
    const tb = document.getElementById('topbarViewName');
    const labels = {
      home:'Dashboard', horario:'Horario', classes:'Clases',
      progress:'Progreso', training:'Entrenamiento', errors:'Errores',
      sesiones:'Sesiones', examenes:'Exámenes', libros:'Biblioteca 📚'
    };
    if (tb) tb.textContent = labels[v] ||
      (v.startsWith('cl_')  ? 'Clase'    :
       v.startsWith('div_') ? 'División' :
       v.startsWith('ex_')  ? 'Examen'   : '—');

    let content = '';
    try {
      if      (v === 'home')     content = renderDashboard();
      else if (v === 'horario')  content = renderHorario();
      else if (v === 'classes')  content = renderClasses();
      else if (v === 'progress') content = renderProgress();
      else if (v === 'training') content = renderTraining();
      else if (v === 'errors')   content = renderErrors();
      else if (v === 'sesiones') content = renderSesiones();
      else if (v === 'examenes') content = renderExamenList();
      else if (v === 'libros')   content = renderLibros();
      else if (v.startsWith('cl_'))  content = renderClase(v.slice(3));
      else if (v.startsWith('div_')) content = renderDivision(v.slice(4));
      else if (v.startsWith('ex_'))  content = renderExamen(v.slice(3));
      else content = `<div class="empty">
        <div class="empty-icon">🔍</div>
        <h3>Vista no encontrada</h3>
        <button class="btn" onclick="go('home')" style="margin-top:16px">← Inicio</button>
      </div>`;
    } catch(e) {
      console.error('Render error:', v, e);
      content = `<div class="empty">
        <div class="empty-icon">⚠️</div>
        <h3>Error al cargar</h3>
        <p style="color:var(--redL);font-size:13px;margin-top:8px">${esc(e.message)}</p>
        <button class="btn" onclick="go('home')" style="margin-top:16px">← Dashboard</button>
      </div>`;
    }

    if (vp) { vp.innerHTML = content; vp.scrollTop = 0; }

    // MathJax
    try {
      if (window.MathJax && window.MathJax.typesetPromise)
        window.MathJax.typesetPromise([vp]).catch(() => {});
    } catch(e) {}

    // Mermaid
    try {
      if (typeof _cai_renderMermaid === 'function') _cai_renderMermaid();
      else if (typeof mermaid !== 'undefined') {
        const nodes = vp.querySelectorAll('.mermaid:not([data-processed])');
        if (nodes.length) mermaid.run({ nodes: Array.from(nodes) }).catch(()=>{});
      }
    } catch(e) {}
  } catch(e) {
    console.error('go() critical error:', e);
  }
}

/* ── MODALES ── */
function openM(id) {
  try {
    const m = document.getElementById(id);
    if (m) { m.style.display = 'flex'; }
  } catch(e) {}
}

function closeM(id) {
  try {
    const m = document.getElementById(id);
    if (m) { m.style.display = 'none'; }
  } catch(e) {}
}

/* ── SIDEBAR MOBILE ── */
function toggleSidebar() {
  try {
    document.getElementById('sidebar')?.classList.toggle('show');
    document.getElementById('sidebarOverlay')?.classList.toggle('show');
  } catch(e) {}
}

function closeSidebar() {
  try {
    document.getElementById('sidebar')?.classList.remove('show');
    document.getElementById('sidebarOverlay')?.classList.remove('show');
  } catch(e) {}
}

/* ── EDITAR NOMBRE ── */
function editItemName(type, id) {
  try {
    const data = getModData(CURRENT_MODULE.id);
    if (type === 'class') {
      const cl = (data.classes||[]).find(c=>c.id===id);
      if (!cl) return;
      const n = prompt('Nuevo nombre:', cl.nombre);
      if (!n || !n.trim()) return;
      cl.nombre = n.trim();
      saveModData(CURRENT_MODULE.id, data);
      buildSidebar();
      if (VIEW === 'cl_'+id) go(VIEW);
      toast('✓ Nombre actualizado', 'ok');
    } else if (type === 'division') {
      const div = (data.divisions||[]).find(d=>d.id===id);
      if (!div) return;
      const n = prompt('Nuevo nombre:', div.nombre);
      if (!n || !n.trim()) return;
      div.nombre = n.trim();
      saveModData(CURRENT_MODULE.id, data);
      buildSidebar();
      if (VIEW === 'div_'+id) go(VIEW);
      toast('✓ Nombre actualizado', 'ok');
    }
  } catch(e) {
    toast('Error: ' + e.message, 'err');
  }
}

/* ── ELIMINAR CLASE (modo single) ── */
function delCl(e, id) {
  try {
    if (e) e.stopPropagation();
    if (!confirm('¿Eliminar esta clase?')) return;
    const data = getModData(CURRENT_MODULE.id);
    data.classes = (data.classes||[]).filter(c=>c.id!==id);
    saveModData(CURRENT_MODULE.id, data);
    if (VIEW === 'cl_'+id) go('classes');
    else buildSidebar();
    toast('Clase eliminada', 'ok');
  } catch(err) {
    toast('Error: ' + err.message, 'err');
  }
}

/* ── ELIMINAR DIVISIÓN ── */
function delDivision(e, id) {
  try {
    if (e) e.stopPropagation();
    if (!confirm('¿Eliminar esta división y todas sus clases?')) return;
    const data = getModData(CURRENT_MODULE.id);
    data.divisions = (data.divisions||[]).filter(d=>d.id!==id);
    saveModData(CURRENT_MODULE.id, data);
    if (VIEW === 'div_'+id) go('home');
    else buildSidebar();
    toast('División eliminada', 'ok');
  } catch(err) {
    toast('Error: ' + err.message, 'err');
  }
}

/* ── ELIMINAR EXAMEN ── */
function delEx(e, id) {
  try {
    if (e) e.stopPropagation();
    if (!confirm('¿Eliminar este examen?')) return;
    const data = getModData(CURRENT_MODULE.id);
    data.exams = (data.exams||[]).filter(ex=>ex.id!==id);
    saveModData(CURRENT_MODULE.id, data);
    if (VIEW === 'ex_'+id) go('examenes');
    else buildSidebar();
    toast('Examen eliminado', 'ok');
  } catch(err) {
    toast('Error: ' + err.message, 'err');
  }
}
