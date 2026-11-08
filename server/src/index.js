import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import habitRoutes from './routes/habits.js';
import bodyRoutes from './routes/body.js';
import ninjaRoutes from './routes/ninja.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const port = Number(process.env.PORT) || 4000;
const configuredOrigin = process.env.CLIENT_ORIGIN
  || process.env.RENDER_EXTERNAL_URL
  || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';
const clientDist = path.join(__dirname, '../../client/dist');
const serveClient = isProd && fs.existsSync(path.join(clientDist, 'index.html'));

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('Defina JWT_SECRET no arquivo server/.env (mínimo de 16 caracteres).');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('Defina MONGODB_URI no arquivo server/.env.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === configuredOrigin) return true;
  if (origin === process.env.RENDER_EXTERNAL_URL) return true;
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') return true;
  // Vite na LAN (celular / outro PC na rede)
  return /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|26\.\d{1,3}\.\d{1,3}\.\d{1,3}):5173$/.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin) ? (origin || configuredOrigin) : false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/body', bodyRoutes);
app.use('/api/ninja', ninjaRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

if (serveClient) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.publicMessage || 'Erro interno.' });
});

await connectDb(process.env.MONGODB_URI);
app.listen(port, () => {
  console.log(`API em http://localhost:${port}${serveClient ? ' (+ client)' : ''}`);
});
