/* ═══════════════════════════════════
   CÓDICE — ai-parser.js
   Responsabilidad: Parser de respuestas IA (Markdown→HTML, detección de acciones JSON),
                    ejecutores _cai_execCrear (CORREGIDO) y _cai_execBloque,
                    renderizador _cai_render, botones de copia y canvas.

   ✅ BUG CRÍTICO CORREGIDO: _cai_execCrear() ahora lee CURRENT_MODULE.scheduleMode
      y crea la clase en el lugar correcto:
      - Modo 'single' → data.classes[]
      - Modo 'multiple' → división activa de data.divisions[]

   Depende de: storage.js (uid, ld, sv, toast, getModData, saveModData),
               router.js (CURRENT_MODULE, VIEW, go, buildSidebar),
               ai-engine.js (CAI, _cai_buildPrompt)
   Expone: _cai_md, _cai_inline, _cai_parse, _cai_execCrear, _cai_execBloque,
           _cai_render, _cai_showStopBtn, _cai_hideStopBtn, _cai_copy,
           _cai_esc, caiExport, caiDiag, _cai_injectStyles
═══════════════════════════════════ */

/* ══ 6. MARKDOWN → HTML ══ */
function _cai_md(raw) {
  if (!raw) return '';
  const PB = [];
  const protect = (html) => { const i = PB.length; PB.push(html); return '\x00B' + i + '\x00'; };

  // Bloques de código con soporte mermaid
  let t = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    lang = (lang||'').toLowerCase().trim();
    if (lang === 'mermaid') {
      const id = 'mmd_' + Math.random().toString(36).slice(2,8);
      return protect(`<div class="cai-mermaid-wrap" style="border:1px solid rgba(124,58,237,.25);border-radius:10px;overflow:hidden;margin:12px 0">
        <div style="font-size:10px;font-weight:700;color:rgba(167,139,250,.7);text-transform:uppercase;letter-spacing:1px;padding:5px 14px;background:rgba(124,58,237,.1);border-bottom:1px solid rgba(255,255,255,.06)">Diagrama Mermaid</div>
        <div class="mermaid" id="${id}" style="padding:12px;text-align:center;background:rgba(0,0,0,.2)">${code.trim()}</div>
      </div>`);
    }
    const label = lang ? `<div style="font-size:10px;font-weight:700;color:rgba(167,139,250,.7);text-transform:uppercase;letter-spacing:1px;padding:5px 14px;background:rgba(124,58,237,.1);border-bottom:1px solid rgba(255,255,255,.06)">${lang}</div>` : '';
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const btnId = 'cb_' + Math.random().toString(36).slice(2,8);
    return protect(`<div style="position:relative;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;margin:10px 0">${label}
      <button id="${btnId}" onclick="_caiCopyCode(this)" data-code="${escaped.replace(/"/g,'&quot;')}" style="position:absolute;top:6px;right:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:5px;color:rgba(255,255,255,.7);font-size:10px;padding:3px 8px;cursor:pointer">Copiar</button>
      <pre style="padding:14px;margin:0;overflow-x:auto;font-family:var(--fm,monospace);font-size:12px;color:#e2e8f0;white-space:pre;line-height:1.6">${escaped}</pre></div>`);
  });

  // Bloques HTML
  t = t.replace(/```html([\s\S]*?)```/gi, (_, html) => protect(`<div class="cai-html-block">${html}</div>`));

  // Tablas Markdown
  t = t.replace(/(\|[^\n]+\|\n)((?:\|[-:]+[-| :]*\|\n))((?:\|[^\n]+\|\n?)*)/g, (_, header, sep, rows) => {
    const parseRow = (row) => row.trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim());
    const headers = parseRow(header);
    const sepCols = parseRow(sep).map(s => s.startsWith(':') && s.endsWith(':') ? 'center' : s.endsWith(':') ? 'right' : 'left');
    const bodyRows = rows.trim().split('\n').filter(Boolean).map(r => parseRow(r));
    const thead = `<thead><tr>${headers.map((h,i) => `<th style="text-align:${sepCols[i]||'left'}">${_cai_inline(h)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${bodyRows.map(r => `<tr>${r.map((c,i) => `<td style="text-align:${sepCols[i]||'left'}">${_cai_inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return protect(`<div style="overflow-x:auto;margin:12px 0"><table class="cai-table">${thead}${tbody}</table></div>`);
  });

  // Encabezados
  t = t.replace(/^#{1,6}\s+(.+)$/gm, (_, text, offset) => {
    const level = (raw.slice(0, raw.indexOf(_)).match(/\n/g)||[]).length;
    const h = Math.min(6, (raw.slice(0, offset).match(/^#{1,6}/m)||[''])[0].length || 2);
    const sizes = {1:'24px',2:'20px',3:'17px',4:'15px',5:'14px',6:'13px'};
    return `<h${h} style="font-size:${sizes[h]};margin:14px 0 8px;font-weight:700;color:var(--txt)">${_cai_inline(text)}</h${h}>`;
  });
  t = t.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const h = Math.min(6, hashes.length);
    const sizes = {1:'24px',2:'20px',3:'17px',4:'15px',5:'14px',6:'13px'};
    return `<h${h} style="font-size:${sizes[h]};margin:14px 0 8px;font-weight:700;color:var(--txt)">${_cai_inline(text)}</h${h}>`;
  });

  // HR
  t = t.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">');

  // Listas
  t = t.replace(/((?:^[-*+]\s.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${_cai_inline(l.replace(/^[-*+]\s/,''))}</li>`).join('');
    return `<ul style="padding-left:20px;margin:8px 0">${items}</ul>`;
  });
  t = t.replace(/((?:^\d+\.\s.+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${_cai_inline(l.replace(/^\d+\.\s/,''))}</li>`).join('');
    return `<ol style="padding-left:20px;margin:8px 0">${items}</ol>`;
  });

  // Blockquotes
  t = t.replace(/^>\s(.+)$/gm, (_, text) =>
    `<blockquote style="border-left:4px solid rgba(124,58,237,.6);padding:8px 14px;margin:10px 0;background:rgba(124,58,237,.07);border-radius:0 8px 8px 0;font-style:italic;color:var(--txt2)">${_cai_inline(text)}</blockquote>`);

  // Párrafos
  t = t.replace(/\n\n+/g, '\n</p><p style="margin:0 0 10px">');
  t = '<p style="margin:0 0 10px">' + t + '</p>';
  t = t.replace(/<p[^>]*>\s*<\/p>/g, '');

  // Restaurar bloques protegidos
  t = t.replace(/\x00B(\d+)\x00/g, (_, i) => PB[parseInt(i)] || '');
  return t;
}

function _cai_inline(t) {
  if (!t) return '';
  return t
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-family:var(--fm,monospace);font-size:12px">$1</code>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--blueL);text-decoration:underline">$1</a>');
}

function _caiCopyCode(btn) {
  try {
    const code = btn.dataset.code || '';
    navigator.clipboard.writeText(code.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"'));
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = 'Copiar', 1500);
  } catch(e) {}
}

/* ══ 7. PARSER DE RESPUESTA ══ */
function _cai_parse(rawText) {
  const blocks = [];
  rawText.replace(/```(?:json)?\s*([\s\S]*?)```/g, (_, b) => blocks.push(b.trim()));
  if (!blocks.length && /^\s*\{/.test(rawText)) blocks.push(rawText.trim());
  for (const block of blocks) {
    let p; try { p = JSON.parse(block); } catch(e) { continue; }
    if (p.__accion__ === 'crear_clases' && Array.isArray(p.clases))
      return { type:'action', action:'crear_clases', data: p.clases };
    if (p.__accion__ === 'crear_clase')
      return { type:'action', action:'crear_clases', data: [p] };
    if (p.__accion__ === 'crear_bloque')
      return { type:'action', action:'crear_bloque', data: p };
    if (Array.isArray(p) && p[0]?.pregunta && Array.isArray(p[0]?.opciones))
      return { type:'quiz', data: p };
    if (p.pregunta && Array.isArray(p.opciones))
      return { type:'quiz', data: [p] };
  }
  // También intentar parsear array en texto plano
  const arrMatch = rawText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrMatch) {
    try {
      const arr = JSON.parse(arrMatch[0]);
      if (arr[0]?.pregunta && Array.isArray(arr[0]?.opciones))
        return { type:'quiz', data: arr };
    } catch(e) {}
  }
  const codeMatches = rawText.match(/```[\s\S]*?```/g) || [];
  if (codeMatches.reduce((n, b) => n + b.length, 0) > 500 || codeMatches.length >= 2)
    return { type:'canvas', data: rawText };
  return { type:'text', data: rawText };
}

/* ══ 8. EJECUTORES ══
   ✅ _cai_execCrear: CORREGIDO — respeta scheduleMode del módulo activo
═══════════════════════════════════════════════════════════════════ */
function _cai_execCrear(clases) {
  if (typeof CURRENT_MODULE === 'undefined' || !CURRENT_MODULE)
    return '⚠️ Selecciona un módulo antes de crear clases.';
  try {
    const data        = getModData(CURRENT_MODULE.id);
    const schedMode   = CURRENT_MODULE.scheduleMode || 'single';
    const result      = [];

    if (schedMode === 'single') {
      /* ── MODO SINGLE: agregar a data.classes[] directamente ── */
      for (const cl of clases) {
        const id     = uid();
        const bloques = (cl.bloques || []).map(b => ({
          id: uid(), titulo: b.titulo || 'Bloque',
          contenido: b.contenido || '<p>Contenido generado por IA.</p>', quiz: null
        }));
        data.classes.push({ id, nombre: cl.nombre || 'Clase IA', color: '#c79a38', bloques, weeks: [], created: Date.now() });
        result.push({ id, nombre: cl.nombre, n: bloques.length });
      }
      saveModData(CURRENT_MODULE.id, data);
      if (result.length === 1) {
        go('cl_' + result[0].id);
      } else {
        buildSidebar();
        go('classes');
      }

    } else {
      /* ── MODO MULTIPLE: agregar a la división activa ── */
      let targetDiv = null;

      // 1. Detectar división activa desde VIEW
      if (VIEW.startsWith('div_')) {
        const divId = VIEW.slice(4);
        targetDiv = (data.divisions || []).find(d => d.id === divId);
      }
      // 2. Si no hay división activa, usar la primera disponible
      if (!targetDiv && (data.divisions || []).length > 0) {
        targetDiv = data.divisions[0];
      }
      // 3. Si no hay ninguna división, crear una automáticamente
      if (!targetDiv) {
        const newDiv = {
          id: uid(), nombre: 'División 1', color: '#c79a38',
          classes: [], created: Date.now(),
          schedule: { type: 'table', rows: 6, table: {
            week: ['lun','mar','mie','jue','vie','sab','dom'],
            rows: Array.from({length:6}, (_,i) => {
              const r = { hora: '', idx: i };
              ['lun','mar','mie','jue','vie','sab','dom'].forEach(d => r[d] = '');
              return r;
            })
          }}
        };
        if (!data.divisions) data.divisions = [];
        data.divisions.push(newDiv);
        targetDiv = newDiv;
      }

      // Asegurar que la división tiene array de clases
      if (!targetDiv.classes) targetDiv.classes = [];

      // Crear las clases dentro de la división
      for (const cl of clases) {
        const id     = uid();
        const bloques = (cl.bloques || []).map(b => ({
          id: uid(), titulo: b.titulo || 'Bloque',
          contenido: b.contenido || '<p>Contenido generado por IA.</p>', quiz: null
        }));
        targetDiv.classes.push({ id, nombre: cl.nombre || 'Clase IA', color: '#c79a38', bloques, created: Date.now() });
        result.push({ id, nombre: cl.nombre, n: bloques.length, divNombre: targetDiv.nombre });
      }

      saveModData(CURRENT_MODULE.id, data);
      // Navegar a la división que contiene las clases nuevas
      buildSidebar();
      go('div_' + targetDiv.id);
    }

    if (typeof toast === 'function') toast('✓ ' + result.length + ' clase(s) creada(s)', 'ok');
    return '✅ **' + result.length + ' clase(s) creada(s)' +
      (schedMode === 'multiple' && result[0]?.divNombre ? ' en "' + result[0].divNombre + '"' : '') +
      ':**\n' + result.map((c, i) => (i+1) + '. **"' + c.nombre + '"** — ' + c.n + ' bloque(s)').join('\n');
  } catch(e) {
    console.error('_cai_execCrear error:', e);
    return '❌ Error al crear: ' + e.message;
  }
}

function _cai_execBloque(data) {
  try {
    if (typeof VIEW === 'undefined') return '⚠️ Abre una clase primero.';

    // Modo single: VIEW = 'cl_ID'
    if (VIEW.startsWith('cl_')) {
      const cid = VIEW.slice(3);
      const mod = getModData(CURRENT_MODULE.id);
      const cl  = (mod.classes || []).find(c => c.id === cid);
      if (!cl) return '⚠️ Clase no encontrada.';
      const b = { id: uid(), titulo: data.titulo || 'Bloque', contenido: data.contenido || '', quiz: null };
      (cl.bloques = cl.bloques || []).push(b);
      saveModData(CURRENT_MODULE.id, mod);
      go('cl_' + cid);
      return '✅ Bloque **"' + b.titulo + '"** agregado.';
    }

    // Modo multiple: VIEW = 'divclass_DID_CID'
    if (VIEW.startsWith('divclass_')) {
      const parts = VIEW.split('_');
      const did = parts[1], cid = parts[2];
      const mod = getModData(CURRENT_MODULE.id);
      const div = (mod.divisions || []).find(d => d.id === did);
      const cl  = div?.classes?.find(c => c.id === cid);
      if (!cl) return '⚠️ Clase no encontrada en la división.';
      const b = { id: uid(), titulo: data.titulo || 'Bloque', contenido: data.contenido || '', quiz: null };
      (cl.bloques = cl.bloques || []).push(b);
      saveModData(CURRENT_MODULE.id, mod);
      if (typeof openDivClass === 'function') openDivClass(did, cid);
      return '✅ Bloque **"' + b.titulo + '"** agregado.';
    }

    return '⚠️ Abre una clase primero (haz clic en una clase del menú lateral).';
  } catch(e) { return '❌ Error: ' + e.message; }
}

/* ══ 9. RENDERIZADOR ══ */
function _cai_render(parsed, meta) {
  const { model, triedCount, isConsensus, contributions, reasoningDetails } = meta;
  const mName = CAI.catalog.find(m => m.id === model)?.name || model?.split('/')[1] || 'Códice IA';
  const badge = '<div class="cai-model-badge"><span class="cai-badge-dot"></span><span>' + mName + '</span>' +
    (isConsensus ? '<span class="cai-consensus-tag">⚖️ Consenso</span>' : '') +
    (triedCount > 1 ? '<span class="cai-tried-tag">' + triedCount + ' modelos probados</span>' : '') + '</div>';

  if (reasoningDetails && typeof _aiAddMessage === 'function') {
    const thinking = reasoningDetails?.thinking || reasoningDetails?.content || JSON.stringify(reasoningDetails).slice(0, 300);
    if (thinking) _aiAddMessage('bot',
      '<details style="opacity:.6;margin-bottom:8px"><summary style="cursor:pointer;font-size:11px;color:rgba(124,58,237,.7)">🧠 Razonamiento interno</summary>' +
      '<div style="font-size:12px;font-style:italic;padding:8px 0;color:var(--txt3)">' + String(thinking).slice(0, 1000) + '...</div></details>');
  }

  if (parsed.type === 'action' && parsed.action === 'crear_clases') {
    const res = _cai_execCrear(parsed.data);
    if (typeof _aiAddMessage === 'function') _aiAddMessage('bot', badge + _cai_md(res));
    _cai_addCopyToLastMsg(); return;
  }
  if (parsed.type === 'action' && parsed.action === 'crear_bloque') {
    const res = _cai_execBloque(parsed.data);
    if (typeof _aiAddMessage === 'function') _aiAddMessage('bot', badge + _cai_md(res));
    _cai_addCopyToLastMsg(); return;
  }
  if (parsed.type === 'quiz') {
    if (typeof _aiAddMessage === 'function') {
      _aiAddMessage('bot', badge + '<div style="font-size:13px;color:var(--txt2);margin-bottom:8px">Quiz generado. Haz clic para iniciarlo:</div>');
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(parsed.data))));
      _aiAddMessage('bot',
        `<button class="btn btn-gold" onclick="qzAbrirDesdeChat('${encoded}')" style="margin-top:4px">🚀 Iniciar Quiz (${parsed.data.length} pregunta${parsed.data.length!==1?'s':''})</button>`);
    }
    _cai_addCopyToLastMsg(); return;
  }
  if (parsed.type === 'canvas') {
    if (typeof _aiAddMessage === 'function') _aiAddMessage('bot', badge + _cai_md(parsed.data));
    _cai_injectButton(badge, parsed.data);
    _cai_addCopyToLastMsg();
    setTimeout(() => { if (typeof _cai_renderMermaid === 'function') _cai_renderMermaid(); }, 300);
    return;
  }
  // type === 'text'
  if (typeof _aiAddMessage === 'function') _aiAddMessage('bot', badge + _cai_md(parsed.data));
  _cai_addCopyToLastMsg();
  setTimeout(() => { if (typeof _cai_renderMermaid === 'function') _cai_renderMermaid(); }, 300);
}

function _cai_showStopBtn() {
  let btn = document.getElementById('caiStopBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'caiStopBtn';
    btn.className = 'btn btn-r';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:5000;font-size:12px;padding:6px 14px';
    btn.textContent = '⏹ Detener';
    btn.onclick = () => { try { CAI._abortCtrl?.abort(); } catch(e) {} CAI._running = false; _cai_hideStopBtn(); };
    document.body.appendChild(btn);
  }
  btn.style.display = 'flex';
}

function _cai_hideStopBtn() {
  const btn = document.getElementById('caiStopBtn');
  if (btn) btn.style.display = 'none';
}

function _cai_addCopyToLastMsg() {
  try {
    const msgs = document.querySelectorAll('#aiChatMessages .ai-msg-bot');
    const last = msgs[msgs.length - 1];
    if (!last) return;
    if (last.querySelector('.cai-copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'cai-copy-btn';
    btn.style.cssText = 'display:inline-block;margin-top:8px;font-size:11px;color:var(--txt3);background:none;border:1px solid var(--brd);border-radius:5px;padding:2px 8px;cursor:pointer';
    btn.textContent = '📋 Copiar';
    btn.onclick = () => {
      const bubble = last.querySelector('.ai-bubble-bot');
      if (bubble) _cai_copy(bubble.innerText || bubble.textContent);
    };
    last.appendChild(btn);
  } catch(e) {}
}

function _cai_injectButton(badge, rawContent) {
  try {
    const msgs = document.querySelectorAll('#aiChatMessages .ai-msg-bot');
    const last = msgs[msgs.length - 1];
    if (!last) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.style.cssText = 'margin-top:6px;font-size:11px';
    btn.textContent = '🖼️ Expandir';
    btn.onclick = () => _cai_openCanvas(rawContent);
    last.appendChild(btn);
  } catch(e) {}
}

function _cai_openCanvas(content) {
  try {
    let ov = document.getElementById('caiCanvas');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'caiCanvas';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9998;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto';
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div style="background:var(--panel);border:1px solid var(--brd);border-radius:var(--r);padding:28px;max-width:860px;width:100%;position:relative">
      <button onclick="document.getElementById('caiCanvas').style.display='none'" style="position:absolute;top:12px;right:12px;background:none;border:none;color:var(--txt3);font-size:20px;cursor:pointer">×</button>
      <div style="font-size:14px;line-height:1.7">${_cai_md(content)}</div>
    </div>`;
    ov.style.display = 'flex';
    setTimeout(() => { if (typeof _cai_renderMermaid === 'function') _cai_renderMermaid(); }, 300);
  } catch(e) {}
}

function _cai_copy(text) {
  navigator.clipboard.writeText(text).then(() => {
    if (typeof toast === 'function') toast('✓ Copiado', 'ok');
  }).catch(() => {});
}

function caiExport(content, name) {
  try {
    const hasMath = /\$/.test(content);
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + (name||'Códice') + '</title>' +
      (hasMath ? '<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" async><\/script>' : '') +
      '<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 24px;background:#0d0d15;color:#e2e8f0;line-height:1.7}h1,h2,h3{color:#c79a38}pre{background:#1a1a2e;padding:16px;border-radius:8px;overflow-x:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:8px 12px}</style>' +
      '</head><body>' + _cai_md(content) + '</body></html>';
    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name||'codice-export') + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch(e) {}
}

function _cai_esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ══ DIAGNÓSTICO ══ */
async function caiDiag() {
  if (typeof _aiAddMessage === 'function')
    _aiAddMessage('user', 'diagnóstico rápido');

  const results = [];
  const models = [...CAI.models.chat.slice(0,3), ...CAI.models.fallback.slice(0,2)];
  const key = ld('ai_api_key') || '';
  if (!key) {
    if (typeof _aiAddMessage === 'function')
      _aiAddMessage('bot', '⚠️ **Sin API Key** — Configura en ⚙️');
    return;
  }

  if (typeof _aiAddMessage === 'function')
    _aiAddMessage('bot', '🔬 Probando ' + models.length + ' modelos…');

  for (const m of models) {
    try {
      const start = Date.now();
      const res = await _cai_fetch(m, [{role:'user',content:'Di solo OK'}], {maxTokens:5});
      const ms = Date.now() - start;
      results.push({ m, ok: !!(res?.text), ms });
    } catch(e) {
      results.push({ m, ok: false, ms: 0, err: e.message });
    }
  }

  const lines = results.map(r =>
    (r.ok ? '✅' : '❌') + ' `' + r.m.split('/')[1] + '`' +
    (r.ok ? ' — ' + r.ms + 'ms' : ' — ' + (r.err||'sin respuesta'))
  );

  if (typeof _aiAddMessage === 'function')
    _aiAddMessage('bot', '**Diagnóstico completado:**\n\n' + lines.join('\n'));
}

/* ══ ESTILOS DEL PANEL IA ══ */
function _cai_injectStyles() {
  if (document.getElementById('caiStyles')) return;
  const s = document.createElement('style');
  s.id = 'caiStyles';
  s.textContent = `
.cai-model-badge{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.cai-badge-dot{width:6px;height:6px;background:#7c3aed;border-radius:50%;flex-shrink:0}
.cai-model-badge span{font-size:10px;color:rgba(167,139,250,.7);font-weight:600}
.cai-consensus-tag,.cai-tried-tag{background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:4px;padding:1px 6px;font-size:10px;color:#a78bfa}
.cai-table{width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid var(--brd,#1e2338);font-size:13px}
.cai-table th{background:rgba(124,58,237,.15);padding:8px 12px;border:1px solid var(--brd,#1e2338);font-weight:700;font-size:12px;color:rgba(167,139,250,.9)}
.cai-table td{padding:8px 12px;border:1px solid var(--brd,#1e2338);vertical-align:top}
.cai-table tr:nth-child(even) td{background:rgba(255,255,255,.02)}
  `;
  document.head.appendChild(s);
}
