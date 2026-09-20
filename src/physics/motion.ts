import type { Body, Vec2 } from '../types';

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

type Kin = Pick<Body, 'r0' | 'v'>;

/** 解析解: r(t) = r0 + v t */
export function posAt(b: Kin, t: number): Vec2 {
  return { x: b.r0.x + b.v.x * t, y: b.r0.y + b.v.y * t };
}

/** 相対位置 r_BA(t) */
export function relPos(A: Kin, B: Kin, t: number): Vec2 {
  return sub(posAt(B, t), posAt(A, t));
}

/** 相対速度 v_BA = v_B - v_A */
export function relVel(A: Kin, B: Kin): Vec2 {
  return sub(B.v, A.v);
}

/**
 * 衝突時刻（|r_BA| = R_A+R_B となる最初の時刻）。[0,T] で衝突しなければ null。
 */
export function collisionTime(A: Body, B: Body, T: number): number | null {
  const R = A.radius + B.radius;
  const r = sub(B.r0, A.r0);
  const v = relVel(A, B);
  const c = dot(r, r) - R * R;
  if (c <= 0) return 0;
  const a = dot(v, v);
  if (a < 1e-12) return null;
  const b = 2 * dot(r, v);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t1 = (-b - Math.sqrt(disc)) / (2 * a);
  return t1 >= 0 && t1 <= T ? t1 : null;
}

/** 衝突を考慮した実効時刻（衝突後は両物体とも停止） */
export function effectiveTime(t: number, tc: number | null): number {
  return tc === null ? t : Math.min(t, tc);
}

export interface Closest {
  vBA: Vec2;
  /** |v_BA| = 0 のとき false（t* を定義しない） */
  defined: boolean;
  /** 区間に収める前の t* */
  tStarRaw: number;
  /** [0,T] に収めた t* */
  tStar: number;
  dMin: number;
  /** 衝突時刻（なければ null） */
  tCollision: number | null;
  collides: boolean;
  /** 「最接近へジャンプ」で移動する時刻（衝突する場合は衝突時刻） */
  tJump: number | null;
}

export function closestApproach(A: Body, B: Body, T: number): Closest {
  const vBA = relVel(A, B);
  const rBA0 = sub(B.r0, A.r0);
  const a = dot(vBA, vBA);
  const defined = a > 1e-12;
  const tStarRaw = defined ? -dot(rBA0, vBA) / a : 0;
  const tStar = clamp(tStarRaw, 0, T);
  const tCollision = collisionTime(A, B, T);
  const dMin = len(add(rBA0, scale(vBA, tCollision !== null ? Math.min(tStar, tCollision) : tStar)));
  const collides = tCollision !== null;
  let tJump: number | null = null;
  if (defined) tJump = collides ? Math.min(tStar, tCollision as number) : tStar;
  return { vBA, defined, tStarRaw, tStar, dMin, tCollision, collides, tJump };
}

/** 2物体間距離（衝突後停止を考慮） */
export function distanceAt(A: Body, B: Body, t: number, tc: number | null): number {
  return len(relPos(A, B, effectiveTime(t, tc)));
}

export const normDeg = (d: number): number => {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};

/** 速度方向（静止時は +x） */
export function headingOf(v: Vec2): Vec2 {
  const s = len(v);
  return s < 1e-9 ? { x: 1, y: 0 } : { x: v.x / s, y: v.y / s };
}

/**
 * 観測者から見た相手の方位角 [deg]。観測者の進行方向を 0°、右向きを正とする（-180〜180）。
 */
export function bearingDeg(obsPos: Vec2, heading: Vec2, targetPos: Vec2): number {
  const d = sub(targetPos, obsPos);
  const ccw = Math.atan2(cross(heading, d), dot(heading, d)); // 反時計回り
  return normDeg((-ccw * 180) / Math.PI);
}

/** 視点方向の方位オフセット [deg]（前0・右90・後180・左-90） */
export const VIEW_OFFSET_DEG = { front: 0, right: 90, back: 180, left: -90 } as const;

/** 点 p から線分 ab までの距離 */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return len(sub(p, a));
  const u = clamp(dot(sub(p, a), ab) / l2, 0, 1);
  return len(sub(p, add(a, scale(ab, u))));
}
