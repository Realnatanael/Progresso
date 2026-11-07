import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Habit } from '../models/Habit.js';
import { CheckIn } from '../models/CheckIn.js';
import { WeightEntry } from '../models/WeightEntry.js';
import { computeScheduledStreak, isIsoDate, shiftDate } from '../lib/dates.js';
import { activeDaySet, buildPlan } from '../lib/exercisePlan.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    if (!isIsoDate(req.query.date)) {
      return res.status(400).json({ error: 'Informe a data de hoje.' });
    }
    res.json(await buildBody(req.user, req.query.date));
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const fields = readProfile(req.body);
    if (fields.error) return res.status(400).json({ error: fields.error });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
    user.heightCm = fields.value.heightCm;
    user.age = fields.value.age;
    user.gender = fields.value.gender;
    await user.save();
    res.json(await buildBody(user, date));
  } catch (error) {
    next(error);
  }
});

router.post('/weight', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const kg = parseKg(req.body?.kg);
    if (kg === null) {
      return res.status(400).json({ error: 'Informe o peso em kg, entre 30 e 300.' });
    }
    await WeightEntry.findOneAndUpdate(
      { userId: req.user._id, date },
      { $set: { kg } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json(await buildBody(req.user, date));
  } catch (error) {
    next(error);
  }
});

router.delete('/weight', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    await WeightEntry.deleteOne({ userId: req.user._id, date });
    res.json(await buildBody(req.user, date));
  } catch (error) {
    next(error);
  }
});

async function buildBody(userDoc, date) {
  const user = userDoc.heightCm !== undefined
    ? userDoc
    : await User.findById(userDoc._id || userDoc);
  const userId = user._id;
  const habit = await Habit.findOne({ userId, kind: 'exercise' }).sort({ createdAt: 1 });
  const weights = await WeightEntry.find({ userId })
    .sort({ date: -1 })
    .limit(60)
    .select('date kg')
    .lean();
  const sorted = weights
    .map((entry) => ({ date: entry.date, kg: entry.kg }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = [...sorted].reverse().find((entry) => entry.date <= date) || sorted.at(-1) || null;
  const heightCm = user.heightCm ?? null;
  const bmi = latest && heightCm ? calcBmi(latest.kg, heightCm) : null;
  const avatar = await buildAvatarShape(habit, userId, date, bmi);

  return {
    date,
    profile: {
      heightCm,
      age: user.age ?? null,
      gender: user.gender ?? null,
    },
    stats: {
      weightKg: latest?.kg ?? null,
      bmi,
      bmiLabel: bmiLabel(bmi),
    },
    avatar,
    workout: habit ? await buildPlan(habit, userId, date) : null,
    weights: sorted,
  };
}

/** Forma do avatar: definição sobe com treino; volume ajusta com IMC. */
async function buildAvatarShape(habit, userId, date, bmi) {
  if (!habit) {
    return {
      definition: 0,
      volume: volumeFromBmi(bmi),
      workoutsLast14: 0,
      streak: 0,
      label: 'Sem treino registrado',
    };
  }

  const from = shiftDate(date, -13);
  const checkins = await CheckIn.find({
    habitId: habit._id,
    userId,
    date: { $gte: from, $lte: date },
  })
    .select('date')
    .lean();
  const dates = checkins.map((item) => item.date);
  const workoutsLast14 = dates.length;
  const active = [...activeDaySet(habit)];
  const streak = computeScheduledStreak(dates, date, active);

  // 8 treinos em 14 dias ≈ 100% definição; sequência soma um pouco
  const freq = Math.min(1, workoutsLast14 / 8);
  const streakPart = Math.min(1, streak / 7) * 0.2;
  const definition = Math.min(1, Math.round((freq * 0.85 + streakPart) * 100) / 100);
  const volume = volumeFromBmi(bmi);

  return {
    definition,
    volume,
    workoutsLast14,
    streak,
    label: avatarLabel(definition, workoutsLast14),
  };
}

function volumeFromBmi(bmi) {
  if (bmi == null) return 0.15;
  if (bmi <= 18.5) return 0;
  if (bmi <= 25) return ((bmi - 18.5) / 6.5) * 0.25;
  if (bmi <= 30) return 0.25 + ((bmi - 25) / 5) * 0.45;
  return Math.min(1, 0.7 + ((bmi - 30) / 10) * 0.3);
}

function avatarLabel(definition, workoutsLast14) {
  if (workoutsLast14 === 0) return 'Treine para definir o avatar';
  if (definition < 0.35) return 'Começando a definir';
  if (definition < 0.7) return 'Definindo com o treino';
  return 'Avatar bem definido';
}

function readProfile(body) {
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

function parseKg(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const kg = Number(text);
  if (!Number.isFinite(kg) || kg < 30 || kg > 300) return null;
  return Math.round(kg * 10) / 10;
}

function calcBmi(kg, heightCm) {
  const meters = heightCm / 100;
  if (!meters) return null;
  return Math.round((kg / (meters * meters)) * 10) / 10;
}

function bmiLabel(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Peso adequado';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidade';
}

export default router;
