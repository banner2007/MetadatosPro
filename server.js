
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Cabeceras obligatorias para SharedArrayBuffer (FFmpeg)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Servir archivos estáticos del build
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback: redirigir todas las peticiones no encontradas al index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Producción corriendo en puerto ${PORT}`);
});
