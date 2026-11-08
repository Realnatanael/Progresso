import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { AppNav } from '../components/AppNav.jsx';
import { formatKg, formatNumber, formatWeightDate, GENDERS } from '../format.js';
import { PART_RANGES, PHYSIQUE_STAGES, USER_BASELINE } from '../bodyMeasures.js';

const MEASURE_FIELDS = [
  { key: 'armCm', label: 'Braço', range: PART_RANGES.arms, stageKey: 'armCm' },
  { key: 'shoulderCm', label: 'Ombro', range: PART_RANGES.shoulders, stageKey: 'shoulderCm' },
  { key: 'forearmCm', label: 'Antebraço', range: PART_RANGES.forearms, stageKey: 'forearmCm' },
  { key: 'chestCm', label: 'Peito', range: PART_RANGES.chest, stageKey: 'chestCm' },
  { key: 'thighCm', label: 'Coxa', range: PART_RANGES.thighs, stageKey: 'thighCm' },
  { key: 'calfCm', label: 'Panturrilha', range: PART_RANGES.calves, stageKey: 'calfCm' },
  { key: 'hipsCm', label: 'Glúteo / quadril', range: PART_RANGES.hips, stageKey: 'hipsCm' },
];

function emptyMeasures() {
  return {
    armCm: String(USER_BASELINE.armCm),
    shoulderCm: String(USER_BASELINE.shoulderCm),
    forearmCm: String(USER_BASELINE.forearmCm),
    chestCm: String(USER_BASELINE.chestCm),
    thighCm: String(USER_BASELINE.thighCm),
    calfCm: String(USER_BASELINE.calfCm),
    hipsCm: String(USER_BASELINE.hipsCm),
  };
}

function measuresFromProfile(measures) {
  const base = emptyMeasures();
  if (!measures) return base;
  for (const field of MEASURE_FIELDS) {
    const value = measures[field.key];
    if (value != null) base[field.key] = String(value).replace('.', ',');
  }
  return base;
}

export function ProfilePage() {
  const { user, logout } = useAuth();
  const date = todayISO();
  const [body, setBody] = useState(null);
  const [kg, setKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [measures, setMeasures] = useState(emptyMeasures);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/api/body?date=${date}`)
      .then((data) => {
        if (!active) return;
        applyBody(data);
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

  function applyBody(data) {
    setBody(data);
    const todayWeight = data.weights.find((entry) => entry.date === date);
    setKg(todayWeight ? String(todayWeight.kg).replace('.', ',') : '');
    setHeightCm(data.profile.heightCm != null ? String(data.profile.heightCm) : '');
    setAge(data.profile.age != null ? String(data.profile.age) : '');
    setGender(data.profile.gender || 'male');
    setMeasures(measuresFromProfile(data.profile.measures));
  }

  async function run(action) {
    setSaving(true);
    setError('');
    try {
      const data = await action();
      applyBody(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function saveProfile(event) {
    event.preventDefault();
    return run(() => api('/api/body/profile', {
      method: 'PATCH',
      body: { date, heightCm, age: Number(age), gender },
    }));
  }

  function saveMeasures(event) {
    event.preventDefault();
    const bodyPayload = { date };
    for (const field of MEASURE_FIELDS) {
      bodyPayload[field.key] = measures[field.key];
    }
    return run(() => api('/api/body/measures', {
      method: 'PATCH',
      body: bodyPayload,
    }));
  }

  function fillStage3Measures() {
    const next = {};
    for (const field of MEASURE_FIELDS) {
      next[field.key] = String(PHYSIQUE_STAGES[3][field.stageKey]);
    }
    setMeasures(next);
  }

  function saveWeight(event) {
    event.preventDefault();
    return run(() => api('/api/body/weight', { method: 'POST', body: { date, kg } }));
  }

  function removeWeight() {
    return run(() => api(`/api/body/weight?date=${date}`, { method: 'DELETE' }));
  }

  const todayWeight = body?.weights.find((entry) => entry.date === date);
  const stats = body?.stats;
  const firstName = user?.name?.split(' ')[0] || 'você';

  return (
    <main className="app with-nav">
      <header className="top">
        <p className="mark">Progresso</p>
        <button className="ghost" type="button" onClick={() => logout()}>Sair</button>
      </header>

      {loading ? <p className="screen-status">Abrindo o perfil…</p> : null}
      {error ? <p className="alert" role="alert">{error}</p> : null}

      {!loading ? (
        <>
          <section className="today">
            <p className="date">Perfil</p>
            <h1>Olá, {firstName}</h1>
            <p className="summary">
              Dados pessoais, peso e medidas. O avatar em{' '}
              <Link to="/corpo">Corpo</Link> acompanha o que você salvar aqui.
            </p>
          </section>

          <section className="plan-block">
            <h2>Dados pessoais</h2>
            <form className="profile-form" onSubmit={saveProfile}>
              <label className="field">
                <span>Altura (cm)</span>
                <input
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                  placeholder="175"
                  required
                />
              </label>
              <label className="field">
                <span>Idade</span>
                <input
                  inputMode="numeric"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="25"
                  required
                />
              </label>
              <div className="gender-picks" role="group" aria-label="Gênero">
                {GENDERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={gender === option.value}
                    onClick={() => setGender(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {stats?.bmi != null ? (
                <p className="hint">
                  IMC atual: {formatNumber(stats.bmi)} · {stats.bmiLabel}
                </p>
              ) : null}
              <button className="primary" type="submit" disabled={saving || !heightCm.trim() || !age.trim()}>
                Salvar dados
              </button>
            </form>
          </section>

          <section className="plan-block">
            <div className="section-head">
              <h2>Medidas</h2>
              <button className="text" type="button" onClick={fillStage3Measures} disabled={saving}>
                Preencher estágio 3
              </button>
            </div>
            <p className="hint">
              Circunferências em cm. O Corpo usa esses valores no avatar (volume leve).
            </p>
            <form className="profile-form measures-form" onSubmit={saveMeasures}>
              {MEASURE_FIELDS.map((field) => (
                <label key={field.key} className="field">
                  <span>{field.label} (cm)</span>
                  <input
                    inputMode="decimal"
                    value={measures[field.key]}
                    onChange={(event) => setMeasures((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))}
                    placeholder={String(USER_BASELINE[field.key])}
                    required
                  />
                  <em className="hint">
                    Est.1 {PHYSIQUE_STAGES[1][field.stageKey]} → est.3 {field.range.goal} cm
                  </em>
                </label>
              ))}
              <button className="primary" type="submit" disabled={saving}>
                Salvar medidas
              </button>
            </form>
          </section>

          <section className="plan-block weight-block">
            <h2>Peso</h2>
            <form className="weight-form" onSubmit={saveWeight}>
              <label className="field" htmlFor="weight-kg">
                <span>Peso de hoje, em kg</span>
                <input
                  id="weight-kg"
                  inputMode="decimal"
                  placeholder="78,5"
                  value={kg}
                  onChange={(event) => setKg(event.target.value)}
                />
              </label>
              <div className="edit-actions">
                {todayWeight ? (
                  <button className="ghost" type="button" onClick={removeWeight} disabled={saving}>
                    Apagar
                  </button>
                ) : null}
                <button className="primary" type="submit" disabled={saving || !kg.trim()}>
                  {todayWeight ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
            {body?.weights?.length ? (
              <>
                <WeightChart weights={body.weights} />
                <ul className="weight-list">
                  {[...body.weights].reverse().slice(0, 12).map((entry) => (
                    <li key={entry.date}>
                      <span>{formatWeightDate(entry.date)}</span>
                      <strong>{formatKg(entry.kg)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="hint">Ainda sem peso anotado. O corpo 3D muda quando houver peso e altura.</p>
            )}
          </section>
        </>
      ) : null}

      <AppNav />
    </main>
  );
}

function WeightChart({ weights }) {
  if (weights.length < 2) return null;
  const values = weights.map((entry) => entry.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.5, max - min);
  const width = 320;
  const height = 96;
  const pad = 8;
  const points = weights.map((entry, index) => {
    const x = pad + (index / (weights.length - 1)) * (width - pad * 2);
    const y = height - pad - ((entry.kg - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="weight-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução do peso">
      <polyline fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
