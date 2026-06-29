const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const exerciseRoutes = require('./routes/exercises');
const progressRoutes = require('./routes/progress');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Init DB files if not exist
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const dbFiles = {
  users: [],
  progress: [],
  sessions: []
};
Object.entries(dbFiles).forEach(([name, def]) => {
  const fp = path.join(dbDir, `${name}.json`);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def, null, 2));
});

// Seed exercises DB
const exercisesPath = path.join(dbDir, 'exercises.json');
if (!fs.existsSync(exercisesPath)) {
  const seed = require('./seed/exercises');
  fs.writeFileSync(exercisesPath, JSON.stringify(seed, null, 2));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏋️  CodeGym corriendo en http://localhost:${PORT}`);
  console.log(`   Presiona Ctrl+C para detener\n`);
});
