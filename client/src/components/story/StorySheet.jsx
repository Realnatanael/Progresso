import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { BattleView } from './BattleView.jsx';
import {
  ElChip,
  ResultCard,
  Sprite,
  StageBackground,
  poseArtUrl,
  useNinjaPoses,
  useTypewriter,
} from './StoryParts.jsx';
import { ElementFx } from './ElementFx.jsx';
import {
  FX_DURATION,
  FX_SHAKE,
  HERO_FALLBACK,
  TONE_COLOR,
  spriteUrl,
} from './storyArt.js';
import '../../story.css';

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function JutsuPicker({ choice, onPick, onBack, disabled }) {
  return (
    <div className="picker">
      <div className="picker-head">
        <strong>{choice.label}</strong>
        <button type="button" className="ghost" onClick={onBack}>Voltar</button>
      </div>
      <div className="picker-list">
        {(choice.options || []).map((option) => (
          <button
            key={option.id}
            type="button"
            className="picker-item"
            disabled={disabled}
            onClick={() => onPick(option)}
          >
            <ElChip fx={option.fx} />
            <span className="picker-name">{option.name}</span>
            <em className="tier-chip">{option.tier}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function SceneView({
  beat,
  avatarSrc,
  poses,
  pose,
  busy,
  castFx,
  pickerFor,
  onPickerFor,
  onChoose,
  onClose,
  onToggleLore,
  loreOpen,
}) {
  const { typed, done, skip } = useTypewriter(beat.text, beat.beatId + beat.startedAt);
  const npc = beat.who?.sprite || null;

  return (
    <div className="sc">
      <header className="st-top">
        <button type="button" className="st-close" onClick={onClose} aria-label="Fechar">×</button>
        <div className="st-title">
          <small>{beat.chapterTitle}</small>
          <div className="st-dots" aria-label={`Cena ${beat.index + 1} de ${beat.total}`}>
            {Array.from({ length: beat.total }, (_, i) => (
              <i key={i} className={i < beat.index ? 'on' : i === beat.index ? 'now' : ''} />
            ))}
          </div>
        </div>
        {beat.lore ? (
          <button type="button" className="st-lore-btn" onClick={onToggleLore} aria-expanded={loreOpen}>
            Contexto
          </button>
        ) : null}
      </header>

      {loreOpen && beat.lore ? (
        <aside className="st-lore" role="note">
          <strong>Universo Naruto</strong>
          <p>{beat.lore}</p>
        </aside>
      ) : null}

      <div className="st-cast">
        <Sprite
          src={avatarSrc}
          poseSrc={poseArtUrl(poses, pose)}
          fallback={HERO_FALLBACK}
          pose={pose}
          side="player"
          fx={castFx}
          label="Você"
        />
        {npc ? <Sprite src={spriteUrl(npc)} pose="idle" side="npc" label={beat.who?.name} /> : null}
      </div>

      <section className="st-dialog">
        <div className="st-chips">
          <span className="st-chip place">{beat.place}</span>
          {beat.mood ? <span className="st-chip">{beat.mood}</span> : null}
          {!done ? <span className="st-skip-hint">toque no texto para pular</span> : null}
        </div>

        {beat.who ? (
          <div className="st-speaker">
            <strong>{beat.who.name}</strong>
            {beat.who.role ? <small>{beat.who.role}</small> : null}
          </div>
        ) : null}

        <p className="st-text" onClick={skip}>
          <span className="st-text-ghost">{beat.text}</span>
          <span className="st-text-live">
            {typed}
            {!done ? <span className="story-caret" aria-hidden="true" /> : null}
          </span>
        </p>

        <div className={`st-choices${done ? '' : ' pending'}`} aria-hidden={!done}>
          {beat.choices.map((choice) => {
            const disabled = busy || choice.locked || choice.done || !done;
            return (
              <button
                key={choice.id}
                type="button"
                className={`st-choice${choice.done ? ' done' : ''}`}
                style={{ '--tone': TONE_COLOR[choice.tone] || TONE_COLOR.coragem }}
                disabled={disabled}
                tabIndex={done ? 0 : -1}
                onClick={() => (choice.kind === 'jutsu' ? onPickerFor(choice) : onChoose(choice))}
              >
                <small>{choice.toneLabel}</small>
                <span className="st-choice-label">{choice.label}</span>
                {choice.locked ? <span className="reason">Bloqueado: {choice.lockReason}</span> : null}
                {!choice.locked && choice.kind === 'jutsu' && !choice.done ? (
                  <span className="reason pick">Escolher um dos seus {choice.options?.length || 0} jutsus ›</span>
                ) : null}
                {choice.done ? <span className="reason">Já tentado</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      {pickerFor ? (
        <div className="picker-sheet">
          <JutsuPicker
            choice={pickerFor}
            disabled={busy}
            onBack={() => onPickerFor(null)}
            onPick={(option) => onChoose(pickerFor, option.id)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function StorySheet({ story, ninja, date, onPayload, onClose }) {
  const [view, setView] = useState(story.activeBeat || null);
  const [loading, setLoading] = useState(!story.activeBeat);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [fx, setFx] = useState(null);
  const [shake, setShake] = useState(false);
  const [pose, setPose] = useState('idle');
  const [castFx, setCastFx] = useState(null);
  const [pickerFor, setPickerFor] = useState(null);
  const [loreOpen, setLoreOpen] = useState(false);

  const storyRef = useRef(story);
  storyRef.current = story;
  const fxId = useRef(0);
  const poses = useNinjaPoses(Boolean(ninja?.avatarReady));

  const avatarSrc = ninja?.avatarUrl
    ? `${ninja.avatarUrl}?t=${encodeURIComponent(ninja.avatarUpdatedAt || '')}`
    : HERO_FALLBACK;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const openStory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await api('/api/ninja/story/advance', { method: 'POST', body: { date } });
      onPayload(payload);
      setView(payload.ninja.story.activeBeat || null);
      setPickerFor(null);
      setLoreOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date, onPayload]);

  useEffect(() => {
    if (!story.activeBeat) openStory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Animação de tela cheia. Resolve um pouco antes do fim pra o resultado aparecer sobre o rastro do efeito. */
  const playFx = useCallback((fxKey, from = 'player') => new Promise((resolve) => {
    const duration = FX_DURATION[fxKey] || 1000;
    fxId.current += 1;
    const id = fxId.current;
    setFx({ fx: fxKey, from, id });
    if (FX_SHAKE.has(fxKey)) {
      setShake(true);
      window.setTimeout(() => setShake(false), 560);
    }
    window.setTimeout(resolve, Math.round(duration * 0.62));
    window.setTimeout(() => setFx((current) => (current && current.id === id ? null : current)), duration + 80);
  }), []);

  async function choose(choice, jutsuId = null) {
    if (busy || !view) return;
    setBusy(true);
    setError('');
    setPickerFor(null);
    try {
      const payload = await api('/api/ninja/story/choose', {
        method: 'POST',
        body: { choiceId: choice.id, jutsuId, beatId: view.beatId, date },
      });
      const outcome = (payload.changes || []).find((item) => item.type === 'story-choose')?.outcome;
      onPayload(payload);
      if (outcome?.fx) {
        setCastFx(outcome.fx);
        setPose('cast');
        await playFx(outcome.fx);
        await sleep(160);
      } else if (outcome?.result === 'fail') {
        setPose('hurt');
        await sleep(380);
      }
      setPose('idle');
      setResult(outcome || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function afterResult() {
    setResult(null);
    setPose('idle');
    setLoreOpen(false);
    const next = storyRef.current.activeBeat;
    if (next) {
      setView(next);
      setPickerFor(null);
    } else {
      onClose();
    }
  }

  async function retry() {
    setResult(null);
    await openStory();
  }

  const battleView = view?.kind === 'battle';

  return (
    <div
      className={`story-stage${battleView ? ' is-battle' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Modo História"
    >
      <div className={`stage-body${shake ? ' shake' : ''}`}>
      <StageBackground bg={view?.bg || 'gates'} />

      {view && battleView ? (
        <BattleView
          beat={view}
          avatarSrc={avatarSrc}
          poses={poses}
          date={date}
          disabled={Boolean(result)}
          playFx={playFx}
          onPayload={onPayload}
          onOutcome={(outcome) => setResult(outcome)}
          onClose={onClose}
        />
      ) : null}

      {view && !battleView ? (
        <SceneView
          beat={view}
          avatarSrc={avatarSrc}
          poses={poses}
          pose={pose}
          castFx={castFx}
          busy={busy || Boolean(result)}
          pickerFor={pickerFor}
          onPickerFor={setPickerFor}
          onChoose={choose}
          onClose={onClose}
          loreOpen={loreOpen}
          onToggleLore={() => setLoreOpen((open) => !open)}
        />
      ) : null}
      </div>

      {!view && !loading ? (
        <div className="st-empty">
          <p>{error || 'Nada para jogar agora.'}</p>
          <button type="button" className="primary" onClick={onClose}>Fechar</button>
        </div>
      ) : null}

      {loading ? (
        <div className="st-loading">
          <span className="story-loading-pulse" aria-hidden="true" />
          <p>Abrindo a cena…</p>
        </div>
      ) : null}

      {fx ? <ElementFx key={fx.id} fx={fx.fx} from={fx.from} /> : null}

      {result ? (
        <ResultCard
          outcome={result}
          onContinue={afterResult}
          onRetry={retry}
          onClose={onClose}
        />
      ) : null}

      {error && view ? <p className="st-error floating">{error}</p> : null}
    </div>
  );
}
