import { CheckIn } from '../models/CheckIn.js';
import { weekdayOf } from './dates.js';
import { normalizeMuscles } from './muscles.js';

export const TRAINING_DAYS = [
  { weekday: 1, name: 'Segunda' },
  { weekday: 2, name: 'Terça' },
  { weekday: 3, name: 'Quarta' },
  { weekday: 4, name: 'Quinta' },
  { weekday: 5, name: 'Sexta' },
  { weekday: 6, name: 'Sábado' },
  { weekday: 0, name: 'Domingo' },
];

export function activeDaySet(habit) {
  return new Set((habit.activeDays || []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
}

export function normalizeDays(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
}

export function orderedExercises(habit, weekday) {
  return habit.exercises
    .filter((item) => item.weekday === weekday)
    .sort((a, b) => a.position - b.position || String(a._id).localeCompare(String(b._id)));
}

export async function buildPlan(habit, userId, date) {
  const active = activeDaySet(habit);
  const weekday = weekdayOf(date);
  const checkin = await CheckIn.findOne({ habitId: habit._id, userId, date }).select('_id').lean();
  return {
    id: habit._id.toString(),
    title: habit.title,
    date,
    weekday,
    restToday: !active.has(weekday),
    doneToday: active.has(weekday) && Boolean(checkin),
    activeDays: [...active],
    days: TRAINING_DAYS.filter((day) => active.has(day.weekday)).map((day) => ({
      weekday: day.weekday,
      name: day.name,
      today: day.weekday === weekday,
      exercises: orderedExercises(habit, day.weekday).map((item) => ({
        id: item._id.toString(),
        name: item.name,
        muscles: normalizeMuscles(item.muscles),
      })),
    })),
  };
}

export function musclesForWeekday(habit, weekday) {
  return normalizeMuscles(
    orderedExercises(habit, weekday).flatMap((item) => item.muscles || []),
  );
}
