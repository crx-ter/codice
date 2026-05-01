/* ═══════════════════════════════════
   CÓDICE — clases.js
   Responsabilidad: Render de vistas de clase (modo single y modo multiple),
                    editor de bloques, gestión de semanas, divisiones y sus clases.
   Depende de: storage.js, modules.js, router.js, dashboard.js
   Expone: renderClase, renderDivision, renderBloqueHTML, renderDivBloqueHTML,
           editBloque, saveEdit, addBloque, delBloque, toggleBlq, toggleWeekBlock,
           addClassToDivision, saveDivClassModal, openDivClass, editDivBloque, saveDivEdit,
           openDivSchedule, _saveDivHorario, addHorarioRow, removeHorarioRow,
           insertMath, insertImgUrl, insertTable, insertHr, insertDiagram, insertCodeBlock, fmt
═══════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   CLASE VIEW (with Weeks)
═══════════════════════════════════════════════════════════════ */
function renderClase(id) {
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === id);
  if (!c) return `<div class="empty"><div class="empty-icon">❓</div><h3>Clase no encontrada</h3></div>`;
  if (!c.bloques) c.bloques = [];
  if (!c.weeks)   c.weeks   = [];
  const totalBloques = c.bloques.length + (c.weeks||[]).reduce((s,w)=>s+(w.bloques||[]).length,0);
  const totalQuiz    = c.bloques.filter(b=>b.quiz).length + (c.weeks||[]).reduce((s,w)=>s+(w.bloques||[]).filter(b=>b.quiz).length,0);
  const mastery = getMastery(c, data);
  const ml      = getMasteryLabel(mastery);

  return `<div class="fade">
    <div class="clase-head" style="display:flex;align-items:flex-start;gap:14px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <div style="width:14px;height:14px;border-radius:4px;background:${c.color};flex-shrink:0;margin-top:4px"></div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fd);font-size:28px;font-weight:700;color:var(--txt)">${esc(c.nombre)}</div>
        <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12px;color:var(--txt3)">📦 <strong>${totalBloques}</strong> bloques · 🎯 <strong>${totalQuiz}</strong> quizzes</span>
          <span class="mastery-badge ${ml.cls}">${ml.label} ${mastery>0?mastery+'%':''}</span>
          ${c.difficulty?`<span class="tag tag-${c.difficulty==='hard'?'r':c.difficulty==='medium'?'gold':'g'}">${c.difficulty==='hard'?'Difícil':c.difficulty==='medium'?'Media':'Fácil'}</span>`:''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn" onclick="go('home')">← Volver</button>
        <button class="btn btn-gold" onclick="addBloque('${id}')">+ Bloque</button>
        <button class="btn btn-b" onclick="addWeekModal('${id}')">+ Semana</button>
      </div>
    </div>
    ${c.bloques.length>0 ? `<div style="margin-bottom:20px">${c.bloques.map(b=>renderBloqueHTML(b,id,null)).join('')}</div>` : ''}
    ${c.weeks.map(w => `<div class="week-block ${true?'open':''}" id="wb_${w.id}">
      <div class="week-block-header" onclick="toggleWeekBlock('${w.id}')">
        <div class="week-block-title">📅 ${esc(w.title||'Semana')}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="event.stopPropagation();addBloqueWeek('${id}','${w.id}')">+ Bloque</button>
          <button class="btn btn-sm" onclick="event.stopPropagation();openRenWeek('${id}','${w.id}')">✏️</button>
          <button class="btn btn-sm btn-r" onclick="event.stopPropagation();delWeek('${id}','${w.id}')">🗑️</button>
        </div>
      </div>
      <div class="week-block-body">
        ${w.bloques&&w.bloques.length>0 ? w.bloques.map(b=>renderBloqueHTML(b,id,w.id)).join('') : '<p style="color:var(--txt4);font-size:13px;padding:8px 0">Sin bloques en esta semana</p>'}
      </div>
    </div>`).join('')}
    ${totalBloques===0 ? `<div class="empty"><div class="empty-icon">📄</div><h3>Sin bloques</h3><p>Agrega bloques de contenido para organizar tus apuntes</p></div>` : ''}
  </div>`;
}
function renderBloqueHTML(b, cid, wid) {
  const wParam = wid ? `,'${wid}'` : '';
  return `<div class="bloque open" id="blq_${b.id}">
    <div class="bloque-head" onclick="toggleBlq('${b.id}')">
      <div class="bloque-title">${esc(b.titulo)}</div><div class="bloque-collapse">▼</div>
    </div>
    <div class="bloque-body">
      <div class="bloque-content" id="cnt_${b.id}">${b.contenido||'<p style="color:var(--txt3)">Sin contenido. Haz clic en Editar.</p>'}</div>
      ${b.quiz ? renderQuizWidget(b.quiz, b.id, cid, wid||null) : ''}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-b" onclick="editBloque('${cid}','${b.id}'${wParam})">✏️ Editar</button>
        <button class="btn" onclick="editBTitle('${cid}','${b.id}'${wParam})">🏷️ Título</button>
        ${!b.quiz
          ? `<button class=\"btn btn-gold\" onclick=\"openAIQuizModal('${cid}','${b.id}'${wParam})\">🤖 Generar Quiz IA</button>
             <button class=\"btn\" onclick=\"openQuizModal('${cid}','${b.id}'${wParam})\" style=\"font-size:11px\">📋 Quiz JSON</button>`
          : `<button class=\"btn btn-b\" onclick=\"launchBlockQuiz('${cid}','${b.id}'${wid?`,'${wid}'`:''})\">🚀 Lanzar Quiz</button>
             <button class=\"btn\" onclick=\"openQuizModal('${cid}','${b.id}'${wParam})\" style=\"font-size:11px\">✏️ Editar</button>
             <button class=\"btn\" onclick=\"delQuiz('${cid}','${b.id}'${wParam})\" style=\"font-size:11px\">🗑️</button>
             <button class=\"btn btn-gold\" onclick=\"openAIQuizModal('${cid}','${b.id}'${wParam})\">🤖 IA</button>`}
        <button class="btn btn-r" onclick="delBloque('${cid}','${b.id}'${wParam})">🗑️</button>
      </div>
    </div>
  </div>`;
}
function toggleBlq(bid)       { const el=document.getElementById('blq_'+bid); if(el) el.classList.toggle('open'); }
function toggleWeekBlock(wid) { const el=document.getElementById('wb_'+wid);  if(el) el.classList.toggle('open'); }

function renderQuizWidget(q, bid, cid, wid) {
  const wParam = wid ? `,'${wid}'` : '';
  return `<div class="quiz-widget" id="qz_${bid}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
      <div class="quiz-q" style="margin-bottom:0">❓ ${esc(q.pregunta)}</div>
      <button class="btn btn-sm" onclick="resetQuiz('${bid}')" style="font-size:10px;flex-shrink:0;padding:3px 8px">↺</button>
    </div>
    <div class="quiz-opts" id="qopts_${bid}">${q.opciones.map((o,i)=>`<div class="quiz-opt" id="qo_${bid}_${i}" onclick="checkQuiz('${bid}','${cid}',${i},${q.correcta})">
      <span class="quiz-opt-letter">${['A','B','C','D'][i]}</span> ${esc(o)}</div>`).join('')}</div>
    <div id="qfb_${bid}"></div>
  </div>`;
}
function resetQuiz(bid) {
  const opts = document.querySelectorAll(`#qopts_${bid} .quiz-opt`);
  opts.forEach(o => { o.classList.remove('ok','ko'); o.style.pointerEvents=''; });
  const fb = document.getElementById('qfb_'+bid); if(fb) fb.innerHTML='';
}
function delQuiz(cid, bid, wid) {
  const data = getModData(CURRENT_MODULE.id);
  const c = data.classes.find(x=>x.id===cid); if(!c) return;
  let b;
  if(wid){const w=c.weeks?.find(x=>x.id===wid);b=w?.bloques?.find(x=>x.id===bid);}
  else{b=c.bloques?.find(x=>x.id===bid);}
  if(b){b.quiz=null;saveModData(CURRENT_MODULE.id,data);go('cl_'+cid);toast('Quiz eliminado','ok');}
}
function checkQuiz(bid, cid, sel, cor) {
  const ok = sel===cor;
  const fb = document.getElementById('qfb_'+bid); if(!fb) return;
  const corrText = document.getElementById('qo_'+bid+'_'+cor)?.textContent||'';
  fb.innerHTML = ok
    ? '<div class="quiz-fb ok">✓ ¡Correcto!</div>'
    : `<div class="quiz-fb ko">✗ Incorrecto. Correcta: ${esc(corrText)}</div>`;
  document.getElementById('qo_'+bid+'_'+sel)?.classList.add(ok?'ok':'ko');
  if (!ok) {
    document.getElementById('qo_'+bid+'_'+cor)?.classList.add('ok');
    const data=getModData(CURRENT_MODULE.id);
    const c=data.classes.find(x=>x.id===cid);
    const b=c?.bloques?.find(x=>x.id===bid)||c?.weeks?.flatMap(w=>w.bloques||[]).find(x=>x.id===bid);
    if (b?.quiz) addError(b.quiz.pregunta, b.quiz.opciones[sel], b.quiz.opciones[cor], `Clase: ${c.nombre}`);
  }
  document.querySelectorAll('#qz_'+bid+' .quiz-opt').forEach(o=>o.style.pointerEvents='none');
}

/* ── WEEK MANAGEMENT ── */
let _weekCidPending = null;
function addWeekModal(cid) {
  _weekCidPending = cid;
  const data = getModData(CURRENT_MODULE.id);
  document.getElementById('weekTitle').value = 'Semana ' + ((data.classes.find(c=>c.id===cid)?.weeks?.length||0)+1);
  openM('mWeek');
}
function saveWeek() {
  const t = document.getElementById('weekTitle').value.trim();
  if (!t) { toast('Escribe un título','err'); return; }
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === _weekCidPending); if (!c) return;
  if (!c.weeks) c.weeks = [];
  c.weeks.push({id:uid(), title:t, bloques:[], created:Date.now()});
  saveModData(CURRENT_MODULE.id, data); closeM('mWeek');
  toast('Semana creada','ok'); go('cl_'+_weekCidPending);
}
function delWeek(cid, wid) {
  if (!confirm('¿Eliminar esta semana y todos sus bloques?')) return;
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  c.weeks = (c.weeks||[]).filter(w => w.id !== wid);
  saveModData(CURRENT_MODULE.id, data); go('cl_'+cid); toast('Semana eliminada','ok');
}

/* ── BLOQUE MANAGEMENT ── */
let _bloquePendingCid = null, _bloquePendingWid = null;
let _renWeekCid = null, _renWeekWid = null;
let _divClassPendingDid = null;
let _divBlockDid = null, _divBlockCid = null;

function addBloque(cid) {
  if (!CURRENT_MODULE) { toast('Error: módulo no cargado','err'); return; }
  _bloquePendingCid = cid; _bloquePendingWid = null;
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  document.getElementById('mBloqueTitle').value = 'Bloque ' + (((c?.bloques||[]).length)+1);
  openM('mBloque');
}
function addBloqueWeek(cid, wid) {
  _bloquePendingCid = cid; _bloquePendingWid = wid;
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  const w    = c?.weeks?.find(x => x.id === wid);
  document.getElementById('mBloqueTitle').value = 'Bloque ' + ((w?.bloques?.length||0)+1);
  openM('mBloque');
}
function saveBloqueModal() {
  if (!CURRENT_MODULE) { toast('Error: módulo no cargado. Recarga la página.','err'); return; }
  const t = document.getElementById('mBloqueTitle').value.trim();
  if (!t) { toast('Escribe un título','err'); return; }
  const ctx = document.getElementById('mBloque').dataset.ctx || '';

  // Division class context
  if ((ctx==='div' || _bloquePendingCid==='__div__') && _divBlockDid) {
    const data = getModData(CURRENT_MODULE.id);
    const d    = data.divisions.find(x => x.id === _divBlockDid);
    const c    = d?.classes?.find(x => x.id === _divBlockCid);
    if (!c) { toast('Clase no encontrada en la división','err'); return; }
    if (!c.bloques) c.bloques = [];
    c.bloques.push({id:uid(), titulo:t, contenido:'<p>Escribe el contenido aquí.</p>', quiz:null});
    saveModData(CURRENT_MODULE.id, data);
    const returnDid = _divBlockDid;
    closeM('mBloque');
    document.getElementById('mBloque').dataset.ctx = '';
    _bloquePendingCid = null; _divBlockDid = null; _divBlockCid = null;
    toast('Bloque agregado','ok'); go('div_'+returnDid); return;
  }

  // Normal class context
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === _bloquePendingCid); if (!c) return;
  const newB = {id:uid(), titulo:t, contenido:'<p>Escribe el contenido aquí. Soporta HTML y fórmulas $LaTeX$.</p>', quiz:null};
  if (_bloquePendingWid) {
    const w = c.weeks?.find(x => x.id === _bloquePendingWid);
    if (!w) return; if (!w.bloques) w.bloques = []; w.bloques.push(newB);
  } else {
    if (!c.bloques) c.bloques = []; c.bloques.push(newB);
  }
  saveModData(CURRENT_MODULE.id, data);
  closeM('mBloque'); document.getElementById('mBloque').dataset.ctx = '';
  toast('Bloque creado','ok'); go('cl_'+_bloquePendingCid);
}
function delBloque(cid, bid, wid) {
  if (!CURRENT_MODULE) { toast('Error: módulo no cargado','err'); return; }
  if (!confirm('¿Eliminar este bloque y su contenido?')) return;
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  if (wid) { const w=c?.weeks?.find(x=>x.id===wid); if(w) w.bloques=(w.bloques||[]).filter(b=>b.id!==bid); }
  else      { c.bloques=(c.bloques||[]).filter(b=>b.id!==bid); }
  saveModData(CURRENT_MODULE.id, data); go('cl_'+cid); toast('Bloque eliminado','ok');
}
function editBTitle(cid, bid, wid) {
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  const b    = wid ? c?.weeks?.find(w=>w.id===wid)?.bloques?.find(x=>x.id===bid) : c?.bloques?.find(x=>x.id===bid);
  if (!b) return;
  const t = prompt('Nuevo título:', b.titulo); if (!t||!t.trim()) return;
  b.titulo = t.trim(); saveModData(CURRENT_MODULE.id, data);
  go('cl_'+cid); toast('Título actualizado','ok');
}
function openRenWeek(cid, wid) {
  _renWeekCid = cid; _renWeekWid = wid;
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  const w    = c?.weeks?.find(x => x.id === wid);
  document.getElementById('renWeekTitle').value = w?.title || '';
  openM('mRenWeek');
}
function saveRenWeek() {
  const t = document.getElementById('renWeekTitle').value.trim();
  if (!t) { toast('Escribe un nombre','err'); return; }
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === _renWeekCid);
  const w    = c?.weeks?.find(x => x.id === _renWeekWid); if (!w) return;
  w.title = t; saveModData(CURRENT_MODULE.id, data);
  closeM('mRenWeek'); toast('Semana renombrada','ok'); go('cl_'+_renWeekCid);
}
function addClassToDivision(did) {
  _divClassPendingDid = did;
  document.getElementById('mDivClassName').value = '';
  openM('mDivClass');
}
function saveDivClassModal() {
  const n = document.getElementById('mDivClassName').value.trim();
  if (!n) { toast('Escribe un nombre','err'); return; }
  const data = getModData(CURRENT_MODULE.id);
  const d    = data.divisions.find(x => x.id === _divClassPendingDid); if (!d) return;
  if (!d.classes) d.classes = [];
  d.classes.push({id:uid(), nombre:n, color:selColor, bloques:[], created:Date.now()});
  saveModData(CURRENT_MODULE.id, data); closeM('mDivClass');
  go('div_'+_divClassPendingDid); toast('Clase agregada','ok');
}

/* ── EDITOR ── */
function editBloque(cid, bid, wid) {
  if (!CURRENT_MODULE) { toast('Error: módulo no cargado','err'); return; }
  _editCid = cid; _editBid = bid;
  const data = getModData(CURRENT_MODULE.id);
  const c    = data.classes.find(x => x.id === cid);
  const b    = wid ? c?.weeks?.find(w=>w.id===wid)?.bloques?.find(x=>x.id===bid) : c?.bloques?.find(x=>x.id===bid);
  if (!b) { toast('Bloque no encontrado','err'); return; }
  document.getElementById('viewport').innerHTML = `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon">✏️</div>
        <div><div class="sh-title">Editando: ${esc(b.titulo)}</div>
        <div class="sh-meta">${esc(c.nombre)}</div></div></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-g" onclick="saveEdit('${wid||''}')">💾 Guardar</button>
        <button class="btn btn-r" onclick="go('cl_${cid}')">✕</button>
      </div>
    </div>
    <div class="editor-wrap">
      <div class="editor-toolbar">
        <!-- Fuente y tamaño -->
        <select class="ed-btn" onchange="changeFontSize(this.value)" title="Tamaño de fuente">
          <option value="11px">11</option><option value="12px">12</option><option value="13px">13</option>
          <option value="14px" selected>14</option><option value="16px">16</option>
          <option value="18px">18</option><option value="20px">20</option><option value="24px">24</option>
        </select>
        <select class="ed-btn" onchange="changeFontFamily(this.value)" title="Fuente">
          <option value="Crimson Pro, serif" selected>Crimson Pro</option>
          <option value="Mulish, sans-serif">Mulish</option>
          <option value="JetBrains Mono, monospace">Mono</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Arial, sans-serif">Arial</option>
        </select>
        <div class="ed-sep"></div>
        <!-- Estilo de texto -->
        <button class="ed-btn" onclick="fmt('bold')" title="Negrita (Ctrl+B)"><b>B</b></button>
        <button class="ed-btn" onclick="fmt('italic')" title="Cursiva (Ctrl+I)"><i>I</i></button>
        <button class="ed-btn" onclick="fmt('underline')" title="Subrayado (Ctrl+U)"><u>U</u></button>
        <button class="ed-btn" onclick="fmt('strikeThrough')" title="Tachado"><s>S</s></button>
        <div class="ed-sep"></div>
        <!-- Color -->
        <button class="ed-btn ed-btn-color" onclick="edPickColor('foreColor')" title="Color de texto" style="position:relative">
          <span style="font-weight:700;font-size:13px">A</span>
          <span id="edFgBar" style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:16px;height:3px;background:#c79a38;border-radius:1px"></span>
        </button>
        <button class="ed-btn ed-btn-color" onclick="edPickColor('hiliteColor')" title="Resaltar" style="position:relative">
          <span style="font-size:11px">▪</span>
          <span id="edHlBar" style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:16px;height:3px;background:#7c3aed;border-radius:1px"></span>
        </button>
        <div class="ed-sep"></div>
        <!-- Encabezados -->
        <button class="ed-btn" onclick="fmt('formatBlock','<h1>')" title="Encabezado 1">H1</button>
        <button class="ed-btn" onclick="fmt('formatBlock','<h2>')" title="Encabezado 2">H2</button>
        <button class="ed-btn" onclick="fmt('formatBlock','<h3>')" title="Encabezado 3">H3</button>
        <button class="ed-btn" onclick="fmt('formatBlock','<p>')" title="Párrafo">¶</button>
        <div class="ed-sep"></div>
        <!-- Listas y alineación -->
        <button class="ed-btn" onclick="fmt('insertUnorderedList')" title="Lista con viñetas">•≡</button>
        <button class="ed-btn" onclick="fmt('insertOrderedList')" title="Lista numerada">1≡</button>
        <div class="ed-sep"></div>
        <button class="ed-btn" onclick="fmt('justifyLeft')"   title="Alinear izquierda">⬤≡</button>
        <button class="ed-btn" onclick="fmt('justifyCenter')" title="Centrar">⊜</button>
        <button class="ed-btn" onclick="fmt('justifyRight')"  title="Alinear derecha">≡⬤</button>
        <div class="ed-sep"></div>
        <!-- Insertar -->
        <button class="ed-btn" onclick="insertTable()" title="Insertar tabla">⊞</button>
        <button class="ed-btn" onclick="insertHr()" title="Línea divisoria">─</button>
        <button class="ed-btn" onclick="insertBlockquote()" title="Cita">❝</button>
        <button class="ed-btn" onclick="insertCodeBlock()" title="Bloque de código">&lt;/&gt;</button>
        <button class="ed-btn" onclick="insertDiagram()" title="Diagrama / Timeline" style="font-size:11px">📊</button>
        <div class="ed-sep"></div>
        <button class="ed-btn" onclick="insertMath()" title="Fórmula LaTeX">∫</button>
        <button class="ed-btn" onclick="insertImgUrl()" title="Imagen">🖼️</button>
        <button class="ed-btn" onclick="insertLink()" title="Enlace">🔗</button>
        <div class="ed-sep"></div>
        <button class="ed-btn" onclick="fmt('removeFormat')" title="Limpiar formato">Tx</button>
      </div>
      <div id="edArea" contenteditable="true">${b.contenido||''}</div>
    </div>
    <div class="card" style="font-size:12px;color:var(--txt3)">
      <strong style="color:var(--goldL)">💡 Tips:</strong>
      Fórmulas: <code style="color:var(--goldL)">$E=mc^2$</code> (en línea) ·
      <code style="color:var(--goldL)">$$\\frac{x}{y}$$</code> (centrada)
    </div>
  </div>`;
  document.getElementById('viewport').scrollTop = 0;
  document.getElementById('edArea')?.focus();
}
function fmt(cmd, val) { document.execCommand(cmd, false, val||null); document.getElementById('edArea')?.focus(); }
function changeFontSize(size) {
  document.execCommand('fontSize', false, '7');
  document.querySelectorAll('#edArea font[size="7"]').forEach(s => { s.style.fontSize=size; s.removeAttribute('size'); });
  document.getElementById('edArea')?.focus();
}
function changeFontFamily(family) {
  document.execCommand('fontName', false, 'inherit');
  document.querySelectorAll('#edArea font[face="inherit"]').forEach(f => { f.style.fontFamily=family; f.removeAttribute('face'); });
  document.getElementById('edArea')?.focus();
}
function insertMath() {
  const l = prompt('Fórmula LaTeX (inline=$expr$ o bloque=$$expr$$):');
  if (!l) return;
  const isBlock = l.startsWith('$$') || l.includes('\\') || l.length > 20;
  fmt('insertHTML', isBlock ? '<div style="text-align:center;margin:12px 0">$$' + l.replace(/^\$+|\$+$/g,'') + '$$</div>' : '$' + l + '$');
}
function insertImgUrl() {
  const u = prompt('URL de la imagen:');
  if (!u) return;
  fmt('insertHTML', '<figure style="margin:12px 0;text-align:center"><img src="' + u + '" style="max-width:100%;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.3)"/></figure>');
}
function insertLink() {
  const url = prompt('URL del enlace:');
  if (!url) return;
  const text = prompt('Texto del enlace:', url) || url;
  fmt('insertHTML', '<a href="' + url + '" target="_blank" style="color:var(--blueL,#60a5fa);text-decoration:underline">' + text + '</a>');
}
function insertTable() {
  const rows = parseInt(prompt('Número de filas:', '3')) || 3;
  const cols = parseInt(prompt('Número de columnas:', '3')) || 3;
  const thead = '<tr>' + Array(cols).fill(0).map((_,i) => '<th contenteditable="true" style="background:rgba(124,58,237,.15);padding:8px 12px;border:1px solid rgba(255,255,255,.15);font-weight:700;font-size:12px;color:rgba(167,139,250,.9)">Col ' + (i+1) + '</th>').join('') + '</tr>';
  const tbody = Array(rows).fill(0).map(() => '<tr>' + Array(cols).fill(0).map(() => '<td contenteditable="true" style="padding:8px 12px;border:1px solid rgba(255,255,255,.08);font-size:13px;vertical-align:top;min-width:80px">&nbsp;</td>').join('') + '</tr>').join('');
  fmt('insertHTML', '<div style="overflow-x:auto;margin:12px 0"><table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.1)"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>');
}
function insertHr() {
  fmt('insertHTML', '<hr style="border:none;border-top:2px solid rgba(199,154,56,.4);margin:16px 0"/>');
}
function insertBlockquote() {
  const sel = window.getSelection();
  const text = sel && sel.toString() ? sel.toString() : prompt('Texto de la cita:') || '';
  if (!text) return;
  fmt('insertHTML', '<blockquote style="border-left:4px solid #7c3aed;padding:10px 16px;margin:12px 0;background:rgba(124,58,237,.07);border-radius:0 8px 8px 0;font-style:italic;color:var(--txt2)">' + text + '</blockquote>');
}
function insertCodeBlock() {
  const lang = prompt('Lenguaje (ej: python, js, html):', '') || '';
  const code = prompt('Código:') || '';
  if (!code) return;
  const label = lang ? '<div style="font-size:10px;font-weight:700;color:rgba(167,139,250,.7);text-transform:uppercase;letter-spacing:1px;padding:5px 14px;background:rgba(124,58,237,.12);border-bottom:1px solid rgba(255,255,255,.06)">' + lang + '</div>' : '';
  fmt('insertHTML', '<div style="background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;margin:10px 0">' + label + '<pre style="padding:14px;margin:0;overflow-x:auto;font-family:JetBrains Mono,monospace;font-size:12px;color:#e2e8f0;white-space:pre;line-height:1.6">' + code.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre></div>');
}

function insertDiagram() {
  const types = ['flowchart', 'timeline', 'sequenceDiagram', 'gantt', 'mindmap', 'pie'];
  const typeList = types.map((t,i) => (i+1)+'. '+t).join('\n');
  const type = prompt('Tipo de diagrama:\n' + typeList + '\n\nEscribe el número o el nombre:', '1') || '1';
  const idx = isNaN(type) ? types.indexOf(type) : parseInt(type) - 1;
  const t = types[Math.max(0, Math.min(idx, types.length-1))];
  
  const templates = {
    flowchart: `flowchart TD\n    A[Inicio] --> B{¿Condición?}\n    B -->|Sí| C[Proceso A]\n    B -->|No| D[Proceso B]\n    C --> E[Fin]\n    D --> E`,
    timeline: `timeline\n    title Línea del Tiempo\n    Sección 1 : Evento importante\n             : Otro evento\n    Sección 2 : Tercer evento`,
    sequenceDiagram: `sequenceDiagram\n    participant A as Actor A\n    participant B as Actor B\n    A->>B: Mensaje 1\n    B-->>A: Respuesta`,
    gantt: `gantt\n    title Plan de Trabajo\n    dateFormat  YYYY-MM-DD\n    Tarea 1 :a1, 2024-01-01, 30d\n    Tarea 2 :after a1, 20d`,
    mindmap: `mindmap\n  root((Tema Central))\n    Rama 1\n      Sub 1\n      Sub 2\n    Rama 2\n      Sub 3`,
    pie: `pie title Distribución\n    "Grupo A" : 40\n    "Grupo B" : 35\n    "Grupo C" : 25`,
  };
  
  const code = templates[t] || templates.flowchart;
  const id = 'mmd_' + Math.random().toString(36).slice(2,8);
  const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  fmt('insertHTML',
    '<div class="bloque-mermaid-wrap" style="border:1px solid rgba(124,58,237,.25);border-radius:10px;overflow:hidden;margin:12px 0">' +
    '<div style="font-size:10px;font-weight:700;color:rgba(167,139,250,.7);text-transform:uppercase;letter-spacing:1px;padding:5px 14px;background:rgba(124,58,237,.1);border-bottom:1px solid rgba(255,255,255,.06)">Diagrama Mermaid — ' + t + '</div>' +
    '<div class="mermaid" id="' + id + '" style="padding:12px;text-align:center;background:rgba(0,0,0,.2)">' + escaped + '</div>' +
    '</div>'
  );
  /* Intentar renderizar si mermaid está disponible */
  if (typeof mermaid !== 'undefined') {
    setTimeout(() => { try { mermaid.run({ nodes: [document.getElementById(id)] }); } catch(e) {} }, 100);
  }
}

/* Color picker helpers */
let _edColorTarget = 'foreColor';
function edPickColor(target) {
  _edColorTarget = target;
  let picker = document.getElementById('edColorPicker');
  if (!picker) {
    picker = document.createElement('input');
    picker.type = 'color'; picker.id = 'edColorPicker';
    picker.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:0;height:0';
    picker.addEventListener('input', function() {
      fmt(_edColorTarget, picker.value);
      if (_edColorTarget === 'foreColor') document.getElementById('edFgBar').style.background = picker.value;
      else document.getElementById('edHlBar').style.background = picker.value;
    });
    document.body.appendChild(picker);
  }
  picker.click();
}
function saveEdit(wid) {
  if (!CURRENT_MODULE) { toast('Error: módulo no cargado','err'); return; }
  if (!_editCid || !_editBid) { toast('Error: referencia de bloque perdida','err'); return; }
  const content = document.getElementById('edArea')?.innerHTML || '';
  const data = getModData(CURRENT_MODULE.id);

  /* Division context */
  if (_editCid === '__div__' && _divEditDid) {
    const d = data.divisions.find(x => x.id === _divEditDid);
    const c = d?.classes?.find(x => x.id === _divEditCid2);
    const b = c?.bloques?.find(x => x.id === _editBid);
    if (!b) { toast('Bloque no encontrado (división)','err'); return; }
    b.contenido = content; saveModData(CURRENT_MODULE.id, data);
    toast('Guardado ✓','ok'); go('div_'+_divEditDid); return;
  }

  const c = data.classes.find(x => x.id === _editCid);
  if (!c) { toast('Clase no encontrada','err'); return; }
  let b;
  if (wid) { const w = c?.weeks?.find(x => x.id === wid); b = w?.bloques?.find(x => x.id === _editBid); }
  else     { b = c?.bloques?.find(x => x.id === _editBid); }
  if (!b) { toast('Bloque no encontrado','err'); return; }
  b.contenido = content; saveModData(CURRENT_MODULE.id, data);
  toast('Guardado ✓','ok');
  /* Re-renderizar Mermaid en bloque guardado */
  if (typeof mermaid !== 'undefined') {
    setTimeout(() => { try { mermaid.run(); } catch(e) {} }, 200);
  }
  go('cl_'+_editCid);
}

/* ── DIVISION MANAGEMENT ── */
function renderDivision(id) {
  const data = getModData(CURRENT_MODULE.id);
  const d    = data.divisions.find(x => x.id === id);
  if (!d) return `<div class="empty"><div class="empty-icon">❓</div><h3>División no encontrada</h3></div>`;
  if (!d.classes) d.classes = [];
  const totalClasses = d.classes.length;
  const totalBlocks  = d.classes.reduce((s,c) => s+(c.bloques||[]).length, 0);
  const divSched     = d.schedule || null;
  const allDays      = [{key:'lun',label:'Lun'},{key:'mar',label:'Mar'},{key:'mie',label:'Mié'},
                        {key:'jue',label:'Jue'},{key:'vie',label:'Vie'},{key:'sab',label:'Sáb'},{key:'dom',label:'Dom'}];

  function renderDivTable(dSched) {
    if (!dSched) return `<div class="card" style="margin-bottom:20px;padding:18px"><div style="font-weight:700;color:var(--txt)">Sin horario</div><p style="color:var(--txt3)">Sin horario establecido.</p></div>`;
    if (dSched.type==='table' && dSched.table) {
      return `<div style="overflow-x:auto;margin-bottom:20px">
        <table class="sched-edit-table" style="pointer-events:none">
          <thead><tr><th class="hora-th">Hora</th>${allDays.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead>
          <tbody>${(dSched.table.rows||[]).map((r,i)=>`<tr>
            <td class="hora-cell"><input value="${esc(r.hora||`Hora ${i+1}`)}" readonly tabindex="-1"></td>
            ${allDays.map(c=>`<td><input value="${esc(r[c.key]||'')}" readonly tabindex="-1"></td>`).join('')}
          </tr>`).join('')}</tbody>
        </table></div>`;
    }
    return `<div class="card" style="margin-bottom:20px;padding:18px"><div style="font-weight:700;color:var(--txt)">Horario simple</div></div>`;
  }

  return `<div class="fade">
    <div class="clase-head" style="display:flex;align-items:flex-start;gap:14px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <div style="width:14px;height:14px;border-radius:4px;background:${d.color};flex-shrink:0;margin-top:4px"></div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fd);font-size:28px;font-weight:700;color:var(--txt)">${esc(d.nombre)}</div>
        <div style="font-size:12px;color:var(--txt3);margin-top:6px">📚 <strong>${totalClasses}</strong> clases · 📦 <strong>${totalBlocks}</strong> bloques</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn" onclick="go('home')">← Volver</button>
        <button class="btn btn-gold" onclick="addClassToDivision('${id}')">+ Nueva Clase</button>
      </div>
    </div>
    <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:13px;font-weight:700;color:var(--txt)">📅 Horario</span>
      <button class="btn btn-sm" onclick="openDivSchedule('${id}')">✏️ Editar Horario</button>
    </div>
    ${renderDivTable(divSched)}
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;color:var(--txt3)">Clases (${totalClasses})</div>
      <button class="btn btn-sm btn-gold" onclick="addClassToDivision('${id}')">+ Nueva Clase</button>
    </div>
    ${d.classes.length>0
      ? `<div style="display:flex;flex-direction:column;gap:12px">
          ${d.classes.map(c=>`<div class="card" style="border-color:${c.color||'#c79a38'}30;cursor:pointer" onclick="openDivClass('${id}','${c.id}')">
            <div class="card-head" style="margin-bottom:${(c.bloques||[]).length>0?'12':'0'}px">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:10px;height:10px;border-radius:50%;background:${c.color||'#c79a38'};flex-shrink:0"></div>
                <div><div class="card-title">${esc(c.nombre)}</div>
                <div class="card-meta">${(c.bloques||[]).length} bloque${(c.bloques||[]).length!==1?'s':''}</div></div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-gold" onclick="event.stopPropagation();addBlockToClassDiv('${id}','${c.id}')">+ Bloque</button>
                <button class="btn btn-sm btn-r" onclick="event.stopPropagation();delClassFromDivision('${id}','${c.id}')">×</button>
              </div>
            </div>
            ${(c.bloques||[]).length>0?`<div style="display:flex;flex-wrap:wrap;gap:6px">
              ${(c.bloques||[]).map(b=>`<span class="tag tag-gold" style="cursor:pointer" onclick="event.stopPropagation();editDivBloque('${id}','${c.id}','${b.id}')">${esc(b.titulo)}</span>`).join('')}
            </div>`:''}
          </div>`).join('')}
        </div>`
      : `<div class="empty"><div class="empty-icon">📚</div><h3>Sin clases</h3><p>Agrega clases a esta división</p></div>`}
  </div>`;
}

function addBlockToClassDiv(did, cid) {
  _divBlockDid = did; _divBlockCid = cid;
  const data = getModData(CURRENT_MODULE.id);
  const d    = data.divisions.find(x => x.id === did);
  const c    = d?.classes?.find(x => x.id === cid);
  const t = prompt('Título del bloque:', 'Bloque '+((c?.bloques?.length||0)+1));
  if (!t) return;
  if (!c.bloques) c.bloques = [];
  c.bloques.push({id:uid(), titulo:t.trim(), contenido:'<p>Escribe el contenido aquí.</p>', quiz:null});
  saveModData(CURRENT_MODULE.id, data);
  toast('Bloque agregado','ok'); openDivClass(did, cid);
}
function delClassFromDivision(did, cid) {
  if (!confirm('¿Eliminar esta clase?')) return;
  const data = getModData(CURRENT_MODULE.id);
  const d    = data.divisions.find(x => x.id === did);
  d.classes  = (d.classes||[]).filter(x => x.id !== cid);
  saveModData(CURRENT_MODULE.id, data); go('div_'+did); toast('Clase eliminada','ok');
}
function openDivClass(did, cid) {
  VIEW = 'divclass_'+did+'_'+cid;
  const vp   = document.getElementById('viewport');
  const data = getModData(CURRENT_MODULE.id);
  const d    = data.divisions.find(x => x.id === did);
  const c    = d?.classes?.find(x => x.id === cid);
  if (!c) { toast('Clase no encontrada','err'); return; }
  if (!c.bloques) c.bloques = [];
  const totalQ = c.bloques.filter(b=>b.quiz).length;
  vp.innerHTML = `<div class="fade">
    <div class="clase-head" style="display:flex;align-items:flex-start;gap:14px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <div style="width:14px;height:14px;border-radius:4px;background:${c.color||'#c79a38'};flex-shrink:0;margin-top:4px"></div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fd);font-size:26px;font-weight:700;color:var(--txt)">${esc(c.nombre)}</div>
        <div style="font-size:12px;color:var(--txt3);margin-top:4px">📦 <strong>${c.bloques.length}</strong> bloques · 🎯 <strong>${totalQ}</strong> quizzes · 📁 ${esc(d.nombre)}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="go('div_${did}')">← División</button>
        <button class="btn btn-gold" onclick="addBlockToClassDiv('${did}','${cid}')">+ Bloque</button>
      </div>
    </div>
    ${c.bloques.length===0
      ? `<div class="empty"><div class="empty-icon">📄</div><h3>Sin bloques</h3><p>Agrega bloques para organizar el contenido</p>
         <button class="btn btn-gold" onclick="addBlockToClassDiv('${did}','${cid}')" style="margin-top:16px">+ Agregar Bloque</button></div>`
      : c.bloques.map(b => renderDivBloqueHTML(b, did, cid)).join('')}
  </div>`;
  vp.scrollTop = 0;
  try { if(window.MathJax&&window.MathJax.typesetPromise) window.MathJax.typesetPromise([vp]).catch(()=>{}); } catch(e){}
}
function renderDivBloqueHTML(b, did, cid) {
  return `<div class="bloque open" id="blq_${b.id}">
    <div class="bloque-head" onclick="toggleBlq('${b.id}')">
      <div class="bloque-title">${esc(b.titulo)}</div><div class="bloque-collapse">▼</div>
    </div>
    <div class="bloque-body">
      <div class="bloque-content" id="cnt_${b.id}">${b.contenido||'<p style="color:var(--txt3)">Sin contenido.</p>'}</div>
      ${b.quiz ? renderQuizWidget(b.quiz, b.id, cid) : ''}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-b" onclick="editDivBloque('${did}','${cid}','${b.id}')">✏️ Editar</button>
        ${!b.quiz ? `<button class="btn btn-gold" onclick="openDivQuizModal('${did}','${cid}','${b.id}')">🎯 Quiz</button>` : ''}
        <button class="btn btn-r" onclick="delDivBloque('${did}','${cid}','${b.id}')">🗑️</button>
      </div>
    </div>
  </div>`;
}
function delDivBloque(did, cid, bid) {
  if (!confirm('¿Eliminar este bloque?')) return;
  const data = getModData(CURRENT_MODULE.id);
  const d    = data.divisions.find(x => x.id === did);
  const c    = d?.classes?.find(x => x.id === cid); if (!c) return;
  c.bloques  = (c.bloques||[]).filter(b => b.id !== bid);
  saveModData(CURRENT_MODULE.id, data); openDivClass(did, cid); toast('Bloque eliminado','ok');
}
function editDivBloque(did, cid, bid) {
  const data = getModData(CURRENT_MODULE.id);
  const d    = data.divisions.find(x => x.id === did);
  const c    = d?.classes?.find(x => x.id === cid);
  const b    = c?.bloques?.find(x => x.id === bid); if (!b) return;
  _editCid = '__div__'; _editBid = bid;
  window._divEditDid = did; window._divEditCid = cid;
  document.getElementById('viewport').innerHTML = `<div class="fade">
    <div class="sh-row">
      <div class="sh"><div class="sh-icon">✏️</div>
        <div><div class="sh-title">Editando: ${esc(b.titulo)}</div>
        <div class="sh-meta">${esc(c.nombre)} — ${esc(d.nombre)}</div></div></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-g" onclick="saveDivEdit('${did}','${cid}','${bid}')">💾 Guardar</button>
        <button class="btn btn-r" onclick="openDivClass('${did}','${cid}')">✕</button>
      </div>
    </div>
    <div class="editor-wrap">
      <div class="editor-toolbar">
        <button class="ed-btn" onclick="fmt('bold')"><b>B</b></button>
        <button class="ed-btn" onclick="fmt('italic')"><i>I</i></button>
        <button class="ed-btn" onclick="fmt('underline')"><u>U</u></button>
        <div class="ed-sep"></div>
        <button class="ed-btn" onclick="fmt('formatBlock','<h2>')">H2</button>
        <button class="ed-btn" onclick="fmt('formatBlock','<h3>')">H3</button>
        <div class="ed-sep"></div>
        <button class="ed-btn" onclick="fmt('insertUnorderedList')">•</button>
        <button class="ed-btn" onclick="fmt('insertOrderedList')">1.</button>
        <div class="ed-sep"></div>
        <button class="ed-btn" onclick="insertMath()" title="LaTeX">∫</button>
        <button class="ed-btn" onclick="insertImgUrl()">🖼️</button>
      </div>
      <div id="edArea" contenteditable="true">${b.contenido||''}</div>
    </div>
  </div>`;
  document.getElementById('viewport').scrollTop = 0;
  document.getElementById('edArea')?.focus();
}
function saveDivEdit(did, cid, bid) {
  const content = document.getElementById('edArea')?.innerHTML || '';
  const data    = getModData(CURRENT_MODULE.id);
  const d       = data.divisions.find(x => x.id === did);
  const c       = d?.classes?.find(x => x.id === cid);
  const b       = c?.bloques?.find(x => x.id === bid); if (!b) return;
  b.contenido   = content; saveModData(CURRENT_MODULE.id, data);
  toast('Guardado','ok'); openDivClass(did, cid);
}
function openDivQuizModal(did, cid, bid) {
  window._quizDivCtx = {did, cid, bid};
  _quizCid = cid; _quizBid = bid; _quizWid = null;
  const ta = document.getElementById('qzJsonArea');
  const er = document.getElementById('qzModalErr');
  if(ta) ta.value='';
  if(er) er.style.display='none';
  openM('mQuiz');
  setTimeout(()=>document.getElementById('qzJsonArea')?.focus(),150);
}

/* ── DIVISION SCHEDULE ── */
function openDivSchedule(did) {
  const data = getModData(CURRENT_MODULE.id);
  const div  = data.divisions.find(x => x.id === did); if (!div) return;
  _scheduleDivisionId = did;
  document.getElementById('mHorarioTitle').textContent = `📅 Horario — ${div.nombre}`;
  const allDays = ['lun','mar','mie','jue','vie','sab','dom'];
  const dayLabels = {lun:'Lunes',mar:'Martes',mie:'Miércoles',jue:'Jueves',vie:'Viernes',sab:'Sábado',dom:'Domingo'};
  if (!div.schedule || div.schedule.type !== 'table' || !div.schedule.table) {
    const rows = [];
    for (let r=0; r<6; r++) { const row={hora:'',idx:r}; allDays.forEach(d=>row[d]=''); rows.push(row); }
    div.schedule = {type:'table', rows:6, table:{week:allDays, rows}};
    saveModData(CURRENT_MODULE.id, data);
  }
  const tbl = div.schedule.table;
  if (!tbl.week.includes('sab')) {
    tbl.week = allDays;
    tbl.rows.forEach(r => { allDays.forEach(d => { if(r[d]===undefined) r[d]=''; }); });
    div.schedule.table = tbl; saveModData(CURRENT_MODULE.id, data);
  }
  const rows = tbl.rows || [];
  const headerCells = `<th class="hora-th">Hora</th>` + allDays.map(d=>`<th>${dayLabels[d]}</th>`).join('');
  const bodyRows = rows.map((r,i)=>`<tr>
    <td class="hora-cell"><input value="${esc(r.hora||'')}" placeholder="Hora ${i+1}" data-row="${i}" data-col="hora"></td>
    ${allDays.map(d=>`<td><input value="${esc(r[d]||'')}" placeholder="—" data-row="${i}" data-col="${d}"></td>`).join('')}
  </tr>`).join('');
  document.getElementById('mHorarioTableWrap').innerHTML =
    `<table class="sched-edit-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
     <div style="margin-top:10px;display:flex;gap:8px">
       <button class="btn btn-sm btn-g" onclick="addHorarioRow()">+ Fila</button>
       <button class="btn btn-sm btn-r" onclick="removeHorarioRow()">− Última fila</button>
     </div>`;
  openM('mHorario');
}
function addHorarioRow() {
  const allDays = ['lun','mar','mie','jue','vie','sab','dom'];
  const tbody   = document.querySelector('#mHorarioTableWrap tbody'); if (!tbody) return;
  const i = tbody.rows.length;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td class="hora-cell"><input value="" placeholder="Hora ${i+1}" data-row="${i}" data-col="hora"></td>` +
    allDays.map(d=>`<td><input value="" placeholder="—" data-row="${i}" data-col="${d}"></td>`).join('');
  tbody.appendChild(tr);
  Array.from(tbody.rows).forEach((row,idx) => { row.querySelectorAll('input').forEach(inp=>inp.dataset.row=idx); });
}
function removeHorarioRow() {
  const tbody = document.querySelector('#mHorarioTableWrap tbody');
  if (!tbody || tbody.rows.length <= 1) return;
  tbody.removeChild(tbody.lastElementChild);
}
function _saveDivHorario(did) {
  const data    = getModData(CURRENT_MODULE.id);
  const div     = data.divisions.find(x => x.id === did); if (!div) return;
  const allDays = ['lun','mar','mie','jue','vie','sab','dom'];
  const inputs  = document.querySelectorAll('#mHorarioTableWrap input');
  const rowMap  = {};
  inputs.forEach(inp => {
    const r = parseInt(inp.dataset.row); const col = inp.dataset.col;
    if (!rowMap[r]) rowMap[r] = {hora:'', idx:r};
    rowMap[r][col] = inp.value.trim();
    if (col !== 'hora') allDays.forEach(d => { if(rowMap[r][d]===undefined) rowMap[r][d]=''; });
  });
  const rows = Object.keys(rowMap).sort((a,b)=>a-b).map(k=>rowMap[k]);
  div.schedule = {type:'table', rows:rows.length, table:{week:allDays, rows}};
  saveModData(CURRENT_MODULE.id, data);
  closeM('mHorario'); _scheduleDivisionId = null;
  toast('Horario guardado','ok'); go('div_'+did);
}

