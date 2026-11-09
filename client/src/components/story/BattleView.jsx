import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { ElChip, Sprite, poseArtUrl } from './StoryParts.jsx';
import { HERO_FALLBACK, fxMeta, spriteUrl } from './storyArt.js';

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const pct = (value, max) => Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
const LEVEL_LABEL = { leve: 'golpe leve', médio: 'golpe médio', forte: 'golpe forte' };

function objectiveOf(battle) {
  const parts = [];
  if (battle.mode === 'survive') parts.push(`Sobreviva até a rodada ${battle.maxRounds}`);
  else if (battle.winAtEnemyPct) parts.push(`Reduza ${battle.enemy.name} a ${battle.winAtEnemyPct}% de vida`);
  else parts.push(`Derrote ${battle.enemy.name}`);
  if (battle.mustUseJutsu) parts.push(battle.usedJutsu ? 'jutsu usado ✓' : 'use ao menos 1 jutsu');
  return parts.join(' · ');
}

export function BattleView({
  beat,
  avatarSrc,
  poses,
  date,
  disabled,
  playFx,
  onPayload,
  onOutcome,
  onClose,
}) {
  const [disp, setDisp] = useState(beat.battle);
  const [pose, setPose] = useState({ player: 'idle', enemy: 'idle' });
  const [floats, setFloats] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [lastFx, setLastFx] = useState(null);
  const [tip, setTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const floatId = useRef(0);

  useEffect(() => {
    setDisp(beat.battle);
    setPose({ player: 'idle', enemy: 'idle' });
    setDrawer(false);
  }, [beat.beatId, beat.startedAt]);

  function addFloat(side, text, kind) {
    floatId.current += 1;
    const id = floatId.current;
    setFloats((current) => [...current, { id, side, text, kind }]);
    window.setTimeout(() => setFloats((current) => current.filter((item) => item.id !== id)), 1150);
  }

  async function playRound(prev, change) {
    const round = change.round;
    const mine = round.player;
    const theirs = round.enemy;
    let current = prev;

    // ── Sua ação ──
    current = { ...current, player: { ...current.player, chakra: round.playerChakraAfter } };
    setDisp(current);

    if (mine.action === 'guard') {
      setPose((state) => ({ ...state, player: 'guard' }));
      await sleep(420);
    } else {
      const melee = mine.action === 'strike' || mine.fx === 'taijutsu';
      setLastFx(mine.fx);
      setPose((state) => ({ ...state, player: melee ? 'attack' : 'cast' }));
      await (mine.fx ? playFx(mine.fx, 'player') : sleep(320));

      if (mine.damage > 0) {
        setPose((state) => ({ ...state, enemy: 'hurt' }));
        addFloat('enemy', `-${mine.damage}`, mine.crit ? 'crit' : 'dmg');
        current = { ...current, enemy: { ...current.enemy, hp: Math.max(0, current.enemy.hp - mine.damage) } };
        setDisp(current);
      }
      if (mine.heal > 0) {
        addFloat('player', `+${mine.heal}`, 'heal');
        current = {
          ...current,
          player: { ...current.player, hp: Math.min(current.player.hpMax, current.player.hp + mine.heal) },
        };
        setDisp(current);
      }
      if (mine.tag === 'advantage') addFloat('enemy', 'Vantagem!', 'status');
      if (mine.tag === 'resist') addFloat('enemy', 'Resistido', 'status');
      if (mine.stunned) addFloat('enemy', 'Atordoado!', 'status');
      await sleep(560);
    }
    setPose((state) => ({
      ...state,
      player: mine.action === 'guard' ? 'guard' : 'idle',
      enemy: current.enemy.hp <= 0 ? 'lose' : 'idle',
    }));

    // ── Ação do inimigo ──
    if (theirs.action === 'attack') {
      setPose((state) => ({ ...state, enemy: 'attack' }));
      await playFx(theirs.fx || 'taijutsu', 'enemy');
      if (theirs.dodged) {
        addFloat('player', 'Esquivou!', 'miss');
      } else {
        setPose((state) => ({ ...state, player: mine.action === 'guard' ? 'guard' : 'hurt' }));
        addFloat('player', `-${theirs.damage}`, 'dmg');
      }
      current = { ...current, player: { ...current.player, hp: round.playerHpAfter } };
      setDisp(current);
      await sleep(620);
    } else if (theirs.action === 'stunned') {
      setPose((state) => ({ ...state, enemy: 'stun' }));
      addFloat('enemy', 'Perdeu o turno', 'status');
      await sleep(650);
    }

    // ── Estado oficial do servidor ──
    setDisp(change.battle);
    const over = change.battle.over;
    if (over) {
      setPose({
        player: over.result === 'win' ? 'win' : 'lose',
        enemy: over.result === 'win' ? 'lose' : 'win',
      });
      await sleep(900);
    } else {
      setPose({ player: 'idle', enemy: 'idle' });
    }
  }

  async function act(action, jutsuId = null) {
    if (busy || disabled || disp.over) return;
    setBusy(true);
    setError('');
    setDrawer(false);
    const prev = disp;
    try {
      const payload = await api('/api/ninja/story/battle/act', {
        method: 'POST',
        body: { action, jutsuId, round: prev.round, beatId: beat.beatId, date },
      });
      const change = (payload.changes || []).find((item) => item.type === 'story-battle');
      onPayload(payload);
      if (change) {
        await playRound(prev, change);
        if (change.outcome) onOutcome(change.outcome);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const { player, enemy, actions } = disp;
  const lockedUi = busy || disabled || Boolean(disp.over);
  const logLines = disp.log?.length ? disp.log.slice(-2) : [beat.text];

  return (
    <div className="bt">
      <header className="st-top">
        <button type="button" className="st-close" onClick={onClose} aria-label="Fechar batalha">×</button>
        <div className="st-title">
          <small>{beat.chapterTitle}</small>
          <strong>{beat.place}</strong>
        </div>
        {beat.lore ? (
          <button type="button" className="st-lore-btn" onClick={() => setTip((open) => !open)} aria-expanded={tip}>
            Dica
          </button>
        ) : null}
        <span className="bt-round">Rodada {Math.min(disp.round, disp.maxRounds)}/{disp.maxRounds}</span>
      </header>

      <p className="bt-objective">{objectiveOf(disp)}</p>
      {tip && beat.lore ? <p className="bt-tip">{beat.lore}</p> : null}

      <div className="bt-field">
        <div className="bt-enemy">
          <Sprite
            src={spriteUrl(enemy.sprite)}
            pose={pose.enemy}
            side="enemy"
            fx={enemy.element}
            label={enemy.name}
          />
        </div>

        <div className="bt-hud enemy">
          <div className="bt-name">
            <strong>{enemy.name}</strong>
            {enemy.element ? <ElChip fx={enemy.element} /> : null}
          </div>
          <span className="bt-sub">{enemy.title}</span>
          <div className="bar hp enemy" aria-label={`Vida de ${enemy.name}`}>
            <i style={{ width: `${pct(enemy.hp, enemy.hpMax)}%` }} />
          </div>
          <div className="bar-label"><span>HP</span><span>{enemy.hp}/{enemy.hpMax}</span></div>
          {enemy.weak ? (
            <span className="bt-weak">Fraqueza: <ElChip fx={enemy.weak} /> {enemy.weakLabel}</span>
          ) : null}
          {!disp.over ? (
            <div className={`bt-intent lv-${enemy.intent.level === 'médio' ? 'medio' : enemy.intent.level}`}>
              <ElChip fx={enemy.intent.fx} />
              <span>
                <b>{enemy.stunned ? 'Atordoado' : enemy.intent.name}</b>
                <i>{enemy.stunned ? 'perde o turno' : LEVEL_LABEL[enemy.intent.level]}</i>
              </span>
            </div>
          ) : null}
        </div>

        <div className="bt-player">
          <Sprite
            src={avatarSrc}
            poseSrc={poseArtUrl(poses, pose.player)}
            fallback={HERO_FALLBACK}
            pose={pose.player}
            side="player"
            fx={lastFx}
            label="Você"
          />
        </div>

        <div className="bt-hud player">
          <div className="bar hp" aria-label="Sua vida"><i style={{ width: `${pct(player.hp, player.hpMax)}%` }} /></div>
          <div className="bar-label"><span>Vida</span><span>{player.hp}/{player.hpMax}</span></div>
          <div className="bar ck" aria-label="Seu chakra"><i style={{ width: `${pct(player.chakra, player.chakraMax)}%` }} /></div>
          <div className="bar-label"><span>Chakra</span><span>{player.chakra}/{player.chakraMax}</span></div>
        </div>

        {floats.map((item) => (
          <span key={item.id} className={`float ${item.side} ${item.kind}`}>{item.text}</span>
        ))}
      </div>

      <div className="bt-actions">
        <div className="bt-log" aria-live="polite">
          {logLines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
        </div>
        {error ? <p className="st-error">{error}</p> : null}

        <div className="bt-buttons">
          <button type="button" className="bt-btn main" disabled={lockedUi} onClick={() => setDrawer(true)}>
            Jutsus
            <small>{actions.jutsus.length} aprendidos</small>
          </button>
          <button type="button" className="bt-btn" disabled={lockedUi} onClick={() => act('strike')}>
            Golpe
            <small>~{actions.strike.dmg} dano</small>
          </button>
          <button type="button" className="bt-btn" disabled={lockedUi} onClick={() => act('guard')}>
            Guarda
            <small>-60% dano · +{actions.guard.regen} chakra</small>
          </button>
          {actions.eye ? (
            <button
              type="button"
              className="bt-btn eye"
              disabled={lockedUi || !actions.eye.usable}
              onClick={() => act('eye')}
            >
              {actions.eye.label}
              <small>{actions.eye.cost} chakra · prevê golpe</small>
            </button>
          ) : null}
        </div>
      </div>

      {drawer ? (
        <div className="bt-drawer-sheet">
          <div className="bt-drawer-head">
            <strong>Seus jutsus</strong>
            <button type="button" className="ghost" onClick={() => setDrawer(false)}>Voltar</button>
          </div>
          {actions.jutsus.length ? (
            <div className="jutsu-grid">
              {actions.jutsus.map((jutsu) => (
                <button
                  key={jutsu.id}
                  type="button"
                  className={`jutsu-card${jutsu.tag ? ` tag-${jutsu.tag}` : ''}`}
                  style={{ '--c': fxMeta(jutsu.fx).color }}
                  disabled={lockedUi || !jutsu.usable}
                  onClick={() => act('jutsu', jutsu.id)}
                >
                  <span className="jutsu-card-top">
                    <ElChip fx={jutsu.fx} />
                    <em>{jutsu.tier}</em>
                    <small>{jutsu.cost} chakra</small>
                  </span>
                  <strong>{jutsu.name}</strong>
                  <span className="jutsu-card-foot">
                    <span>{jutsu.preview}</span>
                    {jutsu.tag === 'advantage' ? <b className="tag adv">Vantagem</b> : null}
                    {jutsu.tag === 'resist' ? <b className="tag res">Resistido</b> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">Você ainda não aprendeu jutsus. Use Golpe e Guarda.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
