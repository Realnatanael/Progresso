import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, todayISO } from '../api.js';

const DAY_PICKS = [
  { weekday: 1, short: 'Seg' },
  { weekday: 2, short: 'Ter' },
  { weekday: 3, short: 'Qua' },
  { weekday: 4, short: 'Qui' },
  { weekday: 5, short: 'Sex' },
  { weekday: 6, short: 'Sáb' },
  { weekday: 0, short: 'Dom' },
];

export function ExercisePage() {
  const { id } = useParams();
  const date = todayISO();
  const [plan, setPlan] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/api/habits/${id}/plan?date=${date}`)
      .then((data) => {
        if (active) setPlan(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, date]);

  async function run(action) {
    setSaving(true);
    setError('');
    try {
      setPlan(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(weekday) {
    const next = plan.activeDays.includes(weekday)
      ? plan.activeDays.filter((day) => day !== weekday)
      : [...plan.activeDays, weekday];
    return run(() => api(`/api/habits/${id}/days`, {
      method: 'PATCH',
      body: { date, activeDays: next },
    }));
  }

  function addExercise(event, weekday) {
    event.preventDefault();
    const name = (drafts[weekday] || '').trim();
    if (!name) return undefined;
    return run(async () => {
      const data = await api(`/api/habits/${id}/exercises`, {
        method: 'POST',
        body: { date, weekday, name },
      });
      setDrafts((current) => ({ ...current, [weekday]: '' }));
      return data;
    });
  }

  function moveExercise(exerciseId, direction) {
    return run(() => api(`/api/habits/${id}/exercises/${exerciseId}`, {
      method: 'PATCH',
      body: { date, direction },
    }));
  }

  function removeExercise(exerciseId) {
    return run(() => api(`/api/habits/${id}/exercises/${exerciseId}?date=${date}`, { method: 'DELETE' }));
  }

  async function toggleDone() {
    setSaving(true);
    setError('');
    try {
      await api(`/api/habits/${id}/toggle`, { method: 'POST', body: { date } });
      setPlan(await api(`/api/habits/${id}/plan?date=${date}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app">
      <header className="top">
        <Link className="ghost" to="/">Hoje</Link>
      </header>

      {loading ? <p className="screen-status">Abrindo treino…</p> : null}
      {error ? <p className="alert" role="alert">{error}</p> : null}

      {plan ? (
        <>
          <section className="today">
            <p className="date">Treino</p>
            <h1>{plan.title}</h1>
            <p className={plan.doneToday ? 'summary done' : 'summary'}>
              {plan.restToday
                ? 'Hoje é descanso. Este hábito não entra na conta do dia.'
                : plan.doneToday ? 'Treino de hoje feito' : 'Dia de treino'}
            </p>
            {plan.restToday ? null : (
              <button className="primary" type="button" onClick={toggleDone} disabled={saving}>
                {plan.doneToday ? 'Desmarcar treino' : 'Marcar treino de hoje'}
              </button>
            )}
          </section>

          <section className="plan-block">
            <h2>Dias de treino</h2>
            <div className="day-picks" role="group" aria-label="Dias de treino">
              {DAY_PICKS.map((day) => (
                <button
                  key={day.weekday}
                  type="button"
                  aria-pressed={plan.activeDays.includes(day.weekday)}
                  disabled={saving}
                  onClick={() => toggleDay(day.weekday)}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </section>

          {plan.days.map((day) => (
            <section key={day.weekday} className={day.today ? 'plan-day today' : 'plan-day'}>
              <h2>{day.name}{day.today ? ' · hoje' : ''}</h2>
              {day.exercises.length === 0 ? <p className="hint">Nenhum exercício neste dia.</p> : (
                <ul className="exercise-list">
                  {day.exercises.map((exercise, index) => (
                    <li key={exercise.id}>
                      <span>{exercise.name}</span>
                      <button type="button" className="text" aria-label={`Subir ${exercise.name}`} disabled={saving || index === 0} onClick={() => moveExercise(exercise.id, 'up')}>↑</button>
                      <button type="button" className="text" aria-label={`Descer ${exercise.name}`} disabled={saving || index === day.exercises.length - 1} onClick={() => moveExercise(exercise.id, 'down')}>↓</button>
                      <button type="button" className="text" aria-label={`Remover ${exercise.name}`} disabled={saving} onClick={() => removeExercise(exercise.id)}>×</button>
                    </li>
                  ))}
                </ul>
              )}
              <form className="exercise-add" onSubmit={(event) => addExercise(event, day.weekday)}>
                <label className="sr" htmlFor={`ex-${day.weekday}`}>Exercício de {day.name}</label>
                <input
                  id={`ex-${day.weekday}`}
                  maxLength={80}
                  placeholder="Novo exercício"
                  value={drafts[day.weekday] || ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [day.weekday]: event.target.value }))}
                />
                <button className="primary" type="submit" disabled={saving || !(drafts[day.weekday] || '').trim()}>
                  Adicionar
                </button>
              </form>
            </section>
          ))}
        </>
      ) : null}
    </main>
  );
}
