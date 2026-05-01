/* ═══════════════════════════════════
   CÓDICE — firebase-sync.js
   Responsabilidad: Sincronización con Firebase, autenticación, panel de cuenta.
                    Define _fbQueueSync() que sv() invoca al guardar.
   Depende de: storage.js (ld, sv, toast)
   Expone: toggleAuthPanel, fbLogin, fbLogout, fbRegister, fbAnonLogin,
           guardarEnNube, cargarDesdeNube, _fbQueueSync, initFirebase
═══════════════════════════════════ */

/* ═══════════════════════ firebase-sync.js ═══════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════
   CÓDICE — firebase-sync.js v3
   Firebase Auth + Firestore — Sincronización completa entre dispositivos

   CONFIGURACIÓN RÁPIDA (2 minutos):
   ───────────────────────────────────────────────────────────────────────────
   1. Ve a https://console.firebase.google.com
   2. Crea proyecto → Agrega app Web → copia el objeto firebaseConfig
   3. Activa: Authentication → Métodos de inicio de sesión:
        ✅ Correo/Contraseña
        ✅ Anónimo
   4. Activa: Firestore Database → Crear base de datos → modo "producción"
      Agrega esta regla en "Reglas":
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /users/{uid}/{document=**} {
              allow read, write: if request.auth != null && request.auth.uid == uid;
            }
          }
        }
   5. Pega tu config en FIREBASE_CONFIG abajo y guarda el archivo.

   Las credenciales son TUYAS — nadie más puede ver tus datos porque
   Firestore solo permite acceso a documentos del propio UID autenticado.
═══════════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════
// 🔑 TU CONFIGURACIÓN FIREBASE — pega aquí tus credenciales
// ══════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROYECTO_ID",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};
// ══════════════════════════════════════════════════════════

// ── Estado central ──
const FB = {
  app: null, db: null, auth: null, fn: {},
  ready: false, user: null,
  enabled: FIREBASE_CONFIG.apiKey !== 'TU_API_KEY',
  queue: new Set(), timer: null, listener: null,
  online: navigator.onLine, offlineQ: [],
  lastPush: 0, lastPull: 0,
};

// ── Logging silencioso ──
const _fbLog  = (...a) => { try { console.log('🔥',...a); } catch(e){} };
const _fbWarn = (...a) => { try { console.warn('🔥',...a); } catch(e){} };

// ── Indicador de estado en el sidebar ──
function _fbSetStatus(msg, state='ok') {
  try {
    const dot = document.getElementById('sbStatusDot');
    const txt = document.getElementById('statusTxt');
    const col = {ok:'var(--green)',warn:'var(--orange)',err:'var(--red)',sync:'var(--blueL)'};
    if (dot) dot.style.background = col[state]||col.ok;
    if (txt) txt.textContent = msg;
    if (state !== 'ok') setTimeout(() => {
      if (txt) txt.textContent = FB.user
        ? `☁️ ${FB.user.isAnonymous?'Anónimo':FB.user.email?.split('@')[0]||'Usuario'}`
        : 'Auto-guardado activo';
      if (dot) dot.style.background = col.ok;
    }, 3500);
  } catch(e) {}
}

// ── Referencia al documento del usuario ──
function _fbRef() {
  if (!FB.db || !FB.user) return null;
  try { return FB.fn.doc(FB.db, 'users', FB.user.uid, 'data', 'main'); }
  catch(e) { return null; }
}

// ── Serialización de datos ──
function _fbBuildPayload() {
  const p = { lastUpdated: Date.now(), modules:{}, settings:{}, progress:{} };
  try {
    const mods = ld(K.modules) || [];
    p.modules.list    = mods;
    p.settings.active = ld(K.active);
    p.settings.theme  = ld(K.theme);
    p.settings.notes  = ld('globalNotes');
    mods.forEach(m => {
      const raw = localStorage.getItem('cdc_mod_' + m.id);
      if (raw !== null) p.progress['mod_' + m.id] = raw;
    });
  } catch(e) { _fbWarn('buildPayload:', e.message); }
  return p;
}

// ── Aplicar datos descargados ──
function _fbApplyPayload(data, force=false) {
  try {
    if (!data) return;
    const localTS = parseInt(localStorage.getItem('cdc_lastUpdated')||'0');
    if (!force && data.lastUpdated && data.lastUpdated <= localTS) return;
    if (data.settings) {
      if (data.settings.active != null && !localStorage.getItem(K.active))
        localStorage.setItem(K.active, JSON.stringify(data.settings.active));
      if (data.settings.theme  != null)
        localStorage.setItem(K.theme,  JSON.stringify(data.settings.theme));
      if (data.settings.notes  != null)
        localStorage.setItem('globalNotes', JSON.stringify(data.settings.notes));
    }
    if (data.modules?.list?.length && !(ld(K.modules)||[]).length)
      localStorage.setItem(K.modules, JSON.stringify(data.modules.list));
    if (data.progress) {
      Object.keys(data.progress).forEach(key => {
        const lsKey = 'cdc_' + key;
        if (localStorage.getItem(lsKey) === null)
          localStorage.setItem(lsKey, data.progress[key]);
      });
    }
    localStorage.setItem('cdc_lastUpdated', String(data.lastUpdated||Date.now()));
    _fbLog('Payload aplicado ✓');
  } catch(e) { _fbWarn('applyPayload:', e.message); }
}

// ══════════════════════════════════════════════════════════
// INICIALIZACIÓN DEL SDK
// ══════════════════════════════════════════════════════════
async function initFirebase() {
  if (!FB.enabled) {
    _fbLog('Firebase no configurado — modo offline');
    // Mostrar guía de configuración en el panel de auth
    _fbUpdateAuthUI();
    return;
  }
  try {
    const [
      { initializeApp },
      { getFirestore, doc, getDoc, setDoc, onSnapshot },
      { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
        signInAnonymously, signOut, onAuthStateChanged }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    ]);
    FB.app  = initializeApp(FIREBASE_CONFIG);
    FB.db   = getFirestore(FB.app);
    FB.auth = getAuth(FB.app);
    FB.fn   = { doc,getDoc,setDoc,onSnapshot,signInWithEmailAndPassword,
                createUserWithEmailAndPassword,signInAnonymously,signOut,onAuthStateChanged };
    FB.ready = true;
    _fbLog('SDK cargado ✓');
    FB.fn.onAuthStateChanged(FB.auth, _fbOnAuthChange);
  } catch(e) {
    _fbWarn('Error SDK:', e.message);
    FB.ready = false;
    _fbSetStatus('⚠️ Firebase: error de conexión', 'warn');
  }
}

// ══════════════════════════════════════════════════════════
// SESIÓN DE USUARIO
// ══════════════════════════════════════════════════════════
async function _fbOnAuthChange(user) {
  FB.user = user;
  _fbUpdateAuthUI();
  if (user) {
    _fbLog('Sesión:', user.isAnonymous ? 'Anónimo' : user.email);
    _fbSetStatus('☁️ Conectando...', 'sync');
    await _fbPullFromCloud(false);
    _fbStartListener();
    _fbFlushOfflineQueue();
    _fbSetStatus(`☁️ ${user.isAnonymous?'Anónimo':user.email.split('@')[0]}`, 'ok');
  } else {
    _fbStopListener();
    _fbSetStatus('Auto-guardado activo', 'ok');
  }
}

function _fbUpdateAuthUI() {
  try {
    const panelLogin = document.getElementById('fbPanelLogin');
    const panelUser  = document.getElementById('fbPanelUser');
    const panelSetup = document.getElementById('fbPanelSetup');
    const emailEl    = document.getElementById('fbUserEmail');
    const syncInfo   = document.getElementById('fbSyncInfo');
    const authBtn    = document.getElementById('sbAuthBtn');

    if (!panelLogin) return;

    if (!FB.enabled) {
      // Mostrar panel de configuración
      if (panelLogin) panelLogin.style.display = 'none';
      if (panelUser)  panelUser.style.display  = 'none';
      if (panelSetup) panelSetup.style.display = 'block';
      if (authBtn)    { authBtn.textContent='⚙️'; authBtn.title='Configurar Firebase'; }
      return;
    }

    if (FB.user) {
      if (panelLogin)  panelLogin.style.display  = 'none';
      if (panelUser)   panelUser.style.display   = 'block';
      if (panelSetup)  panelSetup.style.display  = 'none';
      if (emailEl) emailEl.textContent = FB.user.isAnonymous
        ? '👻 Sesión anónima (datos solo en este proyecto)'
        : `✉️ ${FB.user.email}`;
      if (syncInfo) syncInfo.innerHTML =
        `<strong>UID:</strong> ${FB.user.uid.slice(0,16)}…<br>` +
        `<strong>Último push:</strong> ${FB.lastPush?new Date(FB.lastPush).toLocaleTimeString('es-MX'):'—'}<br>` +
        `<strong>Último pull:</strong> ${FB.lastPull?new Date(FB.lastPull).toLocaleTimeString('es-MX'):'—'}<br>` +
        `<strong>Conexión:</strong> ${FB.online?'🟢 Online':'🟠 Offline (cola activa)'}`;
      if (authBtn) { authBtn.textContent='☁️'; authBtn.title='Cuenta conectada'; }
    } else {
      if (panelLogin)  panelLogin.style.display  = 'block';
      if (panelUser)   panelUser.style.display   = 'none';
      if (panelSetup)  panelSetup.style.display  = 'none';
      if (authBtn) { authBtn.textContent='👤'; authBtn.title='Iniciar sesión'; }
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════
// AUTH — Login / Registro / Anónimo / Logout
// ══════════════════════════════════════════════════════════
async function fbLogin() {
  if (!FB.ready) { _fbShowAuthErr('Firebase no está inicializado. Verifica tu configuración.'); return; }
  const email = document.getElementById('fbEmail')?.value.trim();
  const pass  = document.getElementById('fbPass')?.value;
  _fbClearAuthErr();
  if (!email||!pass) { _fbShowAuthErr('Ingresa tu correo y contraseña'); return; }
  try {
    _fbShowAuthLoading(true);
    await FB.fn.signInWithEmailAndPassword(FB.auth, email, pass);
    toggleAuthPanel();
    toast('✓ Sesión iniciada — sincronizando...', 'ok');
  } catch(e) {
    _fbShowAuthErr(_fbErrMsg(e.code));
  } finally { _fbShowAuthLoading(false); }
}

async function fbRegister() {
  if (!FB.ready) { _fbShowAuthErr('Firebase no está inicializado.'); return; }
  const email = document.getElementById('fbEmail')?.value.trim();
  const pass  = document.getElementById('fbPass')?.value;
  _fbClearAuthErr();
  if (!email||!pass) { _fbShowAuthErr('Ingresa tu correo y contraseña'); return; }
  if (pass.length < 6) { _fbShowAuthErr('La contraseña debe tener mínimo 6 caracteres'); return; }
  try {
    _fbShowAuthLoading(true);
    await FB.fn.createUserWithEmailAndPassword(FB.auth, email, pass);
    // Subir datos existentes de localStorage al registrarse
    await syncTodoANube();
    toggleAuthPanel();
    toast('✓ Cuenta creada — datos sincronizados', 'ok');
  } catch(e) {
    _fbShowAuthErr(_fbErrMsg(e.code));
  } finally { _fbShowAuthLoading(false); }
}

async function fbAnonLogin() {
  if (!FB.ready) { _fbShowAuthErr('Firebase no está inicializado.'); return; }
  try {
    _fbShowAuthLoading(true);
    await FB.fn.signInAnonymously(FB.auth);
    toggleAuthPanel();
    toast('Sesión anónima iniciada', 'ok');
  } catch(e) {
    _fbShowAuthErr('Error al iniciar sesión anónima: ' + (e.message||''));
  } finally { _fbShowAuthLoading(false); }
}

async function fbLogout() {
  if (!FB.auth) return;
  if (!confirm('¿Cerrar sesión?\n\nTus datos quedan guardados localmente.')) return;
  try {
    await syncTodoANube(); // último push
    await FB.fn.signOut(FB.auth);
    toast('Sesión cerrada', 'ok');
  } catch(e) { _fbWarn('Logout error:', e.message); }
}

function _fbErrMsg(code) {
  return ({
    'auth/user-not-found':       'Usuario no encontrado. ¿Ya tienes cuenta?',
    'auth/wrong-password':       'Contraseña incorrecta',
    'auth/invalid-credential':   'Correo o contraseña incorrectos',
    'auth/email-already-in-use': 'Este correo ya tiene una cuenta. Inicia sesión.',
    'auth/invalid-email':        'Formato de correo inválido',
    'auth/weak-password':        'Contraseña muy corta (mínimo 6 caracteres)',
    'auth/too-many-requests':    'Demasiados intentos. Espera unos minutos.',
    'auth/network-request-failed':'Sin conexión a internet',
    'auth/operation-not-allowed':'Este método de inicio de sesión no está activado en Firebase Console',
  })[code] || `Error (${code||'desconocido'}). Intenta de nuevo.`;
}

function _fbShowAuthErr(msg) {
  const el = document.getElementById('fbAuthErr');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function _fbClearAuthErr() {
  const el = document.getElementById('fbAuthErr');
  if (el) el.style.display = 'none';
}
function _fbShowAuthLoading(on) {
  const btn = document.getElementById('fbLoginBtn');
  if (btn) btn.disabled = on;
  const btn2 = document.getElementById('fbRegisterBtn');
  if (btn2) btn2.disabled = on;
}

// ── Toggle panel ──
function toggleAuthPanel() {
  const ov = document.getElementById('fbAuthOverlay');
  if (!ov) return;
  const showing = ov.style.display === 'flex';
  ov.style.display = showing ? 'none' : 'flex';
  if (!showing) { _fbClearAuthErr(); _fbUpdateAuthUI(); }
}
document.addEventListener('click', e => {
  const ov = document.getElementById('fbAuthOverlay');
  if (ov && e.target === ov) ov.style.display = 'none';
});

// ══════════════════════════════════════════════════════════
// PUSH — guardar en la nube
// ══════════════════════════════════════════════════════════
async function guardarEnNube(keys) {
  if (!FB.ready||!FB.db||!FB.user) return;
  try {
    const ref = _fbRef(); if (!ref) return;
    await FB.fn.setDoc(ref, _fbBuildPayload(), { merge: true });
    FB.lastPush = Date.now();
    localStorage.setItem('cdc_lastUpdated', String(FB.lastPush));
    _fbSetStatus('☁️ Guardado en la nube ✓', 'ok');
    _fbLog('Push OK');
  } catch(e) {
    _fbWarn('Push error:', e.message);
    if (!navigator.onLine) _fbOfflineEnqueue(keys||[]);
  }
}

// ══════════════════════════════════════════════════════════
// PULL — cargar desde la nube
// ══════════════════════════════════════════════════════════
async function cargarDesdeNube() { return _fbPullFromCloud(true); }

async function _fbPullFromCloud(force=false) {
  if (!FB.ready||!FB.db||!FB.user) return false;
  try {
    const ref = _fbRef(); if (!ref) return false;
    const snap = await FB.fn.getDoc(ref);
    if (!snap.exists()) { _fbLog('Sin datos en la nube'); return false; }
    _fbApplyPayload(snap.data(), force);
    FB.lastPull = Date.now();
    _fbLog('Pull OK');
    return true;
  } catch(e) { _fbWarn('Pull error:', e.message); return false; }
}

// ══════════════════════════════════════════════════════════
// TIEMPO REAL — onSnapshot
// ══════════════════════════════════════════════════════════
function _fbStartListener() {
  _fbStopListener();
  const ref = _fbRef(); if (!ref) return;
  try {
    FB.listener = FB.fn.onSnapshot(ref, snap => {
      if (!snap.exists()) return;
      const data    = snap.data();
      const localTS = parseInt(localStorage.getItem('cdc_lastUpdated')||'0');
      if ((data.lastUpdated||0) > localTS + 2000) {
        _fbApplyPayload(data, false);
        try {
          if (typeof CURRENT_MODULE!=='undefined'&&CURRENT_MODULE) {
            if (typeof buildSidebar==='function') buildSidebar();
            if (typeof go==='function'&&typeof VIEW!=='undefined') go(VIEW);
          }
        } catch(e) {}
        _fbSetStatus('☁️ Actualizado desde otro dispositivo', 'sync');
        FB.lastPull = Date.now();
      }
    }, err => _fbWarn('onSnapshot:', err.message));
  } catch(e) { _fbWarn('Listener error:', e.message); }
}
function _fbStopListener() {
  if (FB.listener) { try{FB.listener();}catch(e){} FB.listener=null; }
}

// ══════════════════════════════════════════════════════════
// SYNC COMPLETO
// ══════════════════════════════════════════════════════════
async function syncTodoANube() {
  if (!FB.ready||!FB.db||!FB.user) return;
  _fbSetStatus('☁️ Sincronizando...','sync');
  await guardarEnNube(null);
}

// ── Auto-sync con debounce (llamado por sv() en app.js) ──
function _fbQueueSync(key) {
  if (!FB.ready||!FB.user) return;
  if (!FB.online) { _fbOfflineEnqueue([key]); return; }
  FB.queue.add(key);
  clearTimeout(FB.timer);
  FB.timer = setTimeout(async () => {
    const keys = [...FB.queue]; FB.queue.clear();
    await guardarEnNube(keys);
  }, 1500);
}

// ── Offline queue ──
function _fbOfflineEnqueue(keys) {
  FB.offlineQ.push({ keys, ts: Date.now() });
  _fbSetStatus('🔌 Offline — cambios en cola','warn');
}
async function _fbFlushOfflineQueue() {
  if (!FB.online||!FB.user||!FB.offlineQ.length) return;
  FB.offlineQ = [];
  await syncTodoANube();
}
window.addEventListener('online',  () => { FB.online=true;  _fbFlushOfflineQueue(); _fbSetStatus('☁️ Reconectado','ok'); });
window.addEventListener('offline', () => { FB.online=false; _fbSetStatus('🔌 Modo offline','warn'); });

// ── Botones del panel ──
async function fbForcePush() {
  if (!FB.user) { toast('Inicia sesión primero','err'); return; }
  toast('⬆️ Subiendo datos...','ok');
  await syncTodoANube();
  _fbUpdateAuthUI();
  toast('✓ Datos subidos a la nube','ok');
}
async function fbForcePull() {
  if (!FB.user) { toast('Inicia sesión primero','err'); return; }
  const ok = await _fbPullFromCloud(true);
  if (ok) {
    _fbUpdateAuthUI();
    toast('⬇️ Datos descargados','ok');
    setTimeout(() => {
      try {
        if (typeof CURRENT_MODULE!=='undefined'&&CURRENT_MODULE&&typeof initApp==='function') initApp();
        else if (typeof showModuleSelector==='function') showModuleSelector();
      } catch(e){}
    }, 400);
  } else { toast('Sin datos en la nube todavía','err'); }
}

// ══════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════
async function bootFirebase() {
  await initFirebase();
  // onAuthStateChanged gestiona todo lo demás automáticamente
}