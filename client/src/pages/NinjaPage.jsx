import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, todayISO } from '../api.js';
import { AppNav } from '../components/AppNav.jsx';
import { encodeSelfie } from '../lib/photoEncode.js';
import {
  DESTINY_SEAL,
  emojiForCategory,
  sealForNature,
  visualForJutsu,
} from '../natures.js';

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

const TIER_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];

const CATEGORY_LABEL = {
  ninjutsu: 'Ninjutsu',
  genjutsu: 'Genjutsu',
  taijutsu: 'Taijutsu',
  bukijutsu: 'Bukijutsu',
  fuuinjutsu: 'Fūinjutsu',
  iryo: 'Iryō',
  sensor: 'Sensor',
  senjutsu: 'Senjutsu',
  dojutsu: 'Dōjutsu',
};

export function NinjaPage() {
  const { logout } = useAuth();
  const date = todayISO();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('available');
  const [tierFilter, setTierFilter] = useState('all');
  const [natureFilter, setNatureFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedJutsuId, setSelectedJutsuId] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyDismissed, setDailyDismissed] = useState(false);
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

  function convertPoints() {
    return run(() => api('/api/ninja/convert-points', { method: 'POST', body: {} }));
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

  const statusPool = filter === 'locked' ? locked : filter === 'all' ? learnable : available;

  const natureOptions = useMemo(() => {
    const ids = new Set();
    let hasUniversal = false;
    for (const item of learnable) {
      const natures = item.requiresNatures || [];
      if (natures.length === 0) hasUniversal = true;
      natures.forEach((id) => ids.add(id));
    }
    const sorted = [...ids].sort((a, b) => (
      (NATURE_SHORT[a] || a).localeCompare(NATURE_SHORT[b] || b, 'pt')
    ));
    return { hasUniversal, sorted };
  }, [learnable]);

  const categoryOptions = useMemo(() => {
    const ids = new Set(learnable.map((item) => item.category).filter(Boolean));
    return [...ids].sort((a, b) => (
      (CATEGORY_LABEL[a] || a).localeCompare(CATEGORY_LABEL[b] || b, 'pt')
    ));
  }, [learnable]);

  const listToShow = useMemo(() => {
    return statusPool.filter((item) => {
      if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (natureFilter === 'all') return true;
      const natures = item.requiresNatures || [];
      if (natureFilter === 'universal') return natures.length === 0;
      return natures.includes(natureFilter);
    });
  }, [statusPool, tierFilter, categoryFilter, natureFilter]);

  useEffect(() => {
    if (!selectedJutsuId) return;
    if (!listToShow.some((item) => item.id === selectedJutsuId)) {
      setSelectedJutsuId(null);
    }
  }, [listToShow, selectedJutsuId]);

  useEffect(() => {
    if (!selectedJutsuId || openPanel !== 'jutsus') return;
    const body = document.querySelector('.ninja-sheet-body');
    body?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedJutsuId, openPanel]);

  useEffect(() => {
    if (!openPanel) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpenPanel(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [openPanel]);

  const selectedJutsu = listToShow.find((item) => item.id === selectedJutsuId) || null;
  const story = ninja?.story;
  const currentChapter = story?.chapters?.[story.currentIndex];
  const chapterCount = story?.chapters?.length || 0;
  const chapterNumber = story ? (story.currentIndex || 0) + 1 : 0;
  const activeBeat = story?.activeBeat || null;
  const dailyMission = ninja?.dailyMission || null;
  const jutsuOwned = (ninja?.learnedJutsuIds || []).length > 0;

  useEffect(() => {
    if (!dailyMission || dailyDismissed || dailyOpen || storyOpen) return;
    if (dailyMission.status === 'pending' && dailyMission.narrative) {
      setDailyOpen(true);
    }
  }, [dailyMission, dailyDismissed, dailyOpen, storyOpen]);

  async function advanceStory() {
    setStoryOpen(true);
    const payload = await run(() => api('/api/ninja/story/advance', {
      method: 'POST',
      body: { date },
    }));
    if (!payload) setStoryOpen(false);
  }

  async function chooseStory(choiceId) {
    const payload = await run(() => api('/api/ninja/story/choose', {
      method: 'POST',
      body: { choiceId, date },
    }));
    if (payload) setStoryOpen(false);
  }

  async function chooseDaily(choiceId) {
    const payload = await run(() => api('/api/ninja/daily-mission/choose', {
      method: 'POST',
      body: { choiceId },
    }));
    if (payload) {
      setDailyOpen(false);
      setDailyDismissed(true);
    }
  }

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
                Usamos idade, altura e peso do Perfil. O visual começa na academia e evolui com o rank
                (bandana Genin, farda Jounin…) e com dōjutsu — sempre parecido com a sua foto.
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
              {ninja.activeEye?.name ? (
                <p className="ninja-eye-badge">{ninja.activeEye.name}</p>
              ) : null}
            </div>

            <div className="ninja-stats">
              <StatBar
                label="Chakra"
                value={ninja.chakra}
                max={ninja.chakraMax}
                tone="chakra"
                onPlus={() => convertPoints()}
                plusDisabled={saving || !ninja.canConvertPointsToChakra}
                plusLabel={`${ninja.pointsToChakraCost || 3} pts → +${ninja.pointsToChakraGain || 1} chakra`}
              />
              <StatBar
                label="Ninjutsu"
                value={ninja.ninjutsu}
                max={ninja.statMax}
                tone="nin"
                onPlus={pending ? () => pickStat('ninjutsu') : undefined}
                plusDisabled={saving || ninja.ninjutsu >= ninja.statMax}
                plusLabel="Treino de hoje · +1 Ninjutsu"
                plusPulse={pending}
              />
              <StatBar
                label="Genjutsu"
                value={ninja.genjutsu}
                max={ninja.statMax}
                tone="gen"
                onPlus={pending ? () => pickStat('genjutsu') : undefined}
                plusDisabled={saving || ninja.genjutsu >= ninja.statMax}
                plusLabel="Treino de hoje · +1 Genjutsu"
                plusPulse={pending}
              />
              <StatBar
                label="Taijutsu"
                value={ninja.taijutsu}
                max={ninja.statMax}
                tone="tai"
                onPlus={pending ? () => pickStat('taijutsu') : undefined}
                plusDisabled={saving || ninja.taijutsu >= ninja.statMax}
                plusLabel="Treino de hoje · +1 Taijutsu"
                plusPulse={pending}
              />
            </div>
            {pending ? (
              <p className="hint ninja-train-hint">Treino pronto — toque no + de Nin, Gen ou Tai.</p>
            ) : null}
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

          {story && currentChapter ? (
            <section className="ninja-card ninja-story">
              <p className="nature-pick-kicker">Modo História</p>
              <h2>{currentChapter.title}</h2>
              <p className="hint">{currentChapter.blurb}</p>
              <div className="story-progress" aria-hidden="true">
                <span style={{ width: `${story.percent || 0}%` }} />
              </div>
              <p className="story-progress-label">
                Capítulo {chapterNumber}/{chapterCount}
                {' · '}
                {story.percent || 0}%
              </p>
              {!story.finished ? (
                <>
                  <ul className="story-goals-mini">
                    {(currentChapter.goals || []).map((goal) => (
                      <li key={goal.id} className={goal.done ? 'done' : ''}>
                        {goal.done ? '✓' : '○'} {goal.label}
                      </li>
                    ))}
                  </ul>
                  {story.lastOutcome?.blurb ? (
                    <p className="story-last-outcome">{story.lastOutcome.blurb}</p>
                  ) : null}
                  <button
                    type="button"
                    className="primary story-advance-btn"
                    disabled={saving || (!story.canAdvance && !activeBeat)}
                    onClick={() => {
                      if (activeBeat) {
                        setStoryOpen(true);
                        return;
                      }
                      advanceStory();
                    }}
                  >
                    {saving && storyOpen
                      ? 'Gerando cena…'
                      : activeBeat
                        ? 'Continuar cena'
                        : story.lockedUntilTomorrow
                          ? 'Tente amanhã'
                          : story.canAdvance
                            ? 'Avançar na história'
                            : 'Requisitos incompletos'}
                  </button>
                  {story.lockedUntilTomorrow ? (
                    <p className="hint">
                      Você já tentou hoje. Aprenda um jutsu e volte amanhã — a cena se repete sem gastar IA de novo.
                    </p>
                  ) : null}
                  {currentChapter.successNeedsJutsu && !jutsuOwned && !story.lockedUntilTomorrow ? (
                    <p className="hint">Pode tentar sem jutsu, mas nenhuma opção vai deixar você passar.</p>
                  ) : null}
                </>
              ) : (
                <p className="hint">Você concluiu a jornada da Folha — por enquanto.</p>
              )}
            </section>
          ) : null}

          <section className="ninja-vaults" aria-label="Pergaminho e bolsa">
            <button
              type="button"
              className="ninja-vault"
              disabled={ninja.needsFirstNature}
              onClick={() => setOpenPanel('jutsus')}
            >
              <span className="ninja-vault-icon" aria-hidden="true">📜</span>
              <strong>Pergaminho</strong>
              <em>Jutsus & técnicas</em>
            </button>
            <button
              type="button"
              className="ninja-vault"
              onClick={() => setOpenPanel('inventory')}
            >
              <span className="ninja-vault-icon" aria-hidden="true">🎒</span>
              <strong>Bolsa</strong>
              <em>
                Inventário
                {owned.length ? ` · ${owned.length}` : ''}
              </em>
            </button>
          </section>
          {ninja.needsFirstNature ? (
            <p className="hint">Escolha a natureza acima para abrir o pergaminho de jutsus.</p>
          ) : null}

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
            Água = +1 chakra/dia · Treino = +1 Nin/Gen/Tai · Dia completo = +3 pts · 3 pts = +1 chakra
          </p>
        </>
      ) : null}

      {openPanel === 'jutsus' && ninja && !ninja.needsFirstNature ? (
        <div className="ninja-sheet" role="dialog" aria-modal="true" aria-label="Jutsus e técnicas">
          <button
            type="button"
            className="ninja-sheet-backdrop"
            aria-label="Fechar"
            onClick={() => setOpenPanel(null)}
          />
          <div className="ninja-sheet-panel">
            <header className="ninja-sheet-head">
              <div>
                <p className="nature-pick-kicker">Pergaminho</p>
                <h2>Jutsus & técnicas</h2>
              </div>
              <div className="ninja-sheet-head-actions">
                <span className="hint">{ninja.unlockPoints} pts</span>
                <button
                  type="button"
                  className="ghost jutsu-detail-close"
                  onClick={() => setOpenPanel(null)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="ninja-sheet-body">
              {selectedJutsu ? (
                <JutsuDetail
                  item={selectedJutsu}
                  saving={saving}
                  onUnlock={unlock}
                  onClose={() => setSelectedJutsuId(null)}
                  sticky
                />
              ) : (
                <p className="hint jutsu-grid-hint jutsu-grid-hint-top">
                  Toque num jutsu para ver detalhes e aprender.
                </p>
              )}

              <div className="jutsu-filter-block" role="group" aria-label="Disponibilidade">
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
              </div>

              <div className="jutsu-filter-block">
                <p className="jutsu-filter-label">Ranking</p>
                <div className="ninja-filters jutsu-chip-row" role="group" aria-label="Ranking">
                  <button
                    type="button"
                    className={tierFilter === 'all' ? 'primary' : 'ghost'}
                    onClick={() => setTierFilter('all')}
                  >
                    Todos
                  </button>
                  {TIER_ORDER.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={tierFilter === tier ? 'primary' : 'ghost'}
                      onClick={() => setTierFilter(tier)}
                    >
                      <span className={`jutsu-tier tier-${tier}`}>{tier}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="jutsu-filter-block">
                <p className="jutsu-filter-label">Elemento</p>
                <div className="ninja-filters jutsu-chip-row" role="group" aria-label="Elemento">
                  <button
                    type="button"
                    className={natureFilter === 'all' ? 'primary' : 'ghost'}
                    onClick={() => setNatureFilter('all')}
                  >
                    Todos
                  </button>
                  {natureOptions.hasUniversal ? (
                    <button
                      type="button"
                      className={natureFilter === 'universal' ? 'primary' : 'ghost'}
                      onClick={() => setNatureFilter('universal')}
                    >
                      Universal
                    </button>
                  ) : null}
                  {natureOptions.sorted.map((natureId) => (
                    <button
                      key={natureId}
                      type="button"
                      className={natureFilter === natureId ? 'primary' : 'ghost'}
                      onClick={() => setNatureFilter(natureId)}
                    >
                      {NATURE_SHORT[natureId] || natureId}
                    </button>
                  ))}
                </div>
              </div>

              <div className="jutsu-filter-block">
                <p className="jutsu-filter-label">Tipo</p>
                <div className="ninja-filters jutsu-chip-row" role="group" aria-label="Tipo">
                  <button
                    type="button"
                    className={categoryFilter === 'all' ? 'primary' : 'ghost'}
                    onClick={() => setCategoryFilter('all')}
                  >
                    Todos
                  </button>
                  {categoryOptions.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={categoryFilter === category ? 'primary' : 'ghost'}
                      onClick={() => setCategoryFilter(category)}
                    >
                      <span aria-hidden="true">{emojiForCategory(category)} </span>
                      {CATEGORY_LABEL[category] || category}
                    </button>
                  ))}
                </div>
              </div>

              {listToShow.length === 0 ? (
                <p className="hint">
                  {filter === 'available'
                    ? 'Nada liberado com esses filtros — feche o dia em Hoje ou ajuste ranking/elemento.'
                    : 'Lista vazia neste filtro.'}
                </p>
              ) : (
                <div className="jutsu-grid" role="list">
                  {listToShow.map((item) => (
                    <JutsuTile
                      key={item.id}
                      item={item}
                      selected={item.id === selectedJutsuId}
                      onSelect={() => setSelectedJutsuId(
                        item.id === selectedJutsuId ? null : item.id,
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {openPanel === 'inventory' && ninja ? (
        <div className="ninja-sheet" role="dialog" aria-modal="true" aria-label="Inventário">
          <button
            type="button"
            className="ninja-sheet-backdrop"
            aria-label="Fechar"
            onClick={() => setOpenPanel(null)}
          />
          <div className="ninja-sheet-panel">
            <header className="ninja-sheet-head">
              <div>
                <p className="nature-pick-kicker">Bolsa</p>
                <h2>Inventário</h2>
              </div>
              <button
                type="button"
                className="ghost jutsu-detail-close"
                onClick={() => setOpenPanel(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="ninja-sheet-body">
              {owned.length === 0 ? (
                <p className="hint">
                  Ainda sem jutsus. Bata a meta de água e feche o dia em <Link to="/">Hoje</Link>.
                </p>
              ) : (
                <div className="jutsu-grid jutsu-grid-owned" role="list">
                  {owned.map((item) => (
                    <div key={item.id} className="jutsu-tile is-owned" role="listitem">
                      <JutsuTileFace item={item} />
                      <strong>{shortJutsuName(item.name)}</strong>
                      <em>{KIND_LABEL[item.kind] || item.kind}</em>
                    </div>
                  ))}
                </div>
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
            </div>
          </div>
        </div>
      ) : null}

      {storyOpen && (activeBeat || saving) ? (
        <div className="ninja-sheet story-sheet" role="dialog" aria-modal="true" aria-label="Cena da história">
          <button
            type="button"
            className="ninja-sheet-backdrop"
            aria-label="Fechar"
            onClick={() => !saving && setStoryOpen(false)}
          />
          <div className="ninja-sheet-panel">
            <header className="ninja-sheet-head">
              <div>
                <p className="nature-pick-kicker">Modo História</p>
                <h2>{activeBeat?.chapterTitle || currentChapter?.title || 'Cena'}</h2>
              </div>
              <button
                type="button"
                className="ghost jutsu-detail-close"
                disabled={saving}
                onClick={() => setStoryOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="ninja-sheet-body">
              {!activeBeat && saving ? (
                <p className="hint">A IA está montando a cena…</p>
              ) : null}
              {activeBeat ? (
                <>
                  <p className="story-narrative">{activeBeat.narrative}</p>
                  <div className="story-choices">
                    {(activeBeat.choices || []).map((choice) => {
                      const locked = Boolean(choice.requiresJutsu && !jutsuOwned);
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          className="story-choice"
                          disabled={saving || locked}
                          onClick={() => chooseStory(choice.id)}
                        >
                          <strong>{choice.label}</strong>
                          {locked ? <em>Precisa de um jutsu</em> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {dailyOpen && dailyMission?.status === 'pending' ? (
        <div className="ninja-sheet story-sheet" role="dialog" aria-modal="true" aria-label="Missão do dia">
          <button
            type="button"
            className="ninja-sheet-backdrop"
            aria-label="Fechar"
            onClick={() => {
              setDailyOpen(false);
              setDailyDismissed(true);
            }}
          />
          <div className="ninja-sheet-panel">
            <header className="ninja-sheet-head">
              <div>
                <p className="nature-pick-kicker">Missão do dia</p>
                <h2>{dailyMission.title || 'Contrato'}</h2>
              </div>
              <button
                type="button"
                className="ghost jutsu-detail-close"
                onClick={() => {
                  setDailyOpen(false);
                  setDailyDismissed(true);
                }}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="ninja-sheet-body">
              <p className="story-narrative">{dailyMission.narrative}</p>
              <div className="story-choices">
                {(dailyMission.choices || []).map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="story-choice"
                    disabled={saving || choice.locked}
                    onClick={() => chooseDaily(choice.id)}
                  >
                    <strong>{choice.label}</strong>
                    {choice.locked ? <em>Precisa de um jutsu</em> : null}
                  </button>
                ))}
              </div>
              <p className="hint">Uma missão por dia. Escolha certa rende pts ou chakra.</p>
            </div>
          </div>
        </div>
      ) : null}

      {dailyMission?.status === 'completed' && dailyMission.outcomeBlurb && !dailyOpen ? (
        <p className="hint daily-mission-done">
          Missão do dia: {dailyMission.outcomeBlurb}
        </p>
      ) : null}

      <AppNav />
    </main>
  );
}

function JutsuTile({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`jutsu-tile${selected ? ' is-selected' : ''}${item.canUnlock ? ' can' : ' locked'}`}
      onClick={onSelect}
      aria-pressed={selected}
      title={item.name}
    >
      <JutsuTileFace item={item} />
      <strong>{shortJutsuName(item.name)}</strong>
    </button>
  );
}

function JutsuTileFace({ item }) {
  const visual = visualForJutsu(item);
  return (
    <span className="jutsu-tile-art" aria-hidden="true">
      {visual.type === 'seal' ? (
        <img src={visual.src} alt="" />
      ) : (
        <span className="jutsu-tile-emoji">{visual.emoji}</span>
      )}
      {item.tier ? <span className={`jutsu-tier tier-${item.tier}`}>{item.tier}</span> : null}
    </span>
  );
}

function JutsuDetail({ item, saving, onUnlock, onClose, cta = 'Aprender', sticky = false }) {
  const natureTag = (item.requiresNatures || [])
    .map((id) => NATURE_SHORT[id] || id)
    .join('+') || 'Universal';
  return (
    <div className={`jutsu-detail${sticky ? ' jutsu-detail-sticky' : ''}`}>
      <div className="jutsu-detail-head">
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
        </div>
        <button type="button" className="ghost jutsu-detail-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>
      {item.blurb ? <p className="hint">{item.blurb}</p> : null}
      {item.locked && item.missing?.length ? (
        <p className="hint">Falta: {item.missing.join(' · ')}</p>
      ) : null}
      <button
        type="button"
        className="primary"
        disabled={saving || !item.canUnlock}
        onClick={() => onUnlock(item.id)}
      >
        {item.canUnlock ? `${cta} · ${item.costUnlockPoints} pts` : 'Bloqueado'}
      </button>
    </div>
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

function shortJutsuName(name) {
  const text = String(name || '').trim();
  const paren = text.match(/\(([^)]+)\)\s*$/);
  if (paren?.[1]) return paren[1];
  if (text.length <= 22) return text;
  return `${text.slice(0, 20)}…`;
}

function firstName(fullName) {
  const part = String(fullName || '').trim().split(/\s+/)[0];
  return part || 'Ninja';
}

function StatBar({
  label,
  value,
  max,
  tone,
  onPlus,
  plusDisabled = false,
  plusLabel,
  plusPulse = false,
}) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`ninja-bar ${tone}`}>
      <div className="ninja-bar-head">
        <span>{label}</span>
        <div className="ninja-bar-value">
          <strong>{value}/{max}</strong>
          {onPlus ? (
            <button
              type="button"
              className={`ninja-stat-plus${plusPulse ? ' is-pulse' : ''}`}
              disabled={plusDisabled}
              onClick={onPlus}
              aria-label={plusLabel || `Aumentar ${label}`}
              title={plusLabel || `Aumentar ${label}`}
            >
              +
            </button>
          ) : null}
        </div>
      </div>
      <div className="ninja-bar-track" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
