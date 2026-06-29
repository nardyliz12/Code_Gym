const express = require('express');
const { readDB, findAll } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/exercises - all or by level
router.get('/', authMiddleware, (req, res) => {
  const { nivel, tipo } = req.query;
  let ejercicios = readDB('exercises');

  if (nivel) ejercicios = ejercicios.filter(e => e.nivel === parseInt(nivel));
  if (tipo) ejercicios = ejercicios.filter(e => e.tipo === tipo);

  // No enviar la respuesta correcta al cliente
  const safe = ejercicios.map(e => {
    const { respuestaCorrecta, ...rest } = e;
    return rest;
  });
  res.json(safe);
});

// GET /api/exercises/:id
router.get('/:id', authMiddleware, (req, res) => {
  const ejercicios = readDB('exercises');
  const ej = ejercicios.find(e => e.id === req.params.id);
  if (!ej) return res.status(404).json({ error: 'Ejercicio no encontrado' });
  const { respuestaCorrecta, ...safe } = ej;
  res.json(safe);
});

// POST /api/exercises/:id/verificar
router.post('/:id/verificar', authMiddleware, (req, res) => {
  const ejercicios = readDB('exercises');
  const ej = ejercicios.find(e => e.id === req.params.id);
  if (!ej) return res.status(404).json({ error: 'Ejercicio no encontrado' });

  const { respuesta, tiempoSegundos } = req.body;
  let correcto = false;

  if (ej.tipo === 'opcion_multiple' || ej.tipo === 'completar') {
    const respStr = String(respuesta).trim().toLowerCase();
    const correctaStr = String(ej.respuestaCorrecta).trim().toLowerCase();
    // Aceptar si coincide exacto, o si la respuesta empieza con la letra correcta (ej: "b)" == "B")
    const letraRespuesta = respStr.match(/^([a-d])/)?.[1];
    const letraCorrecta = correctaStr.match(/^([a-d])/)?.[1];
    correcto = respStr === correctaStr
      || letraRespuesta === correctaStr
      || letraCorrecta === respStr
      || (letraRespuesta && letraCorrecta && letraRespuesta === letraCorrecta);
  } else if (ej.tipo === 'ordenar') {
    correcto = JSON.stringify(respuesta) === JSON.stringify(ej.respuestaCorrecta);
  } else if (ej.tipo === 'escribir') {
    const norm = s => s
      .replace(/\r/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('\n')
      .toLowerCase()
      .replace(/['"]/g, "'")
      .replace(/>=|≥/g, '>=')
      .replace(/<=|≤/g, '<=')
    correcto = norm(String(respuesta)) === norm(String(ej.respuestaCorrecta));
  }

  const xpGanado = correcto ? (ej.xp || 10) : 0;
  const feedback = correcto ? ej.feedbackCorrecto : ej.feedbackIncorrecto;

  res.json({
    correcto,
    xpGanado,
    feedback,
    respuestaCorrecta: !correcto ? ej.respuestaCorrecta : undefined
  });
});

module.exports = router;
