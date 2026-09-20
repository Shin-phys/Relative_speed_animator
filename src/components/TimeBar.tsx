import { useEffect, useRef } from 'react';
import { SPEEDS, useStore } from '../state/store';

export function TimeBar() {
  const t = useStore((s) => s.t);
  const T = useStore((s) => s.inst.T);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const frameDt = useStore((s) => s.frameDt);
  const canJump = useStore((s) => s.info.tJump !== null);
  const st = useStore.getState;
  const timer = useRef<number | null>(null);

  const stopHold = () => {
    if (timer.current !== null) { window.clearInterval(timer.current); window.clearTimeout(timer.current); timer.current = null; }
  };
  useEffect(() => stopHold, []);
  // 長押しで連続コマ送り
  const startHold = (dir: 1 | -1) => {
    st().step(dir);
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(() => st().step(dir), 90);
    }, 350);
  };

  const play = () => {
    const s = st();
    if (s.playing) s.set({ playing: false });
    else s.set({ playing: true, t: s.t >= s.inst.T - 1e-6 ? 0 : s.t });
  };

  return (
    <div className="timebar">
      <div className="tb-row">
        <button className="big primary" onClick={play} aria-label={playing ? '一時停止' : '再生'}>{playing ? '❚❚' : '▶'}</button>
        <button className="big" onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} aria-label="1コマ戻す">◀︎❘</button>
        <button className="big" onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} aria-label="1コマ進める">❘▶︎</button>
        <input
          className="slider"
          type="range"
          min={0}
          max={T}
          step={0.01}
          value={t}
          onChange={(e) => st().set({ t: Number(e.target.value), playing: false })}
          aria-label="時刻"
        />
        <span className="tnum">{t.toFixed(2)} / {T.toFixed(0)} s</span>
      </div>
      <div className="tb-row wrap">
        <div className="seg" role="group" aria-label="再生速度">
          {SPEEDS.map((v) => (
            <button key={v} className={speed === v ? 'on' : ''} onClick={() => st().set({ speed: v })}>×{v}</button>
          ))}
        </div>
        <label className="inline">コマ送り
          <select value={frameDt} onChange={(e) => st().set({ frameDt: Number(e.target.value) })}>
            {[0.1, 0.25, 0.5, 1, 2].map((v) => <option key={v} value={v}>{v} s</option>)}
          </select>
        </label>
        <button className="big" onClick={() => st().jumpClosest()} disabled={!canJump}>最接近へ</button>
        <button className="big" onClick={() => st().reset()}>リセット</button>
      </div>
    </div>
  );
}
