import { BODY_CSS } from './bodies';
import { normDeg } from '../physics/motion';

export interface OverlayInfo {
  targetId: 'A' | 'B';
  /** 観測者の進行方向を0°、右を正とした方位角 */
  bearing: number;
  /** 過去の方位（古い順） */
  trail: number[];
  /** 視点方向の方位オフセット */
  viewOffset: number;
  hfov: number;
  target: { x: number; y: number; inFront: boolean };
  hints: boolean;
  dist: number;
}

export function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, o: OverlayInfo): void {
  ctx.clearRect(0, 0, w, h);
  const color = BODY_CSS[o.targetId];
  const x0 = 14, x1 = w - 14, y0 = 8, sh = 28;
  const X = (b: number) => x0 + ((b + 180) / 360) * (x1 - x0);
  ctx.font = '11px -apple-system, "Hiragino Sans", sans-serif';
  ctx.textBaseline = 'middle';

  // 帯
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillRect(x0, y0, x1 - x0, sh);
  // 視野の範囲
  ctx.fillStyle = 'rgba(0,114,178,0.16)';
  const half = o.hfov / 2;
  const lo = o.viewOffset - half, hi = o.viewOffset + half;
  const seg = (a: number, b: number) => ctx.fillRect(X(Math.max(a, -180)), y0, X(Math.min(b, 180)) - X(Math.max(a, -180)), sh);
  if (lo < -180) { seg(-180, hi); seg(lo + 360, 180); }
  else if (hi > 180) { seg(lo, 180); seg(-180, hi - 360); }
  else seg(lo, hi);
  // 目盛り
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let b = -180; b <= 180; b += 30) {
    const major = b % 90 === 0;
    ctx.beginPath();
    ctx.moveTo(X(b), y0 + sh);
    ctx.lineTo(X(b), y0 + sh - (major ? 9 : 5));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  const lab: [number, string, CanvasTextAlign][] = [[-180, '後 180°', 'left'], [-90, '左 −90°', 'center'], [0, '前 0°', 'center'], [90, '右 90°', 'center'], [180, '後 180°', 'right']];
  for (const [b, s, al] of lab) { ctx.textAlign = al; ctx.fillText(s, X(b), y0 + 9); }

  // 軌跡（過去の方位）
  o.trail.forEach((b, i) => {
    ctx.globalAlpha = 0.12 + 0.5 * ((i + 1) / o.trail.length);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(X(b), y0 + sh - 7, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  // 現在の方位
  const cx = X(o.bearing);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, y0 + sh + 9);
  ctx.lineTo(cx - 7, y0 + sh - 2);
  ctx.lineTo(cx + 7, y0 + sh - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText(o.targetId, cx, y0 + sh + 1);

  // 視野の外にいるときは画面端に矢印
  const delta = normDeg(o.bearing - o.viewOffset);
  const onScreen = o.target.inFront && Math.abs(delta) <= half && o.target.x >= 0 && o.target.x <= 1;
  if (!onScreen) {
    const right = delta > 0;
    const ax = right ? w - 26 : 26;
    const ay = h / 2;
    const d = right ? 1 : -1;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax + d * 16, ay);
    ctx.lineTo(ax - d * 8, ay - 18);
    ctx.lineTo(ax - d * 8, ay + 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(o.targetId, ax - d * 3, ay + 1);
  } else {
    // 遠くにいても見つけられるよう、位置の上に小さな目印
    const px = o.target.x * w, py = Math.max(y0 + sh + 24, o.target.y * h - 34);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py + 10);
    ctx.lineTo(px - 6, py);
    ctx.lineTo(px + 6, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (o.hints) {
    const s = `距離 ${o.dist.toFixed(1)} m ／ 方位 ${o.bearing.toFixed(1)}°`;
    ctx.font = '13px -apple-system, "Hiragino Sans", sans-serif';
    ctx.textAlign = 'left';
    const tw = ctx.measureText(s).width + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x0, y0 + sh + 44, tw, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(s, x0 + 8, y0 + sh + 56);
  }
}
