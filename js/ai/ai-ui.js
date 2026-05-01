/* ═══════════════════════════════════
   CÓDICE — ai-ui.js
   Responsabilidad: UI del panel de chat IA. Renderizado de mensajes, typing indicator,
                    formateo de texto, quiz modal de IA, panel de conversaciones.
   Depende de: storage.js, router.js, ai-engine.js, ai-parser.js (_cai_md), ai-memory.js
   Expone: _aiAddMessage, _aiAddTyping, _aiFormatText, _aiTriggerMath,
           clearAIChat, openAIQuizModal, generateAIQuiz, saveAIQuiz,
           initializeAIUI, enhanceAISetupModalStyle
═══════════════════════════════════ */

/* _aiHistory — single source of truth via window._aiHistory (shared with ai-memory.js) */
if (!window._aiHistory) window._aiHistory = [];
var _aiHistory = window._aiHistory; // alias

function _aiAddMessage(role, text) {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${role==='user'?'user':'bot'}`;
  const now = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  div.innerHTML = `
    <div class="ai-bubble ai-bubble-${role==='user'?'user':'bot'}">${_aiFormatText(text)}</div>
    <div class="ai-time">${now}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  if (role !== 'user' && typeof _aiTriggerMath === 'function') _aiTriggerMath(div);
}
function _aiAddTyping(id) {
  const container = document.getElementById('aiChatMessages');
  if (!container) return id;
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-bot';
  if (id) div.id = id;
  else div.id = 'typing_' + Date.now();
  div.innerHTML = `<div class="ai-bubble ai-bubble-bot"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div.id;
}

function _aiFormatText(raw) {
  /* Delegar al motor unificado _cai_md si está disponible */
  if (typeof _cai_md === 'function') return _cai_md(raw);
  /* Fallback básico */
  return raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function _aiTriggerMath(container) {
  if (window.MathJax?.typesetPromise) MathJax.typesetPromise([container]).catch(()=>{});
}

function clearAIChat() {
  if (typeof CAI !== 'undefined') CAI._history = [];
  window._aiHistory = [];
  const c = document.getElementById('aiChatMessages');
  if (c) c.innerHTML = `<div class="ai-msg ai-msg-bot">
    <div class="ai-bubble ai-bubble-bot">Chat reiniciado. ¿En qué te ayudo?</div>
    <div class="ai-time">Ahora</div></div>`;
}

/* ══════════════════════════════════════════════════════════════
   QUIZ CON IA
══════════════════════════════════════════════════════════════ */
let _aiQuizCtx = null;

function openAIQuizModal(cid, bid, wid) {
  _aiQuizCtx = {cid, bid, wid: wid||null};
  _quizCid = cid; _quizBid = bid;
  if (typeof _quizWid !== 'undefined') _quizWid = wid||null;

  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  let b;
  if (wid) { const w=c?.weeks?.find(x=>x.id===wid); b=w?.bloques?.find(x=>x.id===bid); }
  else     { b=c?.bloques?.find(x=>x.id===bid); }

  const bloqueText = b
    ? (b.titulo + ':\n' + (b.contenido||'').replace(/<[^>]*>/g,'').slice(0,800))
    : '';

  const promptEl = document.getElementById('aiQuizPrompt');
  const ctxEl    = document.getElementById('aiQuizContext');
  const res      = document.getElementById('aiQuizResult');
  const saveBtn  = document.getElementById('aiQuizSaveBtn');

  if (promptEl) promptEl.value = b ? `Crea un quiz sobre: ${b.titulo}` : '';
  if (ctxEl)    ctxEl.value    = bloqueText;
  if (res)      res.style.display = 'none';
  if (saveBtn)  saveBtn.style.display = 'none';
  window._aiQuizData = null;
  openM('mAIQuiz');
}

async function generateAIQuiz() {
  const apiKey  = ld('ai_api_key');
  const prompt  = document.getElementById('aiQuizPrompt')?.value.trim();
  const context = document.getElementById('aiQuizContext')?.value.trim();
  if (!prompt) { toast('Describe el quiz que quieres','err'); return; }

  const btn = document.getElementById('aiQuizGenBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Generando...'; }

  const systemMsg = 'Eres un generador de quizzes educativos. Responde ÚNICAMENTE con JSON válido, sin texto extra, sin markdown, sin backticks.';
  const userMsg   = `Genera un quiz de opción múltiple (4 opciones) sobre lo siguiente.
${context ? `CONTEXTO DEL BLOQUE:\n${context}\n` : ''}SOLICITUD: ${prompt}

Responde EXACTAMENTE con este JSON (sin nada más):
{"pregunta":"la pregunta completa aquí","opciones":["Opción A completa","Opción B completa","Opción C completa","Opción D completa"],"correcta":0,"explicacion":"por qué es correcta"}
El campo "correcta" es el índice (0=A, 1=B, 2=C, 3=D).`;

  try {
    let responseText;

    if (!apiKey) {
      // Sin API Key: quiz básico de demostración
      responseText = JSON.stringify({
        pregunta:   prompt.replace(/^crea\s+un\s+quiz\s+sobre\s*/i,'').replace(/[.?!]$/,'') + ' — ¿cuál es la respuesta correcta?',
        opciones:   ['Opción A','Opción B (correcta — configura API Key para quizzes reales)','Opción C','Opción D'],
        correcta:   1,
        explicacion:'Configura una API Key en ⚙️ para generar quizzes reales con IA.',
      });
    } else {
      const prov    = ld('ai_provider') || 'openrouter';
      const model   = ld('ai_model')    || 'qwen/qwen3.6-plus:free';
      const history = []; // sin historial para quizzes

      switch(prov) {
        case 'openrouter': responseText = await _callOpenRouter(apiKey, model, systemMsg, history, userMsg); break;
        case 'openai':     responseText = await _callOpenAI(apiKey, model, systemMsg, history, userMsg);     break;
        case 'groq':       responseText = await _callGroq(apiKey, model, systemMsg, history, userMsg);       break;
        case 'gemini':     responseText = await _callGemini(apiKey, model, systemMsg, history, userMsg);     break;
        default:           responseText = await _callOpenRouter(apiKey, model, systemMsg, history, userMsg);
      }
    }

    // Extraer JSON de la respuesta (puede venir con texto extra)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La IA no devolvió JSON válido. Intenta de nuevo.');
    const quiz = JSON.parse(jsonMatch[0]);
    if (!quiz.pregunta || !Array.isArray(quiz.opciones) || quiz.opciones.length < 2)
      throw new Error('El formato del quiz es incompleto. Intenta de nuevo.');

    // Asegurar 4 opciones
    while (quiz.opciones.length < 4) quiz.opciones.push(`Opción ${quiz.opciones.length+1}`);
    if (typeof quiz.correcta !== 'number') quiz.correcta = 0;

    // Mostrar previsualización
    const res = document.getElementById('aiQuizResult');
    if (res) {
      res.style.display = 'block';
      res.innerHTML = `
        <div style="background:var(--card2);border:1px solid var(--brd);border-radius:var(--rs);padding:16px;margin-bottom:4px">
          <div style="font-weight:700;color:var(--txt);margin-bottom:12px;font-size:15px">❓ ${esc(quiz.pregunta)}</div>
          ${quiz.opciones.map((o,i) => `
            <div style="padding:8px 12px;border-radius:8px;margin-bottom:8px;
              background:${i===quiz.correcta?'var(--gnBg)':'var(--card)'};
              border:1px solid ${i===quiz.correcta?'var(--gnBd)':'var(--brd)'};
              color:${i===quiz.correcta?'var(--greenL)':'var(--txt2)'};font-size:13px">
              ${i===quiz.correcta?'✓ ':''}<strong>${['A','B','C','D'][i]})</strong> ${esc(o)}
            </div>`).join('')}
          ${quiz.explicacion?`<div style="margin-top:10px;font-size:12px;color:var(--txt3);background:var(--blBg);border:1px solid var(--blBd);border-radius:6px;padding:10px">💡 ${esc(quiz.explicacion)}</div>`:''}
        </div>`;
      window._aiQuizData = quiz;
      const saveBtn = document.getElementById('aiQuizSaveBtn');
      if (saveBtn) saveBtn.style.display = 'inline-flex';
    }
    toast('✓ Quiz generado','ok');
  } catch(e) {
    const errMsg = _aiParseError(e);
    toast('Error al generar quiz','err');
    const res = document.getElementById('aiQuizResult');
    if (res) {
      res.style.display = 'block';
      res.innerHTML = `<div style="padding:12px;background:var(--redBg);border:1px solid var(--redBd);border-radius:var(--rs);font-size:13px;color:var(--redL)">${_aiFormatText(errMsg)}</div>`;
    }
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='🤖 Generar Quiz'; }
  }
}

function saveAIQuiz() {
  const quiz = window._aiQuizData;
  if (!quiz || !_aiQuizCtx) { toast('Primero genera un quiz','err'); return; }
  const {cid, bid, wid} = _aiQuizCtx;
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id===cid); if (!c) return;
  let b;
  if (wid) { const w=c.weeks?.find(x=>x.id===wid); b=w?.bloques?.find(x=>x.id===bid); }
  else     { b=c.bloques?.find(x=>x.id===bid); }
  if (!b) return;
  b.quiz = { pregunta:quiz.pregunta, opciones:quiz.opciones, correcta:quiz.correcta };
  saveModData(CURRENT_MODULE.id, data);
  window._aiQuizData = null;
  closeM('mAIQuiz');
  toast('✓ Quiz guardado en el bloque','ok');
  go('cl_'+cid);
}

/* ══════════════════════════════════════════════════════════════
   BIBLIOTECA DE ARCHIVOS
   Usa PDF.js CDN para leer PDFs de verdad
══════════════════════════════════════════════════════════════ */

/* ── AI UI Integration ── */
function initializeAIUI() {
  const savedKey = (typeof ld === 'function') ? (ld('ai_api_key') || ld('ai_openrouter_key')) : null;
  if (savedKey) sv('ai_api_key', savedKey);
}

function enhanceAISetupModalStyle() {
  if (document.getElementById('aiModalStyle')) return;
  const style = document.createElement('style');
  style.id = 'aiModalStyle';
  style.textContent = `
    .modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000}
    .modal-content{background:var(--bg1);border:1px solid var(--brd);border-radius:var(--r);max-width:calc(100vw - 32px);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
    .modal-header{padding:20px;border-bottom:1px solid var(--brd);display:flex;justify-content:space-between;align-items:center}
    .modal-header h2{margin:0;font-size:18px;font-weight:600}
    .modal-close{background:none;border:none;color:#999;font-size:20px;cursor:pointer}
  `;
  document.head.appendChild(style);
}
