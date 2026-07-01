const express = require('express');
const { findOne, findAll, insert, update, readDB } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');
const { calcularNivel, calcularInsignias, syncUserAchievements } = require('../utils/achievements');
const { syncTimeBasedStreak } = require('../utils/streak');

const router = express.Router();
const LIFE_COOLDOWN_MINUTES = Number(process.env.LIFE_COOLDOWN_MINUTES || 20);
const LIFE_COOLDOWN_MS = LIFE_COOLDOWN_MINUTES * 60 * 1000;

function hasCompletedLevel(userId, level) {
  const exercises = readDB('exercises').filter(e => e.nivel === level);
  if (exercises.length === 0) return false;

  const solved = new Set(
    findAll('progress', p => p.userId === userId && p.correcto && p.nivelEjercicio === level)
      .map(p => p.ejercicioId)
  );

  return exercises.every(e => solved.has(e.id));
}

function getLivesRestoreAt() {
  return new Date(Date.now() + LIFE_COOLDOWN_MS).toISOString();
}

function ensureLifeState(user) {
  if (!user) return null;

  const restoreAt = user.vidasRestauranEn ? new Date(user.vidasRestauranEn).getTime() : null;
  const now = Date.now();

  if (user.vidas === 0 && restoreAt && restoreAt <= now) {
    const restored = update('users', u => u.id === user.id, {
      vidas: 5,
      vidasRestauranEn: null
    });
    return restored || { ...user, vidas: 5, vidasRestauranEn: null };
  }

  if (user.vidas > 0 && user.vidasRestauranEn) {
    const cleared = update('users', u => u.id === user.id, {
      vidasRestauranEn: null
    });
    return cleared || { ...user, vidasRestauranEn: null };
  }

  return user;
}

function buildExerciseStatusMap(userId) {
  const attempts = findAll('progress', p => p.userId === userId);
  return attempts.reduce((acc, item) => {
    if (!acc[item.ejercicioId]) {
      acc[item.ejercicioId] = {
        intentos: 0,
        correcto: false,
        incorrectos: 0,
        xpOtorgado: 0,
        ultimoResultado: null,
        ultimaFecha: null,
        primerAciertoFecha: null
      };
    }

    const entry = acc[item.ejercicioId];
    entry.intentos += 1;
    entry.ultimaFecha = item.fecha;
    entry.ultimoResultado = item.correcto ? 'correcto' : 'incorrecto';

    if (item.correcto) {
      entry.correcto = true;
      entry.xpOtorgado = Math.max(entry.xpOtorgado, item.xpGanado || 0);
      entry.primerAciertoFecha = entry.primerAciertoFecha || item.fecha;
    } else {
      entry.incorrectos += 1;
    }

    return acc;
  }, {});
}

function inferConcept(exercise = {}) {
  const text = `${exercise.titulo || ''} ${exercise.enunciado || ''}`.toLowerCase();
  if (/bucle|for|while|range/.test(text)) return 'Bucles';
  if (/condicional|if|elif|else/.test(text)) return 'Condicionales';
  if (/funcion|def\s|método|metodo/.test(text)) return 'Funciones';
  if (/arreglo|lista|vector|matriz/.test(text)) return 'Arreglos';
  if (/algoritmo|lógica|logica/.test(text)) return 'Lógica y algoritmos';
  return `Nivel ${exercise.nivel || '?'}`;
}

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function formatWeekLabel(date) {
  return new Date(date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
}

function buildSmartInsights(progreso, statusByExercise, exercisesById, user) {
  const attempts = [...progreso].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const avgTime = attempts.length > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (Number(a.tiempoSegundos) || 0), 0) / attempts.length)
    : 0;

  const byLevel = {};
  attempts.forEach(a => {
    const level = a.nivelEjercicio || exercisesById[a.ejercicioId]?.nivel || 0;
    if (!byLevel[level]) byLevel[level] = { nivel: level, intentos: 0, tiempoTotal: 0 };
    byLevel[level].intentos += 1;
    byLevel[level].tiempoTotal += Number(a.tiempoSegundos) || 0;
  });

  const tiempoPorNivel = Object.values(byLevel)
    .filter(item => item.nivel > 0)
    .map(item => ({
      nivel: item.nivel,
      intentos: item.intentos,
      promedioSegundos: Math.round(item.tiempoTotal / item.intentos)
    }))
    .sort((a, b) => a.nivel - b.nivel);

  const sixWeeksAgo = weekStart(new Date(Date.now() - 6 * 7 * 24 * 60 * 60 * 1000));
  const weeklyMap = {};
  attempts.forEach(a => {
    const w = weekStart(a.fecha);
    if (w < sixWeeksAgo) return;
    const key = w.toISOString();
    if (!weeklyMap[key]) weeklyMap[key] = { weekStart: key, intentos: 0, correctos: 0 };
    weeklyMap[key].intentos += 1;
    if (a.correcto) weeklyMap[key].correctos += 1;
  });

  const curvaEvolucion = Object.values(weeklyMap)
    .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
    .map(item => ({
      semana: formatWeekLabel(item.weekStart),
      intentos: item.intentos,
      precision: item.intentos > 0 ? Math.round((item.correctos / item.intentos) * 100) : 0
    }));

  const concepts = {};
  Object.entries(statusByExercise).forEach(([exerciseId, status]) => {
    if (status.incorrectos <= 0) return;
    const exercise = exercisesById[exerciseId] || {};
    const concept = inferConcept(exercise);
    if (!concepts[concept]) concepts[concept] = { concepto: concept, fallos: 0, intentos: 0, pendiente: 0 };
    concepts[concept].fallos += status.incorrectos;
    concepts[concept].intentos += status.intentos;
    if (!status.correcto) concepts[concept].pendiente += 1;
  });

  const conceptosCriticos = Object.values(concepts)
    .filter(c => c.fallos >= 2 || c.pendiente > 0)
    .sort((a, b) => b.fallos - a.fallos)
    .slice(0, 4);

  const recientes = attempts.slice(-10);
  const precisionReciente = recientes.length > 0
    ? Math.round((recientes.filter(a => a.correcto).length / recientes.length) * 100)
    : 100;

  const preventivas = [];
  if (recientes.length >= 6 && precisionReciente < 55) {
    preventivas.push(`La precisión reciente bajó a ${precisionReciente}%. Se recomienda intervención del tutor.`);
  }
  if ((user.vidas || 0) <= 1) {
    preventivas.push('El estudiante está al límite de vidas. Se sugiere pausa guiada y refuerzo dirigido.');
  }
  if ((user.racha || 0) === 0 && (user.rachaMax || 0) >= 3) {
    preventivas.push('Se detectó racha rota tras un buen histórico. Conviene reenganche temprano.');
  }
  if (conceptosCriticos.some(c => c.pendiente > 0)) {
    preventivas.push('Hay conceptos con errores repetidos aún no corregidos. Priorizar práctica focalizada.');
  }

  const riesgo = preventivas.length >= 3 ? 'alto' : preventivas.length >= 1 ? 'medio' : 'bajo';

  return {
    diagnostico: {
      tiempoPromedioSegundos: avgTime,
      tiempoPorNivel,
      curvaEvolucion
    },
    alertas: {
      conceptosCriticos,
      preventivas,
      riesgo
    }
  };
}

// GET /api/progress - progreso del usuario
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const progreso = findAll('progress', p => p.userId === userId);
  let user = ensureLifeState(findOne('users', u => u.id === userId));
  const syncedUser = syncUserAchievements(user, { completoNivel5: hasCompletedLevel(userId, 5) });
  if (syncedUser?.achievementsChanged || (syncedUser && syncedUser.nivel !== user?.nivel)) {
    user = update('users', u => u.id === userId, {
      nivel: syncedUser.nivel,
      insignias: syncedUser.insignias
    }) || syncedUser;
  } else {
    user = syncedUser;
  }
  const statusByExercise = buildExerciseStatusMap(userId);
  const exercisesById = readDB('exercises').reduce((acc, exercise) => {
    acc[exercise.id] = exercise;
    return acc;
  }, {});

  const stats = {
    totalEjercicios: progreso.length,
    correctos: progreso.filter(p => p.correcto).length,
    incorrectos: progreso.filter(p => !p.correcto).length,
    xpTotal: user ? user.xp : 0,
    racha: user ? user.racha : 0,
    rachaMax: user ? user.rachaMax : 0,
    nivel: user ? user.nivel : 1,
    vidas: user ? user.vidas : 5,
    vidasRestauranEn: user ? user.vidasRestauranEn || null : null,
    insignias: user ? user.insignias : [],
    porNivel: {},
    historialFallos: Object.entries(statusByExercise)
      .filter(([, value]) => value.incorrectos > 0)
      .map(([ejercicioId, value]) => ({
        ejercicioId,
        titulo: exercisesById[ejercicioId]?.titulo || ejercicioId,
        dificultad: exercisesById[ejercicioId]?.dificultad || null,
        nivelEjercicio: exercisesById[ejercicioId]?.nivel || null,
        ...value
      }))
      .sort((a, b) => new Date(b.ultimaFecha || 0) - new Date(a.ultimaFecha || 0)),
    estadoEjercicios: statusByExercise
  };

  stats.seguimientoInteligente = buildSmartInsights(progreso, statusByExercise, exercisesById, user || {});

  // Agrupar por nivel
  for (let n = 1; n <= 5; n++) {
    const del_nivel = progreso.filter(p => p.nivelEjercicio === n);
    const resueltosUnicos = new Set(del_nivel.filter(p => p.correcto).map(p => p.ejercicioId)).size;
    stats.porNivel[n] = {
      intentos: del_nivel.length,
      correctos: del_nivel.filter(p => p.correcto).length,
      resueltosUnicos
    };
  }

  res.json(stats);
});

// POST /api/progress - guardar resultado de ejercicio
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { ejercicioId, correcto, xpGanado, tiempoSegundos, nivelEjercicio } = req.body;
    const currentUser = ensureLifeState(findOne('users', u => u.id === userId));
    const user = syncTimeBasedStreak(currentUser);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (currentUser && (user.racha !== currentUser.racha || user.rachaActualizadaEn !== currentUser.rachaActualizadaEn)) {
      update('users', u => u.id === userId, {
        racha: user.racha,
        rachaActualizadaEn: user.rachaActualizadaEn,
        rachaMax: Math.max(currentUser.rachaMax || 0, user.racha)
      });
    }

    if (user.vidas === 0) {
      return res.json({
        bloqueado: true,
        vidas: 0,
        vidasRestauranEn: user.vidasRestauranEn || getLivesRestoreAt(),
        xpGanadoReal: 0,
        ejercicioYaCompletado: false
      });
    }

    const yaCompletado = findOne('progress', p => p.userId === userId && p.ejercicioId === ejercicioId && p.correcto);
    const xpReal = correcto && !yaCompletado ? (xpGanado || 0) : 0;

    const registro = {
      id: Date.now().toString(),
      userId,
      ejercicioId,
      correcto,
      xpGanado: xpReal,
      tiempoSegundos,
      nivelEjercicio,
      fecha: new Date().toISOString()
    };
    insert('progress', registro);

    if (user && correcto) {
      const nuevoXP = user.xp + xpReal;
      const nuevoNivel = calcularNivel(nuevoXP);
      const nuevasInsignias = calcularInsignias(
        user,
        nuevoXP,
        nuevoNivel,
        user.racha || 0,
        hasCompletedLevel(userId, 5)
      );

      // Restaurar vidas al subir de nivel
      const subiNivel = nuevoNivel > user.nivel;

      update('users', u => u.id === userId, {
        xp: nuevoXP,
        nivel: nuevoNivel,
        insignias: nuevasInsignias,
        racha: user.racha,
        rachaMax: Math.max(user.rachaMax || 0, user.racha || 0),
        rachaActualizadaEn: user.rachaActualizadaEn,
        vidas: subiNivel ? 5 : Math.min(5, user.vidas),
        vidasRestauranEn: subiNivel ? null : user.vidasRestauranEn || null
      });

      res.json({
        registro,
        nuevoXP,
        nuevoNivel,
        nuevasInsignias,
        subiNivel,
        xpGanadoReal: xpReal,
        ejercicioYaCompletado: Boolean(yaCompletado),
        vidas: subiNivel ? 5 : user.vidas,
        vidasRestauranEn: subiNivel ? null : user.vidasRestauranEn || null,
        racha: user.racha,
        rachaMax: Math.max(user.rachaMax || 0, user.racha || 0),
        rachaActualizadaEn: user.rachaActualizadaEn
      });
    } else if (user && !correcto) {
      // Perder vida
      const nuevasVidas = Math.max(0, user.vidas - 1);
      const vidasRestauranEn = nuevasVidas === 0 ? getLivesRestoreAt() : null;
      update('users', u => u.id === userId, {
        vidas: nuevasVidas,
        vidasRestauranEn,
        racha: user.racha,
        rachaMax: Math.max(user.rachaMax || 0, user.racha || 0),
        rachaActualizadaEn: user.rachaActualizadaEn
      });
      res.json({
        registro,
        vidas: nuevasVidas,
        vidasRestauranEn,
        xpGanadoReal: 0,
        ejercicioYaCompletado: Boolean(yaCompletado),
        racha: user.racha,
        rachaMax: Math.max(user.rachaMax || 0, user.racha || 0),
        rachaActualizadaEn: user.rachaActualizadaEn
      });
    } else {
      res.json({
        registro,
        xpGanadoReal: 0,
        ejercicioYaCompletado: Boolean(yaCompletado),
        racha: user.racha,
        rachaMax: Math.max(user.rachaMax || 0, user.racha || 0),
        rachaActualizadaEn: user.rachaActualizadaEn
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
