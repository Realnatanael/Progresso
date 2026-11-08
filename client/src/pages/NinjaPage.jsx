import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { AppNav } from '../components/AppNav.jsx';
import { encodeSelfie } from '../lib/photoEncode.js';

const STATS = [
  { id: 'ninjutsu', label: 'Ninjutsu' },
  { id: 'genjutsu', label: 'Genjutsu' },
  { id: 'taijutsu', label: 'Taijutsu' },
];

const KIND_LABEL = {
  nature: 'Natureza',
  jutsu: 'Jutsu',
  kekkei: 'Kekkei',
  bijuu: 'Bijuu',
};

export function NinjaPage() {
  const { logout } = useAuth();
  const date = todayISO();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('available');
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    api('/api/ninja/sync', { method: 'POST', body: { date } })
      .then((payload) => {
        if (!active) return;
        setData(payload);
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
      const payload = await action();
      setData(payload);
      return payload;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function pickStat(stat) {
    return run(() => api('/api/ninja/pick-stat', { method: 'POST', body: { date, stat } }));
  }

  function unlock(catalogId) {
    return run(() => api('/api/ninja/unlock', { method: 'POST', body: { catalogId } }));
  }

  function rollAffinity() {
    return run(() => api('/api/ninja/affinity-roll', { method: 'POST', body: {} }));
  }

  async function onPickSelfie(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setGeneratingAvatar(true);
    setError('');
    try {
      const encoded = await encodeSelfie(file);
      const payload = await api('/api/ninja/avatar', {
        method: 'POST',
        body: encoded,
      });
      setData(payload);
    } catch (err) {
      setError(err.message || 'Não foi possível gerar o personagem.');
    } finally {
      setGeneratingAvatar(false);
    }
  }

  const ninja = data?.ninja;
  const catalog = data?.catalog || [];
  const pending = ninja?.pendingStatPick?.date === date;
  const unlocked = Boolean(ninja?.avatarReady);

  const firstNatures = useMemo(
    () => catalog.filter((item) => item.kind === 'nature' && item.firstNatureOnly && !item.owned),
    [catalog],
  );
  const secondNatures = useMemo(
    () => catalog.filter((item) => (
      item.kind === 'nature'
      && item.natureGroup === 'basic'
      && !item.firstNatureOnly
      && !item.owned
    )),
    [catalog],
  );
  const advancedNatures = useMemo(
    () => catalog.filter((item) => (
      item.kind === 'nature'
      && (item.natureGroup === 'spirit' || item.natureGroup === 'special')
      && !item.owned
    )),
    [catalog],
  );
  const fusions = useMemo(
    () => catalog.filter((item) => item.kind === 'kekkei' && item.fusion && !item.owned),
    [catalog],
  );
  const owned = useMemo(
    () => catalog.filter((item) => item.owned && item.kind !== 'nature'),
    [catalog],
  );
  const learnable = useMemo(
    () => catalog.filter((item) => (
      !item.owned
      && item.kind !== 'nature'
      && !(item.kind === 'kekkei' && item.fusion)
    )),
    [catalog],
  );
  const available = useMemo(
    () => learnable.filter((item) => item.canUnlock),
    [learnable],
  );
  const locked = useMemo(
    () => learnable.filter((item) => item.locked),
    [learnable],
  );
  const listToShow = filter === 'locked' ? locked : filter === 'all' ? learnable : available;

  return (
    <main className="app with-nav app-wide">
      <header className="top">
        <p className="mark">Progresso</p>
        <button className="ghost" type="button" onClick={() => logout()}>Sair</button>
      </header>

      {loading ? <p className="screen-status">Abrindo o caminho ninja…</p> : null}
      {error ? <p className="alert" role="alert">{error}</p> : null}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPickSelfie}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={onPickSelfie}
      />

      {!loading && ninja && !unlocked ? (
        <>
          <section className="today">
            <p className="date">Ninja</p>
            <h1>Crie seu personagem</h1>
            <p className="summary">
              Envie uma foto pra liberar o painel ninja. Galeria ou câmera — tanto faz.
            </p>
          </section>

          <section className={`ninja-avatar ninja-avatar-gate${generatingAvatar ? ' is-generating' : ''}`}>
            <div className="ninja-avatar-empty">
              <p className="ninja-avatar-empty-title">Portão da vila</p>
              <p className="hint">
                Usamos idade, altura e peso do Perfil. O personagem fica como estudante da academia:
                roupa comum, sem bandana.
              </p>
              <div className="ninja-photo-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={generatingAvatar || saving}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  {generatingAvatar ? 'Criando personagem…' : 'Escolher da galeria'}
                </button>
                <button
                  type="button"
                  className="ghost ninja-photo-secondary"
                  disabled={generatingAvatar || saving}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  Tirar foto
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {!loading && ninja && unlocked ? (
        <>
          <section className="today">
            <p className="date">Ninja</p>
            <h1>
              {ninja.clanName
                ? `${firstName(ninja.displayName)} · Clã ${ninja.clanName}`
                : firstName(ninja.displayName)}
            </h1>
            <p className="summary">
              {ninja.rankLabel}
              {' · '}
              {ninja.unlockPoints} pts de desbloqueio
              {ninja.natureLabels?.length ? ` · ${ninja.natureLabels.join(' · ')}` : ''}
            </p>
          </section>

          <section className="ninja-stage">
            <div className={`ninja-avatar rank-${ninja.rank}${generatingAvatar ? ' is-generating' : ''}`}>
              <img
                className="ninja-avatar-img"
                src={`${ninja.avatarUrl}?t=${encodeURIComponent(ninja.avatarUpdatedAt || '')}`}
                alt={`Personagem ninja de ${ninja.displayName || 'você'}`}
              />
              <p className="ninja-rank-badge">{ninja.rankLabel}</p>
            </div>

            <div className="ninja-stats">
              <StatBar label="Chakra" value={ninja.chakra} max={ninja.chakraMax} tone="chakra" />
              <StatBar label="Ninjutsu" value={ninja.ninjutsu} max={ninja.statMax} tone="nin" />
              <StatBar label="Genjutsu" value={ninja.genjutsu} max={ninja.statMax} tone="gen" />
              <StatBar label="Taijutsu" value={ninja.taijutsu} max={ninja.statMax} tone="tai" />
            </div>
          </section>

          {ninja.needsFirstNature ? (
            <section className="ninja-card ninja-nature-pick">
              <h2>Escolha seu primeiro elemento</h2>
              <p className="hint">
                Os 5 básicos são grátis. Ou junte {ninja.affinityRollCost} pts e invoque uma
                afinidade rara (espiritual, kekkei ou especial).
              </p>
              <div className="ninja-nature-grid">
                {firstNatures.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ninja-nature-btn"
                    disabled={saving}
                    onClick={() => unlock(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <span>{item.blurb}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="primary ninja-roll-btn"
                disabled={saving || !ninja.canAffinityRoll}
                onClick={() => rollAffinity()}
              >
                {ninja.canAffinityRoll
                  ? `Invocar afinidade rara (${ninja.affinityRollCost} pts)`
                  : `Invocar rara — falta pts (${ninja.unlockPoints}/${ninja.affinityRollCost})`}
              </button>
              <p className="hint">
                Na sorte podem sair Yin/Yang, fusões (gelo, madeira, lava…) ou especiais
                (cristal, trevas…). Se sair fusão, os elementos-base vêm junto.
              </p>
            </section>
          ) : (
            <p className="ninja-natures">
              {(ninja.natureLabels || []).map((label) => (
                <span key={label} className="ninja-nature-chip">{label}</span>
              ))}
              {(ninja.kekkeiLabels || []).map((label) => (
                <span key={label} className="ninja-nature-chip ninja-nature-chip-fusion">{label}</span>
              ))}
            </p>
          )}

          {pending ? (
            <section className="ninja-card">
              <h2>Treino de hoje</h2>
              <p className="hint">Escolha onde investir o ponto de treino.</p>
              <div className="ninja-pick">
                {STATS.map((stat) => (
                  <button
                    key={stat.id}
                    type="button"
                    className="primary"
                    disabled={saving || ninja[stat.id] >= ninja.statMax}
                    onClick={() => pickStat(stat.id)}
                  >
                    +1 {stat.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {ninja.nextRank ? (
            <section className="ninja-card">
              <h2>Próximo: {ninja.nextRank.label}</h2>
              <p className="hint">
                Chakra {ninja.nextRank.requires.chakra}
                {' · '}
                {ninja.nextRank.requires.learnedJutsus} jutsus
                {' · '}
                soma Nin+Gen+Tai {ninja.nextRank.requires.statsSum}
                {ninja.nextRank.requires.natures
                  ? ` · ${ninja.nextRank.requires.natures} natureza`
                  : ''}
              </p>
              <p className={ninja.nextRank.ready ? 'summary done' : 'summary'}>
                {ninja.nextRank.ready
                  ? 'Requisitos ok — promoção ao sincronizar'
                  : 'Continue treinando'}
              </p>
            </section>
          ) : null}

          {!ninja.needsFirstNature && secondNatures.length > 0 ? (
            <section className="ninja-card">
              <h2>Elemento secundário</h2>
              <p className="hint">
                10 pts · Genin. Escolha outro dos 5 básicos pra depois liberar fusões.
              </p>
              <ul className="ninja-list">
                {secondNatures.map((item) => (
                  <CatalogRow
                    key={item.id}
                    item={item}
                    saving={saving}
                    onUnlock={unlock}
                    cta="Desbloquear"
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {!ninja.needsFirstNature && fusions.length > 0 ? (
            <section className="ninja-card">
              <h2>Fusões (Kekkei)</h2>
              <p className="hint">
                Exigem os elementos-base. 2 elementos ≈ 16–20 pts · Pó (3) custa bem mais.
              </p>
              <ul className="ninja-list">
                {fusions.map((item) => (
                  <CatalogRow
                    key={item.id}
                    item={item}
                    saving={saving}
                    onUnlock={unlock}
                    cta="Fundir"
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {!ninja.needsFirstNature && advancedNatures.length > 0 ? (
            <section className="ninja-card">
              <h2>Espirituais e especiais</h2>
              <p className="hint">
                Yin / Yang / Yin-Yang e marcadores raros (cristal, trevas, aço…).
              </p>
              <ul className="ninja-list">
                {advancedNatures.map((item) => (
                  <CatalogRow
                    key={item.id}
                    item={item}
                    saving={saving}
                    onUnlock={unlock}
                    cta="Desbloquear"
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="ninja-card">
            <div className="section-head">
              <h2>Jutsus</h2>
              <span className="hint">{ninja.unlockPoints} pts</span>
            </div>
            {ninja.needsFirstNature ? (
              <p className="hint">Escolha a natureza acima; depois você gasta pts em jutsus básicos.</p>
            ) : (
              <>
                <div className="ninja-filters">
                  <button
                    type="button"
                    className={filter === 'available' ? 'primary' : 'ghost'}
                    onClick={() => setFilter('available')}
                  >
                    Disponíveis ({available.length})
                  </button>
                  <button
                    type="button"
                    className={filter === 'locked' ? 'primary' : 'ghost'}
                    onClick={() => setFilter('locked')}
                  >
                    Bloqueados ({locked.length})
                  </button>
                  <button
                    type="button"
                    className={filter === 'all' ? 'primary' : 'ghost'}
                    onClick={() => setFilter('all')}
                  >
                    Todos ({learnable.length})
                  </button>
                </div>
                {listToShow.length === 0 ? (
                  <p className="hint">
                    {filter === 'available'
                      ? 'Nada liberado agora — feche o dia em Hoje para ganhar pts, ou veja Bloqueados.'
                      : 'Lista vazia neste filtro.'}
                  </p>
                ) : (
                  <ul className="ninja-list">
                    {listToShow.map((item) => (
                      <CatalogRow
                        key={item.id}
                        item={item}
                        saving={saving}
                        onUnlock={unlock}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section className="ninja-card">
            <h2>Inventário</h2>
            {owned.length === 0 ? (
              <p className="hint">
                Ainda sem jutsus. Bata a meta de água e feche o dia em <Link to="/">Hoje</Link>.
              </p>
            ) : (
              <ul className="ninja-owned">
                {owned.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name}</strong>
                    <span>{KIND_LABEL[item.kind] || item.kind} · {item.tier}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="hint ninja-tip">
            Água = +1 chakra/dia · Treino = +1 Nin/Gen/Tai · Dia completo = +3 pts
          </p>
        </>
      ) : null}

      <AppNav />
    </main>
  );
}

function CatalogRow({ item, saving, onUnlock, cta = 'Aprender' }) {
  return (
    <li className={item.canUnlock ? 'can' : 'locked'}>
      <div>
        <strong>{item.name}</strong>
        <span className="ninja-meta">
          {KIND_LABEL[item.kind] || item.kind}
          {' · '}
          {item.tier}
          {' · '}
          {item.costUnlockPoints} pts
          {item.rankMin && item.rankMin !== 'academy' ? ` · ${item.rankMin}` : ''}
        </span>
        <p className="hint">{item.blurb}</p>
        {item.locked && item.missing?.length ? (
          <p className="hint">Falta: {item.missing.join(' · ')}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="primary"
        disabled={saving || !item.canUnlock}
        onClick={() => onUnlock(item.id)}
      >
        {item.canUnlock ? cta : 'Bloqueado'}
      </button>
    </li>
  );
}

function firstName(fullName) {
  const part = String(fullName || '').trim().split(/\s+/)[0];
  return part || 'Ninja';
}

function StatBar({ label, value, max, tone }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`ninja-bar ${tone}`}>
      <div className="ninja-bar-head">
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>
      <div className="ninja-bar-track" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
