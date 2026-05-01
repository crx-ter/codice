/* ═══════════════════════════════════
   CÓDICE — quiz-engine.js
   Responsabilidad: Motor de Quiz standalone (renderQuiz, _qzBuild, _qzMostrar, etc.)
                    Se lanza desde bloques, exámenes clásicos y el chat de IA.
   Depende de: storage.js (addError), router.js
   Expone: renderQuiz, launchBlockQuiz, qzAbrirDesdeChat
═══════════════════════════════════ */

/* ═══════════════════════ quiz-engine.js ═══════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════
   CÓDICE QUIZ ENGINE v2.1 — Premium
   - Diseño azul marino oscuro degradado (imagen de referencia)
   - CRONÓMETRO hacia arriba (tiempo transcurrido, no cuenta regresiva)
   - Sin límite de tiempo — el usuario responde a su ritmo
   - Opción A B C D grandes con feedback verde/rojo
   - Explicación en caja separada
   - Resultado final con porcentaje
═══════════════════════════════════════════════════════════════════════ */

const _QZ = {
  preguntas:  [],
  actual:     0,
  aciertos:   0,
  seleccion:  null,
  respondida: false,
  timer:      null,
  elapsed:    0,        // segundos transcurridos
};

/* ══════════════════════════════════════════════════════════════
   ENTRADA PRINCIPAL
══════════════════════════════════════════════════════════════ */

function renderQuiz(json) {
  try {
    let data = typeof json === 'string' ? JSON.parse(json.trim()) : json;
    const preguntas = Array.isArray(data) ? data : [data];
    preguntas.forEach((p, i) => {
      if (!p.pregunta)                    throw new Error(`Pregunta ${i+1}: falta "pregunta"`);
      if (!Array.isArray(p.opciones) || p.opciones.length < 2)
                                          throw new Error(`Pregunta ${i+1}: "opciones" debe ser array con ≥2 items`);
      if (typeof p.correcta !== 'number') throw new Error(`Pregunta ${i+1}: "correcta" debe ser un número (índice)`);
    });
    _QZ.preguntas  = preguntas;
    _QZ.actual     = 0;
    _QZ.aciertos   = 0;
    _QZ.seleccion  = null;
    _QZ.respondida = false;
    _QZ.elapsed    = 0;
    _qzStyles();
    _qzBuild();
    _qzMostrar(0);
  } catch(e) {
    alert('⚠️ Error en el Quiz: ' + e.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   CONSTRUIR OVERLAY
══════════════════════════════════════════════════════════════ */

function _qzBuild() {
  document.getElementById('qzOverlay')?.remove();
  const ov = document.createElement('div');
  ov.id = 'qzOverlay';
  ov.innerHTML = `
    <div id="qzCard">
      <!-- HEADER con efecto glassmorphism -->
      <div id="qzHead">
        <div id="qzHeadGlow"></div>
        <div id="qzTitleWrap">
          <span id="qzTitleBold">QUIZ</span><span id="qzTitleLight"> DE ENTRENAMIENTO</span>
        </div>
        <div id="qzTitleLine"></div>
      </div>

      <!-- BARRA DE PROGRESO + PUNTUACIÓN -->
      <div id="qzProgRow">
        <span id="qzProgLabel">Pregunta <strong id="qzProgCur">1</strong> / <span id="qzProgTot">${_QZ.preguntas.length}</span></span>
        <span id="qzTimerDisplay">⏱ 0:00</span>
        <span id="qzScoreBadge">Puntuación: <strong id="qzScoreNum">0</strong></span>
      </div>
      <div id="qzProgBarWrap">
        <div id="qzProgBarFill"></div>
      </div>

      <!-- CUERPO DINÁMICO -->
      <div id="qzBody"></div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) _qzCerrar(); });
}

/* ══════════════════════════════════════════════════════════════
   MOSTRAR PREGUNTA
══════════════════════════════════════════════════════════════ */

function _qzMostrar(idx) {
  const p   = _QZ.preguntas[idx];
  const tot = _QZ.preguntas.length;
  _QZ.actual    = idx;
  _QZ.seleccion = null;
  _QZ.respondida= false;

  // Header info
  document.getElementById('qzProgCur').textContent  = idx + 1;
  document.getElementById('qzScoreNum').textContent = _QZ.aciertos;
  const pct = tot > 1 ? Math.round((idx / tot) * 100) : 0;
  document.getElementById('qzProgBarFill').style.width = pct + '%';

  // Iniciar/continuar cronómetro
  _qzStartStopwatch();

  const letras = ['A','B','C','D','E','F'];
  document.getElementById('qzBody').innerHTML = `
    <div id="qzQuestion">${_qzEsc(p.pregunta)}</div>
    <div id="qzOpts">
      ${p.opciones.map((op, i) => `
        <button class="qzOpt" id="qzO${i}" onclick="_qzSelect(${i})">
          <span class="qzLet">${letras[i]||i})</span>
          <span class="qzOptTxt">${_qzEsc(op)}</span>
          <span class="qzCheckIcon" id="qzChk${i}">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 10l5 5 7-8"/>
            </svg>
          </span>
        </button>`).join('')}
    </div>
    <div id="qzFb"></div>
    <div id="qzExpBox" style="display:none">
      <div id="qzExpLabel">Explicación:</div>
      <div id="qzExpText"></div>
    </div>
    <div id="qzActions">
      <button class="qzBtnGray" id="qzBtnRe"  onclick="_qzReintentar()" style="display:none">Reintentar</button>
      <button class="qzBtnBlue" id="qzBtnRes" onclick="_qzValidar()"    disabled>Responder</button>
      <button class="qzBtnBlue" id="qzBtnSig" onclick="_qzSiguiente()"  style="display:none">
        ${idx + 1 >= tot ? 'Ver resultados' : 'Siguiente'} ›
      </button>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   SELECCIONAR
══════════════════════════════════════════════════════════════ */

function _qzSelect(i) {
  if (_QZ.respondida) return;
  _QZ.seleccion = i;
  document.querySelectorAll('.qzOpt').forEach((b, j) => b.classList.toggle('qzSel', j === i));
  const br = document.getElementById('qzBtnRes');
  if (br) br.disabled = false;
}

/* ══════════════════════════════════════════════════════════════
   VALIDAR RESPUESTA
══════════════════════════════════════════════════════════════ */

function _qzValidar() {
  if (_QZ.respondida || _QZ.seleccion === null) return;
  _QZ.respondida = true;

  const p  = _QZ.preguntas[_QZ.actual];
  const ok = _QZ.seleccion === p.correcta;
  if (ok) _QZ.aciertos++;

  const letras = ['A','B','C','D','E','F'];

  p.opciones.forEach((_, j) => {
    const btn = document.getElementById('qzO' + j);
    const chk = document.getElementById('qzChk' + j);
    if (!btn) return;
    btn.disabled = true;
    btn.classList.remove('qzSel');
    if (j === p.correcta) {
      btn.classList.add('qzGreen');
      if (chk) chk.style.display = 'flex';
    } else if (j === _QZ.seleccion && !ok) {
      btn.classList.add('qzRed');
    }
  });

  // Feedback
  const fb = document.getElementById('qzFb');
  if (fb) {
    fb.className = ok ? 'qzFbOk' : 'qzFbKo';
    fb.innerHTML = ok
      ? `<span class="qzFbIcon">✓</span><div><strong>¡Correcto!</strong><br><span class="qzFbSub">La respuesta correcta es: <strong>${letras[p.correcta]}) ${_qzEsc(p.opciones[p.correcta])}</strong></span></div>`
      : `<span class="qzFbIcon">✗</span><div><strong>Incorrecto.</strong><br><span class="qzFbSub">La respuesta correcta es: <strong>${letras[p.correcta]}) ${_qzEsc(p.opciones[p.correcta])}</strong></span></div>`;
  }

  // Explicación
  if (p.explicacion) {
    const ex = document.getElementById('qzExpBox');
    const et = document.getElementById('qzExpText');
    if (ex) ex.style.display = 'block';
    if (et) et.innerHTML     = _qzEsc(p.explicacion);
  }

  // Botones
  const br = document.getElementById('qzBtnRes');
  const bR = document.getElementById('qzBtnRe');
  const bs = document.getElementById('qzBtnSig');
  if (br) br.style.display = 'none';
  if (bR) bR.style.display = 'inline-flex';
  if (bs) bs.style.display = 'inline-flex';
  document.getElementById('qzScoreNum').textContent = _QZ.aciertos;
}

/* ══════════════════════════════════════════════════════════════
   REINTENTAR / SIGUIENTE / FINAL
══════════════════════════════════════════════════════════════ */

function _qzReintentar() {
  _QZ.respondida = false;
  _QZ.seleccion  = null;
  _qzMostrar(_QZ.actual);
}

function _qzSiguiente() {
  const sig = _QZ.actual + 1;
  if (sig >= _QZ.preguntas.length) _qzFinal();
  else _qzMostrar(sig);
}

function _qzFinal() {
  _qzStopStopwatch();
  const tot   = _QZ.preguntas.length;
  const ac    = _QZ.aciertos;
  const pct   = Math.round((ac / tot) * 100);
  const tStr  = _qzFmtTime(_QZ.elapsed);

  document.getElementById('qzProgBarFill').style.width = '100%';
  document.getElementById('qzProgCur').textContent = tot;

  let emoji = '😐', msg = 'Sigue practicando', cls = 'qzResLow';
  if      (pct >= 90) { emoji = '🏆'; msg = '¡Excelente!';    cls = 'qzResHigh'; }
  else if (pct >= 70) { emoji = '🎉'; msg = '¡Muy bien!';     cls = 'qzResMed';  }
  else if (pct >= 50) { emoji = '📖'; msg = 'Casi lo tienes'; cls = 'qzResMed';  }

  document.getElementById('qzBody').innerHTML = `
    <div class="qzFinal ${cls}">
      <div class="qzFinalEmoji">${emoji}</div>
      <div class="qzFinalMsg">${msg}</div>
      <div class="qzFinalMeta">${ac} / ${tot} correctas · ${tStr}</div>
      <div class="qzFinalPct">${pct}%</div>
      <div class="qzFinalBarWrap"><div class="qzFinalBar" style="width:${pct}%"></div></div>
      <div class="qzFinalSub">${pct >= 70 ? '¡Sigue así! Dominas bien el tema.' : 'Repasa el contenido y vuelve a intentarlo.'}</div>
    </div>
    <div id="qzActions" style="justify-content:center;gap:12px;margin-top:4px">
      <button class="qzBtnGray" onclick="_qzReiniciar()">🔄 Reiniciar</button>
      <button class="qzBtnBlue" onclick="_qzCerrar()" style="flex:0;min-width:90px">Cerrar</button>
    </div>`;
}

function _qzReiniciar() {
  _QZ.aciertos = 0; _QZ.actual = 0; _QZ.seleccion = null;
  _QZ.respondida = false; _QZ.elapsed = 0;
  _qzMostrar(0);
}

function _qzCerrar() {
  _qzStopStopwatch();
  const ov = document.getElementById('qzOverlay');
  if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 280); }
}

/* ══════════════════════════════════════════════════════════════
   CRONÓMETRO (tiempo transcurrido, sin límite)
══════════════════════════════════════════════════════════════ */

function _qzStartStopwatch() {
  // No reiniciar si ya corre (continuidad entre preguntas)
  if (_QZ.timer) return;
  _QZ.timer = setInterval(() => {
    _QZ.elapsed++;
    const el = document.getElementById('qzTimerDisplay');
    if (el) el.textContent = '⏱ ' + _qzFmtTime(_QZ.elapsed);
  }, 1000);
}

function _qzStopStopwatch() {
  if (_QZ.timer) { clearInterval(_QZ.timer); _QZ.timer = null; }
}

function _qzFmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/* ══════════════════════════════════════════════════════════════
   FUNCIÓN PARA LANZAR EL QUIZ GUARDADO EN UN BLOQUE
══════════════════════════════════════════════════════════════ */

function launchBlockQuiz(cid, bid, wid) {
  if (typeof CURRENT_MODULE === 'undefined' || !CURRENT_MODULE) return;
  const data = getModData(CURRENT_MODULE.id);
  const cl   = data.classes?.find(x => x.id === cid);
  let b;
  if (wid) { const w = cl?.weeks?.find(x => x.id === wid); b = w?.bloques?.find(x => x.id === bid); }
  else      { b = cl?.bloques?.find(x => x.id === bid); }
  if (!b?.quiz) { if (typeof toast === 'function') toast('Sin quiz en este bloque','err'); return; }
  renderQuiz([b.quiz]);
}

/* Para abrir desde el chat de la IA */
function qzAbrirDesdeChat(encodedJson) {
  try { renderQuiz(JSON.parse(decodeURIComponent(encodedJson))); }
  catch(e) { if (typeof toast === 'function') toast('Error abriendo quiz','err'); }
}

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */

function _qzEsc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

/* ══════════════════════════════════════════════════════════════
   ESTILOS PREMIUM — azul marino oscuro, glassmorphism
══════════════════════════════════════════════════════════════ */

function _qzStyles() {
  if (document.getElementById('qzSt')) return;
  const s = document.createElement('style');
  s.id = 'qzSt';
  s.textContent = `
/* ── OVERLAY ── */
#qzOverlay {
  position:fixed; inset:0;
  background:rgba(2,6,18,.88);
  backdrop-filter:blur(6px);
  display:flex; align-items:center; justify-content:center;
  z-index:99999; padding:14px;
  animation:qzFI .25s ease;
}
@keyframes qzFI { from{opacity:0} to{opacity:1} }

/* ── CARD ── */
#qzCard {
  background: linear-gradient(168deg, #0c1e36 0%, #081424 52%, #0c1e36 100%);
  border: 1px solid rgba(59,130,246,.18);
  border-radius: 20px;
  width: 100%; max-width: 510px;
  max-height: 92vh; overflow-y: auto;
  box-shadow:
    0 32px 80px rgba(0,0,0,.8),
    0 0 0 1px rgba(255,255,255,.04) inset,
    0 1px 0 rgba(255,255,255,.08) inset;
  animation: qzSU .32s cubic-bezier(.16,1,.3,1);
  scrollbar-width: thin; scrollbar-color: #1e3a5f transparent;
}
@keyframes qzSU { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
#qzCard::-webkit-scrollbar { width:4px }
#qzCard::-webkit-scrollbar-thumb { background:#1e3a5f; border-radius:2px }

/* ── HEADER ── */
#qzHead {
  position: relative;
  text-align: center;
  padding: 26px 24px 0;
  overflow: hidden;
}
#qzHeadGlow {
  position: absolute; top:-40px; left:50%; transform:translateX(-50%);
  width:300px; height:120px;
  background: radial-gradient(ellipse, rgba(59,130,246,.18) 0%, transparent 70%);
  pointer-events: none;
}
#qzTitleWrap {
  position: relative;
  font-size: 20px; letter-spacing: 3px; text-transform: uppercase;
}
#qzTitleBold  { font-weight: 900; color: #fff; }
#qzTitleLight { font-weight: 300; color: #94a3b8; }
#qzTitleLine  {
  height: 1.5px; margin: 14px 20px 0;
  background: linear-gradient(90deg, transparent, rgba(59,130,246,.6), transparent);
  border-radius: 1px;
}

/* ── PROGRESO ── */
#qzProgRow {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 22px 6px;
  font-size: 12px; color: #64748b; font-weight: 600; gap: 6px;
}
#qzProgRow strong { color: #94a3b8; }
#qzTimerDisplay {
  background: rgba(59,130,246,.1);
  border: 1px solid rgba(59,130,246,.2);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 12px; font-weight: 700;
  color: #60a5fa;
  letter-spacing: .5px;
  font-variant-numeric: tabular-nums;
}
#qzProgBarWrap {
  margin: 0 22px;
  height: 4px; border-radius: 2px;
  background: rgba(255,255,255,.07);
  overflow: hidden;
}
#qzProgBarFill {
  height: 100%; border-radius: 2px; width: 0%;
  background: linear-gradient(90deg, #3b82f6, #818cf8);
  transition: width .55s cubic-bezier(.16,1,.3,1);
  box-shadow: 0 0 8px rgba(59,130,246,.5);
}

/* ── CUERPO ── */
#qzBody { padding: 20px 22px 22px; }

/* ── PREGUNTA ── */
#qzQuestion {
  font-size: 16px; font-weight: 700;
  color: #f1f5f9;
  text-align: center; line-height: 1.62;
  margin-bottom: 24px; padding: 0 4px;
}

/* ── OPCIONES ── */
#qzOpts { display:flex; flex-direction:column; gap:9px; margin-bottom:16px; }

.qzOpt {
  display: flex; align-items: center; gap: 13px;
  background: rgba(255,255,255,.035);
  border: 1.5px solid rgba(255,255,255,.08);
  border-radius: 11px;
  padding: 13px 15px;
  cursor: pointer; width: 100%; text-align: left;
  color: #e2e8f0; font-size: 15px; font-family: inherit;
  transition: background .13s, border-color .13s, transform .1s, box-shadow .13s;
  position: relative;
}
.qzOpt:hover:not(:disabled) {
  background: rgba(59,130,246,.1);
  border-color: rgba(59,130,246,.35);
  transform: translateX(3px);
  box-shadow: 0 2px 12px rgba(59,130,246,.12);
}
.qzSel {
  background: rgba(59,130,246,.18) !important;
  border-color: rgba(59,130,246,.7) !important;
  color: #fff !important;
  box-shadow: 0 0 0 1px rgba(59,130,246,.2) !important;
}
.qzGreen {
  background: rgba(34,197,94,.14) !important;
  border-color: rgba(34,197,94,.6) !important;
  color: #fff !important;
  box-shadow: 0 0 12px rgba(34,197,94,.15) !important;
}
.qzRed {
  background: rgba(239,68,68,.12) !important;
  border-color: rgba(239,68,68,.5) !important;
  color: #fca5a5 !important;
}
.qzOpt:disabled { cursor: default; }

.qzLet {
  font-size: 13px; font-weight: 800;
  color: #475569; flex-shrink: 0; min-width: 24px;
}
.qzGreen .qzLet, .qzSel .qzLet { color: #93c5fd; }
.qzRed   .qzLet { color: #f87171; }

.qzOptTxt { flex: 1; font-weight: 500; line-height: 1.4; }

.qzCheckIcon {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(34,197,94,.25);
  display: none; align-items:center; justify-content:center;
  flex-shrink: 0; color: #4ade80;
}
.qzCheckIcon svg { width: 13px; height: 13px; }
.qzGreen .qzCheckIcon { display: flex; }

/* ── FEEDBACK ── */
.qzFbOk, .qzFbKo {
  border-radius: 10px; padding: 13px 16px;
  font-size: 14px; line-height: 1.5;
  margin-bottom: 12px;
  display: flex; align-items: flex-start; gap: 10px;
}
.qzFbOk {
  background: rgba(34,197,94,.1);
  border: 1.5px solid rgba(34,197,94,.3);
  color: #4ade80;
}
.qzFbKo {
  background: rgba(239,68,68,.09);
  border: 1.5px solid rgba(239,68,68,.3);
  color: #f87171;
}
.qzFbIcon { font-size: 18px; flex-shrink: 0; margin-top: 1px; font-weight: 900; }
.qzFbSub  { display: block; font-size: 12.5px; color: #94a3b8; margin-top: 3px; }

/* ── EXPLICACIÓN ── */
#qzExpBox {
  background: rgba(255,255,255,.035);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
}
#qzExpLabel {
  font-size: 12px; font-weight: 700; color: #475569;
  margin-bottom: 8px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  text-transform: uppercase; letter-spacing: .5px;
}
#qzExpText { font-size: 14px; color: #cbd5e1; line-height: 1.68; }

/* ── BOTONES ── */
#qzActions { display:flex; gap:10px; flex-wrap:wrap; margin-top:2px; }
.qzBtnGray, .qzBtnBlue {
  padding: 12px 20px; border-radius: 9px; border: none;
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: inherit; transition: all .14s;
  display: inline-flex; align-items: center; gap: 6px;
}
.qzBtnGray {
  background: rgba(255,255,255,.07);
  color: #94a3b8;
  border: 1px solid rgba(255,255,255,.1);
}
.qzBtnGray:hover { background: rgba(255,255,255,.13); color: #e2e8f0; }
.qzBtnBlue {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff; flex: 1;
  box-shadow: 0 4px 16px rgba(59,130,246,.28);
}
.qzBtnBlue:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,130,246,.35); }
.qzBtnBlue:disabled { opacity: .3; cursor: not-allowed; transform: none; box-shadow: none; }

/* ── RESULTADO FINAL ── */
.qzFinal { text-align:center; padding:12px 0 20px; }
.qzFinalEmoji { font-size:56px; margin-bottom:10px; }
.qzFinalMsg   { font-size:24px; font-weight:800; color:#f1f5f9; margin-bottom:6px; }
.qzFinalMeta  { font-size:13px; color:#64748b; margin-bottom:6px; }
.qzFinalPct   { font-size:54px; font-weight:900; margin:8px 0; }
.qzResHigh .qzFinalPct { color:#22c55e; text-shadow:0 0 30px rgba(34,197,94,.3); }
.qzResMed  .qzFinalPct { color:#f59e0b; text-shadow:0 0 30px rgba(245,158,11,.3); }
.qzResLow  .qzFinalPct { color:#ef4444; text-shadow:0 0 30px rgba(239,68,68,.3); }
.qzFinalBarWrap { height:6px; border-radius:3px; background:rgba(255,255,255,.08); margin:8px auto 14px; max-width:260px; overflow:hidden; }
.qzFinalBar { height:100%; border-radius:3px; background:linear-gradient(90deg,#3b82f6,#818cf8); transition:width 1.3s cubic-bezier(.16,1,.3,1); box-shadow:0 0 8px rgba(99,102,241,.5); }
.qzFinalSub { font-size:13px; color:#64748b; margin-bottom:16px; }

/* ── RESPONSIVE ── */
@media(max-width:560px){
  #qzCard { border-radius:16px; }
  #qzTitleWrap { font-size:17px; letter-spacing:2px; }
  #qzQuestion { font-size:14px; }
  .qzOpt { font-size:13px; padding:11px 12px; }
  #qzActions { flex-direction:column; }
  .qzBtnBlue,.qzBtnGray { justify-content:center; }
  #qzProgRow { font-size:11px; }
}
`;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════
   EXPORTS GLOBALES
══════════════════════════════════════════════════════════════ */
window.renderQuiz       = renderQuiz;
window.launchBlockQuiz  = launchBlockQuiz;
window.qzAbrirDesdeChat = qzAbrirDesdeChat;
window._qzSelect        = _qzSelect;
window._qzValidar       = _qzValidar;
window._qzSiguiente     = _qzSiguiente;
window._qzReintentar    = _qzReintentar;
window._qzReiniciar     = _qzReiniciar;
window._qzCerrar        = _qzCerrar;

/* ── QUIZ MODAL HELPERS ── */

function _mqzErr(msg) {
  const el=document.getElementById('qzModalErr');
  if(el){ el.style.display='block'; el.textContent='⚠️ '+msg; }
}

function _mqzLanzar() {
  const txt=(document.getElementById('qzJsonArea')?.value||'').trim();
  if(!txt){ _mqzErr('Escribe o pega un JSON primero.'); return; }
  try{
    const parsed=JSON.parse(txt);
    closeM('mQuiz');
    if(typeof renderQuiz==='function') renderQuiz(parsed);
  }catch(e){ _mqzErr('JSON inválido: '+e.message); }
}

function _mqzGuardar() {
  const txt=(document.getElementById('qzJsonArea')?.value||'').trim();
  if(!txt){ _mqzErr('Pega un JSON primero.'); return; }
  try{
    let parsed=JSON.parse(txt);
    const quiz=Array.isArray(parsed)?parsed[0]:parsed;
    if(!quiz.pregunta||!Array.isArray(quiz.opciones)||typeof quiz.correcta!=='number')
      throw new Error('Estructura inválida. Necesita: pregunta, opciones, correcta.');
    const data=getModData(CURRENT_MODULE.id);
    const cl=data.classes.find(x=>x.id===_quizCid);
    let b;
    if(_quizWid){const w=cl?.weeks?.find(x=>x.id===_quizWid);b=w?.bloques?.find(x=>x.id===_quizBid);}
    else{b=cl?.bloques?.find(x=>x.id===_quizBid);}
    if(!b) throw new Error('Bloque no encontrado.');
    b.quiz={pregunta:quiz.pregunta,opciones:quiz.opciones,correcta:quiz.correcta};
    if(quiz.explicacion) b.quiz.explicacion=quiz.explicacion;
    const divCtx = window._quizDivCtx;
    window._quizDivCtx = null;
    saveModData(CURRENT_MODULE.id,data);
    closeM('mQuiz'); toast('✓ Quiz guardado','ok');
    if(divCtx){ openDivClass(divCtx.did, divCtx.cid); }
    else { go('cl_'+_quizCid); }
  }catch(e){ _mqzErr(e.message); }
}

/* ── openQuizModal — opens the JSON quiz modal for a block ── */
function openQuizModal(cid, bid, wid) {
  _quizCid = cid; _quizBid = bid;
  if (typeof _quizWid !== 'undefined') _quizWid = wid || null;
  // Pre-fill if quiz exists
  const data = getModData(CURRENT_MODULE.id);
  const cl   = data.classes.find(x => x.id === cid);
  let b;
  if (wid) { const w = cl?.weeks?.find(x => x.id === wid); b = w?.bloques?.find(x => x.id === bid); }
  else     { b = cl?.bloques?.find(x => x.id === bid); }
  const area = document.getElementById('qzJsonArea');
  const errEl= document.getElementById('qzModalErr');
  if (area)  area.value = b?.quiz ? JSON.stringify([b.quiz], null, 2) : '';
  if (errEl) errEl.style.display = 'none';
  openM('mQuiz');
}
