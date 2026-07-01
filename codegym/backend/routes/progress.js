const express = require('express');
const { findOne, findAll, insert, update, readDB } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');
const { calcularNivel, calcularInsignias, syncUserAchievements } = require('../utils/achievements');

const router = express.Router();
const LIFE_COOLDOWN_MINUTES = Number(process.env.LIFE_COOLDOWN_MINUTES || 20);
const LIFE_COOLDOWN_MS = LIFE_COOLDOWN_MINUTES * 60 * 1000;

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

// GET /api/progress - progreso del usuario
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const progreso = findAll('progress', p => p.userId === userId);
  let user = ensureLifeState(findOne('users', u => u.id === userId));
  const syncedUser = syncUserAchievements(user);
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
    let user = ensureLifeState(findOne('users', u => u.id === userId));

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
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
      const nuevasInsignias = calcularInsignias(user, nuevoXP, nuevoNivel);

      // Restaurar vidas al subir de nivel
      const subiNivel = nuevoNivel > user.nivel;

      update('users', u => u.id === userId, {
        xp: nuevoXP,
        nivel: nuevoNivel,
        insignias: nuevasInsignias,
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
        vidasRestauranEn: subiNivel ? null : user.vidasRestauranEn || null
      });
    } else if (user && !correcto) {
      // Perder vida
      const nuevasVidas = Math.max(0, user.vidas - 1);
      const vidasRestauranEn = nuevasVidas === 0 ? getLivesRestoreAt() : null;
      update('users', u => u.id === userId, { vidas: nuevasVidas, vidasRestauranEn });
      res.json({
        registro,
        vidas: nuevasVidas,
        vidasRestauranEn,
        xpGanadoReal: 0,
        ejercicioYaCompletado: Boolean(yaCompletado)
      });
    } else {
      res.json({ registro, xpGanadoReal: 0, ejercicioYaCompletado: Boolean(yaCompletado) });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
