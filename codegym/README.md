# 🏋️ CodeGym — Plataforma de práctica progresiva de programación

> "Entrena tu lógica. Mantén tu racha. Domina la programación."

## ¿Qué es CodeGym?

CodeGym es una plataforma gamificada inspirada en Duolingo para que estudiantes de primer año practiquen programación fuera del aula. Diseñada para reducir el 88% de desaprobación en Fundamentos de Programación (UPCH).

### Funcionalidades implementadas

- ✅ **Registro e inicio de sesión** (con JWT)
- ✅ **5 Niveles progresivos** (Lógica → Algoritmos → Condicionales → Bucles → Mini proyectos)
- ✅ **4 tipos de ejercicios**: Opción múltiple, Completar código, Ordenar sentencias, Escribir desde cero
- ✅ **Sistema de XP y niveles** (desbloqueo por XP)
- ✅ **Rachas diarias** (se actualiza al iniciar sesión)
- ✅ **Sistema de vidas** (5 vidas, se pierden con errores)
- ✅ **Insignias** automáticas por logros
- ✅ **Feedback inmediato** en cada ejercicio
- ✅ **Tabla de líderes** (leaderboard anónimo comparativo)
- ✅ **Dashboard de progreso** con estadísticas por nivel
- ✅ **Diseño responsive** (móvil y desktop)

---

## 🚀 Instalación y ejecución

### Requisitos

- Node.js v16 o superior
- npm

### Pasos

```bash
# 1. Clonar o descomprimir el proyecto
cd codegym

# 2. Instalar dependencias
npm install --ignore-scripts

# 3. Ejecutar el servidor
node backend/server.js
```

### Acceder a la plataforma

Abre tu navegador en: **http://localhost:3000**

---

## 📁 Estructura del proyecto

```
codegym/
├── backend/
│   ├── server.js              # Servidor Express principal
│   ├── middleware/
│   │   ├── auth.js            # JWT middleware
│   │   └── db.js              # Operaciones con JSON DB
│   ├── routes/
│   │   ├── auth.js            # /api/auth/register, /login, /me
│   │   ├── exercises.js       # /api/exercises
│   │   ├── progress.js        # /api/progress
│   │   └── leaderboard.js     # /api/leaderboard
│   ├── seed/
│   │   └── exercises.js       # 20 ejercicios precargados (5 niveles × 4-5)
│   └── db/                    # Archivos JSON (base de datos)
│       ├── users.json
│       ├── progress.json
│       ├── sessions.json
│       └── exercises.json
│
├── public/
│   ├── index.html             # SPA principal
│   ├── css/
│   │   └── main.css           # Estilos completos (Navy + Verde eléctrico)
│   └── js/
│       ├── api.js             # Cliente API (fetch wrapper)
│       └── app.js             # Lógica de la aplicación
│
├── package.json
└── README.md
```

---

## 🎯 Niveles y ejercicios

| Nivel | Tema | Ejercicios | XP para desbloquear |
|-------|------|-----------|---------------------|
| 1 | Lógica y pensamiento algorítmico | 5 | 0 XP (libre) |
| 2 | Entrada, salida y tipos de datos | 6 | 0 XP (libre) |
| 3 | Condicionales y decisiones | 5 | 50 XP |
| 4 | Bucles e iteraciones | 5 | 150 XP |
| 5 | Mini proyectos integradores | 5 | 350 XP |

### Tipos de ejercicio
- **Opción múltiple**: 4 opciones, razona antes de responder
- **Completar código**: elige la palabra/expresión que falta
- **Ordenar sentencias**: arrastra para construir el flujo correcto
- **Escribir desde cero**: escribe el código libremente

---

## 🔌 API Endpoints

```
POST /api/auth/register      — Crear cuenta
POST /api/auth/login         — Iniciar sesión
GET  /api/auth/me            — Perfil del usuario (requiere token)

GET  /api/exercises?nivel=N  — Ejercicios por nivel
POST /api/exercises/:id/verificar — Verificar respuesta

GET  /api/progress           — Estadísticas del usuario
POST /api/progress           — Guardar resultado de ejercicio

GET  /api/leaderboard        — Top 20 estudiantes
```

---

## ⚙️ Variables de entorno (opcional)

```bash
PORT=3000           # Puerto del servidor (default: 3000)
JWT_SECRET=mi_clave # Clave secreta JWT (default: codegym_secret_2024)
DATA_DIR=/var/data/codegym # Ruta persistente para users.json/progress.json en despliegue
LIFE_COOLDOWN_MINUTES=20    # Minutos para restaurar vidas cuando llegan a 0
```

En Render, monta un Persistent Disk y apunta DATA_DIR a esa ruta. Si dejas los JSON en el filesystem efímero del contenedor, las cuentas y el progreso pueden desaparecer tras reinicios o nuevos despliegues.

---

## 📊 Sistema de XP e insignias

| XP acumulado | Nivel |
|---|---|
| 0 – 99 | Nivel 1 |
| 100 – 299 | Nivel 2 |
| 300 – 599 | Nivel 3 |
| 600 – 999 | Nivel 4 |
| 1000+ | Nivel 5 (Master) |

### Insignias automáticas
- 🔥 **Racha Semanal** — 7 días consecutivos
- ⚡ **Racha Mensual** — 30 días consecutivos
- ⭐ **Primer Centenar** — 100 XP
- 💎 **Elite Coder** — 500 XP
- 🧠 **Pensador Lógico** — Nivel 3
- 🏆 **Master CodeGym** — Nivel 5

---

## 🛠️ Agregar más ejercicios

Edita `backend/seed/exercises.js` con el siguiente formato:

```javascript
{
  id: "n1_006",           // Único: n{nivel}_{número}
  nivel: 1,               // 1-5
  tipo: "opcion_multiple", // opcion_multiple | completar | ordenar | escribir
  dificultad: "inicio",   // inicio | medio | avanzado
  titulo: "Mi ejercicio",
  enunciado: "Pregunta o código...",
  opciones: ["A) ...", "B) ...", "C) ...", "D) ..."],  // para opcion_multiple/completar
  respuestaCorrecta: "A",  // la letra o texto exacto
  xp: 10,
  feedbackCorrecto: "✅ Bien porque...",
  feedbackIncorrecto: "❌ El error fue...",
  pista: "Pista útil aquí"
}
```

Luego elimina `backend/db/exercises.json` y reinicia el servidor para que regenere con los nuevos ejercicios.

---

## 👩‍💻 Créditos

Desarrollado como proyecto para **Desarrollo Profesional I** — Universidad Peruana Cayetano Heredia (UPCH)

*"Que ningún futuro ingeniero se quede atrás por falta de práctica diaria."*
