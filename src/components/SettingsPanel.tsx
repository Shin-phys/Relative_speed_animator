import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SCENARIOS, getScenario } from '../scenarios';
import { stateToQuery, useStore } from '../state/store';
import { ScenarioDiagram } from './ScenarioDiagram';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useStore(
    useShallow((x) => ({
      scenarioId: x.scenarioId, params: x.params, firstView: x.firstView, hints3d: x.hints3d,
      initialStage: x.initialStage, strobeDt: x.strobeDt, setScenario: x.setScenario, setParam: x.setParam,
      applyPreset: x.applyPreset, set: x.set,
    })),
  );
  const def = getScenario(s.scenarioId);
  const [link, setLink] = useState('');

  const makeLink = () => {
    const url = `${location.origin}${location.pathname}?${stateToQuery(useStore.getState())}`;
    setLink(url);
    navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  return (
    <aside className="drawer" aria-label="条件設定">
      <div className="drawer-head">
        <strong>条件設定</strong>
        <button className="ghost" onClick={onClose}>閉じる</button>
      </div>

      <div className="field">
        <div className="seg vert" role="group" aria-label="シナリオ">
          {SCENARIOS.map((sc) => (
            <button key={sc.id} className={sc.id === s.scenarioId ? 'on' : ''} onClick={() => s.setScenario(sc.id)}>{sc.name}</button>
          ))}
        </div>
        <p className="desc">{def.description}</p>
      </div>

      <ScenarioDiagram />

      <div className="field">
        <div className="lbl">プリセット</div>
        <div className="chips">
          {def.presets.map((p, i) => (
            <button key={p.label} className="chip" onClick={() => s.applyPreset(i)}>{p.label}</button>
          ))}
        </div>
        {def.id === 'collision' && (
          <div className="chips" style={{ marginTop: 8 }}>
            <button className={`chip ${s.params.dt === 0 ? 'on' : ''}`} onClick={() => s.setParam('dt', 0)}>Δt = 0</button>
            <button className={`chip ${s.params.dt !== 0 ? 'on' : ''}`} onClick={() => s.setParam('dt', s.params.dt !== 0 ? s.params.dt : 3)}>Δt ≠ 0</button>
          </div>
        )}
      </div>

      <div className="field">
        {def.params.map((p) => (
          <label key={p.key} className="param">
            <span>{p.label}</span>
            <span className="pin">
              <input type="number" value={s.params[p.key]} min={p.min} max={p.max} step={p.step}
                onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) s.setParam(p.key, Math.min(p.max, Math.max(p.min, v))); }} />
              <em>{p.unit}</em>
            </span>
            <input type="range" min={p.min} max={p.max} step={p.step} value={s.params[p.key]} onChange={(e) => s.setParam(p.key, Number(e.target.value))} />
          </label>
        ))}
      </div>

      <details className="field teacher">
        <summary>教員向け設定</summary>
        <label className="param">
          <span>先に表示する画面</span>
          <span className="seg">
            <button className={s.firstView === '3d' ? 'on' : ''} onClick={() => s.set({ firstView: '3d', show3d: true, show2d: false })}>3D</button>
            <button className={s.firstView === '2d' ? 'on' : ''} onClick={() => s.set({ firstView: '2d', show3d: false, show2d: true })}>2D</button>
          </span>
        </label>
        <label className="check"><input type="checkbox" checked={s.hints3d} onChange={(e) => s.set({ hints3d: e.target.checked })} />3D画面に距離・方位角の数値を表示</label>
        <label className="param">
          <span>ベクトル段階表示の初期段階</span>
          <select value={s.initialStage} onChange={(e) => s.set({ initialStage: Number(e.target.value), stage: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="param">
          <span>ストロボの間隔 [s]</span>
          <select value={s.strobeDt} onChange={(e) => s.set({ strobeDt: Number(e.target.value) })}>
            {[0.25, 0.5, 1, 2, 5].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <button className="chip" onClick={makeLink}>この設定の共有リンクを作る</button>
        {link && <input className="linkbox" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />}
      </details>
    </aside>
  );
}
