import { useEffect, useMemo } from 'react';
import { FX_DURATION, fxMeta } from './storyArt.js';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (rand, min, max) => min + rand() * (max - min);
const many = (count, make) => Array.from({ length: count }, (_, index) => make(index));

function bolt(rand) {
  const points = [];
  let x = range(rand, 22, 78);
  for (let step = 0; step <= 8; step += 1) {
    points.push(`${x.toFixed(1)},${((step / 8) * 100).toFixed(1)}`);
    x = Math.min(92, Math.max(8, x + range(rand, -13, 13)));
  }
  return points.join(' ');
}

const CRACKS = [
  'M50 100 L48 78 L54 62 L47 44 L52 26 L49 8',
  'M50 100 L36 84 L34 66 L24 52 L26 34',
  'M50 100 L66 82 L70 64 L82 50 L80 30',
  'M48 78 L30 74 L16 80',
  'M54 62 L74 58 L90 64',
];

/**
 * Animação de tela cheia do elemento/técnica usado.
 * `from` espelha o efeito quando é o inimigo atacando.
 */
export function ElementFx({ fx = 'neutral', from = 'player', onDone }) {
  const duration = FX_DURATION[fx] || 1100;

  useEffect(() => {
    if (!onDone) return undefined;
    const timer = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDone]);

  const parts = useMemo(() => {
    const rand = seeded(Math.floor(Math.random() * 1e9));
    return {
      flames: many(24, () => ({ x: range(rand, 3, 97), s: range(rand, 38, 92), d: range(rand, 0, 460), t: range(rand, -9, 9) })),
      embers: many(26, () => ({ x: range(rand, 2, 98), s: range(rand, 2, 5), d: range(rand, 0, 700), dx: range(rand, -60, 60) })),
      drops: many(16, () => ({ x: range(rand, 6, 94), s: range(rand, 5, 12), d: range(rand, 350, 800), dx: range(rand, -40, 40), dy: range(rand, -52, -22) })),
      streaks: many(18, () => ({ y: range(rand, 4, 94), w: range(rand, 40, 120), d: range(rand, 0, 520), r: range(rand, -9, 9) })),
      leaves: many(10, () => ({ y: range(rand, 10, 88), d: range(rand, 0, 600) })),
      rocks: many(14, () => ({ x: range(rand, 6, 94), s: range(rand, 22, 64), d: range(rand, 0, 520), r: range(rand, -380, 380) })),
      dust: many(4, () => ({ x: range(rand, -4, 62), d: range(rand, 380, 760) })),
      bolts: many(3, () => ({ points: bolt(rand), d: range(rand, 0, 240) })),
      lines: many(16, (index) => ({ a: index * (360 / 16) + range(rand, -6, 6), d: range(rand, 0, 120) })),
      motes: many(22, () => ({ x: range(rand, 4, 96), s: range(rand, 4, 11), d: range(rand, 0, 700) })),
      bubbles: many(16, () => ({ x: range(rand, 6, 94), s: range(rand, 6, 18), d: range(rand, 300, 900) })),
    };
  }, []);

  const meta = fxMeta(fx);
  const className = `fx fx-${fx}${from === 'enemy' ? ' from-enemy' : ''}`;
  const style = { '--c': meta.color, '--dur': `${duration}ms` };

  return (
    <div className={className} style={style} aria-hidden="true">
      {fx === 'fire' ? (
        <>
          <div className="fx-tint" />
          <div className="fx-glow" />
          {parts.flames.map((f, i) => (
            <i key={`f${i}`} className="flame" style={{ '--x': `${f.x}%`, '--s': f.s, '--d': `${f.d}ms`, '--t': `${f.t}deg` }}>
              <u />
            </i>
          ))}
          {parts.embers.map((e, i) => (
            <b key={`e${i}`} className="ember" style={{ '--x': `${e.x}%`, '--s': e.s, '--d': `${e.d}ms`, '--dx': `${e.dx}px` }} />
          ))}
        </>
      ) : null}

      {fx === 'water' ? (
        <>
          <div className="fx-tint" />
          <div className="water-body">
            <span className="water-crest" />
            <span className="water-crest alt" />
          </div>
          {parts.drops.map((d, i) => (
            <i key={`d${i}`} className="drop" style={{ '--x': `${d.x}%`, '--s': d.s, '--d': `${d.d}ms`, '--dx': `${d.dx}px`, '--dy': `${d.dy}vh` }} />
          ))}
          {parts.bubbles.map((b, i) => (
            <b key={`b${i}`} className="bubble-fx" style={{ '--x': `${b.x}%`, '--s': b.s, '--d': `${b.d}ms` }} />
          ))}
        </>
      ) : null}

      {fx === 'wind' ? (
        <>
          <div className="fx-tint" />
          <div className="wind-sweep" />
          {parts.streaks.map((s, i) => (
            <i key={`s${i}`} className="streak" style={{ '--y': `${s.y}%`, '--w': `${s.w}%`, '--d': `${s.d}ms`, '--r': `${s.r}deg` }} />
          ))}
          {parts.leaves.map((l, i) => (
            <b key={`l${i}`} className="leaf" style={{ '--y': `${l.y}%`, '--d': `${l.d}ms` }} />
          ))}
        </>
      ) : null}

      {fx === 'earth' ? (
        <>
          <div className="fx-tint" />
          <svg className="cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
            {CRACKS.map((d, i) => (
              <path key={i} d={d} style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </svg>
          {parts.rocks.map((r, i) => (
            <i key={`r${i}`} className="rock" style={{ '--x': `${r.x}%`, '--s': r.s, '--d': `${r.d}ms`, '--r': `${r.r}deg` }} />
          ))}
          {parts.dust.map((d, i) => (
            <b key={`u${i}`} className="dust" style={{ '--x': `${d.x}%`, '--d': `${d.d}ms` }} />
          ))}
        </>
      ) : null}

      {fx === 'lightning' ? (
        <>
          <div className="fx-tint" />
          <div className="fx-flash" />
          <svg className="bolts" viewBox="0 0 100 100" preserveAspectRatio="none">
            {parts.bolts.map((b, i) => (
              <g key={i}>
                <polyline className="glow" points={b.points} style={{ animationDelay: `${b.d}ms` }} />
                <polyline points={b.points} style={{ animationDelay: `${b.d}ms` }} />
              </g>
            ))}
          </svg>
        </>
      ) : null}

      {fx === 'genjutsu' ? (
        <>
          <div className="fx-tint" />
          <div className="spiral" />
          <div className="spiral s2" />
          <div className="genjutsu-eye" />
        </>
      ) : null}

      {fx === 'dojutsu' ? (
        <>
          <div className="fx-tint" />
          <div className="dojutsu-wheel">
            {[0, 120, 240].map((angle) => (
              <i key={angle} className="tomoe" style={{ '--a': `${angle}deg` }} />
            ))}
          </div>
        </>
      ) : null}

      {fx === 'taijutsu' ? (
        <>
          <div className="fx-flash" />
          <div className="impact-ring" />
          <div className="impact-ring r2" />
          {parts.lines.map((l, i) => (
            <i key={`t${i}`} className="impact-line" style={{ '--a': `${l.a}deg`, '--d': `${l.d}ms` }} />
          ))}
        </>
      ) : null}

      {fx === 'heal' ? (
        <>
          <div className="fx-tint" />
          {parts.motes.map((m, i) => (
            <i key={`m${i}`} className="mote" style={{ '--x': `${m.x}%`, '--s': m.s, '--d': `${m.d}ms` }} />
          ))}
        </>
      ) : null}

      {fx === 'seal' ? (
        <>
          <div className="fx-tint" />
          <div className="seal-ring" />
          <div className="seal-ring r2" />
          <div className="seal-ring r3" />
        </>
      ) : null}

      {fx === 'blade' ? (
        <>
          <div className="fx-flash soft" />
          {[0, 1, 2].map((i) => (
            <i key={i} className="slash" style={{ '--d': `${i * 110}ms`, '--y': `${28 + i * 18}%` }} />
          ))}
        </>
      ) : null}

      {['sage', 'beast', 'sense', 'spirit', 'neutral'].includes(fx) ? (
        <>
          <div className="fx-tint" />
          <div className="burst-ring" />
          <div className="burst-ring r2" />
          {parts.motes.slice(0, 12).map((m, i) => (
            <i key={`n${i}`} className="mote glow" style={{ '--x': `${m.x}%`, '--s': m.s, '--d': `${m.d}ms` }} />
          ))}
        </>
      ) : null}
    </div>
  );
}
