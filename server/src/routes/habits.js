import { Router } from 'express';
import mongoose from 'mongoose';
import { Habit } from '../models/Habit.js';
import { CheckIn } from '../models/CheckIn.js';
import { WaterEntry } from '../models/WaterEntry.js';
import { requireAuth } from '../middleware/auth.js';
import { computeScheduledStreak, computeStreak, isIsoDate, lastDays, weekdayOf } from '../lib/dates.js';
import { activeDaySet, buildPlan, musclesForWeekday, normalizeDays, orderedExercises } from '../lib/exercisePlan.js';
import { guessMusclesFromName, normalizeMuscles } from '../lib/muscles.js';

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
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const fields = readHabitFields(req.body);
    if (fields.error) return res.status(400).json({ error: fields.error });

    const count = await Habit.countDocuments({ userId: req.user._id });
    if (count >= 30) {
      return res.status(400).json({ error: 'Limite de 30 hábitos. Remova um para criar outro.' });
    }

    const payload = { userId: req.user._id, ...fields.value };
    if (fields.value.kind === 'exercise') payload.activeDays = [1, 3, 5];
    await Habit.create(payload);
    res.status(201).json(await buildBoard(req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Hábito não encontrado.' });

    const fields = readHabitFields(req.body);
    if (fields.error) return res.status(400).json({ error: fields.error });

    const previous = habit.kind || 'check';
    if (previous !== fields.value.kind) {
      await CheckIn.deleteMany({ habitId: habit._id, userId: req.user._id });
      await WaterEntry.deleteMany({ habitId: habit._id, userId: req.user._id });
    }

    habit.title = fields.value.title;
    habit.kind = fields.value.kind;
    habit.goalMl = fields.value.goalMl;
    if (fields.value.kind === 'exercise' && (!habit.activeDays || habit.activeDays.length === 0)) {
      habit.activeDays = [1, 3, 5];
    }
    await habit.save();
    res.json(await buildBoard(req.user._id, date));
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
    if ((habit.kind || 'check') === 'water') {
      return res.status(400).json({ error: 'A água é anotada em ml, copo por copo.' });
    }
    if ((habit.kind || 'check') === 'exercise' && !activeDaySet(habit).has(weekdayOf(date))) {
      return res.status(400).json({ error: 'Hoje não é dia de treino.' });
    }

    const existing = await CheckIn.findOne({ habitId: habit._id, userId: req.user._id, date });
    if (existing) {
      await existing.deleteOne();
    } else {
      const muscles = (habit.kind || 'check') === 'exercise'
        ? musclesForWeekday(habit, weekdayOf(date))
        : [];
      await CheckIn.create({ habitId: habit._id, userId: req.user._id, date, muscles });
    }

    res.json(await buildBoard(req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/plan', async (req, res, next) => {
  try {
    if (!isIsoDate(req.query.date)) return res.status(400).json({ error: 'Informe a data de hoje.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit || (habit.kind || 'check') !== 'exercise') {
      return res.status(404).json({ error: 'Treino não encontrado.' });
    }
    res.json(await buildPlan(habit, req.user._id, req.query.date));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/days', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit || (habit.kind || 'check') !== 'exercise') {
      return res.status(404).json({ error: 'Treino não encontrado.' });
    }
    const activeDays = normalizeDays(req.body?.activeDays);
    if (activeDays.length === 0) {
      return res.status(400).json({ error: 'Deixe pelo menos um dia de treino.' });
    }
    habit.activeDays = activeDays;
    await habit.save();
    res.json(await buildPlan(habit, req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/exercises', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit || (habit.kind || 'check') !== 'exercise') {
      return res.status(404).json({ error: 'Treino não encontrado.' });
    }
    const weekday = Number(req.body?.weekday);
    const name = String(req.body?.name || '').trim();
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return res.status(400).json({ error: 'Escolha o dia do exercício.' });
    }
    if (!activeDaySet(habit).has(weekday)) {
      return res.status(400).json({ error: 'Esse dia não está no treino.' });
    }
    if (!name || name.length > 80) {
      return res.status(400).json({ error: 'Dê um nome ao exercício, com até 80 caracteres.' });
    }
    const sameDay = orderedExercises(habit, weekday);
    if (sameDay.length >= 20) {
      return res.status(400).json({ error: 'Limite de 20 exercícios neste dia.' });
    }
    const fromBody = normalizeMuscles(req.body?.muscles);
    const muscles = fromBody.length ? fromBody : guessMusclesFromName(name);
    habit.exercises.push({ weekday, name, position: sameDay.length, muscles });
    await habit.save();
    res.status(201).json(await buildPlan(habit, req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/exercises/:exerciseId', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit || (habit.kind || 'check') !== 'exercise') {
      return res.status(404).json({ error: 'Treino não encontrado.' });
    }
    const item = habit.exercises.id(req.params.exerciseId);
    if (!item) return res.status(404).json({ error: 'Exercício não encontrado.' });

    const direction = req.body?.direction;
    if (direction === 'up' || direction === 'down') {
      const list = orderedExercises(habit, item.weekday);
      const index = list.findIndex((entry) => entry._id.equals(item._id));
      const swapWith = direction === 'up' ? index - 1 : index + 1;
      if (swapWith >= 0 && swapWith < list.length) {
        const reordered = [...list];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(swapWith, 0, moved);
        reordered.forEach((entry, position) => { entry.position = position; });
      }
    } else if (req.body?.muscles !== undefined) {
      item.muscles = normalizeMuscles(req.body.muscles);
    } else {
      return res.status(400).json({ error: 'Não foi possível atualizar o exercício.' });
    }

    await habit.save();
    res.json(await buildPlan(habit, req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/exercises/:exerciseId', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit || (habit.kind || 'check') !== 'exercise') {
      return res.status(404).json({ error: 'Treino não encontrado.' });
    }
    const item = habit.exercises.id(req.params.exerciseId);
    if (!item) return res.status(404).json({ error: 'Exercício não encontrado.' });
    const weekday = item.weekday;
    item.deleteOne();
    orderedExercises(habit, weekday).forEach((entry, position) => { entry.position = position; });
    await habit.save();
    res.json(await buildPlan(habit, req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/water', async (req, res, next) => {
  try {
    const date = req.body?.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Hábito não encontrado.' });
    if ((habit.kind || 'check') !== 'water') {
      return res.status(400).json({ error: 'Esse hábito não é de água.' });
    }

    const ml = parseGlassMl(req.body?.ml);
    if (!ml) return res.status(400).json({ error: 'Informe os ml do copo, entre 10 e 2000.' });

    const count = await WaterEntry.countDocuments({ habitId: habit._id, userId: req.user._id, date });
    if (count >= 40) {
      return res.status(400).json({ error: 'Limite de 40 copos neste dia.' });
    }

    await WaterEntry.create({ habitId: habit._id, userId: req.user._id, date, ml });
    res.status(201).json(await buildBoard(req.user._id, date));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/water/:entryId', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Data inválida.' });
    const habit = await findOwnedHabit(req.user._id, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Hábito não encontrado.' });
    if (!mongoose.isValidObjectId(req.params.entryId)) {
      return res.status(404).json({ error: 'Copo não encontrado.' });
    }

    const entry = await WaterEntry.findOne({
      _id: req.params.entryId,
      habitId: habit._id,
      userId: req.user._id,
    });
    if (!entry) return res.status(404).json({ error: 'Copo não encontrado.' });

    await entry.deleteOne();
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
    await WaterEntry.deleteMany({ habitId: habit._id, userId: req.user._id });
    await habit.deleteOne();
    res.json(await buildBoard(req.user._id, date));
  } catch (error) {
    next(error);
  }
});

function readHabitFields(body) {
  const kind = body?.kind === undefined || body?.kind === '' ? 'check' : body.kind;
  if (kind !== 'check' && kind !== 'water' && kind !== 'exercise') {
    return { error: 'Escolha o tipo do hábito.' };
  }

  let title = String(body?.title || '').trim();
  if (kind === 'water') title = title || 'Água';
  if (!title || title.length > 80) {
    return { error: 'Dê um nome ao hábito, com até 80 caracteres.' };
  }

  if (kind === 'check' || kind === 'exercise') return { value: { title, kind, goalMl: null } };

  const goalMl = parseGoalMl(body?.goalLiters);
  if (!goalMl) return { error: 'A meta precisa ficar entre 0,2 L e 10 L.' };
  return { value: { title, kind, goalMl } };
}

function parseGoalMl(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const ml = Math.round(Number(normalized) * 1000);
  if (ml < 200 || ml > 10000) return null;
  return ml;
}

function parseGlassMl(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;
  const ml = Number(normalized);
  if (ml < 10 || ml > 2000) return null;
  return ml;
}

async function findOwnedHabit(userId, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Habit.findOne({ _id: id, userId });
}

async function buildBoard(userId, today) {
  const habits = await Habit.find({ userId }).sort({ createdAt: 1 });
  const ids = habits.map((habit) => habit._id);
  const [checkins, waters] = await Promise.all([
    CheckIn.find({ userId, habitId: { $in: ids } }).select('habitId date').lean(),
    WaterEntry.find({ userId, habitId: { $in: ids } }).select('habitId date ml createdAt').lean(),
  ]);

  const checksByHabit = groupBy(checkins, (item) => item.habitId.toString());
  const waterByHabit = groupBy(waters, (item) => item.habitId.toString());
  const days = lastDays(today, 7);

  const items = habits.map((habit) => {
    const id = habit._id.toString();
    const kind = habit.kind || 'check';
    if (kind === 'water') {
      return waterHabit(habit, waterByHabit.get(id) || [], today, days);
    }
    if (kind === 'exercise') {
      return exerciseHabit(habit, checksByHabit.get(id) || [], today, days);
    }
    const dates = (checksByHabit.get(id) || []).map((item) => item.date);
    const done = new Set(dates);
    return {
      id,
      title: habit.title,
      kind: 'check',
      doneToday: done.has(today),
      streak: computeStreak(dates, today),
      week: days.map((date) => ({ date, done: done.has(date) })),
    };
  });

  const counted = items.filter((item) => item.countsToday !== false);
  return {
    date: today,
    doneCount: counted.filter((item) => item.doneToday).length,
    total: counted.length,
    habits: items,
  };
}

function exerciseHabit(habit, checkins, today, days) {
  const dates = checkins.map((item) => item.date);
  const done = new Set(dates);
  const active = activeDaySet(habit);
  const weekday = weekdayOf(today);
  const restToday = !active.has(weekday);
  const todayPlan = orderedExercises(habit, weekday).map((item) => item.name);
  return {
    id: habit._id.toString(),
    title: habit.title,
    kind: 'exercise',
    restToday,
    countsToday: !restToday,
    todayPlan,
    doneToday: !restToday && done.has(today),
    streak: computeScheduledStreak(dates, today, [...active]),
    week: days.map((date) => {
      const trains = active.has(weekdayOf(date));
      return { date, done: trains && done.has(date), rest: !trains };
    }),
  };
}

function waterHabit(habit, entries, today, days) {
  const byDate = groupBy(entries, (entry) => entry.date);
  const doneDates = [];
  for (const [date, list] of byDate) {
    const total = list.reduce((sum, entry) => sum + entry.ml, 0);
    if (total >= habit.goalMl) doneDates.push(date);
  }
  const todayList = [...(byDate.get(today) || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const done = new Set(doneDates);
  return {
    id: habit._id.toString(),
    title: habit.title,
    kind: 'water',
    goalMl: habit.goalMl,
    totalMl: todayList.reduce((sum, entry) => sum + entry.ml, 0),
    entries: todayList.map((entry) => ({ id: entry._id.toString(), ml: entry.ml })),
    doneToday: done.has(today),
    streak: computeStreak(doneDates, today),
    week: days.map((date) => ({ date, done: done.has(date) })),
  };
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

export default router;
