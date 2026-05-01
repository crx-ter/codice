/* ═══════════════════════════════════
   CÓDICE — ai-engine.js
   Responsabilidad: Motor CAI principal. Catálogo de modelos, transporte HTTP,
                    cascada/consenso, routing automático de tareas, buildPrompt.
                    Expone la función _cai_send() que despacha mensajes del usuario.
   Depende de: storage.js (ld, sv, uid, toast), router.js (CURRENT_MODULE, VIEW, go),
               ai-parser.js, ai-ui.js, ai-memory.js
   Expone: CAI, _cai_fetch, _cai_cascade, _cai_route, _cai_single, _cai_consensus,
           _cai_buildPrompt, _cai_send, caiOpenSettings, caiSaveSettings, caiTestKey,
           initCodeAI, _cai_renderMermaid
═══════════════════════════════════ */

const CAI = {
  models: {
    router:    'nvidia/nemotron-nano-9b-v2:free',
    code:      ['qwen/qwen3-coder:free','openai/gpt-oss-120b:free','nvidia/nemotron-3-super-120b-a12b:free'],
    reasoning: ['nvidia/nemotron-3-super-120b-a12b:free','google/gemma-4-31b-it:free','liquid/lfm-2.5-1.2b-thinking:free','tencent/hy3-preview:free','openai/gpt-oss-120b:free'],
    chat:      ['meta-llama/llama-3.3-70b-instruct:free','qwen/qwen3.6-plus:free','google/gemma-3-27b-it:free','nousresearch/hermes-3-llama-3.1-405b:free','google/gemma-4-31b-it:free','minimax/minimax-m2.5:free','inclusionai/ling-2.6-flash:free','z-ai/glm-4.5-air:free'],
    vision:    ['baidu/qianfan-ocr-fast:free','google/gemma-3-27b-it:free','google/gemma-3-12b-it:free','google/gemma-4-31b-it:free'],
    creative:  ['cognitivecomputations/dolphin-mistral-24b-venice-edition:free','meta-llama/llama-3.3-70b-instruct:free','nousresearch/hermes-3-llama-3.1-405b:free'],
    judge:     'meta-llama/llama-3.3-70b-instruct:free',
    fallback:  ['google/gemma-3-12b-it:free','google/gemma-3-4b-it:free','meta-llama/llama-3.2-3b-instruct:free','liquid/lfm-2.5-1.2b-instruct:free','nvidia/nemotron-nano-9b-v2:free','google/gemma-3n-e4b-it:free','inclusionai/ling-2.6-1t:free','qwen/qwen3-next-80b-a3b-instruct:free','openai/gpt-oss-20b:free','nvidia/nemotron-3-nano-30b-a3b:free','google/gemma-4-26b-a4b-it:free'],
  },
  catalog: [
    { id:'meta-llama/llama-3.3-70b-instruct:free',    name:'Meta Llama 3.3 70B',        tag:'chat'      },
    { id:'qwen/qwen3.6-plus:free',                    name:'Qwen 3.6 Plus',             tag:'chat'      },
    { id:'google/gemma-3-27b-it:free',                name:'Google Gemma 3 27B',        tag:'vision'    },
    { id:'nousresearch/hermes-3-llama-3.1-405b:free', name:'Nous Hermes 3 405B',        tag:'chat'      },
    { id:'google/gemma-4-31b-it:free',                name:'Google Gemma 4 31B',        tag:'reasoning' },
    { id:'openai/gpt-oss-120b:free',                  name:'OpenAI GPT-OSS 120B',       tag:'reasoning' },
    { id:'nvidia/nemotron-3-super-120b-a12b:free',    name:'NVIDIA Nemotron 120B',      tag:'reasoning' },
    { id:'qwen/qwen3-coder:free',                     name:'Qwen3 Coder 480B',          tag:'code'      },
    { id:'minimax/minimax-m2.5:free',                 name:'MiniMax M2.5',              tag:'chat'      },
    { id:'tencent/hy3-preview:free',                  name:'Tencent HY3 Preview',       tag:'reasoning' },
    { id:'google/gemma-3-12b-it:free',                name:'Google Gemma 3 12B',        tag:'vision'    },
    { id:'google/gemma-3-4b-it:free',                 name:'Google Gemma 3 4B',         tag:'fast'      },
    { id:'meta-llama/llama-3.2-3b-instruct:free',     name:'Meta Llama 3.2 3B',         tag:'fast'      },
    { id:'inclusionai/ling-2.6-flash:free',           name:'Ling 2.6 Flash',            tag:'fast'      },
    { id:'inclusionai/ling-2.6-1t:free',              name:'Ling 2.6 1T',               tag:'chat'      },
    { id:'z-ai/glm-4.5-air:free',                     name:'Z.AI GLM 4.5 Air',          tag:'chat'      },
    { id:'liquid/lfm-2.5-1.2b-thinking:free',         name:'LiquidAI LFM2.5 Thinking',  tag:'reasoning' },
    { id:'liquid/lfm-2.5-1.2b-instruct:free',         name:'LiquidAI LFM2.5',           tag:'fast'      },
    { id:'nvidia/nemotron-nano-9b-v2:free',            name:'NVIDIA Nemotron Nano 9B',   tag:'fast'      },
    { id:'nvidia/nemotron-3-nano-30b-a3b:free',        name:'NVIDIA Nemotron 30B',       tag:'reasoning' },
    { id:'google/gemma-4-26b-a4b-it:free',             name:'Google Gemma 4 26B',        tag:'reasoning' },
    { id:'qwen/qwen3-next-80b-a3b-instruct:free',      name:'Qwen3 Next 80B',            tag:'chat'      },
    { id:'openai/gpt-oss-20b:free',                    name:'OpenAI GPT-OSS 20B',        tag:'chat'      },
    { id:'google/gemma-3n-e4b-it:free',                name:'Google Gemma 3n 4B',        tag:'fast'      },
    { id:'baidu/qianfan-ocr-fast:free',                name:'Baidu OCR Fast',            tag:'vision'    },
    { id:'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', name:'Venice Uncensored', tag:'creative' },
  ],
  _running:   false,
  _abortCtrl: null,
  _history:   [],
  _reasoning: [],
};

/* ══ 1. TRANSPORTE ══ */
async function _cai_fetch(modelId, messages, opts = {}) {
  try {
    const key = ld('ai_api_key') || '';
    if (!key) throw new Error('Sin API Key. Configura en ⚙️');
    CAI._abortCtrl = new AbortController();
    const body = { model: modelId, messages, max_tokens: opts.maxTokens || 4096, temperature: opts.temperature || 0.7 };
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
                 'HTTP-Referer': location.href, 'X-Title': 'Códice Learning OS' },
      body: JSON.stringify(body),
      signal: CAI._abortCtrl.signal
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error('API ' + res.status + ': ' + (err.error?.message || res.statusText));
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('Respuesta vacía del modelo');
    return { text: msg.content || '', reasoning: msg.reasoning || null, model: modelId };
  } catch(e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
}

async function _cai_cascade(modelList, messages, opts = {}) {
  let lastErr = null;
  for (const modelId of modelList) {
    try {
      const result = await _cai_fetch(modelId, messages, opts);
      if (result && result.text && result.text.length > 5) return result;
    } catch(e) { lastErr = e; console.warn('CAI cascade failed:', modelId, e.message); }
  }
  throw lastErr || new Error('Todos los modelos fallaron');
}

/* ══ 2. ROUTING AUTOMÁTICO ══ */
async function _cai_route(userText) {
  const rules = [
    { test: /^diagnóstico\s*(rápido|completo)?$|^test\s+modelos$/i,               type: 'diag'      },
    { test: /```|def |import |class |function |SELECT |<html|npm |git /i,          type: 'code'      },
    { test: /diagrama|mermaid|flowchart|timeline|grafo|esquema|mindmap/i,          type: 'diagram'   },
    { test: /razona|step.by.step|prueba|demuestra|calcula paso|por qué.*exactamente/i,type: 'reasoning' },
    { test: /crea.*clas|genera.*clas|nueva.*clas|agrega.*clas|añade.*clas/i,       type: 'create'    },
    { test: /crea.*bloque|nuevo.*bloque|agrega.*bloque/i,                          type: 'create'    },
    { test: /quiz|pregunta.*test|examen.*crea/i,                                   type: 'quiz'      },
    { test: /imagen|foto|captura|screenshot/i,                                     type: 'vision'    },
    { test: /poema|cuento|historia.*creativ|escribe.*creativ/i,                    type: 'creative'  },
  ];
  for (const r of rules) if (r.test.test(userText)) return r.type;
  return 'chat';
}

async function _cai_single(messages, taskType, onTry) {
  const lists = { code: CAI.models.code, reasoning: CAI.models.reasoning,
                  create: CAI.models.chat, quiz: CAI.models.chat,
                  diagram: CAI.models.chat, vision: CAI.models.vision,
                  creative: CAI.models.creative, chat: CAI.models.chat };
  const list = lists[taskType] || CAI.models.chat;
  if (onTry) onTry(list[0]);
  return await _cai_cascade([...list, ...CAI.models.fallback], messages);
}

async function _cai_consensus(messages, onStatus) {
  const models = CAI.models.reasoning.slice(0, 3);
  if (onStatus) onStatus('Consultando ' + models.length + ' modelos…');
  const promises = models.map(m => _cai_fetch(m, messages).catch(() => null));
  const results = (await Promise.all(promises)).filter(Boolean);
  if (!results.length) throw new Error('Ningún modelo respondió');
  const longest = results.sort((a,b) => b.text.length - a.text.length)[0];
  return { ...longest, isConsensus: true, contributions: results.length };
}

/* ══ 3. CONSTRUCCIÓN DE PROMPT — CRÍTICO ══ */
function _cai_buildPrompt(taskType) {
  let location = 'Sin módulo activo';
  let scheduleMode = 'single';
  let activeDivisionName = null;
  let activeClassName = null;

  try {
    if (typeof CURRENT_MODULE !== 'undefined' && CURRENT_MODULE) {
      scheduleMode = CURRENT_MODULE.scheduleMode || 'single';
      location = 'Módulo: "' + CURRENT_MODULE.name + '" | Modo: ' +
                 (scheduleMode === 'multiple' ? 'múltiple' : 'único');

      if (typeof VIEW !== 'undefined' && typeof getModData === 'function') {
        const data = getModData(CURRENT_MODULE.id);

        if (scheduleMode === 'multiple') {
          // Detectar división activa
          if (VIEW.startsWith('div_')) {
            const divId = VIEW.slice(4);
            const div = (data.divisions||[]).find(d => d.id === divId);
            if (div) { activeDivisionName = div.nombre; location += ' | División activa: "' + div.nombre + '"'; }
          }
          // Detectar clase activa dentro de división (usada con VIEW = divclass_DID_CID)
          if (VIEW.startsWith('divclass_')) {
            const parts = VIEW.split('_');
            const did = parts[1], cid = parts[2];
            const div = (data.divisions||[]).find(d => d.id === did);
            const cl  = div?.classes?.find(c => c.id === cid);
            if (div) { activeDivisionName = div.nombre; location += ' | División: "' + div.nombre + '"'; }
            if (cl)  { activeClassName = cl.nombre;    location += ' | Clase activa: "' + cl.nombre + '"'; }
          }
        } else {
          // Modo single: detectar clase activa
          if (VIEW.startsWith('cl_')) {
            const cl = (data.classes||[]).find(c => c.id === VIEW.slice(3));
            if (cl) { activeClassName = cl.nombre; location += ' | Clase activa: "' + cl.nombre + '"'; }
          }
        }
      }
    }
  } catch(e) {}

  let memory = '';
  try { if (typeof memBuildContextSummary === 'function') memory = memBuildContextSummary(); } catch(e) {}

  // Book library context
  let bookContext = '';
  try {
    if (typeof CURRENT_MODULE !== 'undefined' && CURRENT_MODULE) {
      const books = (typeof ld === 'function' ? ld('codice_books_' + CURRENT_MODULE.id) : null) || [];
      if (books.length > 0) {
        bookContext = '\n\nBIBLIOTECA (archivos subidos):\n' +
          books.slice(0, 3).map(b => `--- "${b.name}" ---\n${(b.text||'').slice(0, 2000)}`).join('\n\n');
      }
    }
  } catch(e) {}

  const modeNote = scheduleMode === 'multiple'
    ? '\nIMPORTANTE MODO MÚLTIPLE: Cuando crees clases, el sistema las insertará automáticamente en la división activa ("' + (activeDivisionName || 'ninguna activa') + '"). Solo genera el JSON con la estructura de clases y bloques, NO menciones divisiones en el JSON.'
    : '';

  const actionGuide = `
═══ COMANDOS DE CREACIÓN ═══
Para CREAR CLASES responde ÚNICAMENTE con este JSON (sin texto adicional):
\`\`\`json
{"__accion__":"crear_clases","clases":[{"nombre":"Nombre Clase","bloques":[{"titulo":"Título Bloque","contenido":"<h2>Título</h2><p>Párrafo.</p>"}]}]}
\`\`\`
Para AGREGAR UN BLOQUE a la clase activa:
\`\`\`json
{"__accion__":"crear_bloque","titulo":"Título del Bloque","contenido":"<h2>T</h2><p>Contenido HTML.</p>"}
\`\`\`
Para CREAR QUIZ:
\`\`\`json
[{"pregunta":"¿Texto?","opciones":["A","B","C","D"],"correcta":0,"explicacion":"Texto..."}]
\`\`\`
REGLAS DE CONTENIDO: Incluye TODO sin resumir. HTML rico: tablas con thead/tbody, <ul>/<ol>, <strong>, <em>, <blockquote>, <h2>/<h3>. Fórmulas: \\(x^2\\) inline, \\[E=mc^2\\] bloque.${modeNote}
NUNCA expliques — solo el JSON exacto.`;

  return 'Eres CÓDICE-IA, asistente de estudio del sistema Códice.\nUBICACIÓN: ' + location +
    '\nTAREA: ' + taskType + '\n' + memory + bookContext + '\n' +
    (['create','quiz'].includes(taskType) ? actionGuide :
     taskType === 'diagram'
       ? 'Responde en español. Para diagramas usa Mermaid:\n```mermaid\ngraph TD\n    A[Inicio] --> B[Proceso]\n```\nTipos: flowchart, timeline, sequenceDiagram, gantt, mindmap, pie.'
       : 'Responde en español con Markdown completo. Para crear contenido usa los JSON __accion__ indicados.');
}

/* ══ 4. ENVÍO DE MENSAJE PRINCIPAL ══ */
async function _cai_send() {
  const input = document.getElementById('aiChatInput');
  const userText = (input?.value || '').trim();
  if (!userText) return;
  if (CAI._running) { try { CAI._abortCtrl?.abort(); } catch(e) {} CAI._running = false; _cai_hideStopBtn(); return; }

  const key = ld('ai_api_key') || '';
  if (!key) {
    if (typeof _aiAddMessage === 'function') _aiAddMessage('bot', '⚙️ **Configura tu API Key primero**\n\nHaz clic en el ícono ⚙️ en la esquina superior derecha del chat.');
    return;
  }

  if (input) { input.value = ''; input.style.height = 'auto'; }
  if (typeof _aiAddMessage === 'function') _aiAddMessage('user', userText);
  if (typeof memAutoSaveHook === 'function') memAutoSaveHook();

  CAI._running = true;
  _cai_showStopBtn();
  const typingId = typeof _aiAddTyping === 'function' ? _aiAddTyping() : null;

  try {
    const taskType = await _cai_route(userText);

    // Special diagnostic shortcut
    if (taskType === 'diag') {
      if (typingId) document.getElementById(typingId)?.remove();
      CAI._running = false; _cai_hideStopBtn();
      if (typeof caiDiag === 'function') caiDiag();
      return;
    }

    const sysprompt = _cai_buildPrompt(taskType);
    CAI._history.push({ role: 'user', content: userText });
    if (!window._aiHistory) window._aiHistory = [];
    window._aiHistory = CAI._history; // keep in sync

    const messages = [
      { role: 'system', content: sysprompt },
      ...CAI._history.slice(-12)
    ];

    let result;
    const useConsensus = /consenso|doble.chequeo|verifica.con|dos.modelos/i.test(userText);

    if (useConsensus) {
      const statusEl = document.getElementById('aiStatus');
      result = await _cai_consensus(messages, msg => { if (statusEl) statusEl.textContent = msg; });
    } else {
      result = await _cai_single(messages, taskType, modelId => {
        const statusEl = document.getElementById('aiStatus');
        const name = CAI.catalog.find(m => m.id === modelId)?.name || modelId.split('/')[1] || 'IA';
        if (statusEl) statusEl.textContent = 'Consultando ' + name + '…';
      });
    }

    if (!result) { CAI._running = false; _cai_hideStopBtn(); if (typingId) document.getElementById(typingId)?.remove(); return; }

    CAI._history.push({ role: 'assistant', content: result.text });
    window._aiHistory = CAI._history; // keep in sync with memory system
    if (typingId) document.getElementById(typingId)?.remove();

    const parsed = _cai_parse(result.text);
    _cai_render(parsed, { model: result.model, triedCount: 1, isConsensus: result.isConsensus || false, contributions: result.contributions || 1, reasoningDetails: result.reasoning });

    const statusEl = document.getElementById('aiStatus');
    if (statusEl) statusEl.textContent = 'Asistente de estudio';

    if (typeof convAutoSave === 'function') convAutoSave();
    if (typeof memAutoSaveHook === 'function') memAutoSaveHook();

  } catch(e) {
    if (typingId) document.getElementById(typingId)?.remove();
    const errMsg = e.name === 'AbortError' ? '⏹️ Detenido.' : '❌ Error: ' + e.message;
    if (typeof _aiAddMessage === 'function') _aiAddMessage('bot', errMsg);
    const statusEl = document.getElementById('aiStatus');
    if (statusEl) statusEl.textContent = 'Asistente de estudio';
  }

  CAI._running = false;
  _cai_hideStopBtn();
}

/* ══ 5. CONFIGURACIÓN ══ */
function caiOpenSettings() {
  let overlay = document.getElementById('caiSettingsOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'caiSettingsOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center';
    const currentKey   = ld('ai_api_key') || '';
    const currentModel = ld('ai_preferred_model') || CAI.models.chat[0];
    const modelOptions = CAI.catalog.map(m =>
      `<option value="${m.id}" ${m.id===currentModel?'selected':''}>${m.name} [${m.tag}]</option>`
    ).join('');
    overlay.innerHTML = `
      <div style="background:var(--panel);border:1px solid var(--brd);border-radius:var(--r);padding:28px;width:460px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div style="font-family:var(--fd);font-size:20px;font-weight:700">⚙️ Configurar Códice IA</div>
          <div onclick="this.closest('#caiSettingsOverlay').remove()" style="cursor:pointer;font-size:20px;color:var(--txt3);padding:4px 8px">×</div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--txt3);display:block;margin-bottom:6px">API Key (OpenRouter)</label>
          <input id="caiApiKeyInput" type="password" value="${currentKey}" placeholder="sk-or-..." class="m-input" style="font-family:monospace;font-size:12px">
          <div style="font-size:11px;color:var(--txt4);margin-top:4px">Obtén tu key gratis en <a href="https://openrouter.ai/keys" target="_blank" style="color:var(--blueL)">openrouter.ai/keys</a></div>
        </div>
        <div style="margin-bottom:20px">
          <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--txt3);display:block;margin-bottom:6px">Modelo preferido</label>
          <select id="caiModelSelect" class="m-input">${modelOptions}</select>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="this.closest('#caiSettingsOverlay').remove()">Cancelar</button>
          <button class="btn btn-b" onclick="caiTestKey()">🔌 Probar conexión</button>
          <button class="btn btn-gold" onclick="caiSaveSettings()">💾 Guardar</button>
        </div>
        <div id="caiTestResult" style="margin-top:12px;font-size:13px"></div>
      </div>`;
    document.body.appendChild(overlay);
  } else {
    overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
  }
}

function caiSaveSettings() {
  try {
    const key   = document.getElementById('caiApiKeyInput')?.value.trim();
    const model = document.getElementById('caiModelSelect')?.value;
    if (key) sv('ai_api_key', key);
    if (model) sv('ai_preferred_model', model);
    document.getElementById('caiSettingsOverlay')?.remove();
    toast('✓ Configuración guardada', 'ok');
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function caiTestKey() {
  const key   = document.getElementById('caiApiKeyInput')?.value.trim();
  const model = document.getElementById('caiModelSelect')?.value || CAI.models.chat[0];
  const resultEl = document.getElementById('caiTestResult');
  if (!key) { if (resultEl) resultEl.innerHTML = '<span style="color:var(--redL)">⚠️ Escribe tu API key primero</span>'; return; }
  if (resultEl) resultEl.innerHTML = '<span style="color:var(--txt3)">⏳ Probando conexión…</span>';
  try {
    const prevKey = ld('ai_api_key');
    sv('ai_api_key', key);
    const res = await _cai_fetch(model, [{ role:'user', content:'Responde solo: OK' }], { maxTokens: 10 });
    if (prevKey) sv('ai_api_key', prevKey); else localStorage.removeItem('ai_api_key');
    if (resultEl) resultEl.innerHTML = res?.text
      ? '<span style="color:var(--greenL)">✓ Conexión exitosa — ' + (CAI.catalog.find(m=>m.id===model)?.name||model) + '</span>'
      : '<span style="color:var(--redL)">✗ Sin respuesta del modelo</span>';
  } catch(e) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--redL)">✗ Error: ' + e.message + '</span>';
  }
}

/* ══ 6. MERMAID ══ */
function _cai_renderMermaid() {
  try {
    if (typeof mermaid === 'undefined') return;
    const nodes = document.querySelectorAll('.mermaid:not([data-processed])');
    if (!nodes.length) return;
    nodes.forEach(n => n.setAttribute('data-processed', 'false'));
    mermaid.run({ nodes: Array.from(nodes) }).catch(() => {});
  } catch(e) {}
}

async function _cai_renderMermaidNodes() {
  try {
    if (typeof mermaid === 'undefined') return;
    await new Promise(r => setTimeout(r, 200));
    const nodes = document.querySelectorAll('.mermaid:not([data-processed="true"])');
    if (!nodes.length) return;
    await mermaid.run({ nodes: Array.from(nodes) }).catch(() => {});
  } catch(e) {}
}

/* ══ 7. INIT ══ */
function initCodeAI() {
  try {
    // Inicializar mermaid si está disponible
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: document.body.classList.contains('light-mode') ? 'default' : 'dark', securityLevel: 'loose' });
    }
    // Conectar botón de envío
    const sendBtn = document.getElementById('aiSendBtn');
    if (sendBtn && !sendBtn.dataset.caiInit) {
      sendBtn.dataset.caiInit = '1';
    }
    // Inyectar estilos del panel IA
    if (typeof _cai_injectStyles === 'function') _cai_injectStyles();
    // Verificar API key
    const hasKey = !!(ld('ai_api_key'));
    const apiWarning = document.getElementById('aiApiWarning');
    if (apiWarning) apiWarning.style.display = hasKey ? 'none' : 'block';
  } catch(e) { console.warn('initCodeAI:', e); }
}
