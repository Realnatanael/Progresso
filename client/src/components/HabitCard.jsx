import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatLiters, litersToInput } from '../format.js';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
/** Tamanhos comuns: shot → garrafa. */
const CUP_SIZES = [100, 150, 200, 250, 300, 400, 500, 750, 1000];

function weekdayIndex(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function cupVisual(ml) {
  const amount = Math.max(0, Number(ml) || 0);
  const t = Math.min(1, Math.max(0, (amount - 80) / 920));
  return {
    width: Math.round(28 + t * 22),
    height: Math.round(36 + t * 28),
    fill: Math.round(30 + t * 58),
  };
}

function isBottle(ml) {
  return Number(ml) >= 1000;
}

function drinkLabel(ml) {
  const amount = Number(ml) || 0;
  if (amount >= 1000 && amount % 1000 === 0) return `${amount / 1000} L`;
  if (amount >= 1000) return formatLiters(amount);
  return `${amount} ml`;
}

function streakLabel(habit) {
  if (habit.streak <= 0) return 'Sem sequência';
  if (habit.kind === 'water') {
    return habit.streak === 1 ? '1 dia na meta' : `${habit.streak} dias na meta`;
  }
  if (habit.kind === 'exercise') {
    return habit.streak === 1 ? '1 treino seguido' : `${habit.streak} treinos seguidos`;
  }
  return habit.streak === 1 ? '1 dia seguido' : `${habit.streak} dias seguidos`;
}

function habitMeta(habit) {
  if (habit.kind === 'water') {
    const amount = habit.doneToday
      ? `Meta · ${formatLiters(habit.totalMl)}`
      : `${formatLiters(habit.totalMl)} de ${formatLiters(habit.goalMl)}`;
    return `${amount} · ${streakLabel(habit)}`;
  }
  if (habit.kind === 'exercise') {
    const plan = habit.restToday
      ? 'Descanso hoje'
      : habit.todayPlan?.length
        ? habit.todayPlan.join(' · ')
        : 'Sem exercícios ainda';
    return `${plan} · ${streakLabel(habit)}`;
  }
  return streakLabel(habit);
}

export function HabitCard({ habit, date, onChange }) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(habit.title);
  const [kind, setKind] = useState(habit.kind);
  const [goal, setGoal] = useState(litersToInput(habit.goalMl));
  const [ml, setMl] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  function openEdit() {
    setName(habit.title);
    setKind(habit.kind);
    setGoal(litersToInput(habit.goalMl));
    setError('');
    setMenuOpen(false);
    setEditing(true);
  }

  function chooseKind(next) {
    setKind(next);
    if (next === 'water') setName('Água');
  }

  async function saveEdit(event) {
    event.preventDefault();
    const nextTitle = kind === 'water' ? 'Água' : name.trim();
    if (kind !== 'water' && !nextTitle) return;
    setSaving(true);
    setError('');
    try {
      const data = await api(`/api/habits/${habit.id}`, {
        method: 'PATCH',
        body: { date, title: nextTitle, kind, goalLiters: goal },
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
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      onChange(await api(`/api/habits/${habit.id}/toggle`, { method: 'POST', body: { date } }));
    } catch (err) {
      setError(err.message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function addGlass(amount) {
    if (busy.current) return;
    const value = String(amount ?? '').trim();
    if (!value) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      onChange(await api(`/api/habits/${habit.id}/water`, { method: 'POST', body: { date, ml: value } }));
      setMl('');
      setCustomOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function removeGlass(entryId) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      onChange(await api(`/api/habits/${habit.id}/water/${entryId}?date=${date}`, { method: 'DELETE' }));
    } catch (err) {
      setError(err.message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function removeHabit() {
    setMenuOpen(false);
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

  const className = [
    'habit',
    habit.doneToday ? 'done' : '',
    `kind-${habit.kind}`,
    editing ? 'editing' : '',
  ].filter(Boolean).join(' ');

  return (
    <li className={className}>
      {editing ? (
        <form className="edit" onSubmit={saveEdit}>
          <KindPicker kind={kind} onChange={chooseKind} />
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
          ) : (
            <label className="field">
              <span>Nome</span>
              <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required />
            </label>
          )}
          {kind !== habit.kind ? (
            <p className="hint">Mudar o tipo apaga o histórico deste hábito.</p>
          ) : null}
          {error ? <p className="alert" role="alert">{error}</p> : null}
          <div className="edit-actions">
            <button className="ghost" type="button" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
            <button
              className="primary"
              type="submit"
              disabled={saving || (kind === 'water' ? !goal.trim() : !name.trim())}
            >
              Salvar
            </button>
          </div>
        </form>
      ) : (
        <>
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
              disabled={saving}
              onClick={toggle}
            >
              <span />
            </button>
          )}

          <div className="habit-body">
            <div className="habit-top">
              <div className="habit-heading">
                <h2>
                  {habit.kind === 'exercise'
                    ? <Link to="/corpo">{habit.title}</Link>
                    : habit.title}
                </h2>
                <p className={habit.doneToday ? 'habit-meta done' : 'habit-meta'}>
                  {habitMeta(habit)}
                </p>
              </div>

              <div className="habit-menu-wrap" ref={menuRef}>
                <button
                  className="habit-more"
                  type="button"
                  aria-label={`Opções de ${habit.title}`}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  disabled={saving}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  ···
                </button>
                {menuOpen ? (
                  <div className="habit-menu" role="menu">
                    <button type="button" role="menuitem" onClick={openEdit}>Editar</button>
                    <button type="button" role="menuitem" className="danger" onClick={removeHabit}>Remover</button>
                  </div>
                ) : null}
              </div>
            </div>

            {error ? <p className="alert" role="alert">{error}</p> : null}

            {habit.kind === 'water' && habit.entries.length > 0 ? (
              <ul className="glasses" aria-label="Goles de hoje">
                {habit.entries.map((entry, index) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="cup-hit"
                      onClick={() => removeGlass(entry.id)}
                      disabled={saving}
                      aria-label={`Tirar ${drinkLabel(entry.ml)}`}
                    >
                      <DrinkMark ml={entry.ml} index={index} />
                      <span className="cup-ml">{drinkLabel(entry.ml)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="habit-foot">
              <Week week={habit.week} today={date} />
              {habit.kind === 'water' ? (
                <button
                  className="habit-action"
                  type="button"
                  aria-expanded={pickerOpen}
                  disabled={saving}
                  onClick={() => {
                    setPickerOpen((open) => !open);
                    if (pickerOpen) {
                      setCustomOpen(false);
                      setMl('');
                    }
                  }}
                >
                  {pickerOpen ? 'Fechar' : '+ Água'}
                </button>
              ) : null}
              {habit.kind === 'exercise' ? (
                <Link className="habit-action" to="/corpo">Corpo</Link>
              ) : null}
            </div>

            {habit.kind === 'water' && pickerOpen ? (
              <div className="sip-block">
                <div className="cup-picker" role="group" aria-label="Tamanhos">
                  {CUP_SIZES.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="cup-pick"
                      onClick={() => addGlass(amount)}
                      disabled={saving}
                      aria-label={`Anotar ${drinkLabel(amount)}`}
                    >
                      <DrinkMark ml={amount} index={0} />
                      <span className="cup-ml">{drinkLabel(amount)}</span>
                    </button>
                  ))}
                </div>
                {customOpen ? (
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
                      placeholder="outro ml"
                      value={ml}
                      onChange={(event) => setMl(event.target.value)}
                      autoFocus
                    />
                    <button className="primary" type="submit" disabled={saving || !ml.trim()}>Anotar</button>
                    <button className="ghost" type="button" onClick={() => { setCustomOpen(false); setMl(''); }} disabled={saving}>
                      Fechar
                    </button>
                  </form>
                ) : (
                  <button className="text sip-custom" type="button" onClick={() => setCustomOpen(true)} disabled={saving}>
                    Outro tamanho…
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </li>
  );
}

function DrinkMark({ ml, index }) {
  const lag = `${(index % 6) * 0.2}s`;
  if (isBottle(ml)) {
    const amount = Math.max(1000, Number(ml) || 1000);
    const t = Math.min(1, (amount - 1000) / 1000);
    const width = Math.round(22 + t * 6);
    const height = Math.round(56 + t * 10);
    const fill = Math.round(58 + Math.min(28, ((amount - 1000) / 1000) * 28));
    return (
      <span
        className="bottle"
        style={{ width, height, '--fill': `${fill}%`, '--lag': lag }}
        aria-hidden="true"
      >
        <span className="bottle-cap" />
        <span className="bottle-neck" />
        <span className="bottle-body">
          <span className="bottle-water">
            <span className="cup-bubble" />
            <span className="cup-bubble alt" />
          </span>
        </span>
      </span>
    );
  }

  const { width, height, fill } = cupVisual(ml);
  return (
    <span
      className="cup"
      style={{ width, height, '--fill': `${fill}%`, '--lag': lag }}
      aria-hidden="true"
    >
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

function Week({ week, today }) {
  return (
    <ol className="week">
      {week.map((day) => {
        const index = weekdayIndex(day.date);
        const isToday = day.date === today;
        const mark = [day.rest ? 'is-rest' : '', day.done ? 'is-on' : '', isToday ? 'is-today' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <li key={day.date} title={isToday ? `${WEEKDAYS[index]} · hoje` : WEEKDAYS[index]}>
            <span className={isToday ? 'week-label-today' : undefined}>{WEEKDAY_LETTERS[index]}</span>
            <span className={`week-dot${mark ? ` ${mark}` : ''}`} />
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
