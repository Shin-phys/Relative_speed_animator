import { useRef } from 'react';
import { useCanvasView } from '../hooks/useCanvasView';
import { useStore } from '../state/store';
import { distanceAt } from '../physics/motion';


/** 距離−時間グラフ（2D画面の隅の小窓） */
export function DistanceGraph() {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useCanvasView(
    (w, h, dpr) => {
      const c = cv.current;
      if (!c) return;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = useStore.getState();
      const { inst, info } = s;
      const cs = getComputedStyle(document.documentElement);
      const text = cs.getPropertyValue('--text').trim() || '#222';
      const muted = cs.getPropertyValue('--muted').trim() || '#666';
      ctx.fillStyle = cs.getPropertyValue('--panel').trim() || '#fff';
      ctx.fillRect(0, 0, w, h);
      const L = 36, R = 8, T = 16, B = 22;
      const N = 160;
      const ds: number[] = [];
      let dmax = 1;
      for (let i = 0; i <= N; i++) {
        const d = distanceAt(inst.A, inst.B, (inst.T * i) / N, info.tCollision);
        ds.push(d);
        dmax = Math.max(dmax, d);
      }
      const X = (t: number) => L + (t / inst.T) * (w - L - R);
      const Y = (d: number) => h - B - (d / dmax) * (h - T - B);
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, T - 4); ctx.lineTo(L, h - B); ctx.lineTo(w - R, h - B);
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${dmax.toFixed(0)}`, L - 3, Y(dmax));
      ctx.fillText('0', L - 3, Y(0));
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('距離 [m]', 4, 2);
      ctx.textAlign = 'right';
      ctx.fillText(`時刻 ${inst.T.toFixed(0)} s`, w - R, h - B + 5);
      ctx.strokeStyle = '#0072b2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ds.forEach((d, i) => {
        const x = X((inst.T * i) / N), y = Y(d);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // 現在時刻
      ctx.strokeStyle = text;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(X(s.t), T - 4); ctx.lineTo(X(s.t), h - B);
      ctx.stroke();
      ctx.setLineDash([]);
      const dNow = distanceAt(inst.A, inst.B, s.t, info.tCollision);
      ctx.fillStyle = text;
      ctx.beginPath();
      ctx.arc(X(s.t), Y(dNow), 3.5, 0, Math.PI * 2);
      ctx.fill();
      // 最接近点（谷）
      if (info.tJump !== null) {
        const x = X(info.tJump), y = Y(distanceAt(inst.A, inst.B, info.tJump, info.tCollision));
        ctx.strokeStyle = '#d55e00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  );
  return (
    <div className="graph" ref={wrap}>
      <canvas ref={cv} />
    </div>
  );
}
