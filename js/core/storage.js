/* ═══════════════════════════════════
   CÓDICE — storage.js
   Responsabilidad: Funciones base de localStorage, utilidades globales (uid, ld, sv, esc, toast)
                    y toda la lógica de módulos (getModData, saveModData, createModule, etc.)
   Depende de: Nada (es el primer archivo cargado)
   Expone: K, uid, esc, ld, sv, toast, flash,
           getModules, saveModules, getModData, saveModData,
           createModule, deleteModule, setActiveModule, getActiveModule,
           migrateOld, guardarLocal
═══════════════════════════════════ */

/* ── CLAVES localStorage ── */
const K = {
  modules:'cdc_modules', active:'cdc_active', theme:'cdc_theme',
  legModules:'codice_modules', legCl:'codice_clases',
  legEx:'codice_examenes', legSe:'codice_sesiones'
};

/* ── UTILIDADES BASE ── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(t) { const d = document.createElement('div'); d.textContent = String(t||''); return d.innerHTML; }

function ld(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
  catch(e) { console.warn('ld error:', k, e); return null; }
}

function guardarLocal(k, v) {
  try {
    const s = JSON.stringify(v);
    localStorage.setItem(k, s);
    localStorage.setItem('cdc_lastUpdated', Date.now().toString());
    return true;
  } catch(e) {
    console.error('guardarLocal error:', k, e);
    toast('Error al guardar: ' + e.message, 'err');
    return false;
  }
}

function sv(k, v) {
  const ok = guardarLocal(k, v);
  if (ok && typeof _fbQueueSync === 'function') {
    try { _fbQueueSync(k); } catch(e) {}
  }
  return ok;
}

/* ── TOAST NOTIFICATIONS ── */
function flash(msg) {
  const el = document.getElementById('toastCont');
  if (!el) return;
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  el.appendChild(d);
  setTimeout(() => d.remove(), 2800);
}

function toast(msg, type='') {
  try {
    const cont = document.getElementById('toastCont');
    if (!cont) { console.log('Toast:', msg); return; }
    const d = document.createElement('div');
    d.className = 'toast' + (type ? ' toast-'+type : '');
    d.innerHTML = String(msg);
    cont.appendChild(d);
    setTimeout(() => { d.style.animation='toastOut .3s forwards'; setTimeout(()=>d.remove(),350); }, 2600);
  } catch(e) {}
}

/* ── MÓDULOS ── */
function getModules() {
  const m = ld(K.modules);
  return Array.isArray(m) ? m : [];
}

function saveModules(m) { sv(K.modules, m); }

function getModData(id) {
  try {
    const raw = ld('cdc_mod_' + id);
    const def = {
      classes: [],
      divisions: [],
      exams: [],
      errors: [],
      schedules: [],
      activeScheduleId: null,
      trainingHistory: [],
      sessions: []
    };
    if (!raw) return def;
    // Asegurar estructura correcta
    return Object.assign(def, raw);
  } catch(e) {
    console.error('getModData error:', id, e);
    return { classes:[], divisions:[], exams:[], errors:[], schedules:[], activeScheduleId:null, trainingHistory:[], sessions:[] };
  }
}

function saveModData(id, data) {
  try {
    sv('cdc_mod_' + id, data);
  } catch(e) {
    toast('Error al guardar datos: ' + e.message, 'err');
  }
}

function createModule(name, type, scheduleMode='single') {
  try {
    const normalized = name.trim().toLowerCase();
    const mods = getModules();
    const exists = mods.some(m => m.name.trim().toLowerCase() === normalized);
    if (exists) { toast('Ya existe un módulo con ese nombre', 'err'); return null; }
    const id = uid();
    const mod = { id, name: name.trim(), type, scheduleMode, created: Date.now(), lastAccessed: Date.now() };
    mods.push(mod);
    saveModules(mods);
    // Inicializar datos vacíos con estructura correcta según modo
    const initData = {
      classes: [],
      divisions: [],
      exams: [],
      errors: [],
      schedules: [],
      activeScheduleId: null,
      trainingHistory: [],
      sessions: []
    };
    saveModData(id, initData);
    return id;
  } catch(e) {
    toast('Error al crear módulo: ' + e.message, 'err');
    return null;
  }
}

function deleteModule(id) {
  try {
    const mods = getModules().filter(m => m.id !== id);
    saveModules(mods);
    localStorage.removeItem('cdc_mod_' + id);
  } catch(e) {
    toast('Error al eliminar módulo: ' + e.message, 'err');
  }
}

function setActiveModule(id) {
  try {
    const mods = getModules();
    const mod  = mods.find(m => m.id === id);
    if (!mod) return null;
    mod.lastAccessed = Date.now();
    saveModules(mods);
    guardarLocal(K.active, id);
    return mod;
  } catch(e) {
    toast('Error al activar módulo: ' + e.message, 'err');
    return null;
  }
}

function getActiveModule() {
  try {
    const id  = ld(K.active);
    if (!id) return null;
    const mod = getModules().find(m => m.id === id);
    return mod || null;
  } catch(e) { return null; }
}

/* ── MIGRACIÓN DATOS LEGACY ── */
function migrateOld() {
  try {
    const oldMods = ld(K.legModules);
    if (oldMods && Array.isArray(oldMods) && getModules().length === 0) {
      const newMods = oldMods.map(m => ({
        id: uid(), name: m.name||m.nombre||'Módulo', type: m.type||'general',
        scheduleMode: 'single', created: Date.now(), lastAccessed: Date.now(), _oldId: m.id
      }));
      newMods.forEach(nm => {
        const od = ld('cdc_mod_'+nm._oldId) || ld('module_'+nm._oldId);
        if (od) saveModData(nm.id, od);
      });
      saveModules(newMods.map(m => { delete m._oldId; return m; }));
    }
    const oc = ld(K.legCl), oe = ld(K.legEx);
    if ((oc||oe) && getModules().length === 0) {
      const id = createModule('Mi Módulo', 'general');
      if (id) {
        const d = getModData(id);
        if (oc) d.classes = oc;
        if (oe) d.exams   = oe;
        saveModData(id, d);
      }
    }
  } catch(e) { console.warn('migrateOld error:', e); }
}

/* ── GUARDAR COMO ARCHIVO HTML (con datos embebidos) ── */
function saveHTML() {
  try {
    // Collect all localStorage CÓDICE keys
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('cdc_') || k.startsWith('codice_') || k.startsWith('ai_'))) {
        try { data[k] = JSON.parse(localStorage.getItem(k)); } catch(e) { data[k] = localStorage.getItem(k); }
      }
    }
    // Inject data into the HTML between markers
    let html = document.documentElement.outerHTML;
    const saveScript = `\n<script type="application/json" data-savedata="1">${JSON.stringify(data)}<\/script>\n`;
    html = html.replace(/<!--SAVEDATA_START-->[\s\S]*?<!--SAVEDATA_END-->/,
      '<!--SAVEDATA_START-->' + saveScript + '<!--SAVEDATA_END-->');
    const blob  = new Blob([html], { type:'text/html' });
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = 'CODICE_backup_' + new Date().toISOString().slice(0,10) + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('✓ Backup guardado con todos los datos', 'ok');
  } catch(e) { toast('Error al guardar: ' + e.message, 'err'); }
}

/* ── CARGAR DATOS EMBEBIDOS ── */
function loadEmbedded() {
  try {
    const marker = document.querySelector('script[data-savedata]');
    if (!marker) return;
    const raw = marker.textContent.trim();
    if (!raw) return;
    const data = JSON.parse(raw);
    let count = 0;
    Object.entries(data).forEach(([k,v]) => { guardarLocal(k, v); count++; });
    if (count > 0) toast('✓ ' + count + ' claves restauradas desde backup', 'ok');
  } catch(e) { console.warn('loadEmbedded:', e); }
}

/* ── TEMA ── */
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  guardarLocal(K.theme, document.body.classList.contains('light-mode') ? 'light' : 'dark');
  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon)  icon.textContent  = document.body.classList.contains('light-mode') ? '☀️' : '🌙';
  if (label) label.textContent = document.body.classList.contains('light-mode') ? 'Modo Claro' : 'Modo Oscuro';
}

function loadTheme() {
  const t = ld(K.theme);
  if (t === 'light') {
    document.body.classList.add('light-mode');
    const icon  = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon)  icon.textContent  = '☀️';
    if (label) label.textContent = 'Modo Claro';
  }
}

function requestNotif() {
  if ('Notification' in window) Notification.requestPermission();
}
