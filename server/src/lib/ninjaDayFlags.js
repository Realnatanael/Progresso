import { Habit } from '../models/Habit.js';
import { CheckIn } from '../models/CheckIn.js';
import { WaterEntry } from '../models/WaterEntry.js';
import { weekdayOf } from './dates.js';
import { activeDaySet } from './exercisePlan.js';

/** Calcula bandeiras do dia para prêmios ninja. */
export async function dayFlagsForUser(userId, date) {
  const habits = await Habit.find({ userId }).sort({ createdAt: 1 });
  if (habits.length === 0) {
    return { waterDone: false, workoutDone: false, perfectDone: false, countedTotal: 0, doneCount: 0 };
  }

  const ids = habits.map((h) => h._id);
  const [checkins, waters] = await Promise.all([
    CheckIn.find({ userId, habitId: { $in: ids }, date }).select('habitId').lean(),
    WaterEntry.find({ userId, habitId: { $in: ids }, date }).select('habitId ml').lean(),
  ]);

  const checked = new Set(checkins.map((c) => c.habitId.toString()));
  const waterByHabit = new Map();
  for (const entry of waters) {
    const key = entry.habitId.toString();
    waterByHabit.set(key, (waterByHabit.get(key) || 0) + entry.ml);
  }

  const weekday = weekdayOf(date);
  let waterDone = false;
  let workoutDone = false;
  let countedTotal = 0;
  let doneCount = 0;

  for (const habit of habits) {
    const id = habit._id.toString();
    const kind = habit.kind || 'check';

    if (kind === 'water') {
      countedTotal += 1;
      const total = waterByHabit.get(id) || 0;
      const done = total >= (habit.goalMl || 0);
      if (done) {
        doneCount += 1;
        waterDone = true;
      }
      continue;
    }

    if (kind === 'exercise') {
      const active = activeDaySet(habit);
      if (!active.has(weekday)) continue;
      countedTotal += 1;
      const done = checked.has(id);
      if (done) {
        doneCount += 1;
        workoutDone = true;
      }
      continue;
    }

    countedTotal += 1;
    if (checked.has(id)) doneCount += 1;
  }

  const perfectDone = countedTotal > 0 && doneCount === countedTotal;
  return { waterDone, workoutDone, perfectDone, countedTotal, doneCount };
}
