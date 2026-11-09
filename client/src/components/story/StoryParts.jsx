import { useEffect, useRef, useState } from 'react';
import { bgUrl, fxMeta } from './storyArt.js';

/** Digita o texto da cena rápido; toque para pular. */
export function useTypewriter(text, resetKey) {
  const [count, setCount] = useState(0);
  const full = String(text || '');

  useEffect(() => {
    setCount(0);
    if (!full) return undefined;
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(full.length, index + 2);
      setCount(index);
      if (index >= full.length) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
  }, [full, resetKey]);

  return {
    typed: full.slice(0, count),
    done: count >= full.length,
    skip: () => setCount(full.length),
  };
}

/** Fundo da cena com crossfade entre locais. */
export function StageBackground({ bg }) {
  const [layers, setLayers] = useState(() => [{ key: 0, bg }]);
  const counter = useRef(0);

  useEffect(() => {
    setLayers((current) => {
      if (current[current.length - 1]?.bg === bg) return current;
      counter.current += 1;
      return [...current, { key: counter.current, bg }].slice(-2);
    });
  }, [bg]);

  useEffect(() => {
    if (layers.length < 2) return undefined;
    const timer = window.setTimeout(() => setLayers((current) => current.slice(-1)), 800);
    return () => window.clearTimeout(timer);
  }, [layers]);

  return (
    <>
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className={`stage-bg${layers.length > 1 && index === layers.length - 1 ? ' fade-in' : ''}`}
          style={{ backgroundImage: `url(${bgUrl(layer.bg)})` }}
        />
      ))}
      <div className="stage-shade" />
    </>
  );
}

/**
 * Personagem em cena. `pose` troca a animação (idle, attack, cast, guard, hurt, win, lose, stun).
 * `poseSrc` é a arte da pose (gerada por IA) quando existe; senão usa a imagem base com a animação CSS.
 */
export function Sprite({ src, poseSrc = null, fallback, pose = 'idle', side = 'player', fx, label }) {
  const [failed, setFailed] = useState(() => new Set());
  const shown = poseSrc || src;

  let finalSrc = shown;
  if (failed.has(shown)) {
    if (poseSrc && shown === poseSrc && !failed.has(src)) finalSrc = src;
    else finalSrc = fallback || src;
  }

  const color = fx ? fxMeta(fx).color : null;
  return (
    <div
      className={`sprite sprite-${side}`}
      data-pose={pose}
      style={color ? { '--fx': color } : undefined}
    >
      <span className="sprite-aura" />
      <img
        src={finalSrc}
        alt={label || ''}
        draggable={false}
        onError={() => setFailed((current) => new Set(current).add(finalSrc))}
      />
    </div>
  );
}

const POSE_FILE = { attack: 'attack', cast: 'cast', guard: 'guard', hurt: 'hurt', stun: 'hurt', lose: 'hurt', win: 'win' };

/** URL da arte da pose gerada por IA (ou null enquanto não existe). */
export function poseArtUrl(poses, pose) {
  const file = POSE_FILE[pose];
  if (!file || !poses?.ready?.includes(file)) return null;
  return `/api/ninja/pose/${file}?t=${encodeURIComponent(poses.stamp || '')}`;
}

/**
 * Pede ao servidor as poses de batalha (geradas em segundo plano) e acompanha até ficarem prontas.
 * Sem chave de IA ou com falha, devolve vazio e o personagem usa o avatar base.
 */
export function useNinjaPoses(enabled = true) {
  const [poses, setPoses] = useState({ ready: [], stamp: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let timer = null;

    async function refresh(trigger) {
      try {
        const response = await fetch('/api/ninja/poses', {
          method: trigger ? 'POST' : 'GET',
          credentials: 'include',
        });
        if (!response.ok || !alive) return;
        const info = await response.json();
        if (!alive) return;
        setPoses({ ready: info.ready || [], stamp: info.stamp || null });
        (info.ready || []).forEach((name) => {
          const image = new Image();
          image.src = `/api/ninja/pose/${name}?t=${encodeURIComponent(info.stamp || '')}`;
        });
        if (info.pending && (info.ready || []).length < (info.total || 5)) {
          timer = window.setTimeout(() => refresh(false), 6000);
        }
      } catch {
        // segue com o avatar base
      }
    }

    refresh(true);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return poses;
}

export function ElChip({ fx }) {
  if (!fx) return null;
  const meta = fxMeta(fx);
  return (
    <span className="el-chip" style={{ '--c': meta.color }} title={meta.label} aria-label={meta.label}>
      {meta.glyph}
    </span>
  );
}

export function RewardPills({ rewards, extra }) {
  const points = (rewards?.unlockPoints || 0) + (extra?.unlockPoints || 0);
  const chakra = (rewards?.chakra || 0) + (extra?.chakra || 0);
  if (!points && !chakra) return null;
  return (
    <div className="reward-row">
      {points ? <span className="reward-pill">+{points} pts</span> : null}
      {chakra ? <span className="reward-pill chakra">+{chakra} chakra</span> : null}
    </div>
  );
}

const RANK_NAME = { genin: 'Genin', chuunin: 'Chuunin', jounin: 'Jounin' };

/** Cartão de resultado: cena concluída, desvio, capítulo concluído ou tentativa fracassada. */
export function ResultCard({ outcome, onContinue, onRetry, onClose }) {
  const failed = outcome.result === 'fail';
  const chapterDone = Boolean(outcome.chapterDone);
  const detour = outcome.result === 'detour';
  const backToScene = failed && !outcome.locked && outcome.nextKind === 'scene';

  let kicker = `Cena ${outcome.beatIndex + 1} de ${outcome.beatTotal}`;
  if (failed) kicker = 'Tentativa fracassada';
  else if (chapterDone) kicker = 'Capítulo concluído';
  else if (detour) kicker = 'Desvio';

  return (
    <div className="st-modal" role="alertdialog" aria-live="assertive">
      <div className={`st-card ${failed ? 'fail' : chapterDone ? 'win' : ''}`}>
        <p className="kicker">{kicker}</p>
        {chapterDone ? <h3>{outcome.chapterTitle}</h3> : null}
        {outcome.choiceLabel && !chapterDone ? (
          <p className="st-card-choice">{outcome.choiceLabel}</p>
        ) : null}
        <p className="say">{outcome.say}</p>

        {failed && outcome.hint ? (
          <div className="hint-box">
            <strong>Dica para avançar</strong>
            <span>{outcome.hint}</span>
          </div>
        ) : null}

        {failed && outcome.locked ? (
          <p className="lock-note">
            A história trava até amanhã. Se você evoluir antes (novo jutsu, atributo ou dōjutsu), ela libera na hora.
          </p>
        ) : null}

        {chapterDone && outcome.promoted ? (
          <p className="promo-banner">Nova patente: {RANK_NAME[outcome.promoted] || outcome.promoted}</p>
        ) : null}

        {!failed ? (
          <RewardPills rewards={outcome.rewards} extra={chapterDone ? outcome.chapterRewards : null} />
        ) : null}

        <div className="st-card-actions">
          {failed && outcome.canRetryNow && !outcome.nextKind && !outcome.locked ? (
            <>
              <button type="button" className="ghost" onClick={onClose}>Fechar</button>
              <button type="button" className="primary" onClick={onRetry}>Tentar de novo</button>
            </>
          ) : failed && outcome.locked ? (
            <button type="button" className="primary" onClick={onClose}>Entendi</button>
          ) : (
            <button type="button" className="primary" onClick={onContinue}>
              {backToScene ? 'Entendi' : chapterDone ? 'Fechar capítulo' : 'Continuar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
