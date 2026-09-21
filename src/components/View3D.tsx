import { useEffect, useRef } from 'react';
import { Scene3D } from '../scene3d/Scene3D';
import { drawOverlay } from '../scene3d/overlay';
import { useCanvasView } from '../hooks/useCanvasView';
import { useStore } from '../state/store';
import { bearingDeg, distanceAt, effectiveTime, headingOf, posAt, VIEW_OFFSET_DEG } from '../physics/motion';
import type { Observer, ViewDir } from '../types';

const DIRS: { id: ViewDir; label: string }[] = [
  { id: 'front', label: '前方' },
  { id: 'left', label: '左' },
  { id: 'right', label: '右' },
  { id: 'back', label: '後方' },
];
export const OBS_LABEL: Record<Observer, string> = { A: 'Aに乗る', B: 'Bに乗る', ground: '地面に立つ' };

export function View3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const instRef = useRef<unknown>(null);
  const viewDir = useStore((s) => s.viewDir);
  const observer = useStore((s) => s.observer);
  const hfov = useStore((s) => s.hfov);
  const set = useStore((s) => s.set);
  const hide = () => set({ show3d: false });

  useEffect(() => {
    sceneRef.current = new Scene3D(canvasRef.current!);
    instRef.current = null;
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const wrap = useCanvasView(
    (w, h, dpr) => {
      const scene = sceneRef.current;
      const oc = overlayRef.current;
      if (!scene || !oc) return;
      const s = useStore.getState();
      if (instRef.current !== s.inst) {
        scene.setScenario(s.inst);
        instRef.current = s.inst;
      }
      const { camPos, heading } = scene.render({ t: s.t, observer: s.observer, viewDir: s.viewDir, groundPos: s.groundPos, info: s.info, hfov: s.hfov });
      // オーバーレイ（方位インジケータ）
      const targetId = s.observer === 'B' ? 'A' : 'B';
      const inst = s.inst;
      const tc = s.info.tCollision;
      const te = effectiveTime(s.t, tc);
      const tgt = targetId === 'A' ? inst.A : inst.B;
      const tPos = posAt(tgt, te);
      const bearing = bearingDeg(camPos, heading, tPos);
      const trail: number[] = [];
      const n = Math.min(90, Math.floor(s.t / 0.5));
      for (let i = 0; i < n; i++) {
        const tt = effectiveTime(s.t - (n - i) * 0.5, tc);
        const op = s.observer === 'A' ? posAt(inst.A, tt) : s.observer === 'B' ? posAt(inst.B, tt) : s.groundPos;
        trail.push(bearingDeg(op, s.observer === 'A' ? headingOf(inst.A.v) : s.observer === 'B' ? headingOf(inst.B.v) : { x: 1, y: 0 }, posAt(tgt, tt)));
      }
      const ctx = oc.getContext('2d')!;
      ctx.setTransform(Math.min(dpr, 2), 0, 0, Math.min(dpr, 2), 0, 0);
      const dist = s.observer === 'ground' ? Math.hypot(tPos.x - camPos.x, tPos.y - camPos.y) : distanceAt(inst.A, inst.B, s.t, tc);
      const tp = scene.project(tPos, tgt.height * 0.6);
      drawOverlay(ctx, w, h, {
        targetId,
        bearing,
        trail,
        viewOffset: VIEW_OFFSET_DEG[s.viewDir],
        hfov: s.hfov,
        target: tp,
        hints: s.hints3d,
        dist,
      });
    },
    (w, h, dpr) => {
      sceneRef.current?.resize(w, h, dpr);
      const oc = overlayRef.current!;
      oc.width = Math.round(w * Math.min(dpr, 2));
      oc.height = Math.round(h * Math.min(dpr, 2));
      // オーバーレイは論理サイズで描くので、dpr 換算を合わせる
    },
  );

  return (
    <section className="pane" aria-label="3D画面">
      <header className="pane-head">
        <strong>3D 一人称視点</strong>
        <span className="pane-sub">{OBS_LABEL[observer]}</span>
        <div className="seg" role="group" aria-label="視点の向き">
          {DIRS.map((d) => (
            <button key={d.id} className={viewDir === d.id ? 'on' : ''} onClick={() => set({ viewDir: d.id })}>
              {d.label}
            </button>
          ))}
        </div>
        <label className="fov">視野角
          <input type="range" min={40} max={140} step={5} value={hfov} onChange={(e) => set({ hfov: Number(e.target.value) })} aria-label="視野角（水平）" />
          <span>{hfov}°</span>
        </label>
        <button className="ghost" onClick={hide} title="この画面を隠す">隠す</button>
      </header>
      <div className="canvas-wrap" ref={wrap}>
        <canvas ref={canvasRef} className="c3d" />
        <canvas ref={overlayRef} className="c3d overlay" />
      </div>
    </section>
  );
}
