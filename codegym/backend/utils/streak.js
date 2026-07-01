const STREAK_WINDOW_MINUTES = Number(process.env.STREAK_WINDOW_MINUTES || 20);
const STREAK_WINDOW_MS = STREAK_WINDOW_MINUTES * 60 * 1000;

function syncTimeBasedStreak(user, now = Date.now()) {
  if (!user) return null;

  const currentRacha = Number(user.racha) || 0;
  const lastUpdateMs = user.rachaActualizadaEn ? new Date(user.rachaActualizadaEn).getTime() : null;

  if (!lastUpdateMs) {
    return {
      ...user,
      racha: currentRacha > 0 ? currentRacha : 1,
      rachaActualizadaEn: new Date(now).toISOString()
    };
  }

  const elapsedMs = now - lastUpdateMs;
  const increments = Math.floor(elapsedMs / STREAK_WINDOW_MS);

  if (increments <= 0) {
    return {
      ...user,
      racha: currentRacha,
      rachaActualizadaEn: user.rachaActualizadaEn
    };
  }

  return {
    ...user,
    racha: currentRacha + increments,
    rachaActualizadaEn: new Date(lastUpdateMs + (increments * STREAK_WINDOW_MS)).toISOString()
  };
}

module.exports = {
  STREAK_WINDOW_MINUTES,
  STREAK_WINDOW_MS,
  syncTimeBasedStreak
};