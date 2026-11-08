import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { AppNav } from '../components/AppNav.jsx';
import { BodyAvatar } from '../components/BodyAvatar.jsx';
import { formatKg, formatNumber, genderLabel } from '../format.js';
import { USER_BASELINE, partsFromMeasures } from '../bodyMeasures.js';
import { MUSCLE_GROUPS, RECOVERY_LEVELS } from '../muscles.js';

const DAY_PICKS = [
  { weekday: 1, short: 'Seg' },
  { weekday: 2, short: 'Ter' },
  { weekday: 3, short: 'Qua' },
  { weekday: 4, short: 'Qui' },
  { weekday: 5, short: 'Sex' },
  { weekday: 6, short: 'Sáb' },
  { weekday: 0, short: 'Dom' },
];

export function BodyPage() {
  const { logout } = useAuth();
  const date = todayISO();
  const [body, setBody] = useState(null);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
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

  function addExercise(event, weekday) {
    event.preventDefault();
    if (!plan) return undefined;
    const name = (drafts[weekday] || '').trim();
    if (!name) return undefined;
    return run(async () => {
      await api(`/api/habits/${plan.id}/exercises`, {
        method: 'POST',
        body: { date, weekday, name },
      });
      setDrafts((current) => ({ ...current, [weekday]: '' }));
      return refreshBody();
    });
  }

  function moveExercise(exerciseId, direction) {
    if (!plan) return undefined;
    return run(async () => {
      await api(`/api/habits/${plan.id}/exercises/${exerciseId}`, {
        method: 'PATCH',
        body: { date, direction },
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

  function toggleMuscle(exercise, muscleId) {
    if (!plan) return undefined;
    const current = exercise.muscles || [];
    const muscles = current.includes(muscleId)
      ? current.filter((id) => id !== muscleId)
      : [...current, muscleId];
    return run(async () => {
      await api(`/api/habits/${plan.id}/exercises/${exercise.id}`, {
        method: 'PATCH',
        body: { date, muscles },
      });
      return refreshBody();
    });
  }

  function toggleDone() {
    if (!plan) return undefined;
    return run(async () => {
      await api(`/api/habits/${plan.id}/toggle`, { method: 'POST', body: { date } });
      return refreshBody();
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
              label={body?.avatar?.label}
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

            <div className="recovery-legend" aria-label="Recuperação muscular">
              {RECOVERY_LEVELS.map((level) => (
                <span key={level.id} className="recovery-legend-item">
                  <i style={{ background: level.color }} />
                  {level.label}
                </span>
              ))}
              <span className="recovery-legend-item muted">Sem brilho = pronto</span>
            </div>
            {activeRecovery.length ? (
              <ul className="recovery-now">
                {activeRecovery.map((item) => (
                  <li key={item.id}>
                    <i className={`recovery-dot ${item.level}`} />
                    <strong>{item.label}</strong>
                    <span>
                      {item.hoursLeft > 0
                        ? `~${formatHoursLeft(item.hoursLeft)}`
                        : 'liberando'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint recovery-empty">Nenhum músculo em recuperação</p>
            )}
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
                    {plan.days.map((day) => (
                      <li key={day.weekday} className={day.today ? 'today' : ''}>
                        <div className="plan-read-line">
                          <strong>{day.name}{day.today ? ' · hoje' : ''}</strong>
                          <span>
                            {day.exercises.length
                              ? day.exercises.map((item) => item.name).join(' · ')
                              : 'Sem exercícios'}
                          </span>
                        </div>
                        <div className="plan-edit">
                          {day.exercises.length ? (
                            <ul className="exercise-list">
                              {day.exercises.map((exercise, index) => (
                                <li key={exercise.id} className="exercise-row">
                                  <div className="exercise-main">
                                    <span>{exercise.name}</span>
                                    <button type="button" className="text" aria-label={`Subir ${exercise.name}`} disabled={saving || index === 0} onClick={() => moveExercise(exercise.id, 'up')}>↑</button>
                                    <button type="button" className="text" aria-label={`Descer ${exercise.name}`} disabled={saving || index === day.exercises.length - 1} onClick={() => moveExercise(exercise.id, 'down')}>↓</button>
                                    <button type="button" className="text" aria-label={`Remover ${exercise.name}`} disabled={saving} onClick={() => removeExercise(exercise.id)}>×</button>
                                  </div>
                                  <div className="muscle-picks" role="group" aria-label={`Músculos de ${exercise.name}`}>
                                    {MUSCLE_GROUPS.map((muscle) => {
                                      const on = (exercise.muscles || []).includes(muscle.id);
                                      return (
                                        <button
                                          key={muscle.id}
                                          type="button"
                                          className="muscle-chip"
                                          aria-pressed={on}
                                          disabled={saving}
                                          onClick={() => toggleMuscle(exercise, muscle.id)}
                                        >
                                          {muscle.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : null}
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
                        </div>
                      </li>
                    ))}
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
                      ? todayPlan.exercises.map((item) => item.name).join(' · ')
                      : 'Sem exercícios neste dia'}
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
