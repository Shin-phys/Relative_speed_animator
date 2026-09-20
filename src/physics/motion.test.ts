import { describe, expect, it } from 'vitest';
import { bearingDeg, closestApproach, collisionTime, distanceAt, headingOf, posAt, relPos, relVel } from './motion';
import { buildInstance, defaultParams, getScenario } from '../scenarios';

const P = (id: Parameters<typeof getScenario>[0], over: Record<string, number> = {}) =>
  buildInstance(id, { ...defaultParams(getScenario(id)), ...over });

describe('相対運動の受け入れ確認', () => {
  it('A系とB系で相手の動きがちょうど逆向き', () => {
    const { A, B } = P('crossing');
    const vBA = relVel(A, B);
    const vAB = relVel(B, A);
    expect(vAB.x).toBeCloseTo(-vBA.x);
    expect(vAB.y).toBeCloseTo(-vBA.y);
  });

  it('相対位置は時刻に対して線形（相対軌跡が直線）', () => {
    const { A, B } = P('crossing');
    const p0 = relPos(A, B, 0), p1 = relPos(A, B, 7), p2 = relPos(A, B, 14);
    expect(p2.x - p1.x).toBeCloseTo(p1.x - p0.x);
    expect(p2.y - p1.y).toBeCloseTo(p1.y - p0.y);
  });

  it('並走・同速で相手が静止して見える', () => {
    const { A, B } = P('parallel', { vA: 15, vB: 15 });
    const r0 = relPos(A, B, 0), r9 = relPos(A, B, 9);
    expect(r9.x).toBeCloseTo(r0.x);
    const c = closestApproach(A, B, 20);
    expect(c.defined).toBe(false);
    expect(c.tJump).toBeNull();
  });

  it('コリジョンコース Δt=0 で方位が一定のまま衝突する', () => {
    const { A, B, T } = P('collision', { dt: 0 });
    const tc = collisionTime(A, B, T);
    expect(tc).not.toBeNull();
    const h = headingOf(A.v);
    const b0 = bearingDeg(A.r0, h, B.r0);
    for (const t of [1, 3, 6, (tc as number) * 0.99]) {
      expect(bearingDeg(posAt(A, t), h, posAt(B, t))).toBeCloseTo(b0, 5);
    }
  });

  it('Δt≠0 で方位が変化し衝突しない', () => {
    const { A, B, T } = P('collision', { dt: 3 });
    expect(collisionTime(A, B, T)).toBeNull();
    const h = headingOf(A.v);
    const b0 = bearingDeg(A.r0, h, B.r0);
    const b5 = bearingDeg(posAt(A, 5), h, posAt(B, 5));
    expect(Math.abs(b5 - b0)).toBeGreaterThan(1);
  });

  it('最接近ジャンプ時刻が距離-時間グラフの谷と一致する', () => {
    for (const id of ['passing', 'crossing', 'collision', 'flow', 'parallel'] as const) {
      const { A, B, T } = P(id);
      const c = closestApproach(A, B, T);
      if (c.tJump === null) continue;
      let best = 0, bd = Infinity;
      const N = 4000;
      for (let i = 0; i <= N; i++) {
        const t = (T * i) / N;
        const d = distanceAt(A, B, t, c.tCollision);
        if (d < bd - 1e-9) { bd = d; best = t; }
      }
      expect(Math.abs(best - c.tJump)).toBeLessThan(T / N * 1.5);
    }
  });

  it('流れの中の運動：θ=60°で地面から見て斜め方向', () => {
    const { B, vBRel } = P('flow', { theta: 60 });
    expect(B.v.x).toBeGreaterThan(0);
    expect(B.v.y).toBeGreaterThan(0);
    expect(B.v.x).toBeCloseTo(4 + (vBRel as { x: number }).x);
  });

  it('流れの中の運動（逆向き）：|v_rel|>|v_A| で向きが反転', () => {
    const fast = P('flow', { theta: 180, vrel: 6, u: 4 });
    expect(fast.B.v.x).toBeLessThan(0);
    const slow = P('flow', { theta: 180, vrel: 2, u: 4 });
    expect(slow.B.v.x).toBeGreaterThan(0);
  });
});
