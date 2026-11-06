import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { clearAuthCookie, setAuthCookie } from '../lib/authCookie.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({ error: 'O nome precisa ter entre 2 e 40 caracteres.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Informe um email válido.' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'A senha precisa ter entre 8 e 72 caracteres.' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Já existe uma conta com esse email.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    setAuthCookie(res, user);
    res.status(201).json({ user: user.toPublic() });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Já existe uma conta com esse email.' });
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await User.findOne({ email });
    const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !matches) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }
    setAuthCookie(res, user);
    res.json({ user: user.toPublic() });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
