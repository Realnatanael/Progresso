import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { HabitCard, KindPicker } from '../components/HabitCard.jsx';

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
  const [kind, setKind] = useState('check');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      const data = await api('/api/habits', {
        method: 'POST',
        body: { title: nextTitle, date, kind, goalLiters: goal },
      });
      setBoard(data);
      setTitle('');
      setKind('check');
      setGoal('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const firstName = user.name.split(' ')[0];
  const doneCount = board?.doneCount ?? 0;
  const total = board?.total ?? 0;
  const dayClosed = total > 0 && doneCount === total;
  const canAdd = title.trim() && (kind !== 'water' || goal.trim()) && !saving;

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
          <HabitCard key={habit.id} habit={habit} date={date} onChange={setBoard} />
        ))}
      </ul>

      <form className="composer" onSubmit={addHabit}>
        <label className="sr" htmlFor="new-habit">Novo hábito</label>
        <input
          id="new-habit"
          value={title}
          maxLength={80}
          placeholder="Novo hábito"
          onChange={(event) => setTitle(event.target.value)}
        />
        <KindPicker kind={kind} onChange={setKind} />
        {kind === 'water' ? (
          <label className="field" htmlFor="new-goal">
            <span>Meta do dia, em litros</span>
            <input
              id="new-goal"
              inputMode="decimal"
              placeholder="2,5"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </label>
        ) : null}
        {kind === 'exercise' ? (
          <p className="hint">Os dias e os exercícios ficam na página do treino.</p>
        ) : null}
        <button className="primary" type="submit" disabled={!canAdd}>
          {saving ? 'Adicionando…' : 'Adicionar'}
        </button>
      </form>
    </main>
  );
}
