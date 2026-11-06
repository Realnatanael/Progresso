import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import habitRoutes from './routes/habits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const port = Number(process.env.PORT) || 4000;
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('Defina JWT_SECRET no arquivo server/.env (mínimo de 16 caracteres).');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('Defina MONGODB_URI no arquivo server/.env.');
  process.exit(1);
}

const app = express();

app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.publicMessage || 'Erro interno.' });
});

await connectDb(process.env.MONGODB_URI);
app.listen(port, () => {
  console.log(`API em http://localhost:${port}`);
});
