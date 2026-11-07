import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { AppNav } from '../components/AppNav.jsx';
import { BodyAvatar } from '../components/BodyAvatar.jsx';
import { formatKg, formatNumber, genderLabel } from '../format.js';
import { PART_RANGES, USER_BASELINE, partsFromMeasures } from '../bodyMeasures.js';

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
  /** Testes locais de circunferência (cm) → remodelam regiões do avatar. */
  const [bicepsCm, setBicepsCm] = useState(USER_BASELINE.armCm);
  const [shoulderCm, setShoulderCm] = useState(USER_BASELINE.shoulderCm);
  const [forearmCm, setForearmCm] = useState(USER_BASELINE.forearmCm);
  const [chestCm, setChestCm] = useState(USER_BASELINE.chestCm);

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

  const parts = partsFromMeasures({
    armCm: bicepsCm,
    shoulderCm,
    forearmCm,
    chestCm,
    calfCm: USER_BASELINE.calfCm,
  });

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

            <div className="part-tests">
              <label className="part-test">
                <span className="part-test-head">
                  <strong>Braço</strong>
                  <em>{formatNumber(bicepsCm)} cm · {Math.round(parts.arms * 100)}%</em>
                </span>
                <input
                  type="range"
                  min={PART_RANGES.arms.lean}
                  max={PART_RANGES.arms.goal}
                  step={0.5}
                  value={bicepsCm}
                  onChange={(event) => setBicepsCm(Number(event.target.value))}
                />
                <span className="hint">Base {USER_BASELINE.armCm} → teto ~{PART_RANGES.arms.goal} cm</span>
              </label>

              <label className="part-test">
                <span className="part-test-head">
                  <strong>Ombro</strong>
                  <em>{formatNumber(shoulderCm)} cm · {Math.round(parts.shoulders * 100)}%</em>
                </span>
                <input
                  type="range"
                  min={PART_RANGES.shoulders.lean}
                  max={PART_RANGES.shoulders.goal}
                  step={0.5}
                  value={shoulderCm}
                  onChange={(event) => setShoulderCm(Number(event.target.value))}
                />
                <span className="hint">Base ~{USER_BASELINE.shoulderCm} → teto ~{PART_RANGES.shoulders.goal} cm</span>
              </label>

              <label className="part-test">
                <span className="part-test-head">
                  <strong>Antebraço</strong>
                  <em>{formatNumber(forearmCm)} cm · {Math.round(parts.forearms * 100)}%</em>
                </span>
                <input
                  type="range"
                  min={PART_RANGES.forearms.lean}
                  max={PART_RANGES.forearms.goal}
                  step={0.5}
                  value={forearmCm}
                  onChange={(event) => setForearmCm(Number(event.target.value))}
                />
                <span className="hint">Base {USER_BASELINE.forearmCm} → teto ~{PART_RANGES.forearms.goal} cm</span>
              </label>

              <label className="part-test">
                <span className="part-test-head">
                  <strong>Peito</strong>
                  <em>{formatNumber(chestCm)} cm · {Math.round(parts.chest * 100)}%</em>
                </span>
                <input
                  type="range"
                  min={PART_RANGES.chest.lean}
                  max={PART_RANGES.chest.goal}
                  step={0.5}
                  value={chestCm}
                  onChange={(event) => setChestCm(Number(event.target.value))}
                />
                <span className="hint">Base {USER_BASELINE.chestCm} → teto ~{PART_RANGES.chest.goal} cm · placa frontal + fenda</span>
              </label>
            </div>
          </section>

          {plan ? (
            <section className="plan-block">
              <div className="section-head">
                <h2>{plan.title}</h2>
                <button className="text" type="button" onClick={() => setEditing((value) => !value)} disabled={saving}>
                  {editing ? 'Pronto' : 'Editar plano'}
                </button>
              </div>
              <p className={plan.doneToday ? 'summary done' : 'summary'}>
                {plan.restToday
                  ? 'Hoje é descanso'
                  : plan.doneToday ? 'Treino de hoje feito' : 'Dia de treino'}
              </p>
              {plan.restToday ? null : (
                <button className="primary mark-workout" type="button" onClick={toggleDone} disabled={saving}>
                  {plan.doneToday ? 'Desmarcar treino' : 'Marcar treino de hoje'}
                </button>
              )}

              {editing ? (
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
              ) : (
                <p className="hint day-summary">
                  {DAY_PICKS.filter((day) => plan.activeDays.includes(day.weekday)).map((day) => day.short).join(' · ') || 'Nenhum dia ativo'}
                </p>
              )}

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
                    {editing ? (
                      <div className="plan-edit">
                        {day.exercises.length ? (
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
                    ) : null}
                  </li>
                ))}
              </ul>
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
