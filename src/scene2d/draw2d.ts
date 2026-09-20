import type { AppState } from '../state/store';
import { BODY_CSS } from '../scene3d/bodies';
import { VIEW_OFFSET_DEG, effectiveTime, headingOf, len, posAt, sub, add, scale } from '../physics/motion';
import type { Body, Vec2 } from '../types';

export interface View2 {
  cx: number;
  cy: number;
  ppm: number;
}

export const GREEN = '#009e73';
const HFOV = 65;
const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** 「次へ」で進められる最大の段階 */
export function maxStage(s: Pick<AppState, 'observer' | 'scenarioId'>): number {
  if (s.observer !== 'ground') return 3;
  return s.scenarioId === 'flow' ? 3 : 1;
}

export function frameShift(s: AppState, t: number): Vec2 {
  if (s.observer === 'ground') return { x: 0, y: 0 };
  const b = s.observer === 'A' ? s.inst.A : s.inst.B;
  const te = effectiveTime(t, s.info.tCollision);
  return sub(posAt(b, te), b.r0);
}

/** 現在の基準系での物体の位置 */
export function framePos(s: AppState, b: Body, t: number): Vec2 {
  const te = effectiveTime(t, s.info.tCollision);
  return sub(posAt(b, te), frameShift(s, t));
}

export function fitView(s: AppState, w: number, h: number): View2 {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const N = 24;
  const grow = (p: Vec2, r = 0) => {
    x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r);
    y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r);
  };
  for (let i = 0; i <= N; i++) {
    const t = (s.inst.T * i) / N;
    grow(framePos(s, s.inst.A, t), s.inst.A.radius);
    grow(framePos(s, s.inst.B, t), s.inst.B.radius);
  }
  if (s.observer === 'ground') grow(s.groundPos, 5);
  if (s.inst.medium) {
    grow({ x: x0, y: -s.inst.medium.halfWidth });
    grow({ x: x1, y: s.inst.medium.halfWidth });
  }
  // 矢印（速度ベクトル）の分だけ余白を取る
  const vm = 0.5 * s.vScale * Math.max(len(s.inst.A.v), len(s.inst.B.v));
  x0 -= vm; x1 += vm; y0 -= vm; y1 += vm;
  const sw = Math.max(x1 - x0, 40), sh = Math.max(y1 - y0, 40);
  // 左上の情報表示・右下の距離グラフを避けて内容を配置する
  const top = 44, bottom = s.showGraph ? Math.min(150, h * 0.4) : 30;
  const ppm = Math.min((w * 0.86) / sw, Math.max(60, h - top - bottom) / sh);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + (top - bottom) / 2 / ppm, ppm };
}

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function arrow(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], color: string, lw: number, dash: number[] = []): void {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 2) return;
  const ux = dx / L, uy = dy / L;
  const hl = Math.min(12, L * 0.5);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0] - ux * hl * 0.7, b[1] - uy * hl * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - ux * hl - uy * hl * 0.45, b[1] - uy * hl + ux * hl * 0.45);
  ctx.lineTo(b[0] - ux * hl + uy * hl * 0.45, b[1] - uy * hl - ux * hl * 0.45);
  ctx.closePath();
  ctx.fill();
}

export function draw2D(ctx: CanvasRenderingContext2D, w: number, h: number, view: View2, s: AppState): void {
  const inst = s.inst;
  const tc = s.info.tCollision;
  const te = effectiveTime(s.t, tc);
  const shift = frameShift(s, s.t);
  const S = (p: Vec2): [number, number] => [w / 2 + (p.x - view.cx) * view.ppm, h / 2 - (p.y - view.cy) * view.ppm];
  const ppm = view.ppm;

  const cBg = css('--c2d-bg', '#f7f8fa');
  const cGrid = css('--c2d-grid', 'rgba(0,0,0,0.07)');
  const cMajor = css('--c2d-major', 'rgba(0,0,0,0.16)');
  const cText = css('--text', '#222');
  const cMuted = css('--muted', '#666');

  ctx.fillStyle = cBg;
  ctx.fillRect(0, 0, w, h);

  // ---- 格子（地面に固定。移動する基準系では流れて見える）----
  let minor = NICE[NICE.length - 1];
  for (const n of NICE) if (n * ppm >= 16) { minor = n; break; }
  const gx0 = view.cx - w / 2 / ppm + shift.x, gx1 = view.cx + w / 2 / ppm + shift.x;
  const gy0 = view.cy - h / 2 / ppm + shift.y, gy1 = view.cy + h / 2 / ppm + shift.y;
  const grid = (step: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(gx0 / step) * step; x <= gx1; x += step) {
      const sx = S({ x: x - shift.x, y: 0 })[0];
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = Math.ceil(gy0 / step) * step; y <= gy1; y += step) {
      const sy = S({ x: 0, y: y - shift.y })[1];
      ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();
  };
  grid(minor, cGrid);
  grid(minor * 5, cMajor);

  // ---- 川（媒質）----
  if (inst.medium) {
    const hw = inst.medium.halfWidth;
    const ya = S({ x: 0, y: hw - shift.y })[1], yb = S({ x: 0, y: -hw - shift.y })[1];
    ctx.fillStyle = 'rgba(47,127,168,0.18)';
    ctx.fillRect(0, ya, w, yb - ya);
    ctx.strokeStyle = 'rgba(47,127,168,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ya); ctx.lineTo(w, ya);
    ctx.moveTo(0, yb); ctx.lineTo(w, yb);
    ctx.stroke();
    // 水面の模様は流れとともに動く。岸の目印は地面に固定。
    const fx = inst.medium.flow.x * te;
    ctx.strokeStyle = 'rgba(47,127,168,0.55)';
    ctx.lineWidth = 2;
    const sp = 30;
    for (let row = 0, y = -hw + 10; y < hw; y += 20, row++) {
      const off = (row % 2) * (sp / 2);
      const start = Math.floor((gx0 - fx - off) / sp) * sp;
      for (let x = start; x < gx1; x += sp) {
        const [sx, sy] = S({ x: x + off + fx - shift.x, y: y - shift.y });
        ctx.beginPath();
        ctx.moveTo(sx - 6 * (ppm > 0.6 ? 1 : 0.5), sy);
        ctx.lineTo(sx + 6 * (ppm > 0.6 ? 1 : 0.5), sy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(70,110,60,0.9)';
    for (const sgn of [-1, 1]) {
      for (let x = Math.floor(gx0 / 30) * 30; x < gx1; x += 30) {
        const [sx, sy] = S({ x: x - shift.x, y: sgn * (hw + 3) - shift.y });
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      }
    }
  }

  // ---- ストロボ ----
  if (s.showStrobe) {
    for (let tk = 0; tk <= s.t + 1e-9; tk += s.strobeDt) {
      for (const b of [inst.A, inst.B]) {
        const [sx, sy] = S(framePos(s, b, tk));
        ctx.fillStyle = BODY_CSS[b.id];
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  const O = s.observer === 'A' ? inst.A : s.observer === 'B' ? inst.B : null;
  const P = s.observer === 'A' ? inst.B : s.observer === 'B' ? inst.A : null;
  const tEnd = effectiveTime(inst.T, tc);

  // ---- 相対軌跡（この基準系での軌跡）----
  if (s.showTrack) {
    for (const b of [inst.A, inst.B]) {
      if (O && b.id === O.id) continue;
      const p0 = S(framePos(s, b, 0)), p1 = S(framePos(s, b, tEnd));
      ctx.strokeStyle = BODY_CSS[b.id];
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 6]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }
  }

  // ---- 観測者まわり：当たり判定円・最接近の垂線 ----
  if (O && P) {
    const oPos = S(framePos(s, O, s.t));
    const R = (inst.A.radius + inst.B.radius) * ppm;
    ctx.strokeStyle = s.info.collides ? 'rgba(220,50,30,0.9)' : cMuted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(oPos[0], oPos[1], Math.max(R, 6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (s.showPerp && s.info.tJump !== null) {
      const foot = S(framePos(s, P, s.info.tJump));
      const o0 = S(framePos(s, O, 0));
      ctx.strokeStyle = cText;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(o0[0], o0[1]);
      ctx.lineTo(foot[0], foot[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = cText;
      ctx.beginPath();
      ctx.arc(foot[0], foot[1], 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '12px -apple-system, "Hiragino Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`d_min = ${s.info.dMin.toFixed(1)} m`, (o0[0] + foot[0]) / 2 + 6, (o0[1] + foot[1]) / 2 - 8);
    }
  }

  // ---- 3Dカメラの視野（扇形）----
  if (s.showFov) {
    const obsB = O;
    const pos = obsB ? framePos(s, obsB, s.t) : s.groundPos;
    const hd = headingOf(obsB ? obsB.v : { x: 1, y: 0 });
    const phi = Math.atan2(hd.y, hd.x) + (-VIEW_OFFSET_DEG[s.viewDir] * Math.PI) / 180;
    const [sx, sy] = S(pos);
    const r = 90;
    ctx.fillStyle = 'rgba(0,114,178,0.14)';
    ctx.strokeStyle = 'rgba(0,114,178,0.5)';
    ctx.lineWidth = 1;
    const half = (HFOV / 2) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, r, -phi - half, -phi + half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ---- 地面の観測者 ----
  if (s.observer === 'ground') {
    const [gx, gy] = S(s.groundPos);
    ctx.fillStyle = cText;
    ctx.beginPath();
    ctx.moveTo(gx, gy - 9); ctx.lineTo(gx + 7, gy); ctx.lineTo(gx, gy + 9); ctx.lineTo(gx - 7, gy);
    ctx.closePath();
    ctx.fill();
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('観測者', gx, gy + 11);
  }

  // ---- 物体 ----
  const iconR = 10;
  for (const b of [inst.A, inst.B]) {
    const [sx, sy] = S(framePos(s, b, s.t));
    const col = BODY_CSS[b.id];
    const R = b.radius * ppm;
    if (R > iconR) {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (b.id === 'A') ctx.arc(sx, sy, iconR, 0, Math.PI * 2);
    else ctx.roundRect(sx - iconR, sy - iconR, iconR * 2, iconR * 2, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.id, sx, sy + 1);
    if (O && O.id === b.id) {
      ctx.strokeStyle = cText;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, iconR + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = cText;
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('観測者', sx, sy + iconR + 7);
    }
  }

  // ---- ベクトル（段階表示）----
  const stage = Math.min(s.stage, maxStage(s));
  if (stage >= 1) drawVectors(ctx, s, stage, S);

  // ---- 衝突エフェクト ----
  if (tc !== null && s.t > tc) {
    const age = s.t - tc;
    const a = Math.max(0, 1 - age / 2);
    const mid = scale(add(framePos(s, inst.A, s.t), framePos(s, inst.B, s.t)), 0.5);
    const [mx, my] = S(mid);
    ctx.strokeStyle = `rgba(230,60,30,${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, my, 12 + Math.min(age, 1.5) * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(230,60,30,${Math.min(1, a + 0.3)})`;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('衝突', mx, my - 22);
  }

  // ---- 情報・スケールバー ----
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = cText;
  ctx.font = 'bold 13px -apple-system, "Hiragino Sans", sans-serif';
  const frameName = s.observer === 'ground' ? '地面系' : s.observer === 'A' ? 'A系（Aを基準）' : 'B系（Bを基準）';
  ctx.fillText(`基準：${frameName}`, 10, 10);
  if (s.info.collides && O) {
    ctx.fillStyle = '#d92e14';
    ctx.font = '12px sans-serif';
    ctx.fillText('衝突コース', 10, 30);
  }
  // scale bar
  let bar = NICE[0];
  for (const n of NICE) if (n * ppm <= 110) bar = n;
  ctx.strokeStyle = cText;
  ctx.fillStyle = cText;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, h - 14); ctx.lineTo(10 + bar * ppm, h - 14);
  ctx.moveTo(10, h - 19); ctx.lineTo(10, h - 9);
  ctx.moveTo(10 + bar * ppm, h - 19); ctx.lineTo(10 + bar * ppm, h - 9);
  ctx.stroke();
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${bar} m`, 16 + bar * ppm, h - 8);
}

function label(ctx: CanvasRenderingContext2D, text: string, p: [number, number], color: string): void {
  ctx.font = 'bold 12px -apple-system, "Hiragino Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(p[0] + 4, p[1] - 17, w + 6, 16);
  ctx.fillStyle = color;
  ctx.fillText(text, p[0] + 7, p[1] - 3);
}

function drawVectors(ctx: CanvasRenderingContext2D, s: AppState, stage: number, S: (p: Vec2) => [number, number]): void {
  const inst = s.inst;
  const k = s.vScale;
  const sp = (v: Vec2) => len(v).toFixed(1);
  const A = inst.A, B = inst.B;
  const posA = framePos(s, A, s.t), posB = framePos(s, B, s.t);
  const vec = (v: Vec2) => scale(v, k);
  const draw = (from: Vec2, v: Vec2, color: string, text: string, lw = 3, dash: number[] = []) => {
    const tip = add(from, vec(v));
    arrow(ctx, S(from), S(tip), color, lw, dash);
    label(ctx, `${text} ${sp(v)} m/s`, S(tip), color);
    return tip;
  };
  const cA = BODY_CSS.A, cB = BODY_CSS.B;

  // 流れの中の運動（地面から見る）：v_A と 媒質に対する速度 v_B,rel を合成して v_B を作る
  if (inst.medium && s.observer === 'ground' && inst.vBRel) {
    const vRel = inst.vBRel;
    draw(posA, A.v, cA, 'v_A（流れ）');
    const tip = draw(posB, vRel, cB, 'v_B,rel', 3);
    if (stage >= 2) arrow(ctx, S(tip), S(add(tip, vec(A.v))), cA, 2.5, [6, 4]);
    if (stage >= 3) draw(posB, B.v, GREEN, 'v_B', 4);
    return;
  }

  if (s.observer === 'ground') {
    draw(posA, A.v, cA, 'v_A');
    draw(posB, B.v, cB, 'v_B');
    return;
  }

  const O = s.observer === 'A' ? A : B;
  const Pb = s.observer === 'A' ? B : A;
  const oPos = s.observer === 'A' ? posA : posB;
  const pPos = s.observer === 'A' ? posB : posA;
  const nO = O.id, nP = Pb.id;
  const cO = BODY_CSS[nO], cP = BODY_CSS[nP];
  const vPO = sub(Pb.v, O.v);
  const negO = scale(O.v, -1);

  if (s.construction === 'chain') {
    draw(oPos, O.v, cO, `v_${nO}`);
    const tipP = draw(pPos, Pb.v, cP, `v_${nP}`);
    if (stage >= 2) {
      arrow(ctx, S(tipP), S(add(tipP, vec(negO))), cO, 2.5, [6, 4]);
      label(ctx, `−v_${nO}`, S(add(tipP, vec(negO))), cO);
    }
    if (stage >= 3) draw(pPos, vPO, GREEN, `v_${nP}${nO}`, 4);
  } else {
    // 始点そろえ型：v_O と v_P を同じ点から引く
    const tipO = draw(pPos, O.v, cO, `v_${nO}`);
    const tipP = draw(pPos, Pb.v, cP, `v_${nP}`);
    if (stage >= 2) {
      arrow(ctx, S(pPos), S(add(pPos, vec(negO))), cO, 2.5, [6, 4]);
      label(ctx, `−v_${nO}`, S(add(pPos, vec(negO))), cO);
    }
    if (stage >= 3) {
      arrow(ctx, S(tipO), S(tipP), GREEN, 4);
      label(ctx, `v_${nP}${nO} ${sp(vPO)} m/s`, S(tipP), GREEN);
    }
  }
  // 観測者側の物体からも、そのままでは矢印が見えるよう位置だけ参照
  void oPos;
}
