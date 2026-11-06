import { Router } from 'express';
import mongoose from 'mongoose';
import { Habit } from '../models/Habit.js';
import { CheckIn } from '../models/CheckIn.js';
import { requireAuth } from '../middleware/auth.js';
import { computeStreak, isIsoDate, lastDays } from '../lib/dates.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    if (!isIsoDate(req.query.date)) {
      return res.status(400).json({ error: 'Informe a data de hoje.' });
    }
    res.json(await buildBoard(req.user._id, req.query.date));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const date = req.body?.date;
    if (!title || title.length > 80) {
      return res.status(400).json({ error: 'Dê um nome ao hábito, com até 80 caracteres.' });
    }
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });

    const count = await Habit.countDocuments({ userId: req.user._id });
    if (count >= 30) {
      return res.status(400).json({ error: 'Limite de 30 hábitos. Remova um para criar outro.' });
    }

    await Habit.create({ userId: req.user._id, title });
    res.status(201).json(await buildBoard(req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/toggle', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Hábito não encontrado.' });

    const existing = await CheckIn.findOne({ habitId: habit._id, userId: req.user._id, date });
    if (existing) await existing.deleteOne();
    else await CheckIn.create({ habitId: habit._id, userId: req.user._id, date });

    res.json(await buildBoard(req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Hábito não encontrado.' });

    await CheckIn.deleteMany({ habitId: habit._id, userId: req.user._id });
    await habit.deleteOne();
    res.json(await buildBoard(req.user._id, date));
  } catch (error) {
    next(error);
  }
});

async function findOwnedHabit(userId, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Habit.findOne({ _id: id, userId });
}

async function buildBoard(userId, today) {
  const habits = await Habit.find({ userId }).sort({ createdAt: 1 });
  const ids = habits.map((habit) => habit._id);
  const checkins = await CheckIn.find({ userId, habitId: { $in: ids } }).select('habitId date').lean();
  const byHabit = new Map();

  for (const item of checkins) {
    const key = item.habitId.toString();
    if (!byHabit.has(key)) byHabit.set(key, []);
    byHabit.get(key).push(item.date);
  }

  const days = lastDays(today, 7);
  const items = habits.map((habit) => {
    const dates = byHabit.get(habit._id.toString()) || [];
    const done = new Set(dates);
    return {
      id: habit._id.toString(),
      title: habit.title,
      doneToday: done.has(today),
      streak: computeStreak(dates, today),
      week: days.map((date) => ({ date, done: done.has(date) })),
    };
  });

  return {
    date: today,
    doneCount: items.filter((item) => item.doneToday).length,
    total: items.length,
    habits: items,
  };
}

export default router;
