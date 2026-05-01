/* ═══════════════════════════════════
   CÓDICE — examenes.js
   Responsabilidad: Exámenes de código (Python/HTML), IDE completo, quiz modal,
                    renderExamenList, renderExamen, runCode, runHTML, _pyRunInteractive.
   Depende de: storage.js, modules.js, router.js
   Expone: renderExamenList, renderExamen, openFullIDE, runCode, runHTML, runPython,
           pickExamType, saveExamen, openQuizModal, _mqzLanzar, _mqzGuardar,
           openPreguntaModal, savePregunta, delPregunta, iniciarExamen,
           renderExEnCurso, finalizarExamen, cancelarExamen, verResultados
═══════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   EXAMEN — SISTEMA DE CÓDIGO (Python + Linux-style / HTML)
═══════════════════════════════════════════════════════════════ */
let _selExamType = 'python';

function pickExamType(el) {
  document.querySelectorAll('#mExamen .mto').forEach(e => e.classList.remove('on'));
  el.classList.add('on'); _selExamType = el.dataset.etype;
}
function saveExamen() {
  const n = document.getElementById('mEN')?.value.trim();
  if (!n) { toast('Escribe un título','err'); return; }
  const fecha = document.getElementById('mEDate')?.value || '';
  const data  = getModData(CURRENT_MODULE.id);
  const id    = uid();
  const defaultCode = _selExamType === 'python'
    ? '#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n\n# Escribe tu código Python aquí\nprint("Hola, mundo!")\n'
    : '<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8">\n  <title>Mi página</title>\n</head>\n<body>\n  <h1>Hola, mundo!</h1>\n</body>\n</html>';
  data.exams.push({id, titulo:n, tipo:_selExamType, fecha, codigo:defaultCode, created:Date.now()});
  saveModData(CURRENT_MODULE.id, data);
  closeM('mExamen');
  const enEl = document.getElementById('mEN'); if (enEl) enEl.value = '';
  _selExamType = 'python';
  document.querySelectorAll('#mExamen .mto').forEach((el,i) => el.classList.toggle('on', i===0));
  toast('Examen creado: '+n, 'ok'); go('ex_'+id);
}

function renderExamenList() {
  const data  = getModData(CURRENT_MODULE.id);
  const exams = data.exams || [];
  return `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon sh-icon-r">📝</div>
        <div><div class="sh-title">Exámenes / Código</div>
        <div class="sh-meta">${exams.length} examen${exams.length!==1?'es':''}</div></div></div>
      <button class="btn btn-gold" onclick="openM('mExamen')">+ Nuevo</button>
    </div>
    ${exams.length === 0
      ? `<div class="empty"><div class="empty-icon">📝</div><h3>Sin exámenes aún</h3>
          <p>Crea exámenes de código Python o HTML</p>
          <button class="btn btn-gold" onclick="openM('mExamen')" style="margin-top:16px">+ Crear examen</button></div>`
      : exams.map(ex => `<div class="exam-list-card" onclick="go('ex_${ex.id}')">
          <div class="elc-icon">${ex.tipo==='html'?'🌐':'🐍'}</div>
          <div class="elc-body">
            <div class="elc-name">${esc(ex.titulo)}</div>
            <div class="elc-meta">${ex.tipo==='html'?'HTML':'Python'}${ex.fecha?' · '+ex.fecha:''} · ${new Date(ex.created).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</div>
          </div>
          <div class="elc-actions">
            <button class="btn btn-sm btn-b" onclick="event.stopPropagation();go('ex_${ex.id}')">Abrir →</button>
            <button class="btn btn-sm btn-r" onclick="event.stopPropagation();delEx(event,'${ex.id}')">🗑️</button>
          </div>
        </div>`).join('')}
  </div>`;
}

function renderExamen(id) {
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === id);
  if (!ex) return `<div class="empty"><div class="empty-icon">❓</div><h3>Examen no encontrado</h3>
    <button class="btn" onclick="go('examenes')" style="margin-top:16px">← Volver</button></div>`;
  if (!ex.tipo) return renderExamenClasico(id, ex, data);
  const isPy = ex.tipo === 'python';
  const code = (ex.codigo || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  return `<div class="fade" id="examCodeView_${id}" style="max-width:100%;height:calc(100vh - 100px);display:flex;flex-direction:column">

    <!-- TOPBAR -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;flex-shrink:0">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;background:${isPy?'rgba(255,212,59,.15)':'rgba(255,100,50,.15)'}">
          ${isPy?'🐍':'🌐'}
        </div>
        <div style="min-width:0">
          <div style="font-family:var(--fd);font-size:18px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ex.titulo)}</div>
          <div style="font-size:11px;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px">${isPy?'Python 3':'HTML5'}${ex.fecha?' · '+ex.fecha:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">
        <button class="btn btn-sm" onclick="go('examenes')">← Lista</button>
        <button class="btn btn-sm" onclick="promptRenameExam('${id}')">✏️</button>
        <button class="btn btn-sm btn-r" onclick="if(confirm('¿Eliminar?'))delExById('${id}')">🗑️</button>
        <button class="btn btn-sm btn-g" onclick="saveExamCode('${id}')">💾 Guardar</button>
        <button class="btn btn-sm btn-primary" onclick="runCode('${id}')">▶ Ejecutar</button>
        <button class="btn btn-sm btn-b" onclick="openFullIDE('${id}')" title="Abrir IDE en pantalla completa">⛶ Pantalla Completa</button>
      </div>
    </div>

    <!-- EDITOR SPLIT (editor arriba, consola abajo) -->
    <div id="edLayout_${id}" style="flex:1;display:flex;flex-direction:column;border:1px solid var(--brd);border-radius:var(--r);overflow:hidden;min-height:0">

      <!-- toolbar del editor -->
      <div style="display:flex;align-items:center;gap:8px;padding:7px 14px;background:var(--card2);border-bottom:1px solid var(--brd);flex-shrink:0">
        <span class="code-lang-badge ${isPy?'code-lang-py':'code-lang-html'}">${isPy?'Python 3':'HTML5'}</span>
        <span style="font-size:11px;color:var(--txt3)">Tab=indentar &nbsp;·&nbsp; Ctrl+Enter=ejecutar &nbsp;·&nbsp; Ctrl+S=guardar</span>
        <div style="margin-left:auto;display:flex;gap:5px">
          <button class="btn btn-sm" onclick="increaseFont()" title="Fuente +">A+</button>
          <button class="btn btn-sm" onclick="decreaseFont()" title="Fuente -">A-</button>
          <button class="btn btn-sm" onclick="clearCode()">🗑️ Limpiar</button>
        </div>
      </div>

      <!-- textarea del código -->
      <textarea id="codeArea" spellcheck="false"
        placeholder="${isPy?'# Tu código Python\\nprint(\\"Hola mundo\\")':'<!DOCTYPE html>\\n<html>\\n<body>\\n  <h1>Hola</h1>\\n</body>\\n</html>'}"
        onkeydown="handleCodeTab(event);handleCodeRun(event,'${id}');handleCodeSave(event,'${id}')">${code}</textarea>

      <!-- divisor arrastrable -->
      <div id="resizerBar_${id}" style="height:6px;background:var(--brd);cursor:ns-resize;display:flex;align-items:center;justify-content:center;flex-shrink:0;user-select:none"
        onmousedown="startResize(event,'${id}')">
        <div style="width:48px;height:2px;border-radius:2px;background:var(--brdL)"></div>
      </div>

      <!-- header de la consola -->
      <div style="display:flex;align-items:center;gap:8px;padding:6px 14px;background:var(--card2);border-top:1px solid var(--brd);flex-shrink:0">
        <span style="font-size:12px;font-weight:700;color:var(--txt2)">${isPy?'🖥️ Consola':'🌐 Vista previa'}</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          ${isPy?`<button class="btn btn-sm" onclick="copyOutput()" title="Copiar salida">📋 Copiar</button>`:''}
          <button class="btn btn-sm" onclick="clearOutput()">Limpiar</button>
        </div>
      </div>

      <!-- área de salida -->
      ${isPy
        ? `<div id="codeOutput"><span style="color:var(--txt4);opacity:.5">▶ Ejecuta tu código para ver la salida aquí...</span></div>`
        : `<iframe id="htmlPreviewFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            srcdoc="<html><body style='font-family:sans-serif;color:#aaa;padding:24px;margin:0;background:#111'>▶ Ejecuta para ver la vista previa...</body></html>"></iframe>`}
    </div>

    <!-- INPUT INTERACTIVO (para input() de Python) -->
    <div id="inputPanel_${id}" style="display:none;margin-top:8px;flex-shrink:0">
      <div style="background:var(--card);border:1px solid var(--goldBd);border-radius:var(--rs);padding:12px 16px">
        <div style="font-size:12px;font-weight:700;color:var(--goldL);margin-bottom:6px">⌨️ Entrada requerida:</div>
        <div id="inputPromptTxt" style="font-family:var(--fm);font-size:13px;color:var(--txt2);margin-bottom:8px;min-height:18px"></div>
        <div style="display:flex;gap:8px">
          <input type="text" id="pyInputField" class="m-input" style="flex:1;font-family:var(--fm);font-size:13px"
            placeholder="Escribe tu respuesta y presiona Enter..."
            onkeydown="if(event.key==='Enter'){event.preventDefault();submitPyInput()}">
          <button class="btn btn-primary" onclick="submitPyInput()">Enviar ↵</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   IDE PANTALLA COMPLETA — abre una ventana flotante fullscreen
═══════════════════════════════════════════════════════════════ */
function openFullIDE(id) {
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === id);
  if (!ex) return;
  const isPy = ex.tipo === 'python';
  const code = ex.codigo || '';

  // Crear overlay fullscreen
  let overlay = document.getElementById('fullIDEOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'fullIDEOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:var(--bg);display:flex;flex-direction:column;animation:fadeIn .2s ease';

  overlay.innerHTML = `
    <!-- TOPBAR FULLSCREEN -->
    <div style="display:flex;align-items:center;gap:10px;padding:10px 20px;background:var(--panel);border-bottom:1px solid var(--brd);flex-shrink:0">
      <div style="font-size:18px">${isPy?'🐍':'🌐'}</div>
      <div style="font-family:var(--fd);font-size:17px;font-weight:700;color:var(--txt);flex:1">${esc(ex.titulo)}</div>
      <span class="code-lang-badge ${isPy?'code-lang-py':'code-lang-html'}">${isPy?'Python 3':'HTML5'}</span>
      <button class="btn btn-sm" onclick="document.getElementById('fullCodeArea').value=document.getElementById('codeArea')?.value||''" style="font-size:11px">↓ Sincronizar</button>
      <button class="btn btn-sm btn-g" onclick="saveFromFull('${id}')" title="Ctrl+S">💾 Guardar</button>
      <button class="btn btn-sm btn-primary" onclick="runFromFull('${id}')" title="Ctrl+Enter">▶ Ejecutar</button>
      <button class="btn btn-sm btn-r" onclick="closeFullIDE('${id}')" title="Esc">✕ Cerrar</button>
    </div>

    <!-- LAYOUT HORIZONTAL: editor izquierda, consola derecha -->
    <div style="flex:1;display:flex;min-height:0;overflow:hidden">

      <!-- Editor -->
      <div style="flex:1;display:flex;flex-direction:column;min-width:0;border-right:2px solid var(--brd)">
        <div style="display:flex;align-items:center;gap:8px;padding:6px 14px;background:var(--card2);border-bottom:1px solid var(--brd);flex-shrink:0">
          <span style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.8px">Código</span>
          <div style="margin-left:auto;display:flex;gap:5px">
            <button class="btn btn-sm" onclick="adjustFullFont(1)">A+</button>
            <button class="btn btn-sm" onclick="adjustFullFont(-1)">A-</button>
            <button class="btn btn-sm" onclick="clearFullCode()">🗑️</button>
          </div>
        </div>
        <textarea id="fullCodeArea" spellcheck="false"
          style="flex:1;padding:18px;background:var(--bg2);color:var(--txt);font-family:var(--fm);font-size:15px;line-height:1.7;border:none;outline:none;resize:none;tab-size:2;white-space:pre;overflow:auto"
          placeholder="${isPy?'# Código Python aquí':'<!DOCTYPE html>...'}"
          onkeydown="handleFullTab(event);handleFullRun(event,'${id}');handleFullSave(event,'${id}')">${esc(code)}</textarea>
      </div>

      <!-- Consola / Vista previa -->
      <div style="width:45%;display:flex;flex-direction:column;min-width:300px">
        <div style="display:flex;align-items:center;gap:8px;padding:6px 14px;background:var(--card2);border-bottom:1px solid var(--brd);flex-shrink:0">
          <span style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.8px">${isPy?'🖥️ Consola':'🌐 Vista previa'}</span>
          <div style="margin-left:auto;display:flex;gap:5px">
            ${isPy?`<button class="btn btn-sm" onclick="copyFullOutput()" title="Copiar">📋</button>`:''}
            <button class="btn btn-sm" onclick="clearFullOutput()">Limpiar</button>
          </div>
        </div>
        ${isPy
          ? `<div id="fullCodeOutput" style="flex:1;padding:18px;background:var(--bg);font-family:var(--fm);font-size:14px;color:var(--txt);white-space:pre-wrap;line-height:1.7;overflow-y:auto;overflow-x:auto">
              <span style="color:var(--txt4);opacity:.5">▶ Ejecuta para ver la salida...</span></div>`
          : `<iframe id="fullHtmlFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              style="flex:1;border:none;background:#fff"
              srcdoc="<html><body style='font-family:sans-serif;color:#aaa;padding:24px;background:#fff'>▶ Ejecuta para ver la vista previa...</body></html>"></iframe>`}

        <!-- Input interactivo (fullscreen) -->
        <div id="fullInputPanel" style="display:none;padding:12px;background:var(--card);border-top:1px solid var(--goldBd)">
          <div style="font-size:12px;font-weight:700;color:var(--goldL);margin-bottom:6px">⌨️ Entrada requerida:</div>
          <div id="fullInputPromptTxt" style="font-family:var(--fm);font-size:13px;color:var(--txt2);margin-bottom:6px"></div>
          <div style="display:flex;gap:8px">
            <input type="text" id="fullPyInputField" class="m-input" style="flex:1;font-family:var(--fm);font-size:13px"
              placeholder="Escribe y presiona Enter..."
              onkeydown="if(event.key==='Enter'){event.preventDefault();submitFullInput()}">
            <button class="btn btn-primary" onclick="submitFullInput()">↵</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById('fullCodeArea')?.focus();

  // Cerrar con Escape
  overlay._escHandler = (e) => { if(e.key==='Escape') closeFullIDE(id); };
  document.addEventListener('keydown', overlay._escHandler);
}

function closeFullIDE(id) {
  const overlay = document.getElementById('fullIDEOverlay');
  if (!overlay) return;
  // Sincronizar el código de vuelta al editor principal
  const fullCode = document.getElementById('fullCodeArea')?.value;
  const mainArea = document.getElementById('codeArea');
  if (fullCode !== undefined && mainArea) mainArea.value = fullCode;
  document.removeEventListener('keydown', overlay._escHandler);
  overlay.remove();
}

function saveFromFull(id) {
  const code = document.getElementById('fullCodeArea')?.value || '';
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === id); if (!ex) return;
  ex.codigo  = code; ex.lastSaved = Date.now();
  saveModData(CURRENT_MODULE.id, data);
  // Sincronizar al editor principal
  const mainArea = document.getElementById('codeArea');
  if (mainArea) mainArea.value = code;
  toast('💾 Código guardado','ok');
}

function runFromFull(id) {
  const code = document.getElementById('fullCodeArea')?.value || '';
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === id); if (!ex) return;
  // Guardar automáticamente
  ex.codigo = code; ex.lastSaved = Date.now();
  saveModData(CURRENT_MODULE.id, data);
  if (ex.tipo === 'html') {
    const frame = document.getElementById('fullHtmlFrame');
    if (frame) { frame.srcdoc = code; toast('▶ HTML renderizado','ok'); }
  } else {
    const out = document.getElementById('fullCodeOutput'); if (!out) return;
    out.innerHTML = '';
    _pyRunInteractive(code, true); // true = fullscreen mode
  }
}

function clearFullCode()   { const ta=document.getElementById('fullCodeArea'); if(ta&&confirm('¿Limpiar?'))ta.value=''; }
function clearFullOutput() {
  const o=document.getElementById('fullCodeOutput');
  if(o) o.innerHTML='<span style="color:var(--txt4);opacity:.5">Salida limpiada.</span>';
  const f=document.getElementById('fullHtmlFrame');
  if(f) f.srcdoc='<html><body style="font-family:sans-serif;color:#aaa;padding:24px">Limpiada.</body></html>';
}
function copyFullOutput() {
  const o=document.getElementById('fullCodeOutput');
  if(o) navigator.clipboard?.writeText(o.innerText||o.textContent).then(()=>toast('📋 Copiado','ok'));
}
function handleFullTab(e) {
  if(e.key!=='Tab') return; e.preventDefault();
  const ta=document.getElementById('fullCodeArea'); if(!ta) return;
  const s=ta.selectionStart,end=ta.selectionEnd;
  ta.value=ta.value.substring(0,s)+'  '+ta.value.substring(end);
  ta.selectionStart=ta.selectionEnd=s+2;
}
function handleFullRun(e,id) { if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runFromFull(id);} }
function handleFullSave(e,id){ if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveFromFull(id);} }
function adjustFullFont(delta) {
  const ta=document.getElementById('fullCodeArea'); if(!ta) return;
  const cur=parseInt(ta.style.fontSize)||15;
  ta.style.fontSize=Math.max(10,Math.min(24,cur+delta))+'px';
}
function submitFullInput() {
  const field=document.getElementById('fullPyInputField'); if(!field) return;
  const val=field.value; field.value='';
  document.getElementById('fullInputPanel').style.display='none';
  if(window._pyInputResolve){ window._pyInputResolve(val); window._pyInputResolve=null; }
}

/* ═══════════════════════════════════════════════════════════════
   CODE EDITOR HELPER FUNCTIONS
═══════════════════════════════════════════════════════════════ */
function handleCodeTab(e) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const ta = document.getElementById('codeArea'); if (!ta) return;
  const s = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.substring(0,s) + '  ' + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = s + 2;
}
function handleCodeRun(e, id)  { if ((e.ctrlKey||e.metaKey) && e.key==='Enter')  { e.preventDefault(); runCode(id); } }
function handleCodeSave(e, id) { if ((e.ctrlKey||e.metaKey) && e.key==='s')      { e.preventDefault(); saveExamCode(id); } }

let _codeFontSize = 14;
function increaseFont() { _codeFontSize=Math.min(24,_codeFontSize+1); const ta=document.getElementById('codeArea'); if(ta)ta.style.fontSize=_codeFontSize+'px'; }
function decreaseFont() { _codeFontSize=Math.max(10,_codeFontSize-1); const ta=document.getElementById('codeArea'); if(ta)ta.style.fontSize=_codeFontSize+'px'; }

function copyOutput() {
  const o=document.getElementById('codeOutput');
  if(o) navigator.clipboard?.writeText(o.innerText||o.textContent).then(()=>toast('📋 Copiado','ok'));
}

function clearCode() {
  const ta = document.getElementById('codeArea');
  if (ta && confirm('¿Limpiar el editor?')) ta.value = '';
}
function clearOutput() {
  const out = document.getElementById('codeOutput');
  if (out) out.innerHTML = '<span style="color:var(--txt4);opacity:.5">Salida limpiada.</span>';
  const fr = document.getElementById('htmlPreviewFrame');
  if (fr) fr.srcdoc = '<html><body style="font-family:sans-serif;color:#aaa;padding:24px;background:#111">Vista limpiada.</body></html>';
}

/* ── RESIZE HANDLE (draggable) ── */
let _resizeState = null;
function startResize(e, id) {
  e.preventDefault();
  const layout = document.getElementById('edLayout_'+id); if (!layout) return;
  const ta  = layout.querySelector('#codeArea');
  const out = layout.querySelector('#codeOutput') || layout.querySelector('#htmlPreviewFrame');
  if (!ta) return;
  _resizeState = { startY:e.clientY, startH:ta.offsetHeight, ta, out };
  document.onmousemove = doResize;
  document.onmouseup  = stopResize;
}
function doResize(e) {
  if (!_resizeState) return;
  const delta = e.clientY - _resizeState.startY;
  const newH  = Math.max(80, _resizeState.startH + delta);
  _resizeState.ta.style.height = newH + 'px';
}
function stopResize() { _resizeState=null; document.onmousemove=null; document.onmouseup=null; }

function saveExamCode(id) {
  const code = document.getElementById('codeArea')?.value || '';
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === id); if (!ex) return;
  ex.codigo  = code; ex.lastSaved = Date.now();
  saveModData(CURRENT_MODULE.id, data); toast('💾 Código guardado','ok');
}
function promptRenameExam(id) {
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === id); if (!ex) return;
  const n    = prompt('Nuevo nombre:', ex.titulo); if (!n||!n.trim()) return;
  ex.titulo  = n.trim(); saveModData(CURRENT_MODULE.id, data);
  toast('Nombre actualizado','ok'); go('ex_'+id);
}
function delExById(id) {
  const data = getModData(CURRENT_MODULE.id);
  data.exams = data.exams.filter(x => x.id !== id);
  saveModData(CURRENT_MODULE.id, data); toast('Examen eliminado','ok'); go('examenes');
}

function runCode(id) {
  window._pyCurrentExamId = id; // Para que el panel input() sepa a qué examen apuntar
  saveExamCode(id);
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === id); if (!ex) return;
  const code = document.getElementById('codeArea')?.value || '';
  const out  = document.getElementById('codeOutput');
  if (out) { out.innerHTML = '<span style="color:var(--txt4);opacity:.5">Ejecutando...</span>'; out.dataset.fresh='1'; }
  if (ex.tipo === 'html') runHTML(code, false); else _pyRunInteractive(code, false);
}

function runHTML(code, fullscreen=false) {
  const frame = document.getElementById(fullscreen?'fullHtmlFrame':'htmlPreviewFrame');
  if (!frame) { toast('Frame no encontrado','err'); return; }
  try { frame.srcdoc = code; toast('▶ HTML renderizado','ok'); }
  catch(e) { toast('Error HTML: '+e.message,'err'); }
}

/* ═══════════════════════════════════════════════════════════════
   PYTHON SIMULATOR — Motor completo con input() interactivo,
   módulos time/sys/math/random, clases, listas, dicts, etc.
═══════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════
   PYTHON INTERPRETER — Motor de ejecución Python seguro v2
   NO usa eval ni JS generado. Interpreta Python línea a línea.
═══════════════════════════════════════════════════════════════════ */

// Estado global del intérprete
window._pyRunning       = false;
window._pyInputResolve  = null;
window._pyCurrentExamId = null;

// ── Ejecutar código Python (punto de entrada principal) ──
async function _pyRunInteractive(code, fullscreen) {
  if (window._pyRunning) { toast('Ya hay un script corriendo. Espera.','err'); return; }
  window._pyRunning = true;

  const outId = fullscreen ? 'fullCodeOutput' : 'codeOutput';
  const out   = document.getElementById(outId);
  if (out) { out.innerHTML = ''; out.dataset.fresh = '0'; }

  try {
    const interp = new PythonInterpreter(fullscreen);
    await interp.run(code);
    _pyAppendOutput('\n[Proceso terminado con código 0]\n', 'color:var(--txt4);font-size:11px');
    toast('▶ Ejecución completada','ok');
  } catch(e) {
    const msg = e?.pyError || e?.message || String(e);
    if (msg.startsWith('SystemExit:')) {
      _pyAppendOutput(`\n[Proceso terminado con código ${msg.slice(11)}]\n`, 'color:var(--txt4);font-size:11px');
    } else {
      _pyAppendOutput(`\n${msg}\n`, 'color:var(--redL)');
      toast('❌ Error en el script','err');
    }
  } finally {
    window._pyRunning = false;
    ['inputPanel_'+(window._pyCurrentExamId||''), 'fullInputPanel'].forEach(pid => {
      const p = document.getElementById(pid);
      if (p) p.style.display = 'none';
    });
  }
}

// ── Agregar texto a la consola ──
function _pyAppendOutput(text, style='') {
  const isFS  = !!document.getElementById('fullIDEOverlay');
  const outId = isFS ? 'fullCodeOutput' : 'codeOutput';
  const out   = document.getElementById(outId);
  if (!out) return;
  if (out.dataset.fresh === '1') { out.innerHTML = ''; out.dataset.fresh = '0'; }
  const span = document.createElement('span');
  if (style) span.style.cssText = style;
  span.textContent = text;
  out.appendChild(span);
  out.scrollTop = out.scrollHeight;
}

// ── Input interactivo ──
function _pyShowInput(promptText) {
  const isFS     = !!document.getElementById('fullIDEOverlay');
  const panelId  = isFS ? 'fullInputPanel'     : ('inputPanel_'+(window._pyCurrentExamId||''));
  const promptId = isFS ? 'fullInputPromptTxt' : 'inputPromptTxt';
  const fieldId  = isFS ? 'fullPyInputField'   : 'pyInputField';
  const panel = document.getElementById(panelId);
  const pTxt  = document.getElementById(promptId);
  const field = document.getElementById(fieldId);
  if (panel) panel.style.display = 'block';
  if (pTxt)  pTxt.textContent    = promptText || '';
  if (field) { field.value = ''; setTimeout(()=>field.focus(), 50); }
}

function submitPyInput() {
  const isFS   = !!document.getElementById('fullIDEOverlay');
  const panelId= isFS ? 'fullInputPanel'   : ('inputPanel_'+(window._pyCurrentExamId||''));
  const fieldId= isFS ? 'fullPyInputField' : 'pyInputField';
  const panel  = document.getElementById(panelId);
  const field  = document.getElementById(fieldId);
  if (!field) return;
  const val = field.value; field.value = '';
  if (panel) panel.style.display = 'none';
  _pyAppendOutput(val + '\n', 'color:var(--blueL)');
  if (window._pyInputResolve) { window._pyInputResolve(val); window._pyInputResolve = null; }
}

function submitFullInput() {
  submitPyInput(); // same handler
}

// ── repr() de valores Python ──
function _pyRepr(v, asRepr=false) {
  if (v === null || v === undefined) return 'None';
  if (v === true)  return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return asRepr ? `'${v.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'` : v;
  if (typeof v === 'number') {
    if (!isFinite(v)) return v > 0 ? 'inf' : '-inf';
    if (isNaN(v))     return 'nan';
    // Python-style: ints without .0, floats with
    if (Number.isInteger(v) && !String(v).includes('.')) return String(v);
    return String(v);
  }
  if (Array.isArray(v)) {
    return v._isTuple
      ? `(${v.map(x=>_pyRepr(x,true)).join(', ')}${v.length===1?',':''})`
      : `[${v.map(x=>_pyRepr(x,true)).join(', ')}]`;
  }
  if (v instanceof PySet)  return `{${[...v.items].map(x=>_pyRepr(x,true)).join(', ')}}` || 'set()';
  if (v instanceof PyDict) return `{${[...v.map.entries()].map(([k,val])=>`${_pyRepr(k,true)}: ${_pyRepr(val,true)}`).join(', ')}}`;
  if (typeof v === 'function') return `<function ${v._pyName||v.name||'<lambda>'}>`;
  if (v instanceof PyObject) return `<${v._class} object>`;
  if (typeof v === 'object') return `{${Object.entries(v).map(([k,val])=>`'${k}': ${_pyRepr(val,true)}`).join(', ')}}`;
  return String(v);
}

// ── Clases auxiliares Python ──
class PySet {
  constructor(items=[]) { this.items = new Set(items); }
  add(v)        { this.items.add(v); return this; }
  remove(v)     { this.items.delete(v); }
  discard(v)    { this.items.delete(v); }
  has(v)        { return this.items.has(v); }
  get size()    { return this.items.size; }
  [Symbol.iterator]() { return this.items[Symbol.iterator](); }
}
class PyDict {
  constructor(entries=[]) { this.map = new Map(entries); }
  get(k,d=null) { return this.map.has(k)?this.map.get(k):d; }
  set(k,v)      { this.map.set(k,v); return this; }
  has(k)        { return this.map.has(k); }
  keys()        { return [...this.map.keys()]; }
  values()      { return [...this.map.values()]; }
  entries()     { return [...this.map.entries()]; }
  get size()    { return this.map.size; }
  [Symbol.iterator]() { return this.map.keys()[Symbol.iterator](); }
}
class PyObject {
  constructor(cls) { this._class = cls; }
}
class PyBreak extends Error { constructor() { super(); this.name='PyBreak'; } }
class PyContinue extends Error { constructor() { super(); this.name='PyContinue'; } }
class PyReturn extends Error { constructor(v) { super(); this.name='PyReturn'; this.value=v; } }
class PyException extends Error {
  constructor(type, msg) { super(msg); this.name=type; this.pyError=`${type}: ${msg}`; }
}

/* ═══════════════════════════════════════════════════════════════
   PYTHON INTERPRETER — Clase principal
═══════════════════════════════════════════════════════════════ */
class PythonInterpreter {
  constructor(fullscreen=false) {
    this.fullscreen = fullscreen;
    this.globals    = this._buildBuiltins();
    this.callStack  = 0;
    this.maxCalls   = 500;
    this.stepCount  = 0;
    this.maxSteps   = 50000;
  }

  // ── Builtins de Python ──
  _buildBuiltins() {
    const self = this;
    const G = {};

    G.print = (...args) => {
      let sep = ' ', end = '\n';
      // Python keyword args sep= end=
      const last = args[args.length-1];
      if (last && typeof last === 'object' && last._kwargs) {
        const kw = args.pop()._kwargs;
        if ('sep' in kw) sep = kw.sep === null ? '' : String(kw.sep);
        if ('end' in kw) end = kw.end === null ? '' : String(kw.end);
      }
      _pyAppendOutput(args.map(a=>_pyRepr(a,false)).join(sep) + end);
    };

    G.input = (prompt='') => new Promise(resolve => {
      const p = String(prompt);
      if (p) _pyAppendOutput(p);
      _pyShowInput(p);
      window._pyInputResolve = resolve;
    });

    G.int   = (x,base=10) => { const n=parseInt(String(x).trim(),base); if(isNaN(n)) throw new PyException('ValueError',`invalid literal for int(): '${x}'`); return n; };
    G.float = (x)         => { const n=parseFloat(String(x).trim()); if(isNaN(n)) throw new PyException('ValueError',`could not convert string to float: '${x}'`); return n; };
    G.str   = (x)         => _pyRepr(x, false);
    G.repr  = (x)         => _pyRepr(x, true);
    G.bool  = (x)         => G.__bool__(x);
    G.len   = (x)         => {
      if (typeof x === 'string' || Array.isArray(x)) return x.length;
      if (x instanceof PySet) return x.size;
      if (x instanceof PyDict) return x.size;
      throw new PyException('TypeError', `object of type '${G.type(x)}' has no len()`);
    };
    G.range = (a,b,c) => {
      const arr = [];
      let s=b!==undefined?Number(a):0, e=b!==undefined?Number(b):Number(a), st=c!==undefined?Number(c):1;
      if (st===0) throw new PyException('ValueError','range() arg 3 must not be zero');
      if (st>0) { for(let i=s;i<e;i+=st) arr.push(i); }
      else       { for(let i=s;i>e;i+=st) arr.push(i); }
      return arr;
    };
    G.abs      = (x)    => Math.abs(x);
    G.round    = (x,n=0)=> Number(Number(x).toFixed(n));
    G.max      = (...a) => { const arr=a.length===1&&Array.isArray(a[0])?a[0]:a; if(!arr.length)throw new PyException('ValueError','max() arg is an empty sequence'); return arr.reduce((m,v)=>v>m?v:m,arr[0]); };
    G.min      = (...a) => { const arr=a.length===1&&Array.isArray(a[0])?a[0]:a; if(!arr.length)throw new PyException('ValueError','min() arg is an empty sequence'); return arr.reduce((m,v)=>v<m?v:m,arr[0]); };
    G.sum      = (a,s=0)=> (Array.isArray(a)?a:[...a]).reduce((acc,v)=>acc+v,s);
    G.pow      = (x,y,m)=> m!==undefined?(x**y)%m:x**y;
    G.divmod   = (a,b)  => [Math.floor(a/b), ((a%b)+b)%b];
    G.sorted   = (a,rev=false) => { const arr=[...(Array.isArray(a)?a:[...a])]; arr.sort((x,y)=>x>y?1:x<y?-1:0); if(rev)arr.reverse(); return arr; };
    G.reversed = (a)    => [...(Array.isArray(a)?a:[...a])].reverse();
    G.enumerate= (a,s=0)=> (Array.isArray(a)?a:[...a]).map((v,i)=>[i+s,v]);
    G.zip      = (...arrs)=> { const len=Math.min(...arrs.map(a=>Array.isArray(a)?a.length:0)); return Array.from({length:len},(_,i)=>arrs.map(a=>a[i])); };
    G.map      = (fn,a) => [...(Array.isArray(a)?a:[...a])].map(fn);
    G.filter   = (fn,a) => [...(Array.isArray(a)?a:[...a])].filter(fn);
    G.list     = (x)    => Array.isArray(x)?[...x]:(x instanceof PySet?[...x.items]:(x instanceof PyDict?x.keys():(typeof x==='string'?[...x]:[])));
    G.tuple    = (x)    => { const a=G.list(x); a._isTuple=true; return a; };
    G.set      = (x)    => new PySet(x?[...(Array.isArray(x)?x:[...x])]:[]);
    G.dict     = (x)    => x instanceof PyDict ? x : new PyDict(x instanceof Map?[...x.entries()]:Object.entries(x||{}));
    G.type     = (x)    => {
      if(x===null||x===undefined) return "<class 'NoneType'>";
      if(x===true||x===false) return "<class 'bool'>";
      if(Array.isArray(x)) return x._isTuple?"<class 'tuple'>":"<class 'list'>";
      if(x instanceof PySet)  return "<class 'set'>";
      if(x instanceof PyDict) return "<class 'dict'>";
      if(typeof x==='number') return Number.isInteger(x)?"<class 'int'>":"<class 'float'>";
      if(typeof x==='string') return "<class 'str'>";
      if(typeof x==='function') return "<class 'function'>";
      return "<class 'object'>";
    };
    G.isinstance= (x,t) => {
      if(t==='int'||t===G.int)    return typeof x==='number'&&Number.isInteger(x);
      if(t==='float'||t===G.float)return typeof x==='number';
      if(t==='str'||t===G.str)    return typeof x==='string';
      if(t==='bool'||t===G.bool)  return typeof x==='boolean';
      if(t==='list'||t===G.list)  return Array.isArray(x);
      return true;
    };
    G.hasattr  = (o,k)   => o!=null && k in o;
    G.getattr  = (o,k,d) => o?.[k]??d;
    G.setattr  = (o,k,v) => { if(o)o[k]=v; };
    G.chr      = (n)     => String.fromCharCode(n);
    G.ord      = (s)     => { if(typeof s!=='string'||s.length!==1)throw new PyException('TypeError','ord() expected a character'); return s.charCodeAt(0); };
    G.hex      = (n)     => '0x'+Math.trunc(n).toString(16);
    G.oct      = (n)     => '0o'+Math.trunc(n).toString(8);
    G.bin      = (n)     => '0b'+Math.trunc(n).toString(2);
    G.format   = (v,spec)=> { if(!spec)return G.str(v); if(spec.includes('f'))return Number(v).toFixed(parseInt(spec)||2); return String(v); };
    G.id       = (x)     => Math.floor(Math.random()*1e15);
    G.hash     = (x)     => String(x).split('').reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0);
    G.callable = (x)     => typeof x==='function';
    G.any      = (a)     => [...(Array.isArray(a)?a:[...a])].some(x=>G.__bool__(x));
    G.all      = (a)     => [...(Array.isArray(a)?a:[...a])].every(x=>G.__bool__(x));
    G.open     = ()      => ({ write:()=>{}, read:()=>'', close:()=>{}, readlines:()=>[], __enter__(){return this;}, __exit__(){} });
    G.vars     = (o)     => o||{};
    G.dir      = (o)     => o?Object.keys(o):[];

    // bool helper
    G.__bool__ = (x) => {
      if (x===null||x===undefined||x===false||x===0||x===0.0) return false;
      if (x==='') return false;
      if (Array.isArray(x) && x.length===0) return false;
      if (x instanceof PySet && x.size===0) return false;
      if (x instanceof PyDict && x.size===0) return false;
      return true;
    };

    // ── módulo math ──
    G.math = {
      pi:Math.PI, e:Math.E, tau:2*Math.PI, inf:Infinity, nan:NaN,
      sqrt:(x)=>Math.sqrt(x), ceil:(x)=>Math.ceil(x), floor:(x)=>Math.floor(x),
      trunc:(x)=>Math.trunc(x), fabs:(x)=>Math.abs(x),
      log:(x,b)=>b!==undefined?Math.log(x)/Math.log(b):Math.log(x),
      log2:(x)=>Math.log2(x), log10:(x)=>Math.log10(x), exp:(x)=>Math.exp(x),
      pow:(x,y)=>Math.pow(x,y), sqrt:(x)=>Math.sqrt(x),
      sin:(x)=>Math.sin(x), cos:(x)=>Math.cos(x), tan:(x)=>Math.tan(x),
      asin:(x)=>Math.asin(x), acos:(x)=>Math.acos(x), atan:(x)=>Math.atan(x),
      atan2:(y,x)=>Math.atan2(y,x), radians:(x)=>x*Math.PI/180, degrees:(x)=>x*180/Math.PI,
      gcd:(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;},
      factorial:(n)=>{if(n<0)throw new PyException('ValueError','factorial() not defined for negative values');let r=1;for(let i=2;i<=n;i++)r*=i;return r;},
      isnan:(x)=>isNaN(x), isinf:(x)=>!isFinite(x),
      hypot:(...a)=>Math.hypot(...a),
      comb:(n,k)=>{let r=1;for(let i=0;i<k;i++)r=r*(n-i)/(i+1);return Math.round(r);},
      perm:(n,k=n)=>{let r=1;for(let i=0;i<k;i++)r*=(n-i);return r;},
      modf:(x)=>{const f=x>=0?x%1:-((-x)%1);return[f,x-f];},
    };

    // ── módulo random ──
    G.random = {
      random:()=>Math.random(),
      randint:(a,b)=>Math.floor(Math.random()*(b-a+1))+a,
      randrange:(a,b,s=1)=>{const arr=G.range(a,b,s);return arr[Math.floor(Math.random()*arr.length)];},
      choice:(a)=>a[Math.floor(Math.random()*a.length)],
      choices:(a,k=1)=>Array.from({length:k},()=>a[Math.floor(Math.random()*a.length)]),
      shuffle:(a)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}},
      sample:(a,k)=>{const c=[...a];G.random.shuffle(c);return c.slice(0,k);},
      uniform:(a,b)=>Math.random()*(b-a)+a,
      seed:()=>{},
      gauss:(mu=0,s=1)=>{const u=1-Math.random(),v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*s+mu;},
      normalvariate:(mu=0,s=1)=>G.random.gauss(mu,s),
    };

    // ── módulo time ──
    const _t0 = Date.now();
    G.time = {
      time:()=>(Date.now()-_t0)/1000,
      sleep:(s)=>new Promise(r=>setTimeout(r,Math.min(Number(s)*100,2000))), // acelerado x10
      time_ns:()=>(Date.now()-_t0)*1e6,
      perf_counter:()=>performance.now()/1000,
      localtime:()=>{const d=new Date();return{tm_year:d.getFullYear(),tm_mon:d.getMonth()+1,tm_mday:d.getDate(),tm_hour:d.getHours(),tm_min:d.getMinutes(),tm_sec:d.getSeconds(),tm_wday:(d.getDay()+6)%7,tm_yday:Math.ceil((d-new Date(d.getFullYear(),0,1))/86400000),tm_isdst:0};},
      strftime:(fmt)=>new Date().toLocaleString('es-MX'),
      monotonic:()=>performance.now()/1000,
    };

    // ── módulo sys ──
    G.sys = {
      argv:['script.py'], version:'3.11.0 (CÓDICE)', platform:'browser', maxsize:Number.MAX_SAFE_INTEGER,
      exit:(code=0)=>{throw new PyException('SystemExit',String(code));},
      stdout:{write:(s)=>_pyAppendOutput(String(s)),flush:()=>{}},
      stderr:{write:(s)=>_pyAppendOutput(String(s),'color:var(--redL)'),flush:()=>{}},
      path:[], modules:{},
    };

    // ── módulo os ──
    G.os = {
      getcwd:()=>'/home/codice', sep:'/', linesep:'\n',
      path:{join:(...a)=>a.join('/'),exists:()=>false,basename:(p)=>p.split('/').pop(),dirname:(p)=>p.split('/').slice(0,-1).join('/'),abspath:(p)=>'/'+p,isfile:()=>false,isdir:()=>false},
      environ:{get:(k,d='')=>d},
      getenv:(k,d='')=>d, listdir:()=>[], makedirs:()=>{}, remove:()=>{},
    };

    // ── módulo re ──
    G.re = {
      compile:(pat,flags=0)=>({
        match:(s)=>{try{const m=s.match(new RegExp('^'+pat));return m?{group:(n=0)=>m[n]||m[0],groups:()=>m.slice(1),start:()=>0,end:()=>m[0].length}:null;}catch{return null;}},
        search:(s)=>{try{const m=s.match(new RegExp(pat));return m?{group:(n=0)=>m[n]||m[0],groups:()=>m.slice(1)}:null;}catch{return null;}},
        findall:(s)=>{try{return s.match(new RegExp(pat,'g'))||[];}catch{return[];}},
        sub:(r,s,count=0)=>{try{return s.replace(new RegExp(pat,count?'':'g'),r);}catch{return s;}},
        split:(s)=>{try{return s.split(new RegExp(pat));}catch{return[s];}},
      }),
      match:(pat,s)=>G.re.compile(pat).match(s),
      search:(pat,s)=>G.re.compile(pat).search(s),
      findall:(pat,s)=>G.re.compile(pat).findall(s),
      sub:(pat,r,s)=>G.re.compile(pat).sub(r,s),
      split:(pat,s)=>G.re.compile(pat).split(s),
      IGNORECASE:2, MULTILINE:8, DOTALL:16, VERBOSE:64,
    };

    // ── módulo collections ──
    G.collections = {
      Counter:(a)=>{const c=new PyDict();(Array.isArray(a)?a:[...a]).forEach(x=>{c.map.set(x,(c.map.get(x)||0)+1);});return c;},
      defaultdict:(fn)=>{const d=new PyDict();d._default=fn;return d;},
      deque:(a=[],max=Infinity)=>{const d=[...a];d.appendleft=x=>d.unshift(x);d.append=x=>d.push(x);d.popleft=()=>d.shift();d.maxlen=max;return d;},
      OrderedDict:()=>new PyDict(),
      namedtuple:(name,fields)=>{const fs=typeof fields==='string'?fields.split(/[\s,]+/):fields;return(...vals)=>{const o={};fs.forEach((f,i)=>o[f]=vals[i]);return o;};},
    };

    // ── módulo string ──
    G.string = { ascii_letters:'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', ascii_lowercase:'abcdefghijklmnopqrstuvwxyz', ascii_uppercase:'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits:'0123456789', punctuation:'!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~', whitespace:' \t\n\r', capwords:(s)=>s.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ') };

    // ── módulo itertools ──
    G.itertools = {
      chain:(...arrs)=>arrs.flat(),
      product:(a,b)=>a.flatMap(x=>b.map(y=>[x,y])),
      combinations:(a,r)=>{const res=[];function c(s,cur){if(cur.length===r){res.push([...cur]);return;}for(let i=s;i<a.length;i++){cur.push(a[i]);c(i+1,cur);cur.pop();}}c(0,[]);return res;},
      permutations:(a,r=a.length)=>{const res=[];function p(cur,rem){if(cur.length===r){res.push([...cur]);return;}rem.forEach((v,i)=>{cur.push(v);p(cur,[...rem.slice(0,i),...rem.slice(i+1)]);cur.pop();});}p([],[...a]);return res;},
      repeat:(x,n)=>Array.from({length:n},()=>x),
      count:(s=0,step=1)=>{let i=s;return{__next__:()=>{const v=i;i+=step;return v;}};},
      accumulate:(a,fn=(x,y)=>x+y)=>{let acc=a[0];return a.slice(1).reduce((r,v)=>{acc=fn(acc,v);r.push(acc);return r;},[a[0]]);},
    };

    // ── Excepciones ──
    G.Exception=class extends Error{constructor(m=''){super(m);this.name='Exception';this.pyError=`Exception: ${m}`;}};
    G.ValueError=class extends Error{constructor(m=''){super(m);this.name='ValueError';this.pyError=`ValueError: ${m}`;}};
    G.TypeError=class extends Error{constructor(m=''){super(m);this.name='TypeError';this.pyError=`TypeError: ${m}`;}};
    G.IndexError=class extends Error{constructor(m=''){super(m);this.name='IndexError';this.pyError=`IndexError: ${m}`;}};
    G.KeyError=class extends Error{constructor(m=''){super(m);this.name='KeyError';this.pyError=`KeyError: ${m}`;}};
    G.NameError=class extends Error{constructor(m=''){super(m);this.name='NameError';this.pyError=`NameError: ${m}`;}};
    G.AttributeError=class extends Error{constructor(m=''){super(m);this.name='AttributeError';this.pyError=`AttributeError: ${m}`;}};
    G.ZeroDivisionError=class extends Error{constructor(m='division by zero'){super(m);this.name='ZeroDivisionError';this.pyError=`ZeroDivisionError: ${m}`;}};
    G.StopIteration=class extends Error{constructor(){super();this.name='StopIteration';}};
    G.SystemExit=class extends Error{constructor(c=0){super(String(c));this.name='SystemExit';this.pyError='SystemExit:'+c;}};
    G.RuntimeError=class extends Error{constructor(m=''){super(m);this.name='RuntimeError';this.pyError=`RuntimeError: ${m}`;}};
    G.NotImplementedError=class extends Error{constructor(m=''){super(m);this.name='NotImplementedError';this.pyError=`NotImplementedError: ${m}`;}};

    // Constantes
    G.None  = null;
    G.True  = true;
    G.False = false;
    G.NotImplemented = undefined;
    G.Ellipsis = '...';
    G.__name__ = '__main__';

    return G;
  }

  // ── Ejecutar código ──
  async run(code) {
    const lines = code.split('\n');
    const blocks = this._parseBlocks(lines, 0, lines.length);
    await this._execBlocks(blocks, this.globals);
  }

  // ── Parser de bloques ──
  _parseBlocks(lines, start, end) {
    const blocks = [];
    let i = start;
    while (i < end) {
      const raw = lines[i];
      if (!raw || !raw.trim() || raw.trim().startsWith('#')) { i++; continue; }
      const indent = this._indent(raw);
      const line   = raw.trim();

      // Bloques compuestos
      if (this._isBlockHeader(line)) {
        // Recopilar el cuerpo indentado
        const bodyStart = i + 1;
        let   j = bodyStart;
        while (j < end) {
          const next = lines[j];
          if (!next || !next.trim() || next.trim().startsWith('#')) { j++; continue; }
          if (this._indent(next) <= indent && next.trim()) break;
          j++;
        }
        blocks.push({ type:'compound', header:line, indent, bodyLines:lines.slice(bodyStart, j), lineNum:i+1 });
        i = j;
      } else {
        blocks.push({ type:'simple', line, indent, lineNum:i+1 });
        i++;
      }
    }
    return blocks;
  }

  _isBlockHeader(line) {
    return /^(if|elif|else|for|while|def|class|try|except|finally|with|async\s+def)\b/.test(line) && line.endsWith(':');
  }

  _indent(line) {
    return line.length - line.trimStart().length;
  }

  // ── Ejecutar lista de bloques ──
  async _execBlocks(blocks, scope) {
    let i = 0;
    while (i < blocks.length) {
      const b = blocks[i];
      this.stepCount++;
      if (this.stepCount > this.maxSteps) throw new PyException('RuntimeError', 'Tiempo de ejecución máximo excedido (bucle infinito?)');

      if (b.type === 'simple') {
        await this._execLine(b.line, scope);
        i++;
      } else {
        // compound: if/elif/else chain, for, while, def, class, try
        const header = b.header;
        if (header.startsWith('if ')) {
          i = await this._execIfChain(blocks, i, scope);
        } else if (header.startsWith('for ')) {
          await this._execFor(b, scope);
          i++;
        } else if (header.startsWith('while ')) {
          await this._execWhile(b, scope);
          i++;
        } else if (header.startsWith('def ') || header.startsWith('async def ')) {
          this._defFunction(b, scope);
          i++;
        } else if (header.startsWith('class ')) {
          await this._defClass(b, scope);
          i++;
        } else if (header.startsWith('try')) {
          i = await this._execTry(blocks, i, scope);
        } else if (header.startsWith('with ')) {
          await this._execWith(b, scope);
          i++;
        } else {
          i++;
        }
      }
    }
  }

  // ── Cadena if/elif/else ──
  async _execIfChain(blocks, i, scope) {
    // Recopilar todos los elif/else consecutivos
    const chain = [blocks[i]];
    let j = i + 1;
    while (j < blocks.length && blocks[j].type==='compound' &&
           (blocks[j].header.startsWith('elif ') || blocks[j].header === 'else:')) {
      chain.push(blocks[j]); j++;
    }
    // Ejecutar la rama correcta
    for (const branch of chain) {
      if (branch.header === 'else:') {
        const inner = this._parseBlocks(branch.bodyLines, 0, branch.bodyLines.length);
        await this._execBlocks(inner, scope);
        break;
      }
      const cond = branch.header.replace(/^(if|elif)\s+/,'').slice(0,-1); // quitar :
      const val  = await this._evalExpr(cond, scope);
      if (this.globals.__bool__(val)) {
        const inner = this._parseBlocks(branch.bodyLines, 0, branch.bodyLines.length);
        await this._execBlocks(inner, scope);
        break;
      }
    }
    return j;
  }

  // ── For loop ──
  async _execFor(b, scope) {
    // "for VAR in EXPR:" o "for V1, V2 in EXPR:"
    const header = b.header.slice(4, -1); // quitar "for " y ":"
    const inIdx  = header.lastIndexOf(' in ');
    if (inIdx === -1) throw new PyException('SyntaxError','invalid for statement');
    const varPart = header.slice(0, inIdx).trim();
    const iterPart= header.slice(inIdx+4).trim();
    const iterable= await this._evalExpr(iterPart, scope);
    const items   = this._toIterable(iterable);
    const inner   = this._parseBlocks(b.bodyLines, 0, b.bodyLines.length);
    const isMulti = varPart.includes(',');

    for (const item of items) {
      this.stepCount++;
      if (this.stepCount > this.maxSteps) throw new PyException('RuntimeError','Bucle infinito detectado');
      if (isMulti) {
        const vars = varPart.split(',').map(v=>v.trim());
        vars.forEach((v,idx)=>scope[v] = Array.isArray(item)?item[idx]:item);
      } else {
        scope[varPart] = item;
      }
      try {
        await this._execBlocks(inner, scope);
      } catch(e) {
        if (e instanceof PyBreak) break;
        if (e instanceof PyContinue) continue;
        throw e;
      }
    }
  }

  _toIterable(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return [...v];
    if (v instanceof PySet) return [...v.items];
    if (v instanceof PyDict) return v.keys();
    if (v && typeof v[Symbol.iterator]==='function') return [...v];
    throw new PyException('TypeError', `'${typeof v}' object is not iterable`);
  }

  // ── While loop ──
  async _execWhile(b, scope) {
    const cond  = b.header.slice(6,-1).trim(); // quitar "while " y ":"
    const inner = this._parseBlocks(b.bodyLines, 0, b.bodyLines.length);
    let loopCount = 0;
    while (true) {
      loopCount++;
      this.stepCount++;
      if (loopCount > 100000 || this.stepCount > this.maxSteps) throw new PyException('RuntimeError','Bucle infinito detectado');
      const val = await this._evalExpr(cond, scope);
      if (!this.globals.__bool__(val)) break;
      try {
        await this._execBlocks(inner, scope);
      } catch(e) {
        if (e instanceof PyBreak) break;
        if (e instanceof PyContinue) continue;
        throw e;
      }
    }
  }

  // ── Definir función ──
  _defFunction(b, scope) {
    // "def name(params):" o "async def name(params):"
    const match = b.header.match(/^(?:async\s+)?def\s+(\w+)\s*\((.*)\)\s*:/);
    if (!match) return;
    const fname   = match[1];
    const pStr    = match[2];
    const bodyLines = b.bodyLines;
    const self    = this;
    const capturedScope = {...scope}; // closure

    const fn = async (...args) => {
      self.callStack++;
      if (self.callStack > self.maxCalls) { self.callStack--; throw new PyException('RecursionError','maximum recursion depth exceeded'); }
      const local = {...capturedScope};
      // Parse params
      const params = pStr ? pStr.split(',').map(p=>p.trim()) : [];
      params.forEach((p,i) => {
        if (p.includes('=')) {
          const [pname, pdef] = p.split('=').map(s=>s.trim());
          local[pname] = args[i] !== undefined ? args[i] : self._evalExprSync(pdef, capturedScope);
        } else if (p.startsWith('*')) {
          local[p.slice(1)] = args.slice(i);
        } else {
          local[p] = args[i];
        }
      });
      let retVal = null;
      try {
        const inner = self._parseBlocks(bodyLines, 0, bodyLines.length);
        await self._execBlocks(inner, local);
      } catch(e) {
        if (e instanceof PyReturn) { retVal = e.value; }
        else throw e;
      } finally { self.callStack--; }
      return retVal;
    };
    fn._pyName = fname;
    scope[fname] = fn;
  }

  // ── Definir clase ──
  async _defClass(b, scope) {
    const match = b.header.match(/^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/);
    if (!match) return;
    const cname  = match[1];
    const base   = match[2] ? scope[match[2].trim()] : null;
    const proto  = base ? {...base.prototype} : {};
    const self   = this;

    // Ejecutar el cuerpo de la clase para recopilar métodos
    const classScope = {...scope, ...proto};
    const inner = this._parseBlocks(b.bodyLines, 0, b.bodyLines.length);
    await this._execBlocks(inner, classScope);

    // Constructor de la clase
    const cls = function(...args) {
      const instance = Object.create(proto);
      instance._class = cname;
      if (classScope.__init__) {
        classScope.__init__.call(instance, ...args);
      }
      // Copiar métodos al instance
      Object.keys(classScope).forEach(k => {
        if (typeof classScope[k]==='function') instance[k]=classScope[k].bind(instance);
      });
      return instance;
    };
    cls.prototype = proto;
    // Copiar métodos definidos
    Object.keys(classScope).forEach(k => {
      if (k !== '__init__' && typeof classScope[k]==='function') proto[k] = classScope[k];
    });
    scope[cname] = cls;
  }

  // ── Try/except ──
  async _execTry(blocks, i, scope) {
    const tryBlock = blocks[i];
    const chain = [tryBlock];
    let j = i + 1;
    while (j < blocks.length && blocks[j].type==='compound' &&
           /^(except|finally)/.test(blocks[j].header)) {
      chain.push(blocks[j]); j++;
    }
    const tryInner = this._parseBlocks(tryBlock.bodyLines, 0, tryBlock.bodyLines.length);
    let caught = false;
    try {
      await this._execBlocks(tryInner, scope);
    } catch(e) {
      if (e instanceof PyBreak || e instanceof PyContinue || e instanceof PyReturn) throw e;
      // Buscar except que coincida
      for (const branch of chain.slice(1)) {
        if (branch.header.startsWith('except')) {
          const m = branch.header.match(/^except\s*(\w+)?(?:\s+as\s+(\w+))?\s*:/);
          if (m && m[2]) scope[m[2]] = e;
          const excInner = this._parseBlocks(branch.bodyLines, 0, branch.bodyLines.length);
          await this._execBlocks(excInner, scope);
          caught = true; break;
        }
      }
      if (!caught) throw e;
    } finally {
      // Ejecutar finally si existe
      for (const branch of chain.slice(1)) {
        if (branch.header === 'finally:') {
          const finInner = this._parseBlocks(branch.bodyLines, 0, branch.bodyLines.length);
          await this._execBlocks(finInner, scope);
          break;
        }
      }
    }
    return j;
  }

  // ── With statement ──
  async _execWith(b, scope) {
    const m = b.header.match(/^with\s+(.+)\s+as\s+(\w+)\s*:/);
    if (!m) { const inner=this._parseBlocks(b.bodyLines,0,b.bodyLines.length);await this._execBlocks(inner,scope);return; }
    const ctx  = await this._evalExpr(m[1], scope);
    const name = m[2];
    scope[name] = ctx.__enter__ ? ctx.__enter__() : ctx;
    try { const inner=this._parseBlocks(b.bodyLines,0,b.bodyLines.length);await this._execBlocks(inner,scope); }
    finally { if(ctx.__exit__) ctx.__exit__(null,null,null); }
  }

  // ── Ejecutar línea simple ──
  async _execLine(line, scope) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    // import (ignorar, módulos ya disponibles en globals)
    if (/^import\s+/.test(line) || /^from\s+\w+\s+import/.test(line)) {
      const am = line.match(/^import\s+(\w+)\s+as\s+(\w+)$/);
      if (am && this.globals[am[1]]) scope[am[2]] = this.globals[am[1]];
      const fm = line.match(/^from\s+(\w+)\s+import\s+(.+)$/);
      if (fm && this.globals[fm[1]]) {
        const names = fm[2].split(',');
        names.forEach(n => {
          const parts = n.trim().split(/\s+as\s+/);
          const src   = parts[0].trim();
          const dst   = (parts[1]||src).trim();
          if (this.globals[fm[1]][src] !== undefined) scope[dst] = this.globals[fm[1]][src];
        });
      }
      return;
    }

    // print shorthand (también capturado por _evalExpr)
    // pass
    if (line === 'pass') return;
    // break
    if (line === 'break') throw new PyBreak();
    // continue
    if (line === 'continue') throw new PyContinue();
    // return
    if (line === 'return') throw new PyReturn(null);
    if (line.startsWith('return ')) {
      const val = await this._evalExpr(line.slice(7).trim(), scope);
      throw new PyReturn(val);
    }
    // raise
    if (line === 'raise') throw scope._e || new PyException('Exception','');
    if (line.startsWith('raise ')) {
      const val = await this._evalExpr(line.slice(6).trim(), scope);
      throw val;
    }
    // assert
    if (line.startsWith('assert ')) {
      const rest = line.slice(7);
      const commaIdx = rest.indexOf(',');
      const condStr = commaIdx>-1 ? rest.slice(0,commaIdx) : rest;
      const msg     = commaIdx>-1 ? await this._evalExpr(rest.slice(commaIdx+1).trim(),scope) : '';
      const val     = await this._evalExpr(condStr.trim(), scope);
      if (!this.globals.__bool__(val)) throw new PyException('AssertionError', String(msg));
      return;
    }
    // del
    if (line.startsWith('del ')) { delete scope[line.slice(4).trim()]; return; }
    // global / nonlocal
    if (line.startsWith('global ') || line.startsWith('nonlocal ')) return;

    // Augmented assignment: x += y etc
    const augMatch = line.match(/^([a-zA-Z_][\w.]*(?:\[.*?\])?)\s*(\+=|-=|\*=|\/=|\/\/=|%=|\*\*=|&=|\|=|\^=|>>=|<<=)\s*(.+)$/);
    if (augMatch) {
      const [,lhs,op,rhs] = augMatch;
      const cur = await this._evalExpr(lhs, scope);
      const val = await this._evalExpr(rhs, scope);
      let res;
      switch(op) {
        case '+=':  res = typeof cur==='string'||typeof val==='string' ? String(cur)+String(val) : cur+val; break;
        case '-=':  res = cur-val; break;
        case '*=':  res = cur*val; break;
        case '/=':  res = cur/val; break;
        case '//=': res = Math.floor(cur/val); break;
        case '%=':  res = cur%val; break;
        case '**=': res = cur**val; break;
        case '&=':  res = cur&val; break;
        case '|=':  res = cur|val; break;
        case '^=':  res = cur^val; break;
        case '>>=': res = cur>>val; break;
        case '<<=': res = cur<<val; break;
        default: res = cur+val;
      }
      await this._assign(lhs, res, scope);
      return;
    }

    // Assignment: a = b (also handles a, b = ...)
    const eqIdx = this._findAssignEq(line);
    if (eqIdx > -1) {
      const lhs = line.slice(0, eqIdx).trim();
      const rhs = line.slice(eqIdx+1).trim();
      const val = await this._evalExpr(rhs, scope);
      if (lhs.includes(',')) {
        // Tuple unpacking
        const vars = lhs.split(',').map(v=>v.trim().replace(/^\(|\)$/g,''));
        const vals = Array.isArray(val) ? val : [val];
        vars.forEach((v,i) => { if(v) scope[v] = vals[i] !== undefined ? vals[i] : null; });
      } else {
        await this._assign(lhs, val, scope);
      }
      return;
    }

    // Expression statement (function call, etc.)
    await this._evalExpr(line, scope);
  }

  // Encuentra el '=' de asignación (no ==, !=, <=, >=, **=, +=, etc.)
  _findAssignEq(line) {
    let depth = 0; // parens/brackets depth
    for (let i=0; i<line.length; i++) {
      const c = line[i];
      if (c==='('||c==='['||c==='{') depth++;
      else if (c===')'||c===']'||c==='}') depth--;
      else if (c==='=' && depth===0) {
        const prev = line[i-1]; const next = line[i+1];
        if (prev==='!'||prev==='<'||prev==='>'||prev==='='||prev==='+'||prev==='-'||prev==='*'||prev==='/'||prev==='%'||prev==='&'||prev==='|'||prev==='^') continue;
        if (next==='=') continue;
        return i;
      }
    }
    return -1;
  }

  // ── Asignación a LHS (puede ser a.b, a[i], a) ──
  async _assign(lhs, val, scope) {
    if (lhs.includes('[')) {
      // a[i] = val
      const m = lhs.match(/^(.+)\[(.+)\]$/);
      if (m) {
        const obj = await this._evalExpr(m[1].trim(), scope);
        const key = await this._evalExpr(m[2].trim(), scope);
        if (obj instanceof PyDict) obj.map.set(key, val);
        else obj[key] = val;
        return;
      }
    }
    if (lhs.includes('.')) {
      const parts = lhs.split('.');
      let obj = scope[parts[0]] || this.globals[parts[0]];
      for (let i=1; i<parts.length-1; i++) obj = obj[parts[i]];
      obj[parts[parts.length-1]] = val;
      return;
    }
    scope[lhs] = val;
  }

  // ── Evaluación de expresiones (siempre async) ──
  async _evalExpr(expr, scope) {
    const result = this._evalExprSync(expr, scope, true);
    // Si el resultado es una Promise (de input() o time.sleep()), awaiteamos
    if (result && typeof result.then === 'function') {
      return await result;
    }
    return result;
  }

  _evalExprSync(expr, scope, allowAsync=false) {
    expr = expr.trim();
    if (!expr) return null;

    // None/True/False
    if (expr==='None')  return null;
    if (expr==='True')  return true;
    if (expr==='False') return false;

    // String literal
    if ((expr.startsWith('"')&&expr.endsWith('"')) || (expr.startsWith("'")&&expr.endsWith("'"))) {
      return expr.slice(1,-1).replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\r/g,'\r').replace(/\\\\/g,'\\').replace(/\\'/g,"'").replace(/\\"/g,'"');
    }
    // Triple-quoted string
    if (expr.startsWith('"""') && expr.endsWith('"""')) return expr.slice(3,-3);
    if (expr.startsWith("'''") && expr.endsWith("'''")) return expr.slice(3,-3);

    // f-string
    if ((expr.startsWith('f"')||expr.startsWith("f'"))&&(expr.endsWith('"')||expr.endsWith("'"))) {
      const inner = expr.slice(2,-1);
      return inner.replace(/\{([^}]+)\}/g, (_,e) => {
        try { return _pyRepr(this._evalExprSync(e.trim(), scope, false), false); } catch { return ''; }
      });
    }

    // Number
    if (/^-?\d+\.\d*$/.test(expr)) return parseFloat(expr);
    if (/^-?\d+$/.test(expr)) return parseInt(expr, 10);
    if (/^0x[0-9a-fA-F]+$/.test(expr)) return parseInt(expr, 16);
    if (/^0b[01]+$/.test(expr)) return parseInt(expr, 2);
    if (/^0o[0-7]+$/.test(expr)) return parseInt(expr, 8);
    if (expr==='...') return null;

    // List literal [...]
    if (expr.startsWith('[') && expr.endsWith(']')) {
      const inner = expr.slice(1,-1).trim();
      if (!inner) return [];
      const items = this._splitArgs(inner);
      return items.map(item => this._evalExprSync(item.trim(), scope, false));
    }

    // Tuple (...)
    if (expr.startsWith('(') && expr.endsWith(')')) {
      const inner = expr.slice(1,-1).trim();
      if (!inner) { const t=[]; t._isTuple=true; return t; }
      // Could be grouping or tuple
      const items = this._splitArgs(inner);
      if (items.length === 1 && !inner.endsWith(',')) return this._evalExprSync(inner, scope, false);
      const arr = items.map(item => this._evalExprSync(item.trim(), scope, false));
      arr._isTuple = true; return arr;
    }

    // Dict {...}
    if (expr.startsWith('{') && expr.endsWith('}')) {
      const inner = expr.slice(1,-1).trim();
      if (!inner) return new PyDict();
      const d = new PyDict();
      const pairs = this._splitArgs(inner);
      pairs.forEach(pair => {
        const ci = pair.indexOf(':');
        if (ci>-1) {
          const k = this._evalExprSync(pair.slice(0,ci).trim(), scope, false);
          const v = this._evalExprSync(pair.slice(ci+1).trim(), scope, false);
          d.map.set(k,v);
        }
      });
      return d;
    }

    // Unary not
    if (expr.startsWith('not ')) return !this.globals.__bool__(this._evalExprSync(expr.slice(4).trim(), scope, false));
    if (expr.startsWith('-') && !/^-\d/.test(expr)) return -(this._evalExprSync(expr.slice(1).trim(), scope, false));

    // Boolean operators (right to left at top level)
    const orParts  = this._splitOp(expr, ' or ');
    if (orParts) { const L=this._evalExprSync(orParts[0],scope,false); return this.globals.__bool__(L)?L:this._evalExprSync(orParts[1],scope,false); }
    const andParts = this._splitOp(expr, ' and ');
    if (andParts) { const L=this._evalExprSync(andParts[0],scope,false); return !this.globals.__bool__(L)?L:this._evalExprSync(andParts[1],scope,false); }

    // Comparison operators
    for (const op of ['>=','<=','!=','==','>','<',' in ',' not in ',' is not ',' is ']) {
      const parts = this._splitOp(expr, op);
      if (parts) {
        const L = this._evalExprSync(parts[0],scope,false);
        const R = this._evalExprSync(parts[1],scope,false);
        switch(op.trim()) {
          case '==':     return L===null?R===null:L===R;
          case '!=':     return L!==R;
          case '>':      return L>R;
          case '<':      return L<R;
          case '>=':     return L>=R;
          case '<=':     return L<=R;
          case 'in':     return Array.isArray(R)?R.includes(L):(typeof R==='string'?R.includes(String(L)):(R instanceof PyDict?R.has(L):false));
          case 'not in': return !(Array.isArray(R)?R.includes(L):(typeof R==='string'?R.includes(String(L)):false));
          case 'is':     return L===R;
          case 'is not': return L!==R;
        }
      }
    }

    // Arithmetic operators (lowest to highest precedence)
    for (const op of ['+','-']) {
      const parts = this._splitOp(expr, op);
      if (parts) {
        const L = this._evalExprSync(parts[0],scope,false);
        const R = this._evalExprSync(parts[1],scope,false);
        if (op==='+') return (typeof L==='string'||typeof R==='string') ? String(L)+String(R) : (Array.isArray(L)&&Array.isArray(R))?[...L,...R]:L+R;
        return L-R;
      }
    }
    for (const op of ['*','/','//','%','**']) {
      const parts = this._splitOp(expr, op);
      if (parts) {
        const L = this._evalExprSync(parts[0],scope,false);
        const R = this._evalExprSync(parts[1],scope,false);
        if (op==='*') return (typeof L==='string'&&typeof R==='number')?L.repeat(R):(typeof L==='number'&&typeof R==='string')?R.repeat(L):L*R;
        if (op==='/') return L/R;
        if (op==='//') return Math.floor(L/R);
        if (op==='%') return ((L%R)+R)%R;
        if (op==='**') return L**R;
      }
    }

    // Method call: obj.method(args)
    const dotCallM = expr.match(/^(.+)\.(\w+)\s*\(([^]*)\)$/);
    if (dotCallM) {
      const obj    = this._evalExprSync(dotCallM[1].trim(), scope, false);
      const method = dotCallM[2];
      const rawArgs= dotCallM[3];
      const args   = rawArgs.trim() ? this._splitArgs(rawArgs).map(a=>this._evalExprSync(a.trim(),scope,false)) : [];
      return this._callMethod(obj, method, args);
    }

    // Function call: name(args)
    const callM = expr.match(/^([a-zA-Z_][\w.]*)\s*\(([^]*)\)$/);
    if (callM) {
      const fn  = this._evalExprSync(callM[1], scope, false);
      const rawArgs = callM[2];
      const args = rawArgs.trim() ? this._splitArgs(rawArgs).map(a=>this._evalExprSync(a.trim(),scope,false)) : [];
      if (typeof fn !== 'function') throw new PyException('TypeError', `'${_pyRepr(fn,false)}' is not callable`);
      const result = fn(...args);
      if (result instanceof Promise) {
        if (allowAsync) return result; // caller will await
        return null;
      }
      return result;
    }

    // Attribute access: obj.attr
    const dotM = expr.match(/^(.+)\.(\w+)$/);
    if (dotM) {
      const obj  = this._evalExprSync(dotM[1].trim(), scope, false);
      const attr = dotM[2];
      if (obj === null) throw new PyException('AttributeError', `'NoneType' object has no attribute '${attr}'`);
      if (obj instanceof PyDict) {
        if (attr==='keys')   return ()=>obj.keys();
        if (attr==='values') return ()=>obj.values();
        if (attr==='items')  return ()=>obj.entries();
        if (attr==='get')    return (k,d=null)=>obj.get(k,d);
        if (attr==='update') return (other)=>{ (other instanceof PyDict?other.entries():Object.entries(other||{})).forEach(([k,v])=>obj.map.set(k,v)); };
        if (attr==='pop')    return (k)=>{ const v=obj.map.get(k); obj.map.delete(k); return v; };
        if (attr==='copy')   return ()=>new PyDict([...obj.map.entries()]);
        if (attr==='clear')  return ()=>obj.map.clear();
        return obj.map.get(attr);
      }
      if (typeof obj === 'string') return this._strMethod(obj, attr);
      if (Array.isArray(obj)) return this._listMethod(obj, attr);
      if (obj instanceof PySet) return this._setMethod(obj, attr);
      return obj?.[attr];
    }

    // Subscript: obj[key] or obj[a:b]
    const subM = expr.match(/^(.+)\[(.+)\]$/);
    if (subM) {
      const obj = this._evalExprSync(subM[1].trim(), scope, false);
      const keyStr = subM[2].trim();
      if (keyStr.includes(':')) {
        // Slice
        const parts = keyStr.split(':').map(p=>p.trim());
        const s = parts[0]?parseInt(parts[0]):0;
        const e = parts[1]?parseInt(parts[1]):undefined;
        const st= parts[2]?parseInt(parts[2]):1;
        if (typeof obj==='string') return e!==undefined?obj.slice(s,e):obj.slice(s);
        if (Array.isArray(obj))    return e!==undefined?obj.slice(s,e):obj.slice(s);
        return null;
      }
      const key = this._evalExprSync(keyStr, scope, false);
      if (obj instanceof PyDict) {
        if (!obj.has(key)) throw new PyException('KeyError', _pyRepr(key,true));
        return obj.get(key);
      }
      if (typeof obj==='string') { const idx=key<0?obj.length+key:key; return obj[idx]||null; }
      if (Array.isArray(obj)) { const idx=key<0?obj.length+key:key; if(idx<0||idx>=obj.length)throw new PyException('IndexError','list index out of range'); return obj[idx]; }
      return obj?.[key];
    }

    // Variable lookup
    if (/^[a-zA-Z_]\w*$/.test(expr)) {
      if (expr in scope) return scope[expr];
      if (expr in this.globals) return this.globals[expr];
      throw new PyException('NameError', `name '${expr}' is not defined`);
    }

    // Lambda
    const lambdaM = expr.match(/^lambda\s*(.*?):\s*(.+)$/);
    if (lambdaM) {
      const params = lambdaM[1].split(',').map(p=>p.trim()).filter(Boolean);
      const body   = lambdaM[2];
      const self   = this;
      const cap    = {...scope};
      return (...args) => {
        const local = {...cap};
        params.forEach((p,i)=>local[p]=args[i]);
        return self._evalExprSync(body, local, false);
      };
    }

    // Conditional expression: val if cond else val2
    const ternM = expr.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
    if (ternM) {
      const cond = this._evalExprSync(ternM[2].trim(), scope, false);
      return this._evalExprSync(this.globals.__bool__(cond)?ternM[1].trim():ternM[3].trim(), scope, false);
    }

    // List comprehension [expr for x in iter if cond]
    if (expr.startsWith('[') && expr.includes(' for ')) {
      return this._evalListComp(expr.slice(1,-1), scope);
    }

    return null;
  }

  _evalListComp(expr, scope) {
    const m = expr.match(/^(.+?)\s+for\s+(\w+)\s+in\s+(.+?)(?:\s+if\s+(.+))?$/);
    if (!m) return [];
    const items = this._toIterable(this._evalExprSync(m[3].trim(), scope, false));
    const result = [];
    for (const item of items) {
      const local = {...scope, [m[2]]:item};
      if (m[4] && !this.globals.__bool__(this._evalExprSync(m[4].trim(), local, false))) continue;
      result.push(this._evalExprSync(m[1].trim(), local, false));
    }
    return result;
  }

  // Split expression at operator, respecting parens/brackets/quotes
  _splitOp(expr, op) {
    // Find rightmost occurrence of op at depth 0 (except for ** which is right-assoc)
    let depth = 0; let inStr = null;
    const isRightAssoc = op === '**';
    let lastIdx = -1;
    for (let i=0; i<expr.length; i++) {
      const c = expr[i];
      if (inStr) { if(c===inStr&&expr[i-1]!=='\\') inStr=null; continue; }
      if (c==='"'||c==="'") { inStr=c; continue; }
      if (c==='('||c==='['||c==='{') depth++;
      else if (c===')'||c===']'||c==='}') depth--;
      if (depth===0 && expr.slice(i).startsWith(op)) {
        // Verify it's really this op (not a longer one)
        const after = expr[i+op.length];
        if (op==='+'&&expr[i+1]==='=') continue;
        if (op==='-'&&expr[i+1]==='=') continue;
        if (op==='*'&&expr[i+1]==='='&&op.length===1) continue;
        if (op==='/'&&expr[i+1]==='='&&op.length===1) continue;
        if (op==='*'&&expr[i+1]==='*'&&op.length===1) continue;
        if (op==='/'&&expr[i+1]==='/'&&op.length===1) continue;
        // Check it's at depth 0
        if (isRightAssoc) lastIdx=i;
        else { if(i>0) lastIdx=i; }
      }
    }
    if (lastIdx>0) return [expr.slice(0,lastIdx).trim(), expr.slice(lastIdx+op.length).trim()];
    return null;
  }

  // Split function arguments, respecting parens/brackets/quotes
  _splitArgs(str) {
    const args=[]; let depth=0; let inStr=null; let cur='';
    for (let i=0; i<str.length; i++) {
      const c=str[i];
      if (inStr) { cur+=c; if(c===inStr&&str[i-1]!=='\\') inStr=null; continue; }
      if (c==='"'||c==="'") { inStr=c; cur+=c; continue; }
      if (c==='('||c==='['||c==='{') { depth++; cur+=c; }
      else if (c===')'||c===']'||c==='}') { depth--; cur+=c; }
      else if (c===','&&depth===0) { args.push(cur.trim()); cur=''; }
      else cur+=c;
    }
    if (cur.trim()) args.push(cur.trim());
    return args;
  }

  // ── Métodos de string Python ──
  _strMethod(s, attr) {
    const methods = {
      upper:()=>s.toUpperCase(), lower:()=>s.toLowerCase(),
      strip:(ch)=>ch?s.replace(new RegExp(`^[${ch}]+|[${ch}]+$`,'g'),''):s.trim(),
      lstrip:(ch)=>ch?s.replace(new RegExp(`^[${ch}]+`),''):s.trimStart(),
      rstrip:(ch)=>ch?s.replace(new RegExp(`[${ch}]+$`),''):s.trimEnd(),
      split:(sep=null,n=-1)=>sep===null?s.trim().split(/\s+/).filter(Boolean):s.split(sep),
      join:(a)=>Array.isArray(a)?a.map(x=>String(x)).join(s):s,
      replace:(old,neu,cnt=-1)=>cnt>0?s.replace(old,neu):s.replaceAll(old,neu),
      find:(sub,start=0)=>s.indexOf(sub,start),
      index:(sub)=>{const i=s.indexOf(sub);if(i<0)throw new PyException('ValueError','substring not found');return i;},
      startswith:(p)=>s.startsWith(p), endswith:(p)=>s.endsWith(p),
      count:(sub)=>{let cnt=0,pos=0;while((pos=s.indexOf(sub,pos))>-1){cnt++;pos+=sub.length||1;}return cnt;},
      format:(...a)=>s.replace(/\{(\d*)\}/g,(m,n)=>n?a[parseInt(n)]:a[0]),
      zfill:(w)=>s.padStart(w,'0'),
      ljust:(w,c=' ')=>s.padEnd(w,c), rjust:(w,c=' ')=>s.padStart(w,c), center:(w,c=' ')=>s.padStart(Math.floor((w+s.length)/2),c).padEnd(w,c),
      isdigit:()=>/^\d+$/.test(s), isalpha:()=>/^[a-zA-Z]+$/.test(s),
      isalnum:()=>/^[a-zA-Z0-9]+$/.test(s), isspace:()=>/^\s+$/.test(s),
      isupper:()=>s===s.toUpperCase()&&s!==s.toLowerCase(),
      islower:()=>s===s.toLowerCase()&&s!==s.toUpperCase(),
      capitalize:()=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase(),
      title:()=>s.replace(/\w\S*/g,t=>t.charAt(0).toUpperCase()+t.substr(1).toLowerCase()),
      encode:()=>s, decode:()=>s,
      expandtabs:(ts=8)=>s.replace(/\t/g,' '.repeat(ts)),
      splitlines:()=>s.split(/\r?\n/),
    };
    return methods[attr] || (()=>`<built-in method '${attr}' of str>`);
  }

  // ── Métodos de list Python ──
  _listMethod(arr, attr) {
    return {
      append:(v)=>arr.push(v),
      extend:(v)=>arr.push(...(Array.isArray(v)?v:[...v])),
      insert:(i,v)=>arr.splice(i,0,v),
      remove:(v)=>{const i=arr.indexOf(v);if(i<0)throw new PyException('ValueError',`${_pyRepr(v,true)} is not in list`);arr.splice(i,1);},
      pop:(i=-1)=>i<0?arr.splice(arr.length+i,1)[0]:arr.splice(i,1)[0],
      index:(v,s=0)=>{const i=arr.indexOf(v,s);if(i<0)throw new PyException('ValueError',`${_pyRepr(v,true)} is not in list`);return i;},
      count:(v)=>arr.filter(x=>x===v).length,
      sort:(rev=false)=>{arr.sort((a,b)=>a>b?1:a<b?-1:0);if(rev)arr.reverse();},
      reverse:()=>arr.reverse(),
      copy:()=>[...arr], clear:()=>{arr.length=0;},
    }[attr] || arr[attr];
  }

  // ── Métodos de set Python ──
  _setMethod(s, attr) {
    return {
      add:(v)=>s.add(v), remove:(v)=>s.remove(v), discard:(v)=>s.discard(v),
      pop:()=>{const v=[...s.items][0];s.remove(v);return v;},
      union:(o)=>new PySet([...s.items,...(o.items||[])]),
      intersection:(o)=>new PySet([...s.items].filter(x=>o.has(x))),
      difference:(o)=>new PySet([...s.items].filter(x=>!o.has(x))),
      issubset:(o)=>[...s.items].every(x=>o.has(x)),
      issuperset:(o)=>[...o.items].every(x=>s.has(x)),
      copy:()=>new PySet([...s.items]), clear:()=>{s.items.clear();},
    }[attr];
  }

  // ── Llamada a método en objeto ──
  _callMethod(obj, method, args) {
    if (obj === null) throw new PyException('AttributeError',`'NoneType' has no attribute '${method}'`);
    if (typeof obj === 'string') {
      const m = this._strMethod(obj, method);
      if (typeof m === 'function') return m(...args);
      throw new PyException('AttributeError', `'str' has no attribute '${method}'`);
    }
    if (Array.isArray(obj)) {
      const m = this._listMethod(obj, method);
      if (typeof m === 'function') return m(...args);
      throw new PyException('AttributeError', `'list' has no attribute '${method}'`);
    }
    if (obj instanceof PySet) {
      const m = this._setMethod(obj, method);
      if (typeof m === 'function') return m(...args);
    }
    if (obj instanceof PyDict) {
      const methods = {
        keys:()=>obj.keys(), values:()=>obj.values(), items:()=>obj.entries().map(([k,v])=>[k,v]),
        get:(k,d=null)=>obj.get(k,d), update:(o)=>{(o instanceof PyDict?o.entries():Object.entries(o||{})).forEach(([k,v])=>obj.map.set(k,v));},
        pop:(k,d=null)=>{if(!obj.has(k)){if(d!==null)return d;throw new PyException('KeyError',_pyRepr(k,true));}const v=obj.get(k);obj.map.delete(k);return v;},
        setdefault:(k,d=null)=>{if(!obj.has(k))obj.set(k,d);return obj.get(k);},
        copy:()=>new PyDict([...obj.map.entries()]), clear:()=>obj.map.clear(),
      };
      if (methods[method]) return methods[method](...args);
    }
    if (obj && typeof obj[method] === 'function') return obj[method](...args);
    // Módulos (math, random, etc.)
    if (obj && typeof obj === 'object' && method in obj) {
      if (typeof obj[method]==='function') return obj[method](...args);
      return obj[method];
    }
    throw new PyException('AttributeError', `object has no attribute '${method}'`);
  }
}

// ── Función pública de ejecución ──
function runPython(code) {
  const out = document.getElementById('codeOutput');
  if (out) { out.innerHTML = '<span style="color:var(--txt4);opacity:.5">Ejecutando...</span>'; out.dataset.fresh='1'; }
  _pyRunInteractive(code, false);
}
function openPreguntaModal(exId) {
  _pendingExamId = exId;
  ['pPregunta','pOp0','pOp1','pOp2','pOp3'].forEach(i => { const el=document.getElementById(i); if(el) el.value=''; });
  document.getElementById('pCorrecta').value = '0'; openM('mPregunta');
}
function savePregunta() {
  const preg = document.getElementById('pPregunta').value.trim();
  if (!preg) { toast('Escribe la pregunta','err'); return; }
  const ops  = [0,1,2,3].map(i => document.getElementById('pOp'+i).value.trim());
  if (ops.some(o=>!o)) { toast('Completa todas las opciones','err'); return; }
  const cor  = parseInt(document.getElementById('pCorrecta').value);
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === _pendingExamId); if (!ex) return;
  if (!ex.preguntas) ex.preguntas = [];
  ex.preguntas.push({pregunta:preg, opciones:ops, correcta:cor});
  saveModData(CURRENT_MODULE.id, data); closeM('mPregunta'); toast('Pregunta agregada','ok'); go('ex_'+_pendingExamId);
}
function delPregunta(exId, idx) {
  if (!confirm('¿Eliminar esta pregunta?')) return;
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === exId);
  ex.preguntas.splice(idx, 1); saveModData(CURRENT_MODULE.id, data); go('ex_'+exId);
}
function iniciarExamen(exId) {
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === exId);
  if (!ex?.preguntas?.length) { toast('Agrega preguntas primero','err'); return; }
  examEnCurso = {exId, respuestas:new Array(ex.preguntas.length).fill(null), inicio:Date.now(), durSeg:ex.duracion*60};
  document.body.classList.add('exam-on');
  document.getElementById('cronometro').classList.add('show');
  startCrono(); go('ex_'+exId);
}
function renderExEnCurso(ex) {
  const ec = examEnCurso;
  const answered = ec.respuestas.filter(r=>r!==null).length;
  return `<div class="fade">
    <div class="exam-banner" style="background:linear-gradient(135deg,var(--redBg),transparent);border-color:var(--redBd)">
      <div class="exam-title" style="color:var(--redL)">🔴 EXAMEN EN CURSO</div>
      <div class="exam-desc">${esc(ex.titulo)}</div>
      <div class="exam-meta"><div class="exam-meta-item">✅ <strong>${answered}/${ex.preguntas.length}</strong> respondidas</div></div>
    </div>
    ${ex.preguntas.map((p,i)=>`<div class="preg-card">
      <div class="preg-n">Pregunta ${i+1}</div>
      <div class="preg-txt">${esc(p.pregunta)}</div>
      <div class="preg-opts">${p.opciones.map((o,j)=>`<div class="preg-opt ${ec.respuestas[i]===j?'sel':''}" onclick="selResp(${i},${j})">${esc(o)}</div>`).join('')}</div>
    </div>`).join('')}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-g" onclick="finalizarExamen()">✓ Finalizar Examen</button>
      <button class="btn btn-r" onclick="cancelarExamen()">✕ Cancelar</button>
    </div>
  </div>`;
}
function selResp(idx, opt) { examEnCurso.respuestas[idx]=opt; go('ex_'+examEnCurso.exId); }
function startCrono() {
  if (cronoInterval) clearInterval(cronoInterval);
  cronoInterval = setInterval(() => {
    const left = examEnCurso.durSeg - Math.floor((Date.now()-examEnCurso.inicio)/1000);
    if (left<=0) { finalizarExamen(); return; }
    const el = document.getElementById('cronoTxt');
    if (el) el.textContent = `${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
    document.getElementById('cronometro')?.classList.toggle('warning', left<=60);
  }, 1000);
}
function finalizarExamen() {
  if (cronoInterval) clearInterval(cronoInterval);
  document.getElementById('cronometro')?.classList.remove('show','warning');
  document.body.classList.remove('exam-on');
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === examEnCurso.exId);
  const respuestas = examEnCurso.respuestas.map((r,i) => {
    const ok = r===ex.preguntas[i].correcta;
    if (!ok && r!==null) addError(ex.preguntas[i].pregunta, ex.preguntas[i].opciones[r], ex.preguntas[i].opciones[ex.preguntas[i].correcta], `Examen: ${ex.titulo}`);
    return {pregunta:i, seleccionada:r, correcta:ok};
  });
  if (!ex.resultados) ex.resultados = [];
  ex.resultados.push({fecha:Date.now(), respuestas});
  saveModData(CURRENT_MODULE.id, data);
  const exId = examEnCurso.exId; examEnCurso=null; verResultados(exId);
}
function cancelarExamen() {
  if (!confirm('¿Cancelar el examen?')) return;
  if (cronoInterval) clearInterval(cronoInterval);
  document.getElementById('cronometro')?.classList.remove('show','warning');
  document.body.classList.remove('exam-on');
  const exId = examEnCurso.exId; examEnCurso=null; go('ex_'+exId);
}
function verResultados(exId) {
  const data = getModData(CURRENT_MODULE.id);
  const ex   = data.exams.find(x => x.id === exId);
  const res  = ex.resultados[ex.resultados.length-1];
  const ok   = res.respuestas.filter(r=>r.correcta).length;
  const tot  = res.respuestas.length;
  const pct  = Math.round(ok/tot*100);
  const aprobado = pct >= 70;
  document.getElementById('viewport').innerHTML = `<div class="fade">
    <div class="result-banner ${aprobado?'':'fail'}">
      <div class="result-score">${pct}%</div>
      <div class="result-label">${aprobado?'✓ APROBADO':'✗ REPROBADO'}</div>
      <div class="result-details"><div>Correctas: <strong>${ok}</strong></div><div>Incorrectas: <strong>${tot-ok}</strong></div><div>Total: <strong>${tot}</strong></div></div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn" onclick="go('ex_${exId}')">← Volver</button>
      ${!aprobado?`<button class="btn btn-gold" onclick="startSmartSession()">🧠 Practicar temas débiles</button>`:''}
    </div>
    ${res.respuestas.map((r,i) => {
      const p = ex.preguntas[r.pregunta];
      return `<div class="review-card ${r.correcta?'ok':'ko'}">
        <div class="review-q"><span style="color:var(--gold)">${i+1}. </span>${esc(p.pregunta)}</div>
        <div class="review-ans">
          <div class="review-label">Tu resp.:</div>
          <div class="review-val ${r.correcta?'ok':'ko'}">${r.seleccionada!==null?esc(p.opciones[r.seleccionada]):'Sin responder'}</div>
          ${!r.correcta?`<div class="review-label">Correcta:</div><div class="review-val ok">${esc(p.opciones[p.correcta])}</div>`:''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ── CRUD HELPERS ── */

/* ── MODALS / MISC ── */
document.addEventListener('click', e => { if (e.target.classList.contains('modal')) e.target.classList.remove('show'); });

/* ── SELF-SAVE (descarga el HTML con datos embebidos) ── */

/* ── KEYBOARD SHORTCUTS ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    closeSidebar();
  }
  if ((e.ctrlKey||e.metaKey) && e.key==='s') {
    e.preventDefault(); flash(); toast('✓ Guardado','ok');
    try { if (typeof syncTodoANube==='function') syncTodoANube(); } catch(e){}
  }
});


/* ═══════════════════════════════════════════════════════════════════════
   CHAT IA — Motor multi-proveedor con soporte real de browser
   
   PROVEEDORES SOPORTADOS (funcionan 100% desde browser):
   ┌─────────────────┬────────────────────────────────────────────┐
   │ openrouter      │ openrouter.ai — GRATIS con deepseek/llama  │
   │ openai          │ platform.openai.com — de pago              │
   │ groq            │ console.groq.com — GRATIS muy rápido       │
   │ gemini          │ aistudio.google.com — GRATIS               │
   └─────────────────┴────────────────────────────────────────────┘
   
   NOTA: Claude/Anthropic NO permite llamadas directas desde browser
   (CORS bloqueado). Usa OpenRouter para acceder a Claude desde browser.
═══════════════════════════════════════════════════════════════════════ */

/* ── Estado del chat (window._aiHistory es la fuente canónica, usada por ai-memory.js) ── */
if (typeof window._aiHistory === 'undefined') window._aiHistory = [];
let _aiTyping  = false;

/* ── Toggle del panel ── */
function toggleGlobalNotes() {
  const panel = document.getElementById('globalNotesPanel');
  const fab   = document.getElementById('aiFab');
  if (!panel) return;
  const isOpen = panel.classList.contains('visible');
  if (isOpen) {
    // Auto-guardar sesión al cerrar
    if (typeof memSaveSession === 'function' && typeof _aiHistory !== 'undefined' && _aiHistory.length >= 2) {
      try { memSaveSession(null, _aiHistory.map(m => ({ role: m.role, content: m.content }))); } catch(e) {}
    }
    panel.classList.remove('visible');
    if (fab) fab.style.display = '';
  } else {
    panel.classList.add('visible');
    if (fab) fab.style.display = 'none';
    _aiCheckAPIKey();
    setTimeout(function() {
      var inp = document.getElementById('aiChatInput');
      if (inp) inp.focus();
    }, 200);
    if (typeof _ctrlUpdatePath    === 'function') _ctrlUpdatePath();
    else { try { const p = document.getElementById('aiPathDisplay'); if(p && typeof CURRENT_MODULE!=='undefined' && CURRENT_MODULE) p.textContent = CURRENT_MODULE.name; } catch(e){} }
    if (typeof _memRenderChips    === 'function') _memRenderChips();
  }
}

function _aiCheckAPIKey() {
  const key  = ld('ai_api_key');
  const warn = document.getElementById('aiApiWarning');
  const stat = document.getElementById('aiStatus');
  const prov = ld('ai_provider') || 'openrouter';
  const provNames = {openrouter:'OpenRouter',openai:'OpenAI',groq:'Groq',gemini:'Gemini'};
  if (!key) {
    if (warn) warn.style.display = 'block';
    if (stat) stat.textContent = 'Sin API Key — configura ⚙️';
  } else {
    if (warn) warn.style.display = 'none';
    const model = (ld('ai_model')||'').split('/').pop() || 'IA';
    if (stat) stat.textContent = `${provNames[prov]||prov} · ${model}`;
  }
}

/* ── Abrir configuración ── */
function openAISettings() { if(typeof caiOpenSettings==='function'){caiOpenSettings();return;}
  const key  = ld('ai_api_key')  || '';
  const prov = ld('ai_provider') || 'openrouter';
  const mdl  = ld('ai_model')    || 'qwen/qwen3.6-plus:free';
  const el   = document.getElementById('aiApiKeyInput');
  const ps   = document.getElementById('aiProviderSelect');
  if (el) el.value = key;
  if (ps) { ps.value = prov; _aiUpdateProviderUI(prov, mdl); }
  openM('mAISettings');
}

function _aiUpdateProviderUI(prov, currentModel) {
  const ms = document.getElementById('aiModelSelect');
  if (!ms) return;

  const models = {
        openrouter: [
      {v:'qwen/qwen3.6-plus:free',               l:'Qwen 3.6 Plus 🆓 ⭐ (recomendado)'},
      {v:'openrouter/auto',                       l:'Auto 🆓 (mejor modelo disponible)'},
      {v:'meta-llama/llama-3.3-70b-instruct:free',l:'Llama 3.3 70B 🆓 (gratis)'},
      {v:'mistralai/mistral-small-3.1-24b-instruct:free', l:'Mistral Small 3.1 🆓 (gratis)'},
      {v:'google/gemma-3-27b-it:free',            l:'Gemma 3 27B 🆓 (gratis)'},
      {v:'openai/gpt-4o-mini',                    l:'GPT-4o-mini (créditos OR)'},
      {v:'anthropic/claude-3-haiku',              l:'Claude 3 Haiku (créditos OR)'},
      {v:'anthropic/claude-3.5-sonnet',           l:'Claude 3.5 Sonnet (créditos OR)'},
    ],
    openai: [
      {v:'gpt-4o-mini',    l:'GPT-4o-mini (rápido, económico)'},
      {v:'gpt-4o',         l:'GPT-4o (potente)'},
      {v:'gpt-3.5-turbo',  l:'GPT-3.5-turbo (muy económico)'},
    ],
    groq: [
      {v:'llama-3.1-70b-versatile', l:'Llama 3.1 70B 🆓 (gratis, rápido)'},
      {v:'llama-3.1-8b-instant',    l:'Llama 3.1 8B 🆓 (gratis, muy rápido)'},
      {v:'mixtral-8x7b-32768',      l:'Mixtral 8x7B 🆓 (gratis)'},
      {v:'gemma2-9b-it',            l:'Gemma 2 9B 🆓 (gratis)'},
      {v:'deepseek-r1-distill-llama-70b', l:'DeepSeek R1 70B 🆓 (gratis)'},
    ],
    gemini: [
      {v:'gemini-1.5-flash',        l:'Gemini 1.5 Flash 🆓 (gratis, rápido)'},
      {v:'gemini-1.5-flash-8b',     l:'Gemini 1.5 Flash 8B 🆓 (gratis)'},
      {v:'gemini-1.5-pro',          l:'Gemini 1.5 Pro 🆓 (límite bajo)'},
    ],
  };

  const list = models[prov] || models.openrouter;
  ms.innerHTML = list.map(m =>
    `<option value="${m.v}" ${m.v===currentModel?'selected':''}>${m.l}</option>`
  ).join('');
  // Actualizar hint de la API Key
  const hints = {
    openrouter: '→ openrouter.ai/keys  (gratis, sin tarjeta)',
    openai:     '→ platform.openai.com/api-keys',
    groq:       '→ console.groq.com/keys  (gratis)',
    gemini:     '→ aistudio.google.com/app/apikey  (gratis)',
  };
  const hint = document.getElementById('aiKeyHint');
  if (hint) hint.textContent = hints[prov] || '';
}

function saveAISettings() {
  const key  = document.getElementById('aiApiKeyInput')?.value.trim() || '';
  const prov = document.getElementById('aiProviderSelect')?.value || 'openrouter';
  const mdl  = document.getElementById('aiModelSelect')?.value || 'qwen/qwen3.6-plus:free';
  if (key) {
    guardarLocal('ai_api_key',  key);
    guardarLocal('ai_provider', prov);
    guardarLocal('ai_model',    'codice'); guardarLocal('ai_provider','openrouter');
    toast('✓ IA configurada correctamente', 'ok');
  } else {
    localStorage.removeItem('ai_api_key');
    toast('API Key eliminada', 'ok');
  }
  closeM('mAISettings');
  _aiCheckAPIKey();
}

/* ══════════════════════════════════════════════════════════════
   ENVÍO DE MENSAJES
══════════════════════════════════════════════════════════════ */
/* sendAIMessage — unified: delegates to CAI engine (_cai_send) */
async function sendAIMessage() {
  if (typeof _cai_send === 'function') {
    return _cai_send();
  }
  /* Legacy fallback if CAI not loaded yet */
  const input = document.getElementById('aiChatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text || _aiTyping) return;
  input.value = ''; input.style.height = 'auto';
  const apiKey = ld('ai_api_key');
  if (!apiKey) {
    _aiAddMessage('user', text);
    _aiAddMessage('bot', '🔑 **Configura tu API Key en ⚙️** para usar la IA.');
    openAISettings(); return;
  }
  _aiAddMessage('user', text);
  _aiTyping = true;
  const typingId = 'typing_' + Date.now();
  _aiAddTyping(typingId);
  try {
    const response = await _aiCall(text);
    document.getElementById(typingId)?.remove();
    _aiAddMessage('bot', response);
  } catch(e) {
    document.getElementById(typingId)?.remove();
    _aiAddMessage('bot', _aiParseError(e));
  } finally { _aiTyping = false; }
}

/* ── Parsear errores de API de forma útil ── */
function _aiParseError(e) {
  const msg = e?.message || String(e);
  const prov = ld('ai_provider') || 'openrouter';

  // CORS error
  if (msg.includes('CORS') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    const fixes = {
      claude:  '⛔ **Anthropic Claude** bloquea llamadas desde el browser (CORS).\n\n✅ **Solución:** Cambia a **OpenRouter** en ⚙️ y selecciona *Claude 3 Haiku* — accede a Claude sin CORS.',
      openai:  '❌ Error de red con OpenAI. Verifica tu API Key y que tengas créditos.\n\nTambién puedes usar **OpenRouter** ⚙️ con modelos gratuitos.',
      groq:    '❌ Error de red con Groq. Verifica tu API Key en console.groq.com/keys',
      gemini:  '❌ Error de red con Gemini. Verifica tu API Key en aistudio.google.com',
      openrouter: '❌ Error de red con OpenRouter. Verifica tu API Key en openrouter.ai/keys',
    };
    return fixes[prov] || '❌ Error de conexión. Verifica tu API Key en ⚙️.';
  }

  // HTTP errors
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid_api_key')) {
    return `🔑 **API Key inválida.**\n\nVerifica que copiaste la key completa en ⚙️.\n\nTu key de ${prov} debe empezar con:\n${
      {openrouter:'sk-or-',openai:'sk-',groq:'gsk_',gemini:'AIza'}[prov]||'sk-'
    }...`;
  }
  if (msg.includes('402') || msg.includes('insufficient')) {
    return '💳 **Sin créditos.** Tu cuenta no tiene saldo suficiente.\n\n✅ Usa modelos gratuitos 🆓 en **OpenRouter** o **Groq** — cambia en ⚙️.';
  }
  if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('Rate limit')) {
    return '⏳ **Límite de velocidad alcanzado.** Espera un momento e intenta de nuevo.\n\nSi esto pasa seguido, usa **Groq** ⚙️ que tiene límites más generosos.';
  }
  if (msg.includes('403') || msg.includes('Forbidden')) {
    return `🚫 **Acceso denegado** (403). Verifica que tu cuenta en ${prov} esté activa y la key sea correcta.`;
  }
  if (msg.includes('503') || msg.includes('overloaded')) {
    return '🔄 **Servicio temporalmente saturado.** Intenta de nuevo en 30 segundos o cambia de modelo en ⚙️.';
  }

  return `❌ **Error:** ${msg}\n\nVerifica tu configuración en ⚙️.`;
}

/* ══════════════════════════════════════════════════════════════
   LLAMADAS A LA API
══════════════════════════════════════════════════════════════ */
async function _aiCall(userText) {
  const key      = ld('ai_api_key')  || '';
  const model    = ld('ai_model')    || 'qwen/qwen3.6-plus:free';
  const provider = ld('ai_provider') || 'openrouter';
  const context  = _aiGetContext();
  const sysprompt= _aiSystemPrompt(context);

  // Historial limpio (solo role+content)
  const history = _aiHistory.slice(-14).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }));

  switch(provider) {
    case 'openrouter': return _callOpenRouter(key, model, sysprompt, history, userText);
    case 'openai':     return _callOpenAI(key, model, sysprompt, history, userText);
    case 'groq':       return _callGroq(key, model, sysprompt, history, userText);
    case 'gemini':     return _callGemini(key, model, sysprompt, history, userText);
    default:           return _callOpenRouter(key, model, sysprompt, history, userText);
  }
}

/* ── OpenRouter (recomendado — funciona 100% desde browser) ── */
async function _callOpenRouter(key, model, sysprompt, history, userText) {
  const messages = [
    { role:'system', content: sysprompt },
    ...history,
    { role:'user', content: userText }
  ];
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + key,
      'HTTP-Referer':  'https://codice.app',
      'X-Title':       'Códice Learning OS',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens:  2500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Sin respuesta del modelo.';
}

/* ── OpenAI (funciona desde browser) ── */
async function _callOpenAI(key, model, sysprompt, history, userText) {
  const messages = [
    { role:'system', content: sysprompt },
    ...history,
    { role:'user', content: userText }
  ];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({ model, messages, max_tokens:1500, temperature:0.7 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Sin respuesta.';
}

/* ── Groq (funciona desde browser, muy rápido) ── */
async function _callGroq(key, model, sysprompt, history, userText) {
  const messages = [
    { role:'system', content: sysprompt },
    ...history,
    { role:'user', content: userText }
  ];
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({ model, messages, max_tokens:1500, temperature:0.7 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Sin respuesta.';
}

/* ── Gemini (funciona desde browser) ── */
async function _callGemini(key, model, sysprompt, history, userText) {
  // Gemini usa formato diferente: no soporta role:system directamente
  // Lo metemos como primer turno de usuario
  const contents = [
    { role:'user',  parts:[{text: sysprompt + '\n\n---\nRespóndeme en español.'}] },
    { role:'model', parts:[{text: 'Entendido. Soy tu asistente en Códice.'}] },
    ...history.map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role:'user', parts:[{text: userText}] },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens:1500, temperature:0.7 },
      safetySettings: [
        {category:'HARM_CATEGORY_HARASSMENT',      threshold:'BLOCK_NONE'},
        {category:'HARM_CATEGORY_HATE_SPEECH',     threshold:'BLOCK_NONE'},
        {category:'HARM_CATEGORY_SEXUALLY_EXPLICIT',threshold:'BLOCK_NONE'},
        {category:'HARM_CATEGORY_DANGEROUS_CONTENT',threshold:'BLOCK_NONE'},
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Sin respuesta.';
}

/* ══════════════════════════════════════════════════════════════
   CONTEXTO Y SYSTEM PROMPT
══════════════════════════════════════════════════════════════ */
function _aiGetContext() {
  if (!CURRENT_MODULE) return {};
  const data  = getModData(CURRENT_MODULE.id);
  const mods  = getModules();
  const books = ld('codice_books_' + CURRENT_MODULE.id) || [];

  // Clases con contenido resumido
  const classesSummary = data.classes.map(c => {
    const bloques = (c.bloques||[]).map(b =>
      b.titulo + ': ' + ((b.contenido||'').replace(/<[^>]*>/g,'').slice(0, 300))
    ).join(' | ');
    const weeks = (c.weeks||[]).flatMap(w =>
      (w.bloques||[]).map(b => b.titulo + ': ' + ((b.contenido||'').replace(/<[^>]*>/g,'').slice(0,200)))
    ).join(' | ');
    return { nombre:c.nombre, bloques:bloques + (weeks?'\n'+weeks:'') };
  });

  // Libros (texto completo para contexto IA)
  const booksSummary = books.map(b => ({
    name: b.name,
    text: (b.text||'').slice(0, 3000), // hasta 3000 chars por libro
  }));

  return {
    moduleName:  CURRENT_MODULE.name,
    moduleType:  CURRENT_MODULE.type,
    allModules:  mods.map(m => m.name),
    classes:     classesSummary,
    exams:       data.exams.map(e => e.titulo),
    errorsCount: (data.errors||[]).length,
    sessions:    (data.sessions||[]).length,
    topErrors:   (data.errors||[]).slice(-5).map(e => e.question || ''),
    books:       booksSummary,
  };
}

function _aiSystemPrompt(ctx) {
  const classesText = (ctx.classes||[]).length > 0
    ? '\n\nCLASES DEL MÓDULO:\n' + ctx.classes.map(c =>
        `• "${c.nombre}":\n  ${c.bloques||'(sin contenido)'}`
      ).join('\n')
    : '';

  const booksText = (ctx.books||[]).length > 0
    ? '\n\nBIBLIOTECA (archivos subidos por el usuario):\n' +
      ctx.books.map(b => `--- Archivo: "${b.name}" ---\n${b.text}`).join('\n\n')
    : '';

  const errorsText = (ctx.topErrors||[]).length > 0
    ? '\nErrores recientes: ' + ctx.topErrors.join(', ')
    : '';

  const memorySummary = (typeof memBuildContextSummary === 'function') ? memBuildContextSummary() : '';

  return `Eres CÓDICE-IA, el asistente inteligente integrado en Códice (sistema de aprendizaje adaptativo). Tienes MEMORIA de conversaciones pasadas.

MÓDULO ACTIVO: "${ctx.moduleName||'Ninguno'}" (${ctx.moduleType||''})
Todos los módulos del usuario: ${(ctx.allModules||[]).join(', ')||'ninguno'}
Exámenes: ${(ctx.exams||[]).join(', ')||'ninguno'}
Sesiones de estudio: ${ctx.sessions||0} | Errores registrados: ${ctx.errorsCount||0}${errorsText}${classesText}${booksText}${memorySummary}

INSTRUCCIONES:
1. Responde SIEMPRE en español, con Markdown (negritas, listas, código).
2. Usa el contenido de las clases y archivos de arriba para respuestas precisas.
3. Si el usuario pide un quiz, usa formato JSON: {"pregunta":"...","opciones":["A","B","C","D"],"correcta":0,"explicacion":"..."}.
4. Si pide crear contenido (clases, exámenes), genera estructura detallada y completa.
5. Analiza el progreso real del usuario cuando sea relevante.
6. Sé completo. NUNCA truncues información que el usuario te proporciona directamente.`;
}

/* ══════════════════════════════════════════════════════════════
   UI DEL CHAT
══════════════════════════════════════════════════════════════ */




/* ══════════════════════════════════════════════════════════════
   QUIZ CON IA
══════════════════════════════════════════════════════════════ */
let _aiQuizCtx = null;




/* ══════════════════════════════════════════════════════════════
   BIBLIOTECA DE ARCHIVOS
   Usa PDF.js CDN para leer PDFs de verdad
══════════════════════════════════════════════════════════════ */


/* ── BIBLIOTECA / LIBROS ── */
function renderLibros() {
  const modId = CURRENT_MODULE.id;
  const books = ld('codice_books_'+modId) || [];
  return `<div class="fade">
    <div class="sh-row">
      <div class="sh">
        <div class="sh-icon sh-icon-v">📖</div>
        <div>
          <div class="sh-title">Biblioteca</div>
          <div class="sh-meta">${books.length} archivo${books.length!==1?'s':''} · La IA los lee en cada conversación</div>
        </div>
      </div>
      <label class="btn btn-gold" style="cursor:pointer">
        📎 Subir archivo
        <input type="file" id="bookFileInput" multiple
          accept=".txt,.md,.pdf,.html,.htm,.py,.js,.ts,.css,.json,.csv,.xml,.yaml,.yml,.java,.cpp,.c,.cs,.rs,.go,.rb,.php,.sql"
          style="display:none" onchange="uploadBooks(this)">
      </label>
    </div>

    ${books.length===0
      ? `<div class="empty">
          <div class="empty-icon">📚</div>
          <h3>Sin archivos aún</h3>
          <p>Sube documentos de texto, PDFs, código, etc.<br>La IA los leerá y podrá responder preguntas sobre su contenido.</p>
          <label class="btn btn-gold" style="cursor:pointer;margin-top:16px">
            📎 Subir primer archivo
            <input type="file" multiple accept=".txt,.md,.pdf,.html,.py,.js,.json,.csv"
              style="display:none" onchange="uploadBooks(this)">
          </label>
        </div>`
      : `<div style="display:flex;flex-direction:column;gap:10px">
          ${books.map(b => `
            <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px 18px">
              <div style="font-size:28px;flex-shrink:0">${_bookIcon(b.name)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.name)}</div>
                <div style="font-size:11px;color:var(--txt3);margin-top:2px">
                  ${_humanBytes(b.size||0)} · ${new Date(b.uploaded||Date.now()).toLocaleDateString('es-MX')} · ${(b.text||'').length.toLocaleString()} caracteres leídos
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn btn-sm btn-gold" onclick="askAboutBook('${esc(b.name).replace(/'/g,"\\'")}')">🤖 Preguntar</button>
                <button class="btn btn-sm btn-r" onclick="deleteBook('${esc(b.name).replace(/'/g,"\\'")}')">🗑️</button>
              </div>
            </div>`).join('')}
        </div>`}

    <div style="margin-top:20px;background:var(--card2);border:1px solid var(--brd);border-radius:var(--rs);padding:14px;font-size:12px;color:var(--txt3);line-height:1.8">
      <strong style="color:var(--txt)">📄 Formatos soportados:</strong><br>
      Texto: .txt .md .csv .json .xml .yaml .html .py .js .ts .java .cpp .c .cs .rs .go .sql<br>
      <strong style="color:var(--txt)">📕 PDF:</strong> se extrae el texto automáticamente con PDF.js
    </div>
  </div>`;
}

function _bookIcon(name) {
  const ext = (name||'').split('.').pop().toLowerCase();
  return {pdf:'📄',py:'🐍',js:'⚡',ts:'⚡',html:'🌐',htm:'🌐',css:'🎨',
          json:'📋',csv:'📊',md:'📝',txt:'📝',xml:'📋',yaml:'📋',yml:'📋',
          java:'☕',cpp:'⚙️',c:'⚙️',cs:'⚙️',rs:'🦀',go:'🐹',rb:'💎',php:'🐘',sql:'🗄️'}[ext] || '📁';
}

function _humanBytes(b) {
  if (b < 1024)        return b + 'B';
  if (b < 1024*1024)   return (b/1024).toFixed(1) + 'KB';
  return (b/1024/1024).toFixed(1) + 'MB';
}

async function uploadBooks(input) {
  const files = [...(input.files||[])];
  if (!files.length) return;
  const modId = CURRENT_MODULE.id;
  const books = ld('codice_books_'+modId) || [];
  let added = 0, errors = [];

  for (const file of files) {
    try {
      toast(`📖 Leyendo ${file.name}...`, '');
      const text = await _readFileText(file);
      const existing = books.findIndex(b => b.name===file.name);
      const book = {
        name:     file.name,
        size:     file.size,
        text:     text.slice(0, 80000), // hasta 80KB por archivo
        uploaded: Date.now(),
      };
      if (existing > -1) books[existing] = book;
      else books.push(book);
      added++;
    } catch(e) {
      errors.push(file.name + ': ' + e.message);
    }
  }

  guardarLocal('codice_books_'+modId, books);
  if (added)  toast(`✓ ${added} archivo${added!==1?'s':''} subido${added!==1?'s':''}`, 'ok');
  if (errors.length) toast('Error: ' + errors.join('; '), 'err');
  go('libros');
}

async function _readFileText(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    return await _readPDFWithPDFjs(file);
  }

  // Archivos de texto (todos los demás)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

/* ── Leer PDF con PDF.js (CDN) ── */
async function _readPDFWithPDFjs(file) {
  // Cargar PDF.js si no está cargado
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf         = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages       = [];

  for (let p = 1; p <= Math.min(pdf.numPages, 100); p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text    = content.items.map(item => item.str).join(' ');
    if (text.trim()) pages.push(`[Página ${p}]\n${text}`);
  }

  if (!pages.length) {
    // Fallback: extracción básica de bytes
    return await _readPDFFallback(file);
  }
  return pages.join('\n\n');
}

/* ── Fallback PDF por bytes (si PDF.js falla) ── */
async function _readPDFFallback(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const arr  = new Uint8Array(e.target.result);
      let   text = '';
      for (let i=0; i<arr.length-1; i++) {
        if (arr[i]===40) { // '('
          let j=i+1, s='';
          while(j<arr.length && arr[j]!==41) {
            if(arr[j]>31&&arr[j]<127) s+=String.fromCharCode(arr[j]);
            j++;
          }
          if(s.length>2&&/[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]/.test(s)) text+=s+' ';
          i=j;
        }
      }
      resolve(text.trim() || '[PDF sin texto extraíble — el archivo puede estar escaneado como imagen]');
    };
    reader.readAsArrayBuffer(file);
  });
}

function deleteBook(name) {
  if (!confirm(`¿Eliminar "${name}" de la biblioteca?`)) return;
  const modId = CURRENT_MODULE.id;
  const books = (ld('codice_books_'+modId)||[]).filter(b => b.name!==name);
  guardarLocal('codice_books_'+modId, books);
  toast('Archivo eliminado','ok');
  go('libros');
}

function askAboutBook(name) {
  const books = ld('codice_books_'+CURRENT_MODULE.id)||[];
  const book  = books.find(b => b.name===name);
  if (!book) return;
  // Abrir chat y precargar pregunta
  const panel = document.getElementById('globalNotesPanel');
  if (!panel?.classList.contains('visible')) toggleGlobalNotes();
  setTimeout(() => {
    const input = document.getElementById('aiChatInput');
    if (input) {
      input.value = `Analiza el archivo "${name}" y dame un resumen de los puntos más importantes.`;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      input.focus();
    }
  }, 350);
}

/* Boot logic is handled by index.html DOMContentLoaded — only Firebase here */
window.addEventListener('load', () => {
  try { if (typeof bootFirebase==='function') bootFirebase().catch(e=>console.warn('Firebase boot error:',e)); } catch(e){}
});
