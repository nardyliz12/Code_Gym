// =============================================
//  CodeGym – API Client
//  Todas las llamadas al backend centralizadas
// =============================================

const API = {
  BASE: '/api',

  _headers() {
    const token = localStorage.getItem('cg_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  },

  async _fetch(path, opts = {}) {
    const res = await fetch(this.BASE + path, {
      headers: this._headers(),
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  },

  // AUTH
  async register(nombre, email, password) {
    return this._fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, password })
    });
  },

  async login(email, password) {
    return this._fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async me() {
    return this._fetch('/auth/me');
  },

  // EXERCISES
  async getExercises(nivel, dificultad) {
    let qs = '';
    if (nivel) qs += `nivel=${nivel}`;
    if (dificultad && dificultad !== 'all') qs += `${qs ? '&' : ''}tipo=`; // just nivel filter
    return this._fetch(`/exercises${qs ? '?' + qs : ''}`);
  },

  async getExercisesByNivel(nivel) {
    return this._fetch(`/exercises?nivel=${nivel}`);
  },

  async verifyAnswer(ejercicioId, respuesta, tiempoSegundos) {
    return this._fetch(`/exercises/${ejercicioId}/verificar`, {
      method: 'POST',
      body: JSON.stringify({ respuesta, tiempoSegundos })
    });
  },

  // PROGRESS
  async getProgress() {
    return this._fetch('/progress');
  },

  async saveProgress(ejercicioId, correcto, xpGanado, tiempoSegundos, nivelEjercicio) {
    return this._fetch('/progress', {
      method: 'POST',
      body: JSON.stringify({ ejercicioId, correcto, xpGanado, tiempoSegundos, nivelEjercicio })
    });
  },

  // LEADERBOARD
  async getLeaderboard() {
    return this._fetch('/leaderboard');
  }
};
