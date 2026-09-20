import { useRef } from 'react';
import { useCanvasView } from '../hooks/useCanvasView';
import { useStore } from '../state/store';
import { BODY_CSS } from '../scene3d/bodies';
import type { Vec2 } from '../types';

/** 条件設定の簡易図（問題文の図に相当：初期位置と進行方向だけ。合成や相対軌跡は描かない） */
export function ScenarioDiagram() {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useCanvasView(
    (w, h, dpr) => {
      const c = cv.current;
      if (!c) return;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { inst, observer, groundPos } = useStore.getState();
      const cs = getComputedStyle(document.documentElement);
      const text = cs.getPropertyValue('--text').trim() || '#222';
      const muted = cs.getPropertyValue('--muted').trim() || '#777';
      ctx.fillStyle = cs.getPropertyValue('--c2d-bg').trim() || '#f7f8fa';
      ctx.fillRect(0, 0, w, h);

      const pts: Vec2[] = [inst.A.r0, inst.B.r0];
      if (inst.diagram.crossing) pts.push(inst.diagram.crossing);
      if (observer === 'ground') pts.push(groundPos);
      if (inst.medium) pts.push({ x: inst.A.r0.x, y: inst.medium.halfWidth }, { x: inst.A.r0.x, y: -inst.medium.halfWidth });
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      x0 -= 30; x1 += 60; y0 -= 20; y1 += 20;
      const sc = Math.min((w - 30) / (x1 - x0), (h - 24) / (y1 - y0));
      const ox = (w - (x1 - x0) * sc) / 2, oy = (h - (y1 - y0) * sc) / 2;
      const S = (p: Vec2): [number, number] => [ox + (p.x - x0) * sc, h - oy - (p.y - y0) * sc];

      if (inst.medium) {
        const a = S({ x: x0, y: inst.medium.halfWidth })[1], b = S({ x: x0, y: -inst.medium.halfWidth })[1];
        ctx.fillStyle = 'rgba(47,127,168,0.18)';
        ctx.fillRect(0, a, w, b - a);
        ctx.strokeStyle = 'rgba(47,127,168,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, a); ctx.lineTo(w, a); ctx.moveTo(0, b); ctx.lineTo(w, b); ctx.stroke();
        // 流れの向き
        const fy = S({ x: 0, y: inst.medium.halfWidth - 14 })[1];
        arrowPx(ctx, [w - 90, fy], [w - 20, fy], '#2f7fa8');
        ctx.fillStyle = '#2f7fa8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`流れ ${Math.hypot(inst.medium.flow.x, inst.medium.flow.y).toFixed(1)} m/s`, w - 20, fy - 4);
      }

      // 進路（点線）と交点
      if (!inst.medium) {
        ctx.strokeStyle = muted;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        for (const b of [inst.A, inst.B]) {
          const sp = Math.hypot(b.v.x, b.v.y);
          if (sp < 1e-9) continue;
          const d = { x: b.v.x / sp, y: b.v.y / sp };
          const p0 = S(b.r0), p1 = S({ x: b.r0.x + d.x * 2000, y: b.r0.y + d.y * 2000 });
          ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      if (inst.diagram.crossing) {
        const [cx, cy] = S(inst.diagram.crossing);
        ctx.strokeStyle = text;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();
      }

      // 物体と進行方向（長さは一定。速さは数値で示す）
      const dirOf = (v: Vec2) => { const s = Math.hypot(v.x, v.y); return s < 1e-9 ? null : { x: v.x / s, y: -v.y / s }; };
      for (const b of [inst.A, inst.B]) {
        const p = S(b.r0);
        const v = inst.medium && b.id === 'B' && inst.vBRel ? inst.vBRel : inst.medium && b.id === 'A' ? { x: 0, y: 0 } : b.v;
        const d = dirOf(v);
        const col = BODY_CSS[b.id];
        if (d) {
          arrowPx(ctx, p, [p[0] + d.x * 44, p[1] + d.y * 44], col);
          ctx.fillStyle = col;
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const q: [number, number] = [p[0] + d.x * 48 + (d.x >= 0 ? 4 : -60), p[1] + d.y * 48 - 8];
          ctx.fillText(`${Math.hypot(v.x, v.y).toFixed(1)} m/s`, q[0], q[1]);
        }
        ctx.fillStyle = col;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (b.id === 'A') ctx.arc(p[0], p[1], 9, 0, Math.PI * 2); else ctx.roundRect(p[0] - 9, p[1] - 9, 18, 18, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.id, p[0], p[1] + 1);
      }
      if (observer === 'ground') {
        const [gx, gy] = S(groundPos);
        ctx.fillStyle = text;
        ctx.beginPath(); ctx.moveTo(gx, gy - 7); ctx.lineTo(gx + 5, gy); ctx.lineTo(gx, gy + 7); ctx.lineTo(gx - 5, gy); ctx.closePath(); ctx.fill();
      }
    },
  );
  return (
    <div className="diagram" ref={wrap}>
      <canvas ref={cv} />
    </div>
  );
}

function arrowPx(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], color: string): void {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] - ux * 6, b[1] - uy * 6); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - ux * 9 - uy * 4, b[1] - uy * 9 + ux * 4);
  ctx.lineTo(b[0] - ux * 9 + uy * 4, b[1] - uy * 9 - ux * 4);
  ctx.closePath(); ctx.fill();
}
