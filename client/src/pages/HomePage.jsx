import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function weekdayIndex(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function formatToday() {
  const label = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function HomePage() {
  const { user, logout } = useAuth();
  const date = todayISO();
  const [board, setBoard] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    let active = true;
    api(`/api/habits?date=${date}`)
      .then((data) => {
        if (active) setBoard(data);
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

  async function addHabit(event) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setError('');
    setSaving(true);
    try {
      const data = await api('/api/habits', { method: 'POST', body: { title: nextTitle, date } });
      setBoard(data);
      setTitle('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleHabit(id) {
    setError('');
    setPendingId(id);
    try {
      const data = await api(`/api/habits/${id}/toggle`, { method: 'POST', body: { date } });
      setBoard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  async function removeHabit(habit) {
    const confirmed = window.confirm(`Remover “${habit.title}”? O histórico desse hábito também sai.`);
    if (!confirmed) return;
    setError('');
    setPendingId(habit.id);
    try {
      const data = await api(`/api/habits/${habit.id}?date=${date}`, { method: 'DELETE' });
      setBoard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  const firstName = user.name.split(' ')[0];
  const doneCount = board?.doneCount ?? 0;
  const total = board?.total ?? 0;
  const dayClosed = total > 0 && doneCount === total;

  return (
    <main className="app">
      <header className="top">
        <p className="mark">Progresso</p>
        <button className="ghost" type="button" onClick={() => logout()}>Sair</button>
      </header>

      <section className="today">
        <p className="date">{formatToday()}</p>
        <h1>Olá, {firstName}</h1>
        <p className={dayClosed ? 'summary done' : 'summary'}>
          {total === 0 ? 'Nenhum hábito ainda' : dayClosed ? `Dia fechado · ${doneCount} de ${total}` : `${doneCount} de ${total} hoje`}
        </p>
        <div className="meter" aria-hidden="true">
          <span style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }} />
        </div>
      </section>

      {error ? <p className="alert" role="alert">{error}</p> : null}

      {loading ? <p className="screen-status">Carregando hábitos…</p> : null}

      {!loading && board?.habits.length === 0 ? (
        <p className="empty">Comece por um hábito pequeno, do tipo que cabe no dia.</p>
      ) : null}

      <ul className="habits">
        {board?.habits.map((habit) => (
          <li key={habit.id} className={habit.doneToday ? 'habit done' : 'habit'}>
            <button
              className="check"
              type="button"
              aria-pressed={habit.doneToday}
              aria-label={habit.doneToday ? `Desmarcar ${habit.title}` : `Marcar ${habit.title}`}
              disabled={pendingId === habit.id}
              onClick={() => toggleHabit(habit.id)}
            >
              <span />
            </button>
            <div className="habit-body">
              <div className="habit-line">
                <h2>{habit.title}</h2>
                <button className="text" type="button" onClick={() => removeHabit(habit)} disabled={pendingId === habit.id}>
                  Remover
                </button>
              </div>
              <p className="streak">
                {habit.streak > 0 ? `${habit.streak} ${habit.streak === 1 ? 'dia seguido' : 'dias seguidos'}` : 'Ainda sem sequência'}
              </p>
              <ol className="week">
                {habit.week.map((day) => {
                  const index = weekdayIndex(day.date);
                  return (
                    <li key={day.date} title={WEEKDAYS[index]}>
                      <span>{WEEKDAY_LETTERS[index]}</span>
                      <i className={day.done ? 'on' : ''} />
                    </li>
                  );
                })}
              </ol>
            </div>
          </li>
        ))}
      </ul>

      <form className="add" onSubmit={addHabit}>
        <label className="sr" htmlFor="new-habit">Novo hábito</label>
        <input
          id="new-habit"
          value={title}
          maxLength={80}
          placeholder="Novo hábito"
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="primary" type="submit" disabled={saving || !title.trim()}>
          {saving ? '…' : 'Adicionar'}
        </button>
      </form>
    </main>
  );
}
