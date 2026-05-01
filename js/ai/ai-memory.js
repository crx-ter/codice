/* ═══════════════════════════════════
   CÓDICE — ai-memory.js
   Responsabilidad: Sistema de memoria contextual del chat IA. Guarda y recupera
                    sesiones de conversación, extrae hechos clave, construye resúmenes
                    de contexto para el system prompt.
   Depende de: storage.js (ld, sv, uid), ai-ui.js (_aiAddMessage)
   Expone: memGetSessions, memSaveSession, memClearSessions, memGetFacts,
           memSaveFact, memBuildContextSummary, memAutoSaveHook, initAIMemory,
           convGetAll, convSave, convSaveCurrent, convLoad, convDelete,
           convNew, convRenderPanel, convTogglePanel, convInjectStyles, convAutoSave
═══════════════════════════════════ */


/* ═══════════════════════ ai-memory.js ═══════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════
   CÓDICE AI MEMORY v1.0
   js/ai-memory.js — Sistema de memoria persistente para el chat de IA
   - Guarda las últimas 20 conversaciones en localStorage
   - Extrae "facts" del usuario para personalización
   - Muestra chips de memoria en el panel
═══════════════════════════════════════════════════════════════════════ */

const _MEM_KEY     = 'cdc_ai_memory_v1';
const _MEM_MAX     = 20;     // máx conversaciones guardadas
const _FACTS_MAX   = 8;      // máx facts en chips

/* ══════════════════════════════════════════════════════════════
   GUARDAR / LEER SESIONES
══════════════════════════════════════════════════════════════ */

function memGetSessions() {
  try { return JSON.parse(localStorage.getItem(_MEM_KEY) || '[]'); }
  catch(e) { return []; }
}

function memSaveSession(title, messages) {
  if (!messages || messages.length < 2) return;
  const sessions = memGetSessions();
  const session  = {
    id:    Date.now().toString(36),
    title: title || _memAutoTitle(messages),
    date:  Date.now(),
    msgs:  messages.slice(-20), // guardar últimos 20 mensajes de la sesión
  };
  // Evitar duplicado exacto
  if (sessions.length > 0 && sessions[0].title === session.title) return;
  sessions.unshift(session);
  if (sessions.length > _MEM_MAX) sessions.length = _MEM_MAX;
  try { localStorage.setItem(_MEM_KEY, JSON.stringify(sessions)); } catch(e) {}
  _memExtractFacts(messages);
  _memRenderChips();
}

function memClearSessions() {
  localStorage.removeItem(_MEM_KEY);
  localStorage.removeItem('cdc_ai_facts_v1');
  _memRenderChips();
}

/* ── Título automático de la sesión ── */
function _memAutoTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'Conversación';
  const t = (first.content || '').trim().slice(0, 48);
  return t.length < (first.content||'').length ? t + '…' : t;
}

/* ══════════════════════════════════════════════════════════════
   FACTS — Datos clave del usuario detectados en la conversación
══════════════════════════════════════════════════════════════ */

function memGetFacts() {
  try { return JSON.parse(localStorage.getItem('cdc_ai_facts_v1') || '[]'); }
  catch(e) { return []; }
}

function memSaveFact(fact) {
  const facts = memGetFacts();
  if (facts.includes(fact)) return;
  facts.unshift(fact);
  if (facts.length > _FACTS_MAX) facts.length = _FACTS_MAX;
  try { localStorage.setItem('cdc_ai_facts_v1', JSON.stringify(facts)); } catch(e) {}
}

/* Extrae facts simples de los mensajes del usuario */
function _memExtractFacts(messages) {
  const userMsgs = messages
    .filter(m => m.role === 'user')
    .map(m => m.content || '')
    .join(' ')
    .toLowerCase();

  const rules = [
    [/estudia[rndo]*\s+(.{4,30})/i,    m => '📚 Estudia ' + _cap(m[1])],
    [/soy\s+(estudiante|alumno)/i,      () => '🎓 Estudiante'],
    [/preparo\s+(.{4,30})/i,           m => '🎯 Prep: ' + _cap(m[1])],
    [/tengo\s+examen\s+de\s+(.{3,20})/i,m=> '📝 Examen: ' + _cap(m[1])],
    [/aprend[oe]r?\s+(.{4,24})/i,      m => '💡 Aprende ' + _cap(m[1])],
    [/mi\s+módulo\s+(?:es|de)\s+(.{3,20})/i, m => '📁 Módulo: '+_cap(m[1])],
  ];

  for (const [regex, builder] of rules) {
    const match = userMsgs.match(regex);
    if (match) { try { memSaveFact(builder(match)); } catch(e) {} }
  }
}

function _cap(s) {
  const t = s.trim().slice(0,24);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ══════════════════════════════════════════════════════════════
   RESUMEN DE MEMORIA PARA EL SYSTEM PROMPT
══════════════════════════════════════════════════════════════ */

function memBuildContextSummary() {
  const sessions = memGetSessions();
  const facts    = memGetFacts();

  let summary = '';

  if (facts.length > 0) {
    summary += '\nDATOS DEL USUARIO (de conversaciones previas):\n';
    summary += facts.map(f => '- ' + f).join('\n') + '\n';
  }

  if (sessions.length > 0) {
    summary += '\nCONVERSACIONES RECIENTES (últimas ' + Math.min(3, sessions.length) + '):\n';
    sessions.slice(0, 3).forEach(s => {
      const date = new Date(s.date).toLocaleDateString('es-MX', {day:'numeric',month:'short'});
      summary += `[${date}] "${s.title}"\n`;
    });
  }

  return summary;
}

/* ══════════════════════════════════════════════════════════════
   UI — CHIPS DE MEMORIA
══════════════════════════════════════════════════════════════ */

function _memRenderChips() {
  const bar = document.getElementById('aiMemoryBar');
  if (!bar) return;

  const facts    = memGetFacts();
  const sessions = memGetSessions();

  if (facts.length === 0 && sessions.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';

  const chipsHtml = [
    ...facts.map(f => `<div class="ai-chip" title="Dato recordado">${f}</div>`),
    sessions.length > 0
      ? `<div class="ai-chip" title="${sessions.length} conversaciones guardadas" onclick="_memShowHistory()" style="cursor:pointer;border-color:rgba(199,154,56,.3);color:var(--goldL)">🕓 ${sessions.length} conv.</div>`
      : '',
    `<div class="ai-chip" onclick="memClearSessions()" title="Limpiar memoria" style="cursor:pointer;color:rgba(239,68,68,.6);border-color:rgba(239,68,68,.2)">🗑️</div>`,
  ].join('');

  bar.innerHTML = `
    <span class="ai-memory-label">Memoria</span>
    ${chipsHtml}
  `;
}

function _memShowHistory() {
  const sessions = memGetSessions();
  if (!sessions.length) return;

  // Mostrar popup simple con historial
  const existing = document.getElementById('aiHistoryPopup');
  if (existing) { existing.remove(); return; }

  const popup = document.createElement('div');
  popup.id = 'aiHistoryPopup';
  popup.style.cssText = `
    position:absolute; bottom:100%; left:12px; right:12px; max-height:240px; overflow-y:auto;
    background:rgba(6,6,18,.96); backdrop-filter:blur(16px);
    border:1px solid rgba(124,58,237,.25); border-radius:12px;
    padding:10px; z-index:600; box-shadow:0 16px 48px rgba(0,0,0,.7);
    animation:msgIn .25s ease both;
  `;

  popup.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:rgba(124,58,237,.6);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Conversaciones Guardadas</div>
    ${sessions.map(s => {
      const date = new Date(s.date).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
      return `<div onclick="_memLoadSession('${s.id}')" style="padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:all .15s;margin-bottom:4px" onmouseover="this.style.background='rgba(124,58,237,.1)';this.style.borderColor='rgba(124,58,237,.2)'" onmouseout="this.style.background='';this.style.borderColor='transparent'">
        <div style="font-size:12px;font-weight:600;color:#f1f0ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.title}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:2px">${date} · ${s.msgs.length} mensajes</div>
      </div>`;
    }).join('')}
    <div onclick="document.getElementById('aiHistoryPopup').remove()" style="text-align:center;font-size:11px;color:rgba(255,255,255,.2);cursor:pointer;margin-top:6px;padding:4px">Cerrar ×</div>
  `;

  const panel = document.getElementById('globalNotesPanel');
  if (panel) { panel.style.position = 'relative'; panel.appendChild(popup); }
  setTimeout(() => document.addEventListener('click', function handler(e) {
    if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', handler); }
  }), 100);
}

function _memLoadSession(sid) {
  document.getElementById('aiHistoryPopup')?.remove();
  const sessions = memGetSessions();
  const session  = sessions.find(s => s.id === sid);
  if (!session) return;

  // Cargar mensajes en el historial de la IA
  if (typeof _aiHistory !== 'undefined') {
    window._aiHistory = session.msgs.map(m => ({ role: m.role, content: m.content }));
  }

  // Renderizar mensajes en el chat
  const container = document.getElementById('aiChatMessages');
  if (!container) return;
  container.innerHTML = '';

  session.msgs.forEach(m => {
    if (typeof _aiAddMessage === 'function') _aiAddMessage(m.role, m.content);
  });

  if (typeof toast === 'function') toast('Conversación cargada', 'ok');
}

/* ══════════════════════════════════════════════════════════════
   HOOK — Guardar sesión automáticamente al cerrar el panel
══════════════════════════════════════════════════════════════ */

function memAutoSaveHook() {
  // Parchear toggleGlobalNotes para auto-guardar
  const _origToggle = window.toggleGlobalNotes;
  if (typeof _origToggle === 'function') {
    window.toggleGlobalNotes = function() {
      // Si el panel está visible, guardar antes de cerrar
      const panel = document.getElementById('globalNotesPanel');
      const isVisible = panel?.classList.contains('visible') || panel?.style.display === 'flex';
      if (isVisible && typeof window._aiHistory !== 'undefined' && window._aiHistory.length >= 2) {
        memSaveSession(null, window._aiHistory);
      }
      _origToggle.apply(this, arguments);
    };
  }
}

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */

function initAIMemory() {
  _memRenderChips();
  memAutoSaveHook();
}

// Init controlled by index.html

window.memGetFacts         = memGetFacts;
window.memGetSessions      = memGetSessions;
window.memSaveSession      = memSaveSession;
window.memClearSessions    = memClearSessions;
window.memBuildContextSummary = memBuildContextSummary;
window._memShowHistory     = _memShowHistory;
window._memLoadSession     = _memLoadSession;
window._memRenderChips     = _memRenderChips;



/* ── GESTOR DE CONVERSACIONES ── */

/* ═══════════════════════ codice-conversations.js ═══════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════
   CÓDICE — Conversation Manager v1.0
   Guarda, lista, carga y borra conversaciones completas del chat IA.
   Storage: localStorage bajo la clave 'cdc_conversations'
═══════════════════════════════════════════════════════════════════════ */

const CONV_KEY = 'cdc_conversations';
const CONV_MAX = 50; // máximo de conversaciones guardadas

/* ── Lectura / escritura ── */
function convGetAll() {
  try { const v = localStorage.getItem(CONV_KEY); return v ? JSON.parse(v) : []; }
  catch(e) { return []; }
}
function convSave(list) {
  try { localStorage.setItem(CONV_KEY, JSON.stringify(list)); } catch(e) {}
}

/* ── Crear nueva conversación (o guardar la activa) ── */
function convSaveCurrent(title) {
  if (!window._aiHistory || window._aiHistory.length < 2) {
    if (typeof toast === 'function') toast('La conversación está vacía', 'err'); return;
  }
  const list = convGetAll();
  const id   = 'conv_' + Date.now();
  const auto = (window._aiHistory.find(m => m.role === 'user')?.content || 'Conversación').slice(0, 60);
  list.unshift({ id, title: title || auto, messages: [...window._aiHistory], date: Date.now(), module: (typeof CURRENT_MODULE !== 'undefined' && CURRENT_MODULE) ? CURRENT_MODULE.name : '' });
  if (list.length > CONV_MAX) list.length = CONV_MAX;
  convSave(list);
  if (typeof toast === 'function') toast('✓ Conversación guardada', 'ok');
  convRenderPanel();
}

/* ── Cargar una conversación ── */
function convLoad(id) {
  const conv = convGetAll().find(c => c.id === id);
  if (!conv) return;
  window._aiHistory = [...conv.messages];
  /* Repintar el chat */
  const container = document.getElementById('aiChatMessages');
  if (!container) return;
  container.innerHTML = '';
  conv.messages.forEach(m => {
    if (typeof _aiAddMessage === 'function') _aiAddMessage(m.role === 'user' ? 'user' : 'bot', m.content);
  });
  if (typeof toast === 'function') toast('Conversación cargada', 'ok');
  convRenderPanel();
}

/* ── Borrar una conversación ── */
function convDelete(id) {
  if (!confirm('¿Eliminar esta conversación?')) return;
  const list = convGetAll().filter(c => c.id !== id);
  convSave(list);
  convRenderPanel();
  if (typeof toast === 'function') toast('Conversación eliminada', 'ok');
}

/* ── Nueva conversación vacía ── */
function convNew() {
  if (window._aiHistory && window._aiHistory.length >= 2) {
    if (confirm('¿Guardar la conversación actual antes de crear una nueva?')) {
      convSaveCurrent();
    }
  }
  window._aiHistory = [];
  if (typeof clearAIChat === 'function') clearAIChat();
  convRenderPanel();
}

/* ── Formatear fecha ── */
function convFmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)   return 'Ahora';
  if (diff < 3600) return Math.floor(diff/60) + 'm';
  if (diff < 86400) return Math.floor(diff/3600) + 'h';
  return d.toLocaleDateString('es-MX', { day:'numeric', month:'short' });
}

/* ── Renderizar panel de conversaciones ── */
function convRenderPanel() {
  const panel = document.getElementById('convHistoryPanel');
  if (!panel || panel.style.display === 'none') return;

  const list = convGetAll();
  const hasActive = window._aiHistory && window._aiHistory.length >= 2;

  panel.innerHTML = `
    <div class="conv-panel-head">
      <span class="conv-panel-title">💬 Conversaciones</span>
      <button class="conv-close-btn" onclick="convTogglePanel()">✕</button>
    </div>
    <div class="conv-panel-actions">
      <button class="conv-btn-new" onclick="convNew()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nueva
      </button>
      ${hasActive ? `<button class="conv-btn-save" onclick="convSaveCurrent()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        Guardar actual
      </button>` : ''}
    </div>
    <div class="conv-list">
      ${list.length === 0 ? '<div class="conv-empty">Sin conversaciones guardadas</div>' :
        list.map(c => `
          <div class="conv-item" onclick="convLoad('${c.id}')">
            <div class="conv-item-body">
              <div class="conv-item-title">${escConv(c.title)}</div>
              <div class="conv-item-meta">
                ${c.module ? `<span class="conv-module-tag">${escConv(c.module)}</span>` : ''}
                <span>${convFmtDate(c.date)}</span>
                <span>${c.messages.length} msgs</span>
              </div>
            </div>
            <button class="conv-del-btn" onclick="event.stopPropagation();convDelete('${c.id}')" title="Eliminar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>`).join('')}
    </div>`;
}

function escConv(t) {
  const d = document.createElement('div'); d.textContent = String(t||''); return d.innerHTML;
}

/* ── Toggle panel ── */
function convTogglePanel() {
  let panel = document.getElementById('convHistoryPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'convHistoryPanel';
    const aiPanel = document.getElementById('globalNotesPanel');
    if (aiPanel) aiPanel.appendChild(panel);
    else document.body.appendChild(panel);
  }
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) convRenderPanel();
}

/* ── Estilos ── */
function convInjectStyles() {
  if (document.getElementById('convStyles')) return;
  const s = document.createElement('style');
  s.id = 'convStyles';
  s.textContent = `
#convHistoryPanel {
  position:absolute; inset:0; background:rgba(6,6,14,.97);
  backdrop-filter:blur(12px); z-index:20;
  flex-direction:column; border-radius:inherit; overflow:hidden;
}
.conv-panel-head {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px; background:linear-gradient(135deg,rgba(30,10,70,.9),rgba(15,8,40,.9));
  border-bottom:1px solid rgba(124,58,237,.15); flex-shrink:0;
}
.conv-panel-title { font-size:14px; font-weight:700; color:#f1f0ff; }
.conv-close-btn {
  background:none; border:none; color:rgba(255,255,255,.4); font-size:18px;
  cursor:pointer; border-radius:6px; padding:2px 6px; transition:all .15s;
}
.conv-close-btn:hover { background:rgba(239,68,68,.15); color:#f87171; }
.conv-panel-actions {
  display:flex; gap:8px; padding:10px 12px;
  border-bottom:1px solid rgba(255,255,255,.05); flex-shrink:0;
}
.conv-btn-new, .conv-btn-save {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 12px; border-radius:8px; border:none; cursor:pointer;
  font-size:12px; font-weight:600; font-family:inherit; transition:all .15s;
}
.conv-btn-new {
  background:rgba(124,58,237,.15); border:1px solid rgba(124,58,237,.3); color:#a78bfa;
}
.conv-btn-new:hover { background:rgba(124,58,237,.3); }
.conv-btn-save {
  background:rgba(199,154,56,.1); border:1px solid rgba(199,154,56,.3); color:var(--goldL,#c79a38);
}
.conv-btn-save:hover { background:rgba(199,154,56,.2); }
.conv-list { flex:1; overflow-y:auto; padding:8px; scrollbar-width:thin; scrollbar-color:rgba(124,58,237,.2) transparent; }
.conv-list::-webkit-scrollbar { width:3px; }
.conv-list::-webkit-scrollbar-thumb { background:rgba(124,58,237,.2); border-radius:2px; }
.conv-empty { text-align:center; padding:32px 16px; color:rgba(255,255,255,.2); font-size:13px; }
.conv-item {
  display:flex; align-items:flex-start; gap:8px; padding:10px 12px;
  border-radius:10px; cursor:pointer; margin-bottom:4px;
  background:rgba(255,255,255,.03); border:1px solid transparent;
  transition:all .18s;
}
.conv-item:hover { background:rgba(124,58,237,.1); border-color:rgba(124,58,237,.2); }
.conv-item-body { flex:1; min-width:0; }
.conv-item-title { font-size:12.5px; font-weight:600; color:var(--txt,#e8e8f0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px; }
.conv-item-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.conv-item-meta span { font-size:10px; color:rgba(255,255,255,.3); }
.conv-module-tag { background:rgba(124,58,237,.12); border:1px solid rgba(124,58,237,.2); color:#a78bfa !important; padding:1px 6px; border-radius:8px; }
.conv-del-btn {
  background:none; border:none; color:rgba(255,255,255,.2); cursor:pointer;
  padding:4px; border-radius:6px; flex-shrink:0; transition:all .15s;
  display:flex; align-items:center; justify-content:center;
}
.conv-del-btn:hover { background:rgba(239,68,68,.15); color:#f87171; }
`;
  document.head.appendChild(s);
}

/* ── Auto-save cada vez que el bot responde ── */
function convAutoSave() {
  if (!window._aiHistory || window._aiHistory.length < 2) return;
  const list = convGetAll();
  /* buscar si ya existe una conv activa (la más reciente sin título manual) */
  const existing = list.find(c => c._auto && c.id === window._convActiveId);
  const title = (window._aiHistory.find(m => m.role === 'user')?.content || 'Chat').slice(0, 60);
  if (existing) {
    existing.messages = [...window._aiHistory];
    existing.date = Date.now();
    existing.title = title;
  } else {
    const id = 'conv_auto_' + Date.now();
    window._convActiveId = id;
    list.unshift({ id, title, messages: [...window._aiHistory], date: Date.now(), _auto: true, module: (typeof CURRENT_MODULE !== 'undefined' && CURRENT_MODULE) ? CURRENT_MODULE.name : '' });
    if (list.length > CONV_MAX) list.length = CONV_MAX;
  }
  convSave(list);
}

window.convSaveCurrent = convSaveCurrent;
window.convLoad        = convLoad;
window.convDelete      = convDelete;
window.convNew         = convNew;
window.convTogglePanel = convTogglePanel;
window.convRenderPanel = convRenderPanel;
window.convAutoSave    = convAutoSave;
window.convInjectStyles = convInjectStyles;

