function calcularNivel(xp) {
  if (xp < 100) return 1;
  if (xp < 300) return 2;
  if (xp < 600) return 3;
  if (xp < 1000) return 4;
  return 5;
}

function calcularInsignias(user, xp, nivel, racha = user.racha || 0) {
  const insignias = [...(user.insignias || [])];
  const agregar = (id, nombre) => {
    if (!insignias.find(i => i.id === id)) {
      insignias.push({ id, nombre, fecha: new Date().toISOString() });
    }
  };

  if (racha >= 7) agregar('racha_7', '🔥 Racha Semanal');
  if (racha >= 30) agregar('racha_30', '⚡ Racha Mensual');
  if (xp >= 100) agregar('xp_100', '⭐ Primer Centenar');
  if (xp >= 500) agregar('xp_500', '💎 Elite Coder');
  if (nivel >= 3) agregar('nivel_3', '🧠 Pensador Lógico');
  if (nivel >= 5) agregar('nivel_5', '🏆 Master CodeGym');

  return insignias;
}

function syncUserAchievements(user) {
  if (!user) return null;

  const xp = user.xp || 0;
  const nivel = user.nivel || calcularNivel(xp);
  const racha = user.racha || 0;
  const insignias = calcularInsignias(user, xp, nivel, racha);
  const changed = insignias.length !== (user.insignias || []).length;

  return {
    ...user,
    nivel,
    insignias,
    achievementsChanged: changed
  };
}

module.exports = {
  calcularNivel,
  calcularInsignias,
  syncUserAchievements
};