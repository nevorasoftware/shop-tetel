import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { initDatabase } from './db.js';
import apiRouter from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar la base de datos (PostgreSQL en Railway o SQLite local)
await initDatabase();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
const publicPath = path.join(__dirname, '..', 'public');
if (process.env.UPLOADS_PATH) {
  app.use('/uploads', express.static(process.env.UPLOADS_PATH));
}
app.use(express.static(publicPath));

// Rutas API
app.use('/api', apiRouter);

// Fallback para SPA o páginas específicas
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Si la ruta no tiene extensión y no es un archivo, redirigir a index.html
  if (!path.extname(req.path)) {
    return res.sendFile(path.join(publicPath, 'index.html'));
  }
  next();
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`✨ TETEL Fashion Atelier E-commerce & Wompi SV 3DS`);
  console.log(`🛍️  Tienda Online:        http://0.0.0.0:${PORT}`);
  console.log(`⚙️  Panel de Admin:       http://localhost:${PORT}#admin`);
  console.log(`💳  Pasarela Wompi 3DS:   Activa (Modo Seguro / 3DS Sandbox)`);
  console.log(`🇸🇻 Envíos El Salvador:   14 Departamentos y Distritos configurados`);
  console.log(`=============================================================\n`);
});
