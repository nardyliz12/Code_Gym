// =============================================
//  CodeGym – App Principal
// =============================================

// ---- STATE ----
let state = {
  user: null,
  currentView: 'home',
  practice: {
    nivel: null,
    dificultad: 'all',
    ejercicios: [],
    idx: 0,
    startTime: null,
    selectedAnswer: null,
    dragOrder: [],
    answered: false
  }
};

// ---- LEVELS META ----
const LEVELS_META = [
  { n: 1, icon: '🧠', title: 'Lógica y algoritmos', desc: 'Pensamiento computacional básico', xpReq: 0 },
  { n: 2, icon: '📥', title: 'Entrada, salida y datos', desc: 'print(), input() y tipos de datos', xpReq: 0 },
  { n: 3, icon: '🔀', title: 'Condicionales', desc: 'if, elif, else y operadores lógicos', xpReq: 50 },
  { n: 4, icon: '🔄', title: 'Bucles', desc: 'for, while y range()', xpReq: 150 },
  { n: 5, icon: '🚀', title: 'Mini proyectos', desc: 'Funciones y ejercicios integradores', xpReq: 350 }
];

const TIPO_LABELS = {
  opcion_multiple: 'Opción múltiple',
  completar: 'Completar código',
  ordenar: 'Ordenar sentencias',
  escribir: 'Escribir desde cero'
};

// ---- DOM HELPERS ----
const $ = id => document.getElementById(id);
const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };
const show = id => { const el = $(id); if (el) el.classList.remove('hidden'); };
const hide = id => { const el = $(id); if (el) el.classList.add('hidden'); };

// ============================
//  INIT
// ============================
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('cg_token');
  if (token) {
    API.me()
      .then(user => { state.user = user; showApp(); })
      .catch(() => { localStorage.removeItem('cg_token'); showAuth(); });
  } else {
    showAuth();
  }

  bindAuthEvents();
  bindNavEvents();
  bindPracticeEvents();
  bindModalEvents();
});

// ============================
//  AUTH
// ============================
function showAuth() {
  $('screen-auth').classList.add('active');
  $('screen-app').classList.remove('active');
}

function showApp() {
  $('screen-auth').classList.remove('active');
  $('screen-app').classList.add('active');
  updateNavStats();
  loadView('home');
}

function bindAuthEvents() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });
  document.querySelectorAll('.auth-hint a').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); switchAuthTab(a.dataset.tab); });
  });

  // Login
  $('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    hide('login-error');
    const email = $('login-email').value.trim();
    const pass = $('login-pass').value;
    try {
      const { token, user } = await API.login(email, pass);
      localStorage.setItem('cg_token', token);
      state.user = user;
      showApp();
    } catch (err) {
      show('login-error');
      $('login-error').textContent = err.message;
    }
  });

  // Register
  $('form-register').addEventListener('submit', async e => {
    e.preventDefault();
    hide('reg-error');
    const nombre = $('reg-nombre').value.trim();
    const email = $('reg-email').value.trim();
    const pass = $('reg-pass').value;
    if (pass.length < 6) {
      show('reg-error'); $('reg-error').textContent = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }
    try {
      const { token, user } = await API.register(nombre, email, pass);
      localStorage.setItem('cg_token', token);
      state.user = user;
      showApp();
    } catch (err) {
      show('reg-error');
      $('reg-error').textContent = err.message;
    }
  });
}

function switchAuthTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `form-${tab}`));
}

// ============================
//  NAVIGATION
// ============================
function bindNavEvents() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeHamburger();
      loadView(btn.dataset.view);
    });
  });

  $('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('cg_token');
    state.user = null;
    showAuth();
  });

  $('hamburger').addEventListener('click', () => {
    $('hamburger').closest('.navbar').querySelector('.nav-menu').classList.toggle('open');
  });
}

function closeHamburger() {
  document.querySelector('.nav-menu')?.classList.remove('open');
}

function loadView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));

  const view = $(`view-${viewName}`);
  if (view) view.classList.add('active');

  if (viewName === 'home') renderHome();
  if (viewName === 'progress') renderProgress();
  if (viewName === 'leaderboard') renderLeaderboard();
}

// ============================
//  HOME VIEW
// ============================
function renderHome() {
  const u = state.user;
  if (!u) return;

  setText('hero-nombre', u.nombre.split(' ')[0]);
  setText('hero-racha', u.racha || 0);
  setText('home-racha', u.racha || 0);
  setText('home-xp', u.xp || 0);
  setText('home-nivel', u.nivel || 1);
  setText('home-vidas', u.vidas !== undefined ? u.vidas : 5);
  setText('xp-nivel-actual', u.nivel || 1);
  setText('xp-actual', u.xp || 0);

  // XP bar
  const xpThresholds = [0, 100, 300, 600, 1000, 99999];
  const nivel = u.nivel || 1;
  const xpMin = xpThresholds[nivel - 1];
  const xpMax = xpThresholds[nivel];
  setText('xp-siguiente', xpMax >= 99999 ? '∞' : xpMax);
  const pct = xpMax >= 99999 ? 100 : Math.min(100, ((u.xp - xpMin) / (xpMax - xpMin)) * 100);
  $('xp-bar-fill').style.width = pct + '%';

  // Levels grid
  const grid = $('levels-grid');
  grid.innerHTML = LEVELS_META.map(lm => {
    const locked = (u.xp || 0) < lm.xpReq;
    return `
      <div class="level-card ${locked ? 'locked' : ''}" data-nivel="${lm.n}" ${locked ? '' : 'onclick="openLevelSelect(' + lm.n + ')"'}>
        <div class="level-badge">${lm.icon}</div>
        <div class="level-num">0${lm.n}</div>
        <div class="level-title">${lm.title}</div>
        <div class="level-desc">${lm.desc}</div>
        ${locked ? `<div class="level-desc" style="color:var(--yellow);margin-top:6px">🔒 Requiere ${lm.xpReq} XP</div>` : ''}
      </div>
    `;
  }).join('');

  // Insignias
  const ins = u.insignias || [];
  if (ins.length === 0) {
    $('insignias-grid').innerHTML = '<p class="empty-msg">Completa ejercicios para ganar insignias ✨</p>';
  } else {
    $('insignias-grid').innerHTML = ins.map(i =>
      `<div class="insignia-chip">${i.nombre}</div>`
    ).join('');
  }
}

function updateNavStats() {
  const u = state.user;
  if (!u) return;
  setText('nav-racha', u.racha || 0);
  setText('nav-vidas', u.vidas !== undefined ? u.vidas : 5);
  setText('nav-xp', u.xp || 0);
}

// ============================
//  LEVEL SELECT
// ============================
function openLevelSelect(nivel) {
  state.practice.nivel = nivel;
  const meta = LEVELS_META.find(l => l.n === nivel);
  $('modal-level-title').textContent = `${meta.icon} Nivel ${nivel}: ${meta.title}`;
  $('modal-level-select').classList.remove('hidden');
}

function bindPracticeEvents() {
  $('close-level-select').addEventListener('click', () => {
    $('modal-level-select').classList.add('hidden');
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('modal-level-select').classList.add('hidden');
      startPractice(state.practice.nivel, btn.dataset.diff);
    });
  });

  $('btn-back-levels').addEventListener('click', () => loadView('home'));
}

// ============================
//  PRACTICE
// ============================
async function startPractice(nivel, dificultad) {
  try {
    let ejercicios = await API.getExercisesByNivel(nivel);
    if (dificultad !== 'all') {
      ejercicios = ejercicios.filter(e => e.dificultad === dificultad);
    }
    if (ejercicios.length === 0) {
      showModal('😅', 'Sin ejercicios', 'No hay ejercicios disponibles para esta combinación.', false);
      return;
    }
    // Shuffle
    ejercicios = ejercicios.sort(() => Math.random() - 0.5);

    state.practice = { nivel, dificultad, ejercicios, idx: 0, startTime: Date.now(), selectedAnswer: null, dragOrder: [], answered: false };
    loadView('practice');
    updatePracticeHeader();
    renderExercise();
  } catch (err) {
    alert('Error cargando ejercicios: ' + err.message);
  }
}

function updatePracticeHeader() {
  const { nivel, ejercicios, idx } = state.practice;
  const meta = LEVELS_META.find(l => l.n === nivel);
  $('prac-nivel-label').textContent = `${meta.icon} Nivel ${nivel}`;
  $('prac-ejercicio-num').textContent = `Ejercicio ${idx + 1} de ${ejercicios.length}`;
  updateLivesDisplay();
}

function updateLivesDisplay() {
  const vidas = state.user?.vidas ?? 5;
  $('lives-display').textContent = '❤️'.repeat(Math.max(0, vidas)) + '🖤'.repeat(Math.max(0, 5 - vidas));
}

function renderExercise() {
  const { ejercicios, idx } = state.practice;
  const ej = ejercicios[idx];
  if (!ej) return;

  state.practice.startTime = Date.now();
  state.practice.selectedAnswer = null;
  state.practice.answered = false;

  const difClass = `badge-dif-${ej.dificultad}`;
  let bodyHTML = '';

  if (ej.tipo === 'opcion_multiple' || ej.tipo === 'completar') {
    bodyHTML = `
      <div class="options-grid">
        ${ej.opciones.map((op, i) => `
          <button class="option-btn" data-val="${op.split(')')[0].trim()}" onclick="selectOption(this)">
            ${op}
          </button>
        `).join('')}
      </div>
    `;
  } else if (ej.tipo === 'ordenar') {
    const items = [...ej.items];
    const shuffled = items.map((t, i) => ({ t, orig: i })).sort(() => Math.random() - 0.5);
    state.practice.dragOrder = shuffled.map(x => x.orig);
    bodyHTML = `
      <p style="font-size:0.85rem;color:var(--white-dim);margin-bottom:12px">Arrastra para ordenar los pasos:</p>
      <ul class="sortable-list" id="sortable-list">
        ${shuffled.map((item, i) => `
          <li class="sortable-item" draggable="true" data-orig="${item.orig}">
            <span class="drag-handle">⠿</span>
            <span class="item-num">${i + 1}</span>
            <span>${item.t}</span>
          </li>
        `).join('')}
      </ul>
    `;
  } else if (ej.tipo === 'escribir') {
    bodyHTML = `
      <button class="pista-btn" onclick="togglePista(this, '${escapePista(ej.pista)}')">💡 Ver pista</button>
      <div class="pista-box hidden"></div>
      <textarea class="write-area" id="write-input" placeholder="Escribe tu código aquí..." spellcheck="false"></textarea>
    `;
  }

  $('exercise-container').innerHTML = `
    <div class="exercise-card">
      <div class="exercise-meta">
        <span class="badge-tipo">${TIPO_LABELS[ej.tipo] || ej.tipo}</span>
        <span class="badge-dif ${difClass}">${ej.dificultad}</span>
        <span class="badge-xp">+${ej.xp} XP</span>
      </div>
      <div class="exercise-title">${ej.titulo}</div>
      <div class="exercise-enunciado">${ej.enunciado}</div>
      ${bodyHTML}
      ${ej.tipo !== 'ordenar' && ej.tipo !== 'opcion_multiple' && ej.tipo !== 'completar' ? '' : ''}
      <div class="exercise-actions">
        ${ej.tipo === 'opcion_multiple' || ej.tipo === 'completar'
          ? `<button class="btn-primary" onclick="submitAnswer()" id="btn-submit" disabled>Verificar respuesta</button>`
          : ej.tipo === 'escribir'
          ? `<button class="btn-primary" onclick="submitWriteAnswer()">Verificar respuesta</button>`
          : `<button class="btn-primary" onclick="submitOrderAnswer()">Verificar orden</button>`
        }
        ${ej.tipo !== 'opcion_multiple' && ej.tipo !== 'completar'
          ? `<button class="pista-btn" style="margin-bottom:0" onclick="togglePista(this, '${escapePista(ej.pista)}')">💡 Pista</button>`
          : ''
        }
      </div>
      <div id="feedback-box" class="hidden" style="margin-top:16px;"></div>
    </div>
  `;

  if (ej.tipo === 'ordenar') initDragDrop();
}

function escapePista(t) {
  return (t || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function togglePista(btn, pista) {
  // Find pista-box: sibling or parent search
  let box = btn.nextElementSibling;
  if (!box || !box.classList.contains('pista-box')) {
    box = btn.closest('.exercise-card')?.querySelector('.pista-box');
  }
  if (!box) return;
  if (box.classList.contains('hidden')) {
    box.textContent = '💡 ' + pista;
    box.classList.remove('hidden');
    btn.textContent = '🙈 Ocultar pista';
  } else {
    box.classList.add('hidden');
    btn.textContent = '💡 Ver pista';
  }
}

function selectOption(btn) {
  if (state.practice.answered) return;
  document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.practice.selectedAnswer = btn.dataset.val;
  const submitBtn = $('btn-submit');
  if (submitBtn) submitBtn.disabled = false;
}

async function submitAnswer() {
  const { ejercicios, idx, selectedAnswer, startTime } = state.practice;
  const ej = ejercicios[idx];
  if (!selectedAnswer || state.practice.answered) return;
  state.practice.answered = true;

  const tiempoSegundos = Math.round((Date.now() - startTime) / 1000);

  try {
    const result = await API.verifyAnswer(ej.id, selectedAnswer, tiempoSegundos);
    await handleResult(result, ej, tiempoSegundos);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function submitWriteAnswer() {
  const { ejercicios, idx, startTime } = state.practice;
  const ej = ejercicios[idx];
  const respuesta = $('write-input')?.value || '';
  if (!respuesta.trim()) { alert('Escribe tu respuesta primero'); return; }
  if (state.practice.answered) return;
  state.practice.answered = true;

  const tiempoSegundos = Math.round((Date.now() - startTime) / 1000);
  try {
    const result = await API.verifyAnswer(ej.id, respuesta, tiempoSegundos);
    await handleResult(result, ej, tiempoSegundos);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function submitOrderAnswer() {
  const { ejercicios, idx, startTime } = state.practice;
  const ej = ejercicios[idx];
  if (state.practice.answered) return;
  state.practice.answered = true;

  // Get current order from DOM
  const items = document.querySelectorAll('#sortable-list .sortable-item');
  const order = Array.from(items).map(li => parseInt(li.dataset.orig));

  const tiempoSegundos = Math.round((Date.now() - startTime) / 1000);
  try {
    const result = await API.verifyAnswer(ej.id, order, tiempoSegundos);
    await handleResult(result, ej, tiempoSegundos);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function handleResult(result, ej, tiempoSegundos) {
  // Mark option buttons
  if (ej.tipo === 'opcion_multiple' || ej.tipo === 'completar') {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = true;
      if (result.correcto && btn.classList.contains('selected')) btn.classList.add('correct');
      if (!result.correcto && btn.classList.contains('selected')) btn.classList.add('wrong');
    });
  }

  // Show inline feedback
  const fb = $('feedback-box');
  if (fb) {
    fb.classList.remove('hidden');
    fb.style.background = result.correcto ? 'rgba(79,255,176,0.1)' : 'rgba(255,79,109,0.1)';
    fb.style.border = `1px solid ${result.correcto ? 'var(--green)' : 'var(--red)'}`;
    fb.style.borderRadius = 'var(--radius-sm)';
    fb.style.padding = '14px 16px';
    fb.style.fontSize = '0.92rem';
    fb.style.lineHeight = '1.6';
    fb.innerHTML = `<strong>${result.correcto ? '✅' : '❌'}</strong> ${result.feedback || ''}
      ${!result.correcto && result.respuestaCorrecta ? `<br/><br/><strong>Respuesta correcta:</strong> <code style="color:var(--green)">${result.respuestaCorrecta}</code>` : ''}
    `;
  }

  // Save progress
  try {
    const saved = await API.saveProgress(ej.id, result.correcto, result.xpGanado, tiempoSegundos, ej.nivel);
    // Update state.user
    if (saved.nuevoXP !== undefined) {
      state.user.xp = saved.nuevoXP;
      state.user.nivel = saved.nuevoNivel;
      state.user.insignias = saved.nuevasInsignias || state.user.insignias;
    }
    if (saved.vidas !== undefined) {
      state.user.vidas = saved.vidas;
    }
    updateNavStats();
    updateLivesDisplay();

    // Check game over
    if (!result.correcto && state.user.vidas === 0) {
      setTimeout(() => {
        showModal('💀', '¡Sin vidas!', 'Te quedaste sin vidas. ¡Descansa y vuelve mañana para recuperarlas!', false, () => loadView('home'));
      }, 1200);
      return;
    }
  } catch (e) { /* non-critical */ }

  // Auto advance after 1.8s
  setTimeout(() => showNextButton(), 1600);
}

function showNextButton() {
  const { ejercicios, idx } = state.practice;
  const isLast = idx >= ejercicios.length - 1;

  showModal(
    isLast ? '🎉' : (state.practice.answered ? '➡️' : '➡️'),
    isLast ? '¡Nivel completado!' : 'Siguiente ejercicio',
    isLast
      ? `Completaste todos los ejercicios de este nivel. ¡Excelente trabajo! Has ganado XP y avanzado en tu camino.`
      : `Ejercicio ${idx + 1} de ${ejercicios.length} completado.`,
    true,
    () => {
      if (isLast) {
        loadView('home');
        API.me().then(u => { state.user = u; updateNavStats(); renderHome(); }).catch(() => {});
      } else {
        state.practice.idx++;
        updatePracticeHeader();
        renderExercise();
      }
    }
  );
}

// ============================
//  DRAG & DROP (Ordenar)
// ============================
function initDragDrop() {
  const list = $('sortable-list');
  if (!list) return;
  let dragging = null;

  list.addEventListener('dragstart', e => {
    dragging = e.target.closest('.sortable-item');
    if (dragging) dragging.classList.add('dragging');
  });
  list.addEventListener('dragend', () => {
    if (dragging) dragging.classList.remove('dragging');
    dragging = null;
    // Update numbers
    list.querySelectorAll('.sortable-item .item-num').forEach((el, i) => el.textContent = i + 1);
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const afterEl = getDragAfterElement(list, e.clientY);
    if (!dragging) return;
    if (afterEl) list.insertBefore(dragging, afterEl);
    else list.appendChild(dragging);
  });
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
  return els.reduce((closest, el) => {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: el };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ============================
//  PROGRESS VIEW
// ============================
async function renderProgress() {
  setHTML('progress-content', '<div class="loading-spinner">Cargando estadísticas...</div>');
  try {
    const stats = await API.getProgress();
    const pct = stats.totalEjercicios > 0 ? Math.round((stats.correctos / stats.totalEjercicios) * 100) : 0;

    let html = `
      <div class="progress-grid">
        <div class="progress-card"><div class="big-num">${stats.totalEjercicios}</div><div class="lbl">Ejercicios totales</div></div>
        <div class="progress-card"><div class="big-num" style="color:var(--green)">${stats.correctos}</div><div class="lbl">Correctos</div></div>
        <div class="progress-card"><div class="big-num" style="color:var(--red)">${stats.incorrectos}</div><div class="lbl">Incorrectos</div></div>
        <div class="progress-card"><div class="big-num">${pct}%</div><div class="lbl">Precisión</div></div>
        <div class="progress-card"><div class="big-num">${stats.xpTotal}</div><div class="lbl">XP Total</div></div>
        <div class="progress-card"><div class="big-num">${stats.racha}</div><div class="lbl">Racha actual</div></div>
        <div class="progress-card"><div class="big-num">${stats.rachaMax}</div><div class="lbl">Racha máxima</div></div>
        <div class="progress-card"><div class="big-num">${stats.insignias.length}</div><div class="lbl">Insignias</div></div>
      </div>

      <h2 class="section-title">📈 Progreso por Nivel</h2>
      <table class="level-stats-table">
        <thead><tr><th>Nivel</th><th>Ejercicios</th><th>Correctos</th><th>Avance</th><th>%</th></tr></thead>
        <tbody>
          ${LEVELS_META.map(lm => {
            const ln = stats.porNivel[lm.n] || { intentos: 0, correctos: 0 };
            const p = ln.intentos > 0 ? Math.round((ln.correctos / ln.intentos) * 100) : 0;
            return `<tr>
              <td>${lm.icon} Nivel ${lm.n}: ${lm.title}</td>
              <td>${ln.intentos}</td>
              <td>${ln.correctos}</td>
              <td><div class="mini-bar-wrap"><div class="mini-bar" style="width:${p}%"></div></div></td>
              <td>${p}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      ${stats.insignias.length > 0 ? `
        <h2 class="section-title">🏅 Insignias obtenidas</h2>
        <div class="insignias-grid">
          ${stats.insignias.map(i => `<div class="insignia-chip">${i.nombre}</div>`).join('')}
        </div>
      ` : ''}
    `;
    setHTML('progress-content', html);
  } catch (err) {
    setHTML('progress-content', `<p style="color:var(--red)">Error: ${err.message}</p>`);
  }
}

// ============================
//  LEADERBOARD
// ============================
async function renderLeaderboard() {
  setHTML('leaderboard-content', '<div class="loading-spinner">Cargando ranking...</div>');
  try {
    const tabla = await API.getLeaderboard();
    const medals = ['🥇', '🥈', '🥉'];

    let html = `
      <table class="leaderboard-table">
        <thead><tr><th>#</th><th>Estudiante</th><th>Nivel</th><th>XP</th><th>Racha</th><th>Insignias</th></tr></thead>
        <tbody>
          ${tabla.map((row, i) => {
            const isMe = row.id === state.user?.id;
            const rankLabel = i < 3 ? medals[i] : (i + 1);
            const rankClass = i < 3 ? `rank-${i+1}` : '';
            return `<tr class="${isMe ? 'me' : ''}">
              <td class="rank ${rankClass}">${rankLabel}</td>
              <td>${row.nombre}${isMe ? ' <em style="color:var(--green);font-size:0.78rem">(tú)</em>' : ''}</td>
              <td>Nivel ${row.nivel}</td>
              <td class="xp-td">${row.xp}</td>
              <td>🔥 ${row.racha}</td>
              <td>🏅 ${row.insignias}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${tabla.length === 0 ? '<p class="empty-msg" style="padding:24px">Sé el primero en el ranking. ¡Empieza a practicar!</p>' : ''}
    `;
    setHTML('leaderboard-content', html);
  } catch (err) {
    setHTML('leaderboard-content', `<p style="color:var(--red)">Error: ${err.message}</p>`);
  }
}

// ============================
//  MODALS
// ============================
let _modalCallback = null;

function showModal(icon, title, body, showNext = true, callback = null) {
  _modalCallback = callback;
  $('modal-icon').textContent = icon;
  $('modal-title').textContent = title;
  $('modal-body').textContent = body;
  $('modal-btn-next').textContent = showNext ? 'Continuar →' : 'Cerrar';
  $('modal-overlay').classList.remove('hidden');
}

function bindModalEvents() {
  $('modal-btn-next').addEventListener('click', () => {
    $('modal-overlay').classList.add('hidden');
    if (_modalCallback) { _modalCallback(); _modalCallback = null; }
  });
}
