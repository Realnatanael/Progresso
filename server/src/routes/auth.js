import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Habit } from '../models/Habit.js';
import { CheckIn } from '../models/CheckIn.js';
import { WaterEntry } from '../models/WaterEntry.js';
import { WeightEntry } from '../models/WeightEntry.js';
import { NinjaPose } from '../models/NinjaPose.js';
import { requireAuth } from '../middleware/auth.js';
import { clearAuthCookie, setAuthCookie } from '../lib/authCookie.js';
import { defaultNinjaState } from '../data/ninjaCatalog.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const profile = readEssentialProfile(req.body);

    if (firstName.length < 2 || firstName.length > 40) {
      return res.status(400).json({ error: 'O nome precisa ter entre 2 e 40 caracteres.' });
    }
    if (lastName.length < 2 || lastName.length > 40) {
      return res.status(400).json({ error: 'O sobrenome precisa ter entre 2 e 40 caracteres.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Informe um email válido.' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'A senha precisa ter entre 8 e 72 caracteres.' });
    }
    if (profile.error) {
      return res.status(400).json({ error: profile.error });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Já existe uma conta com esse email.' });

    const name = `${firstName} ${lastName}`.trim();
    const passwordHash = await bcrypt.hash(password, 12);
    const ninja = {
      ...defaultNinjaState(),
      clanName: lastName,
      clanNameSyncedFromName: true,
    };

    const user = await User.create({
      name,
      email,
      passwordHash,
      heightCm: profile.value.heightCm,
      age: profile.value.age,
      gender: profile.value.gender,
      ninja,
    });
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

/** Apaga a conta e todo o registro ligado ao usuário. */
router.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const password = String(req.body?.password || '');
    if (!password) {
      return res.status(400).json({ error: 'Informe a senha para excluir a conta.' });
    }

    const matches = await bcrypt.compare(password, req.user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const userId = req.user._id;
    await Promise.all([
      CheckIn.deleteMany({ userId }),
      WaterEntry.deleteMany({ userId }),
      WeightEntry.deleteMany({ userId }),
      NinjaPose.deleteMany({ userId }),
      Habit.deleteMany({ userId }),
    ]);
    await User.deleteOne({ _id: userId });

    clearAuthCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function readEssentialProfile(body) {
  const heightCm = parseHeight(body?.heightCm);
  if (heightCm === null) {
    return { error: 'Informe a altura em cm, entre 120 e 230.' };
  }
  const age = Number(body?.age);
  if (!Number.isInteger(age) || age < 10 || age > 120) {
    return { error: 'Informe a idade, entre 10 e 120.' };
  }
  const gender = body?.gender;
  if (gender !== 'male' && gender !== 'female' && gender !== 'other') {
    return { error: 'Escolha o gênero.' };
  }
  return { value: { heightCm, age, gender } };
}

function parseHeight(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const cm = Number(text);
  if (!Number.isFinite(cm) || cm < 120 || cm > 230) return null;
  return Math.round(cm);
}

export default router;
