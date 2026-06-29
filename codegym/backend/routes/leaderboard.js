const express = require('express');
const { readDB } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/leaderboard
router.get('/', authMiddleware, (req, res) => {
  const users = readDB('users');
  const tabla = users
    .map(u => ({
      id: u.id,
      nombre: u.nombre,
      xp: u.xp,
      nivel: u.nivel,
      racha: u.racha,
      insignias: (u.insignias || []).length
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 20);

  res.json(tabla);
});

module.exports = router;
