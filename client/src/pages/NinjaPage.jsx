import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { AppNav } from '../components/AppNav.jsx';
import { encodeSelfie } from '../lib/photoEncode.js';
import { DESTINY_SEAL, sealForNature } from '../natures.js';

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
  sennin: 'Sennin',
};

const ABILITY_TABS = [
  { id: 'elemento', label: 'Elemento' },
  { id: 'dojutsu', label: 'Dōjutsu' },
  { id: 'jinchuuriki', label: 'Jinchūriki' },
  { id: 'sennin', label: 'Sennin' },
];

const PATH_JUTSU_CATEGORIES = new Set(['dojutsu', 'bijuu', 'senjutsu', 'kekkei']);

const NATURE_SHORT = {
  fire: 'Katon',
  water: 'Suiton',
  wind: 'Fuuton',
  earth: 'Doton',
  lightning: 'Raiton',
  yin: 'Inton',
  yang: 'Yōton',
  yin_yang: 'Onmyōton',
  crystal: 'Shōton',
  typhoon: 'Taiton',
  steel: 'Kōton',
  darkness: 'Meiton',
  speed: 'Jinton',
};

export function NinjaPage() {
  const { logout } = useAuth();
  const date = todayISO();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('available');
  const [abilityOpen, setAbilityOpen] = useState(false);
  const [abilityTab, setAbilityTab] = useState('elemento');
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

  function rollJinchuuriki() {
    return run(() => api('/api/ninja/jinchuuriki-roll', { method: 'POST', body: {} }));
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
  const dojutsuEyes = useMemo(
    () => catalog.filter((item) => item.kind === 'kekkei' && item.path === 'dojutsu' && !item.owned),
    [catalog],
  );
  const dojutsuJutsus = useMemo(
    () => catalog.filter((item) => item.kind === 'jutsu' && item.category === 'dojutsu' && !item.owned),
    [catalog],
  );
  const bijuuJutsus = useMemo(
    () => catalog.filter((item) => item.kind === 'jutsu' && item.category === 'bijuu' && !item.owned),
    [catalog],
  );
  const senninJutsus = useMemo(
    () => catalog.filter((item) => item.kind === 'jutsu' && item.category === 'senjutsu' && !item.owned),
    [catalog],
  );
  const fusionJutsus = useMemo(
    () => catalog.filter((item) => item.kind === 'jutsu' && item.category === 'kekkei' && !item.owned),
    [catalog],
  );
  const senninPaths = useMemo(
    () => catalog.filter((item) => item.kind === 'sennin' && !item.owned),
    [catalog],
  );
  const owned = useMemo(
    () => catalog.filter((item) => item.owned && item.kind !== 'nature'),
    [catalog],
  );
  const learnable = useMemo(
    () => catalog.filter((item) => (
      !item.owned
      && item.kind === 'jutsu'
      && !PATH_JUTSU_CATEGORIES.has(item.category)
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
  const story = ninja?.story;
  const currentChapter = story?.chapters?.[story.currentIndex];

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
              <p className="nature-pick-kicker">Selos da Academia</p>
              <h2>Escolha seu elemento</h2>
              <p className="hint">
                Toque num selo básico — grátis. Ou guarde pts e invoque o Destino.
              </p>
              <div className="nature-seal-grid" role="group" aria-label="Elementos básicos">
                {firstNatures.map((item) => {
                  const seal = sealForNature(item.natureId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nature-seal nature-seal-${item.natureId}`}
                      disabled={saving}
                      onClick={() => unlock(item.id)}
                    >
                      <span className="nature-seal-art" aria-hidden="true">
                        {seal ? (
                          <img src={seal.icon} alt="" />
                        ) : (
                          <span className="nature-seal-fallback">{item.natureId?.[0]?.toUpperCase()}</span>
                        )}
                      </span>
                      <strong>{seal?.label || item.name}</strong>
                      <em>{seal?.release || 'Básico'}</em>
                      <span className="nature-seal-tag">Grátis</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className={`nature-destiny${ninja.canAffinityRoll ? ' is-ready' : ''}`}
                disabled={saving || !ninja.canAffinityRoll}
                onClick={() => rollAffinity()}
              >
                <span className="nature-seal-art" aria-hidden="true">
                  <img src={DESTINY_SEAL.icon} alt="" />
                </span>
                <span className="nature-destiny-copy">
                  <strong>Invocar Destino</strong>
                  <span>
                    {ninja.canAffinityRoll
                      ? `${ninja.affinityRollCost} pts · afinidade rara`
                      : `${ninja.unlockPoints}/${ninja.affinityRollCost} pts`}
                  </span>
                </span>
              </button>
              <p className="hint nature-destiny-hint">
                Raros: Yin/Yang, fusões (gelo, madeira…) ou especiais. Fusões trazem os básicos.
              </p>
            </section>
          ) : (
            <div className="ninja-natures">
              {(ninja.natures || []).map((natureId, index) => {
                const seal = sealForNature(natureId);
                const label = ninja.natureLabels?.[index] || natureId;
                if (seal) {
                  return (
                    <span key={natureId} className="nature-owned-seal" title={label}>
                      <img src={seal.icon} alt={label} />
                      <em>{seal.release}</em>
                    </span>
                  );
                }
                return (
                  <span key={natureId} className="ninja-nature-chip">
                    {label}
                  </span>
                );
              })}
              {(ninja.kekkeiLabels || []).map((label) => (
                <span key={label} className="ninja-nature-chip ninja-nature-chip-fusion">{label}</span>
              ))}
            </div>
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

          {story ? (
            <section className="ninja-card ninja-story">
              <p className="nature-pick-kicker">Modo História</p>
              <h2>{currentChapter?.title || 'Sua jornada'}</h2>
              <p className="hint">{currentChapter?.blurb}</p>
              <div className="story-progress" aria-hidden="true">
                <span style={{ width: `${story.percent || 0}%` }} />
              </div>
              <p className="story-progress-label">{story.percent || 0}% da jornada</p>
              <ol className="story-roadmap">
                {(story.chapters || []).map((chapter, index) => {
                  const isCurrent = chapter.id === story.currentId;
                  return (
                    <li
                      key={chapter.id}
                      className={[
                        chapter.complete ? 'is-done' : '',
                        isCurrent ? 'is-current' : '',
                        !chapter.complete && !isCurrent ? 'is-locked' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className="story-step-index">{index + 1}</span>
                      <div>
                        <strong>{chapter.title}</strong>
                        {isCurrent ? (
                          <ul className="story-goals">
                            {(chapter.goals || []).map((goal) => (
                              <li key={goal.id} className={goal.done ? 'done' : ''}>
                                {goal.done ? '✓' : '○'} {goal.label}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="hint">
                            {chapter.complete ? 'Concluído' : 'Ainda fechado'}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <section className="ninja-card">
            <div className="section-head">
              <h2>Jutsus & técnicas</h2>
              <span className="hint">{ninja.unlockPoints} pts</span>
            </div>
            {ninja.needsFirstNature ? (
              <p className="hint">Escolha a natureza acima; jutsus elementais só da sua afinidade.</p>
            ) : (
              <>
                <p className="hint">
                  Ranks E→S. Elementais exigem a natureza (Raiton não aprende Katon).
                  Universais (clone, taijutsu, cura…) liberam pra todos.
                </p>
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
            {ninja.jinchuuriki ? (
              <div className="path-badge">
                <strong>Jinchūriki · {ninja.jinchuuriki.name}</strong>
                <span>{ninja.jinchuuriki.tails} caudas · {ninja.jinchuuriki.buff}</span>
                <em>Limite: {ninja.jinchuuriki.limit}</em>
              </div>
            ) : null}
            {ninja.sennin ? (
              <div className="path-badge">
                <strong>{ninja.sennin.name}</strong>
                <span>{ninja.sennin.buff}</span>
                <em>Limite: {ninja.sennin.limit}</em>
              </div>
            ) : null}
          </section>

          {!ninja.needsFirstNature ? (
            <section className="ninja-card ninja-abilities">
              <button
                type="button"
                className="abilities-toggle"
                aria-expanded={abilityOpen}
                onClick={() => setAbilityOpen((open) => !open)}
              >
                <div>
                  <p className="nature-pick-kicker">Caminhos raros</p>
                  <h2>Desbloquear habilidades</h2>
                </div>
                <span className="abilities-chevron" aria-hidden="true">{abilityOpen ? '−' : '+'}</span>
              </button>

              {abilityOpen ? (
                <>
                  <p className="hint">
                    Elemento, dōjutsu, jinchūriki ou sennin — cada caminho tem custo e preço.
                  </p>
                  <div className="ninja-filters ability-tabs" role="tablist">
                    {ABILITY_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={abilityTab === tab.id}
                        className={abilityTab === tab.id ? 'primary' : 'ghost'}
                        onClick={() => setAbilityTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {abilityTab === 'elemento' ? (
                    <div className="ability-panel">
                      <h3>Segundo elemento</h3>
                      <p className="hint">Jounin · 28 pts · chakra/nin/tai altos.</p>
                      {secondNatures.length === 0 ? (
                        <p className="hint">Todos os básicos já estão com você.</p>
                      ) : (
                        <div className="nature-seal-grid nature-seal-grid-compact" role="group" aria-label="Segundo elemento">
                          {secondNatures.map((item) => {
                            const seal = sealForNature(item.natureId);
                            const isLocked = item.locked || !item.canUnlock;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`nature-seal nature-seal-${item.natureId}${isLocked ? ' is-locked' : ''}`}
                                disabled={saving || isLocked}
                                onClick={() => unlock(item.id)}
                              >
                                <span className="nature-seal-art" aria-hidden="true">
                                  {seal ? <img src={seal.icon} alt="" /> : null}
                                </span>
                                <strong>{seal?.label || item.name}</strong>
                                <em>{item.canUnlock ? `${item.costUnlockPoints} pts` : (item.missing?.[0] || 'Bloqueado')}</em>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {advancedNatures.length > 0 ? (
                        <>
                          <h3>Espirituais e especiais</h3>
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
                        </>
                      ) : null}

                      {fusions.length > 0 ? (
                        <>
                          <h3>Fusões (Kekkei)</h3>
                          <p className="hint">Exigem os elementos-base · custam pts.</p>
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
                        </>
                      ) : null}

                      {fusionJutsus.length > 0 ? (
                        <>
                          <h3>Jutsus de fusão</h3>
                          <p className="hint">Só após desbloquear o marcador kekkei · todos com custo em pts.</p>
                          <ul className="ninja-list">
                            {fusionJutsus.map((item) => (
                              <CatalogRow
                                key={item.id}
                                item={item}
                                saving={saving}
                                onUnlock={unlock}
                                cta="Aprender"
                              />
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {abilityTab === 'dojutsu' ? (
                    <div className="ability-panel">
                      <h3>Despertar um olho</h3>
                      <p className="hint">
                        Sharingan sobe por tomoe · Byakugan · Rinnegan. Cada estágio tem preço e abre jutsus próprios.
                      </p>
                      {dojutsuEyes.length === 0 ? (
                        <p className="hint">Você já despertou todos os olhos disponíveis.</p>
                      ) : (
                        <ul className="ninja-list">
                          {dojutsuEyes.map((item) => (
                            <CatalogRow
                              key={item.id}
                              item={item}
                              saving={saving}
                              onUnlock={unlock}
                              cta="Despertar"
                            />
                          ))}
                        </ul>
                      )}
                      {dojutsuJutsus.length > 0 ? (
                        <>
                          <h3>Técnicas oculares</h3>
                          <ul className="ninja-list">
                            {dojutsuJutsus.map((item) => (
                              <CatalogRow
                                key={item.id}
                                item={item}
                                saving={saving}
                                onUnlock={unlock}
                                cta="Aprender"
                              />
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {abilityTab === 'jinchuuriki' ? (
                    <div className="ability-panel">
                      <h3>Selar uma bijū</h3>
                      {ninja.jinchuuriki ? (
                        <div className="path-badge">
                          <strong>Você carrega {ninja.jinchuuriki.name}</strong>
                          <span>{ninja.jinchuuriki.tails} caudas · {ninja.jinchuuriki.buff}</span>
                          <em>Limite: {ninja.jinchuuriki.limit}</em>
                        </div>
                      ) : ninja.senninPath ? (
                        <p className="hint">Você já trilhou o caminho sennin — jinchūriki fica fechado.</p>
                      ) : (
                        <>
                          <p className="hint">
                            A bijū é sorteada (1–9 caudas). Vem com buff e limitação — escolha irreversible
                            (fecha o caminho sennin).
                            Custo: <strong>{ninja.jinchuurikiCost} pts</strong> · Jounin · chakra 160+.
                          </p>
                          <button
                            type="button"
                            className="primary"
                            disabled={saving || !ninja.canJinchuurikiRoll}
                            onClick={() => rollJinchuuriki()}
                          >
                            {ninja.canJinchuurikiRoll
                              ? `Sortear bijū · ${ninja.jinchuurikiCost} pts`
                              : `Bloqueado · ${ninja.unlockPoints}/${ninja.jinchuurikiCost} pts`}
                          </button>
                        </>
                      )}
                      {bijuuJutsus.length > 0 ? (
                        <>
                          <h3>Técnicas de bijū</h3>
                          <p className="hint">
                            Exigem ser jinchūriki (algumas pedem bijū específica) · todas custam pts.
                          </p>
                          <ul className="ninja-list">
                            {bijuuJutsus.map((item) => (
                              <CatalogRow
                                key={item.id}
                                item={item}
                                saving={saving}
                                onUnlock={unlock}
                                cta="Aprender"
                              />
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {abilityTab === 'sennin' ? (
                    <div className="ability-panel">
                      <h3>Estudar senjutsu</h3>
                      {ninja.sennin ? (
                        <div className="path-badge">
                          <strong>{ninja.sennin.name}</strong>
                          <span>{ninja.sennin.buff}</span>
                          <em>Limite: {ninja.sennin.limit}</em>
                        </div>
                      ) : ninja.jinchuuriki ? (
                        <p className="hint">Jinchūriki não estuda senjutsu — escolha exclusiva.</p>
                      ) : (
                        <>
                          <p className="hint">
                            Escolha um contrato: sapo, serpente ou lesma. Cada um dá buff e traz um limite
                            (fecha o caminho jinchūriki).
                          </p>
                          {senninPaths.length === 0 ? (
                            <p className="hint">Nenhum caminho aberto ainda — avance até Jounin.</p>
                          ) : (
                            <ul className="ninja-list">
                              {senninPaths.map((item) => (
                                <CatalogRow
                                  key={item.id}
                                  item={item}
                                  saving={saving}
                                  onUnlock={unlock}
                                  cta="Estudar"
                                />
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                      {senninJutsus.length > 0 ? (
                        <>
                          <h3>Técnicas sennin</h3>
                          <p className="hint">Exigem caminho sennin · todas custam pts.</p>
                          <ul className="ninja-list">
                            {senninJutsus.map((item) => (
                              <CatalogRow
                                key={item.id}
                                item={item}
                                saving={saving}
                                onUnlock={unlock}
                                cta="Aprender"
                              />
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="hint">Toque para abrir elemento, olhos, bijū e sennin.</p>
              )}
            </section>
          ) : null}

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
  const natureTag = (item.requiresNatures || [])
    .map((id) => NATURE_SHORT[id] || id)
    .join('+') || 'Universal';
  return (
    <li className={item.canUnlock ? 'can' : 'locked'}>
      <div>
        <strong>{item.name}</strong>
        <span className="ninja-meta">
          <span className={`jutsu-tier tier-${item.tier}`}>{item.tier}</span>
          {' · '}
          {natureTag}
          {' · '}
          {item.costUnlockPoints} pts
          {item.rankMin && item.rankMin !== 'academy' ? ` · ${item.rankMin}` : ''}
        </span>
        <p className="hint">{item.blurb}</p>
        {item.buff ? <p className="hint">Buff: {item.buff}</p> : null}
        {item.limit ? <p className="hint">Limite: {item.limit}</p> : null}
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
