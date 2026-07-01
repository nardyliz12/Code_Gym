const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findOne, findAll, insert, update, readDB } = require('../middleware/db');
const { authMiddleware, SECRET } = require('../middleware/auth');
const { syncUserAchievements } = require('../utils/achievements');
const { syncTimeBasedStreak } = require('../utils/streak');

const router = express.Router();

function hasCompletedLevel(userId, level) {
  const exercises = readDB('exercises').filter(e => e.nivel === level);
  if (exercises.length === 0) return false;

  const solved = new Set(
    findAll('progress', p => p.userId === userId && p.correcto && p.nivelEjercicio === level)
      .map(p => p.ejercicioId)
  );

  return exercises.every(e => solved.has(e.id));
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ error: 'Todos los campos son requeridos' });

    if (findOne('users', u => u.email === email))
      return res.status(409).json({ error: 'Email ya registrado' });

    const hash = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      nombre,
      email,
      password: hash,
      xp: 0,
      nivel: 1,
      racha: 0,
      rachaMax: 0,
      rachaActualizadaEn: null,
      vidas: 5,
      vidasRestauranEn: null,
      insignias: [],
      ultimaSesion: null,
      createdAt: new Date().toISOString()
    };
    insert('users', user);

    const token = jwt.sign({ id: user.id, email: user.email, nombre: user.nombre }, SECRET, { expiresIn: '7d' });
    const { password: _, ...userSafe } = user;
    res.status(201).json({ token, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = findOne('users', u => u.email === email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const ahora = new Date();
    const hoy = ahora.toDateString();
    const streakUser = syncTimeBasedStreak({
      ...user,
      ultimaSesion: hoy,
      rachaActualizadaEn: user.rachaActualizadaEn || ahora.toISOString()
    }, ahora.getTime());
    const nuevaRacha = streakUser.racha || 0;
    const rachaMax = Math.max(user.rachaMax || 0, nuevaRacha);
    const restoreAt = user.vidasRestauranEn ? new Date(user.vidasRestauranEn).getTime() : null;
    const cooldownVencido = user.vidas === 0 && restoreAt && restoreAt <= Date.now();
    const vidas = cooldownVencido ? 5 : user.vidas;
    const vidasRestauranEn = cooldownVencido ? null : user.vidasRestauranEn || null;

    const syncedUser = syncUserAchievements({
      ...streakUser,
      racha: nuevaRacha,
      rachaMax,
      ultimaSesion: hoy,
      vidas,
      vidasRestauranEn
    }, { completoNivel5: hasCompletedLevel(user.id, 5) });

    update('users', u => u.id === user.id, {
      racha: nuevaRacha,
      rachaMax,
      rachaActualizadaEn: streakUser.rachaActualizadaEn,
      ultimaSesion: hoy,
      vidas,
      vidasRestauranEn,
      nivel: syncedUser.nivel,
      insignias: syncedUser.insignias
    });

    const updatedUser = syncedUser;
    const token = jwt.sign({ id: user.id, email: user.email, nombre: user.nombre }, SECRET, { expiresIn: '7d' });
    const { password: _, ...userSafe } = updatedUser;
    res.json({ token, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = findOne('users', u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  let currentUser = user;
  const streakUser = syncTimeBasedStreak(currentUser);
  if (streakUser.racha !== currentUser.racha || streakUser.rachaActualizadaEn !== currentUser.rachaActualizadaEn) {
    currentUser = update('users', u => u.id === user.id, {
      racha: streakUser.racha,
      rachaActualizadaEn: streakUser.rachaActualizadaEn,
      rachaMax: Math.max(user.rachaMax || 0, streakUser.racha)
    }) || streakUser;
  } else {
    currentUser = streakUser;
  }
  const restoreAt = user.vidasRestauranEn ? new Date(user.vidasRestauranEn).getTime() : null;
  if (user.vidas === 0 && restoreAt && restoreAt <= Date.now()) {
    currentUser = update('users', u => u.id === user.id, {
      vidas: 5,
      vidasRestauranEn: null
    }) || { ...user, vidas: 5, vidasRestauranEn: null };
  }
  const syncedUser = syncUserAchievements(currentUser, { completoNivel5: hasCompletedLevel(user.id, 5) });
  if (syncedUser.achievementsChanged || syncedUser.nivel !== currentUser.nivel) {
    currentUser = update('users', u => u.id === user.id, {
      nivel: syncedUser.nivel,
      insignias: syncedUser.insignias
    }) || syncedUser;
  } else {
    currentUser = syncedUser;
  }
  const { password: _, ...userSafe } = currentUser;
  res.json(userSafe);
});

module.exports = router;
