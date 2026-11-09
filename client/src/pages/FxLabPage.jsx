import { useState } from 'react';
import { ElementFx } from '../components/story/ElementFx.jsx';
import { FX_META } from '../components/story/storyArt.js';
import { Sprite } from '../components/story/StoryParts.jsx';
import { HERO_FALLBACK, bgUrl } from '../components/story/storyArt.js';
import '../story.css';

/** Laboratório das animações de elemento (somente em desenvolvimento). */
export function FxLabPage() {
  const [active, setActive] = useState(null);
  const [from, setFrom] = useState('player');
  const [pose, setPose] = useState('idle');
  const params = new URLSearchParams(window.location.search);
  const bg = params.get('bg') || 'arena';

  function play(fx) {
    setActive(null);
    window.requestAnimationFrame(() => setActive({ fx, id: Date.now() }));
  }

  return (
    <div className="story-stage" style={{ position: 'fixed' }}>
      <div className="stage-body">
        <div className="stage-bg" style={{ backgroundImage: `url(${bgUrl(bg)})` }} />
        <div className="stage-shade" />
        <div style={{ position: 'relative', zIndex: 2, padding: 14, display: 'grid', gap: 10 }}>
          <strong>Laboratório de animações</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(FX_META).map(([fx, meta]) => (
              <button
                key={fx}
                type="button"
                className="st-lore-btn"
                data-fx={fx}
                onClick={() => play(fx)}
              >
                {meta.glyph} {meta.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['player', 'enemy'].map((side) => (
              <button
                key={side}
                type="button"
                className="st-lore-btn"
                data-from={side}
                onClick={() => setFrom(side)}
                style={{ opacity: from === side ? 1 : 0.5 }}
              >
                de: {side}
              </button>
            ))}
            {['idle', 'attack', 'cast', 'hurt', 'guard', 'win', 'lose', 'stun'].map((item) => (
              <button
                key={item}
                type="button"
                className="st-lore-btn"
                data-pose={item}
                onClick={() => setPose(item)}
                style={{ opacity: pose === item ? 1 : 0.5 }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{ position: 'absolute', left: '4%', bottom: 0, height: '84%', width: '46%' }}>
            <Sprite src="/images/story/sprites/hero.webp" fallback={HERO_FALLBACK} pose={pose} side="player" fx={active?.fx} />
          </div>
          <div style={{ position: 'absolute', right: '4%', bottom: 0, height: '76%', width: '46%', display: 'flex', justifyContent: 'flex-end' }}>
            <Sprite src="/images/story/sprites/rival.webp" pose={pose === 'cast' ? 'idle' : pose} side="enemy" />
          </div>
        </div>
      </div>
      {active ? <ElementFx key={active.id} fx={active.fx} from={from} /> : null}
    </div>
  );
}
