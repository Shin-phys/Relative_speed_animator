import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { applyQuery, useStore } from './state/store';
import { View3D, OBS_LABEL } from './components/View3D';
import { View2D } from './components/View2D';
import { TimeBar } from './components/TimeBar';
import { SettingsPanel } from './components/SettingsPanel';
import type { Observer } from './types';

applyQuery(location.search);

function Placeholder({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <section className="pane placeholder">
      <button className="open-btn" onClick={onOpen}>{title}を開く</button>
    </section>
  );
}

export function App() {
  const s = useStore(useShallow((x) => ({ show3d: x.show3d, show2d: x.show2d, observer: x.observer, groundPos: x.groundPos, set: x.set })));
  const [panel, setPanel] = useState(() => window.innerWidth >= 900);

  // 再生ループ：時刻はストアの t だけが持つ
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      useStore.getState().tick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <h1>相対速度アニメーター</h1>
        <button className="big" onClick={() => setPanel((v) => !v)} aria-expanded={panel}>条件設定</button>
        <div className="seg" role="group" aria-label="観測者">
          {(['A', 'B', 'ground'] as Observer[]).map((o) => (
            <button key={o} className={s.observer === o ? 'on' : ''} onClick={() => s.set({ observer: o })}>{OBS_LABEL[o]}</button>
          ))}
        </div>
        {s.observer === 'ground' && (
          <span className="gpos">
            位置 x
            <input type="number" value={s.groundPos.x} step={5} onChange={(e) => s.set({ groundPos: { ...s.groundPos, x: Number(e.target.value) || 0 } })} />
            y
            <input type="number" value={s.groundPos.y} step={5} onChange={(e) => s.set({ groundPos: { ...s.groundPos, y: Number(e.target.value) || 0 } })} />
            m
          </span>
        )}
      </header>
      <div className="main">
        {panel && <SettingsPanel onClose={() => setPanel(false)} />}
        <div className="panes">
          {s.show3d ? <View3D /> : <Placeholder title="3D画面" onOpen={() => s.set({ show3d: true })} />}
          {s.show2d ? <View2D /> : <Placeholder title="俯瞰図" onOpen={() => s.set({ show2d: true })} />}
        </div>
      </div>
      <TimeBar />
    </div>
  );
}
