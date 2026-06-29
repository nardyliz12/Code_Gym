const express = require('express');
const { findOne, findAll, insert, update, upsert } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Restaurar vidas y actualizar racha cada 20 minutos (simulación)
setInterval(() => {
  const { findAll, update } = require('../middleware/db');
  const users = findAll('users', () => true);
  const ahora = new Date();
  users.forEach(user => {
    const progreso = findAll('progress', p => p.userId === user.id && p.correcto);
    const hace20min = new Date(ahora - 20 * 60 * 1000);
    const hizoEjercicio = progreso.some(p => new Date(p.fecha) >= hace20min);
    const rachaAnterior = user.racha || 0;
    const nuevaRacha = hizoEjercicio ? rachaAnterior + 1 : 0;
    const perdioRacha = !hizoEjercicio && rachaAnterior > 0;
    const nuevaRachaMax = Math.max(nuevaRacha, user.rachaMax || 0);
    update('users', u => u.id === user.id, {
      vidas: 5,
      racha: nuevaRacha,
      rachaMax: nuevaRachaMax,
      perdioRacha: perdioRacha
    });
    console.log(`[Simulación] Usuario ${user.nombre}: vidas restauradas, racha=${nuevaRacha}${perdioRacha ? ' - PERDIO RACHA' : ''}`);
  });
}, 20 * 60 * 1000);

// GET /api/progress - progreso del usuario
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const progreso = findAll('progress', p => p.userId === userId);
  const user = findOne('users', u => u.id === userId);

  const stats = {
    totalEjercicios: progreso.length,
    correctos: progreso.filter(p => p.correcto).length,
    incorrectos: progreso.filter(p => !p.correcto).length,
    xpTotal: user ? user.xp : 0,
    racha: user ? user.racha : 0,
    rachaMax: user ? user.rachaMax : 0,
    nivel: user ? user.nivel : 1,
    vidas: user ? user.vidas : 5,
    insignias: user ? user.insignias : [],
    porNivel: {}
  };

  // Agrupar por nivel
  for (let n = 1; n <= 5; n++) {
    const del_nivel = progreso.filter(p => p.nivelEjercicio === n);
    stats.porNivel[n] = {
      intentos: del_nivel.length,
      correctos: del_nivel.filter(p => p.correcto).length
    };
  }

  res.json(stats);
});

// POST /api/progress - guardar resultado de ejercicio
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { ejercicioId, correcto, xpGanado, tiempoSegundos, nivelEjercicio } = req.body;

    const registro = {
      id: Date.now().toString(),
      userId,
      ejercicioId,
      correcto,
      xpGanado,
      tiempoSegundos,
      nivelEjercicio,
      fecha: new Date().toISOString()
    };
    insert('progress', registro);

    // Actualizar XP y nivel del usuario
    const user = findOne('users', u => u.id === userId);
    if (user && correcto) {
      const nuevoXP = user.xp + (xpGanado || 0);
      const nuevoNivel = calcularNivel(nuevoXP);
      const nuevasInsignias = calcularInsignias(user, nuevoXP, nuevoNivel);

      // Restaurar vidas al subir de nivel
      const subiNivel = nuevoNivel > user.nivel;

      update('users', u => u.id === userId, {
        xp: nuevoXP,
        nivel: nuevoNivel,
        insignias: nuevasInsignias,
        vidas: subiNivel ? 5 : Math.min(5, user.vidas)
      });

      res.json({ registro, nuevoXP, nuevoNivel, nuevasInsignias, subiNivel });
    } else if (user && !correcto) {
      // Perder vida
      const nuevasVidas = Math.max(0, user.vidas - 1);
      update('users', u => u.id === userId, { vidas: nuevasVidas });
      res.json({ registro, vidas: nuevasVidas });
    } else {
      res.json({ registro });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calcularNivel(xp) {
  if (xp < 100) return 1;
  if (xp < 300) return 2;
  if (xp < 600) return 3;
  if (xp < 1000) return 4;
  return 5;
}

function calcularInsignias(user, xp, nivel) {
  const insignias = [...(user.insignias || [])];
  const agregar = (id, nombre) => {
    if (!insignias.find(i => i.id === id)) insignias.push({ id, nombre, fecha: new Date().toISOString() });
  };

  if (user.racha >= 7) agregar('racha_7', '🔥 Racha Semanal');
  if (user.racha >= 30) agregar('racha_30', '⚡ Racha Mensual');
  if (xp >= 100) agregar('xp_100', '⭐ Primer Centenar');
  if (xp >= 500) agregar('xp_500', '💎 Elite Coder');
  if (nivel >= 3) agregar('nivel_3', '🧠 Pensador Lógico');
  if (nivel >= 5) agregar('nivel_5', '🏆 Master CodeGym');

  return insignias;
}

module.exports = router;
