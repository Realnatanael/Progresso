import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { AppNav } from '../components/AppNav.jsx';
import { BodyAvatar } from '../components/BodyAvatar.jsx';
import { formatKg, formatNumber, genderLabel } from '../format.js';
import { USER_BASELINE, partsFromMeasures } from '../bodyMeasures.js';
import { findWorkoutTag, RECOVERY_LEVELS, WORKOUT_TAGS } from '../muscles.js';
import { syncNinja } from '../ninjaSync.js';

const DAY_PICKS = [
  { weekday: 1, short: 'Seg' },
  { weekday: 2, short: 'Ter' },
  { weekday: 3, short: 'Qua' },
  { weekday: 4, short: 'Qui' },
  { weekday: 5, short: 'Sex' },
  { weekday: 6, short: 'Sáb' },
  { weekday: 0, short: 'Dom' },
];

function sameMuscles(a = [], b = []) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

function findExerciseByTag(day, tag) {
  const label = tag.label.toLowerCase();
  const byName = day.exercises.find((item) => String(item.name || '').trim().toLowerCase() === label);
  if (byName) return byName;
  return day.exercises.find((item) => sameMuscles(item.muscles, tag.muscles)) || null;
}

function customExercises(day) {
  return day.exercises.filter((item) => !findWorkoutTag(item.name) && !WORKOUT_TAGS.some((tag) => sameMuscles(item.muscles, tag.muscles)));
}

export function BodyPage() {
  const { logout } = useAuth();
  const date = todayISO();
  const [body, setBody] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/api/body?date=${date}`)
      .then((data) => {
        if (active) setBody(data);
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
  }, [date]);

  async function run(action) {
    setSaving(true);
    setError('');
    try {
      const data = await action();
      setBody(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  const plan = body?.workout;

  function refreshBody() {
    return api(`/api/body?date=${date}`);
  }

  function toggleDay(weekday) {
    if (!plan) return undefined;
    const next = plan.activeDays.includes(weekday)
      ? plan.activeDays.filter((day) => day !== weekday)
      : [...plan.activeDays, weekday];
    return run(async () => {
      await api(`/api/habits/${plan.id}/days`, {
        method: 'PATCH',
        body: { date, activeDays: next },
      });
      return refreshBody();
    });
  }

  function toggleTag(weekday, tag) {
    if (!plan) return undefined;
    const day = plan.days.find((item) => item.weekday === weekday);
    if (!day) return undefined;
    const existing = findExerciseByTag(day, tag);
    if (existing) {
      return run(async () => {
        await api(`/api/habits/${plan.id}/exercises/${existing.id}?date=${date}`, { method: 'DELETE' });
        return refreshBody();
      });
    }
    return run(async () => {
      await api(`/api/habits/${plan.id}/exercises`, {
        method: 'POST',
        body: { date, weekday, name: tag.label, muscles: tag.muscles },
      });
      return refreshBody();
    });
  }

  function removeExercise(exerciseId) {
    if (!plan) return undefined;
    return run(async () => {
      await api(`/api/habits/${plan.id}/exercises/${exerciseId}?date=${date}`, { method: 'DELETE' });
      return refreshBody();
    });
  }

  function toggleDone() {
    if (!plan) return undefined;
    return run(async () => {
      await api(`/api/habits/${plan.id}/toggle`, { method: 'POST', body: { date } });
      const bodyData = await refreshBody();
      syncNinja(date);
      return bodyData;
    });
  }

  const stats = body?.stats;
  const profile = body?.profile;
  const hasProfile = Boolean(profile?.heightCm && profile?.age && profile?.gender);
  const m = profile?.measures || {};
  const parts = partsFromMeasures({
    armCm: m.armCm ?? USER_BASELINE.armCm,
    shoulderCm: m.shoulderCm ?? USER_BASELINE.shoulderCm,
    forearmCm: m.forearmCm ?? USER_BASELINE.forearmCm,
    chestCm: m.chestCm ?? USER_BASELINE.chestCm,
    thighCm: m.thighCm ?? USER_BASELINE.thighCm,
    calfCm: m.calfCm ?? USER_BASELINE.calfCm,
    hipsCm: m.hipsCm ?? USER_BASELINE.hipsCm,
  });
  const todayPlan = plan?.days.find((day) => day.today);
  const recoveryMuscles = body?.recovery?.muscles || [];
  const activeRecovery = recoveryMuscles.filter((item) => item.level);
  const recoveryKey = activeRecovery.map((item) => `${item.id}:${item.level}`).join('|');

  return (
    <main className="app with-nav app-wide">
      <header className="top">
        <p className="mark">Progresso</p>
        <button className="ghost" type="button" onClick={() => logout()}>Sair</button>
      </header>

      {loading ? <p className="screen-status">Abrindo o corpo…</p> : null}
      {error ? <p className="alert" role="alert">{error}</p> : null}

      {!loading ? (
        <>
          <section className="today">
            <p className="date">Corpo</p>
            <h1>Seu corpo</h1>
            <p className="summary">
              {[
                stats?.bmi != null ? `IMC ${formatNumber(stats.bmi)} · ${stats.bmiLabel}` : null,
                body?.avatar?.label || null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Preencha seus dados no Perfil e marque treinos'}
            </p>
          </section>

          <section className="body-panel">
            <BodyAvatar
              gender={profile?.gender || 'male'}
              definition={body?.avatar?.definition ?? 0}
              volume={body?.avatar?.volume ?? 0.15}
              parts={parts}
              heightCm={profile?.heightCm || USER_BASELINE.heightCm}
              recoveryMuscles={recoveryMuscles}
              recoveryKey={recoveryKey}
            >
              <aside className="body-hud">
                <Link className="body-hud-edit" to="/perfil">Editar</Link>
                {hasProfile ? (
                  <dl className="body-hud-list">
                    <div className="body-hud-item">
                      <dt>Altura</dt>
                      <dd>{profile.heightCm} cm</dd>
                    </div>
                    <div className="body-hud-item">
                      <dt>Peso</dt>
                      <dd>{stats.weightKg != null ? formatKg(stats.weightKg) : '—'}</dd>
                    </div>
                    <div className="body-hud-item">
                      <dt>Idade</dt>
                      <dd>{profile.age} anos</dd>
                    </div>
                    <div className="body-hud-item">
                      <dt>Gênero</dt>
                      <dd className="body-hud-symbol" aria-label={genderLabel(profile.gender)}>
                        <GenderIcon gender={profile.gender} />
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="body-hud-empty">
                    Sem dados ainda.
                    {' '}
                    <Link to="/perfil">Abrir Perfil</Link>
                  </p>
                )}
              </aside>
            </BodyAvatar>

            {activeRecovery.length ? (
              <div className="recovery-strip" aria-label="Recuperação muscular">
                <div className="recovery-legend compact">
                  {RECOVERY_LEVELS.map((level) => (
                    <span key={level.id} className="recovery-legend-item" title={level.label}>
                      <i style={{ background: level.color }} />
                    </span>
                  ))}
                </div>
                <ul className="recovery-chips">
                  {activeRecovery.map((item) => (
                    <li key={item.id} className={`recovery-chip ${item.level}`}>
                      {item.label}
                      <span>{formatHoursLeft(item.hoursLeft)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {plan ? (
            <section className="plan-block">
              <div className="section-head">
                <h2>{plan.title}</h2>
                <button className="text" type="button" onClick={() => setEditing((value) => !value)} disabled={saving}>
                  {editing ? 'Pronto' : 'Editar plano'}
                </button>
              </div>

              {editing ? (
                <>
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
                  <ul className="plan-read">
                    {plan.days.map((day) => {
                      const leftovers = customExercises(day);
                      return (
                        <li key={day.weekday} className={day.today ? 'today' : ''}>
                          <div className="plan-read-line">
                            <strong>{day.name}{day.today ? ' · hoje' : ''}</strong>
                          </div>
                          <div className="plan-edit">
                            <p className="hint">Toque nas tags do que quer treinar — sem digitar</p>
                            <div className="workout-tags" role="group" aria-label={`Tags de ${day.name}`}>
                              {WORKOUT_TAGS.map((tag) => {
                                const on = Boolean(findExerciseByTag(day, tag));
                                return (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    className="workout-tag"
                                    aria-pressed={on}
                                    disabled={saving}
                                    onClick={() => toggleTag(day.weekday, tag)}
                                  >
                                    {tag.label}
                                  </button>
                                );
                              })}
                            </div>
                            {leftovers.length ? (
                              <ul className="legacy-exercises" aria-label={`Itens antigos de ${day.name}`}>
                                {leftovers.map((exercise) => (
                                  <li key={exercise.id}>
                                    <span>{exercise.name}</span>
                                    <button
                                      type="button"
                                      className="text"
                                      aria-label={`Remover ${exercise.name}`}
                                      disabled={saving}
                                      onClick={() => removeExercise(exercise.id)}
                                    >
                                      Remover
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : plan.restToday || !todayPlan ? (
                <p className="summary">Hoje é descanso</p>
              ) : (
                <>
                  <p className={plan.doneToday ? 'summary done' : 'summary'}>
                    {plan.doneToday ? 'Treino de hoje feito' : `Hoje · ${todayPlan.name}`}
                  </p>
                  <p className="hint">
                    {todayPlan.exercises.length
                      ? todayPlan.exercises.map((item) => findWorkoutTag(item.name)?.label || item.name).join(' · ')
                      : 'Nenhuma tag neste dia — toque em Editar plano'}
                  </p>
                  <button className="primary mark-workout" type="button" onClick={toggleDone} disabled={saving}>
                    {plan.doneToday ? 'Desmarcar treino' : 'Marcar treino de hoje'}
                  </button>
                </>
              )}
            </section>
          ) : (
            <p className="hint">
              Crie um hábito do tipo Exercício em <Link to="/">Hoje</Link> para montar o treino.
            </p>
          )}
        </>
      ) : null}

      <AppNav />
    </main>
  );
}

function formatHoursLeft(hours) {
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return days === 1 ? '1 dia' : `${days} dias`;
  }
  const rounded = Math.max(1, Math.round(hours));
  return rounded === 1 ? '1 h' : `${rounded} h`;
}

function GenderIcon({ gender }) {
  if (gender === 'female') {
    return (
      <svg className="gender-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.6" />
        <path d="M12 14.2V21M9.2 18.2h5.6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (gender === 'male') {
    return (
      <svg className="gender-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.2" cy="13.8" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.6" />
        <path d="M14 10l5.2-5.2M19.2 4.8H14.4M19.2 4.8v4.8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="gender-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
