import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { draw2D, fitView, maxStage, type View2 } from '../scene2d/draw2d';
import { useCanvasView } from '../hooks/useCanvasView';
import { useStore } from '../state/store';
import { DistanceGraph } from './DistanceGraph';

export function View2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View2>({ cx: 0, cy: 0, ppm: 1 });
  const fitRef = useRef(true);
  const sizeRef = useRef({ w: 0, h: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const s = useStore(
    useShallow((x) => ({
      stage: x.stage, observer: x.observer, scenarioId: x.scenarioId, construction: x.construction,
      showTrack: x.showTrack, showPerp: x.showPerp, showFov: x.showFov, showStrobe: x.showStrobe,
      showGraph: x.showGraph, vScale: x.vScale, viewResetToken: x.viewResetToken, set: x.set,
    })),
  );
  const set = s.set;
  const max = maxStage(s);
  const stage = Math.min(s.stage, max);

  // シナリオ・観測者が変わったら全体表示に戻す
  useEffect(() => {
    fitRef.current = true;
    useStore.setState({});
  }, [s.viewResetToken, s.observer]);

  const wrap = useCanvasView(
    (w, h, dpr) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const st = useStore.getState();
      if (fitRef.current) {
        viewRef.current = fitView(st, w, h);
        fitRef.current = false;
      }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw2D(ctx, w, h, viewRef.current, st);
    },
    (w, h, dpr) => {
      const cv = canvasRef.current!;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      if (sizeRef.current.w === 0) fitRef.current = true;
      sizeRef.current = { w, h };
    },
  );

  const zoomAt = (px: number, py: number, k: number) => {
    const { w, h } = sizeRef.current;
    const v = viewRef.current;
    const wx = v.cx + (px - w / 2) / v.ppm;
    const wy = v.cy - (py - h / 2) / v.ppm;
    const ppm = Math.min(60, Math.max(0.05, v.ppm * k));
    viewRef.current = { ppm, cx: wx - (px - w / 2) / ppm, cy: wy + (py - h / 2) / ppm };
    useStore.setState({});
  };

  const rel = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useEffect(() => {
    const cv = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, rel(e));
  };
  const onMove = (e: React.PointerEvent) => {
    const m = pointers.current;
    const prev = m.get(e.pointerId);
    if (!prev) return;
    const cur = rel(e);
    if (m.size === 1) {
      const v = viewRef.current;
      viewRef.current = { ...v, cx: v.cx - (cur.x - prev.x) / v.ppm, cy: v.cy + (cur.y - prev.y) / v.ppm };
    } else if (m.size === 2) {
      const other = [...m.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
      if (d0 > 5) zoomAt((cur.x + other.x) / 2, (cur.y + other.y) / 2, d1 / d0);
    }
    m.set(e.pointerId, cur);
    useStore.setState({});
  };
  const onUp = (e: React.PointerEvent) => pointers.current.delete(e.pointerId);

  return (
    <section className="pane" aria-label="2D俯瞰画面">
      <header className="pane-head">
        <strong>2D 俯瞰図</strong>
        <div className="seg" role="group" aria-label="ベクトルの作図">
          <button onClick={() => set({ stage: Math.max(0, stage - 1) })} disabled={stage <= 0} aria-label="前の段階">‹</button>
          <button className="static" tabIndex={-1}>ベクトル {stage}/{max}</button>
          <button onClick={() => set({ stage: Math.min(max, stage + 1) })} disabled={stage >= max} aria-label="次の段階">次へ ›</button>
        </div>
        <div className="seg" role="group" aria-label="作図方法">
          <button className={s.construction === 'chain' ? 'on' : ''} onClick={() => set({ construction: 'chain' })}>つなぎ型</button>
          <button className={s.construction === 'tail' ? 'on' : ''} onClick={() => set({ construction: 'tail' })}>始点そろえ型</button>
        </div>
        <button className="ghost" onClick={() => set({ show2d: false })} title="この画面を隠す">隠す</button>
      </header>
      <details className="toggles" open={window.innerWidth >= 900}>
        <summary>表示設定</summary>
        <label><input type="checkbox" checked={s.showTrack} onChange={(e) => set({ showTrack: e.target.checked })} />軌跡</label>
        <label><input type="checkbox" checked={s.showPerp} onChange={(e) => set({ showPerp: e.target.checked })} />最接近</label>
        <label><input type="checkbox" checked={s.showFov} onChange={(e) => set({ showFov: e.target.checked })} />視野</label>
        <label><input type="checkbox" checked={s.showStrobe} onChange={(e) => set({ showStrobe: e.target.checked })} />ストロボ</label>
        <label><input type="checkbox" checked={s.showGraph} onChange={(e) => set({ showGraph: e.target.checked })} />距離グラフ</label>
        <label className="range">矢印の長さ
          <input type="range" min={1} max={12} step={0.5} value={s.vScale} onChange={(e) => set({ vScale: Number(e.target.value) })} />
        </label>
        <button className="ghost" onClick={() => { fitRef.current = true; useStore.setState({}); }}>全体表示</button>
      </details>
      <div className="canvas-wrap" ref={wrap}>
        <canvas ref={canvasRef} className="c2d" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {s.showGraph && <DistanceGraph />}
      </div>
    </section>
  );
}
