import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { HabitCard, KindPicker } from '../components/HabitCard.jsx';
import { AppNav } from '../components/AppNav.jsx';
import { syncNinja } from '../ninjaSync.js';

function formatToday() {
  const label = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const WATER_TITLE = 'Água';

export function HomePage() {
  const { user, logout } = useAuth();
  const date = todayISO();
  const [board, setBoard] = useState(null);
  const [composing, setComposing] = useState(false);
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

  function onBoardChange(next) {
    setBoard(next);
    syncNinja(date);
  }

  function resetComposer() {
    setTitle('');
    setKind('check');
    setGoal('');
    setComposing(false);
  }

  function chooseKind(next) {
    setKind(next);
    if (next === 'water') setTitle('');
  }

  async function addHabit(event) {
    event.preventDefault();
    const nextTitle = kind === 'water' ? WATER_TITLE : title.trim();
    if (kind !== 'water' && !nextTitle) return;
    if (kind === 'water' && !goal.trim()) return;
    setError('');
    setSaving(true);
    try {
      const data = await api('/api/habits', {
        method: 'POST',
        body: { title: nextTitle, date, kind, goalLiters: goal },
      });
      setBoard(data);
      resetComposer();
      syncNinja(date);
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
  const canAdd = (kind === 'water' ? goal.trim() : title.trim()) && !saving;

  return (
    <main className="app with-nav">
      <header className="top">
        <p className="mark">Progresso</p>
        <button className="ghost" type="button" onClick={() => logout()}>Sair</button>
      </header>

      <section className="today">
        <p className="date">{formatToday()}</p>
        <h1>Olá, {firstName}</h1>
        <p className={dayClosed ? 'summary done' : 'summary'}>
          {loading
            ? 'Carregando…'
            : total === 0
              ? 'Nenhum hábito ainda'
              : dayClosed
                ? `Dia fechado · ${doneCount} de ${total}`
                : `${doneCount} de ${total} hoje`}
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
          <HabitCard key={habit.id} habit={habit} date={date} onChange={onBoardChange} />
        ))}
      </ul>

      {composing ? (
        <form className="composer" onSubmit={addHabit}>
          <KindPicker kind={kind} onChange={chooseKind} />
          {kind === 'water' ? (
            <label className="field" htmlFor="new-goal">
              <span>Meta do dia, em litros</span>
              <input
                id="new-goal"
                inputMode="decimal"
                placeholder="2,5"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                autoFocus
              />
            </label>
          ) : (
            <>
              <label className="sr" htmlFor="new-habit">Novo hábito</label>
              <input
                id="new-habit"
                value={title}
                maxLength={80}
                placeholder="Novo hábito"
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
            </>
          )}
          {kind === 'exercise' ? (
            <p className="hint">Os dias e os exercícios ficam em Corpo.</p>
          ) : null}
          <div className="composer-actions">
            <button className="ghost" type="button" onClick={resetComposer} disabled={saving}>
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={!canAdd}>
              {saving ? 'Adicionando…' : 'Adicionar'}
            </button>
          </div>
        </form>
      ) : (
        <button className="add-habit" type="button" onClick={() => setComposing(true)}>
          Novo hábito
        </button>
      )}
      <AppNav />
    </main>
  );
}
