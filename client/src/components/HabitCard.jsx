import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatLiters, litersToInput } from '../format.js';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const QUICK_GLASSES = [200, 300, 500];

function weekdayIndex(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function HabitCard({ habit, date, onChange }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(habit.title);
  const [kind, setKind] = useState(habit.kind);
  const [goal, setGoal] = useState(litersToInput(habit.goalMl));
  const [ml, setMl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setName(habit.title);
    setKind(habit.kind);
    setGoal(litersToInput(habit.goalMl));
    setError('');
    setEditing(true);
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await api(`/api/habits/${habit.id}`, {
        method: 'PATCH',
        body: { date, title: name, kind, goalLiters: goal },
      });
      onChange(data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    setSaving(true);
    setError('');
    try {
      onChange(await api(`/api/habits/${habit.id}/toggle`, { method: 'POST', body: { date } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addGlass(amount) {
    setSaving(true);
    setError('');
    try {
      onChange(await api(`/api/habits/${habit.id}/water`, { method: 'POST', body: { date, ml: amount } }));
      setMl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeGlass(entryId) {
    setSaving(true);
    setError('');
    try {
      onChange(await api(`/api/habits/${habit.id}/water/${entryId}?date=${date}`, { method: 'DELETE' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeHabit() {
    const confirmed = window.confirm(`Remover “${habit.title}”? O histórico desse hábito também sai.`);
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      onChange(await api(`/api/habits/${habit.id}?date=${date}`, { method: 'DELETE' }));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const fill = habit.kind === 'water' && habit.goalMl
    ? Math.min(100, Math.round((habit.totalMl / habit.goalMl) * 100))
    : 0;

  return (
    <li className={habit.doneToday ? 'habit done' : 'habit'}>
      {habit.kind === 'water' && habit.doneToday ? (
        <div className="check" aria-hidden="true"><span /></div>
      ) : habit.kind === 'water' ? (
        <div className="vessel" style={{ '--fill': fill }} aria-hidden="true">
          {fill > 0 ? (
            <div className="vessel-water">
              <span className="sheen" />
              <span className="bubble b1" />
              <span className="bubble b2" />
              <span className="bubble b3" />
            </div>
          ) : null}
          <span className="vessel-glint" />
        </div>
      ) : habit.kind === 'exercise' && habit.restToday ? (
        <div className="check rest" role="img" aria-label="Dia de descanso" />
      ) : (
        <button
          className="check"
          type="button"
          aria-pressed={habit.doneToday}
          aria-label={habit.doneToday ? `Desmarcar ${habit.title}` : `Marcar ${habit.title}`}
          disabled={saving || editing}
          onClick={toggle}
        >
          <span />
        </button>
      )}

      <div className="habit-body">
        {editing ? (
          <form className="edit" onSubmit={saveEdit}>
            <label className="field">
              <span>Nome</span>
              <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required />
            </label>
            <KindPicker kind={kind} onChange={setKind} />
            {kind === 'water' ? (
              <label className="field">
                <span>Meta do dia, em litros</span>
                <input
                  inputMode="decimal"
                  placeholder="2,5"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  required
                />
              </label>
            ) : null}
            {kind !== habit.kind ? (
              <p className="hint">Mudar o tipo apaga o histórico deste hábito.</p>
            ) : null}
            {error ? <p className="alert" role="alert">{error}</p> : null}
            <div className="edit-actions">
              <button className="ghost" type="button" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
              <button className="primary" type="submit" disabled={saving || !name.trim()}>Salvar</button>
            </div>
          </form>
        ) : (
          <>
            <div className="habit-line">
              <h2>
                {habit.kind === 'exercise'
                  ? <Link to={`/exercicios/${habit.id}`}>{habit.title}</Link>
                  : habit.title}
              </h2>
              <div className="habit-actions">
                <button className="text" type="button" onClick={openEdit} disabled={saving}>Editar</button>
                <button className="text" type="button" onClick={removeHabit} disabled={saving}>Remover</button>
              </div>
            </div>

            {habit.kind === 'water' ? (
              <>
                <p className={habit.doneToday ? 'streak done' : 'streak'}>
                  {habit.doneToday
                    ? `Meta batida · ${formatLiters(habit.totalMl)} de ${formatLiters(habit.goalMl)}`
                    : `${formatLiters(habit.totalMl)} de ${formatLiters(habit.goalMl)}`}
                </p>
                <div className="meter sip" aria-hidden="true">
                  <span style={{ width: `${fill}%` }} />
                </div>
              </>
            ) : null}
            {habit.kind === 'exercise' ? (
              <>
                <p className="streak">
                  {habit.restToday
                    ? 'Descanso hoje'
                    : habit.todayPlan?.length
                      ? habit.todayPlan.join(' · ')
                      : 'Dia de treino, sem exercícios ainda'}
                </p>
                <Link className="open-training" to={`/exercicios/${habit.id}`}>Abrir treino</Link>
              </>
            ) : null}
            <p className="streak">
              {habit.streak > 0
                ? `${habit.streak} ${habit.kind === 'water'
                  ? (habit.streak === 1 ? 'dia na meta' : 'dias na meta')
                  : habit.kind === 'exercise'
                    ? (habit.streak === 1 ? 'treino seguido' : 'treinos seguidos')
                    : (habit.streak === 1 ? 'dia seguido' : 'dias seguidos')}`
                : 'Ainda sem sequência'}
            </p>
            {error ? <p className="alert" role="alert">{error}</p> : null}
            <Week week={habit.week} />
            {habit.kind === 'water' ? (
              <>
                {habit.entries.length === 0 ? <p className="hint">Nenhum copo ainda hoje.</p> : (
                  <ul className="glasses">
                    {habit.entries.map((entry, index) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="cup-hit"
                          onClick={() => removeGlass(entry.id)}
                          disabled={saving}
                          aria-label={`Tirar copo de ${entry.ml} ml`}
                        >
                          <CupMark ml={entry.ml} index={index} />
                          <span className="cup-ml">{entry.ml}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="sip-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (ml.trim()) addGlass(ml.trim());
                  }}
                >
                  <label className="sr" htmlFor={`ml-${habit.id}`}>Ml do copo</label>
                  <input
                    id={`ml-${habit.id}`}
                    inputMode="numeric"
                    placeholder="ml do copo"
                    value={ml}
                    onChange={(event) => setMl(event.target.value)}
                  />
                  <button className="primary" type="submit" disabled={saving || !ml.trim()}>Anotar</button>
                </form>
                <div className="chips">
                  {QUICK_GLASSES.map((amount) => (
                    <button key={amount} type="button" onClick={() => addGlass(amount)} disabled={saving}>
                      {amount} ml
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function CupMark({ ml, index }) {
  const amount = Number(ml) || 0;
  const t = Math.min(1, Math.max(0, (amount - 50) / 900));
  const width = Math.round(34 + t * 12);
  const height = Math.round(46 + t * 14);

  return (
    <span className="cup" style={{ width, height, '--lag': `${(index % 6) * 0.2}s` }} aria-hidden="true">
      <span className="cup-rim" />
      <span className="cup-glass">
        <span className="cup-water">
          <span className="cup-bubble" />
          <span className="cup-bubble alt" />
        </span>
      </span>
    </span>
  );
}

function Week({ week }) {
  return (
    <ol className="week">
      {week.map((day) => {
        const index = weekdayIndex(day.date);
        return (
          <li key={day.date} title={WEEKDAYS[index]}>
            <span>{WEEKDAY_LETTERS[index]}</span>
            <i className={day.rest ? 'rest' : day.done ? 'on' : ''} />
          </li>
        );
      })}
    </ol>
  );
}

export function KindPicker({ kind, onChange }) {
  return (
    <div className="kinds" role="group" aria-label="Tipo de hábito">
      <button type="button" aria-pressed={kind === 'check'} onClick={() => onChange('check')}>Uma vez ao dia</button>
      <button type="button" aria-pressed={kind === 'water'} onClick={() => onChange('water')}>Água</button>
      <button type="button" aria-pressed={kind === 'exercise'} onClick={() => onChange('exercise')}>Exercício</button>
    </div>
  );
}
