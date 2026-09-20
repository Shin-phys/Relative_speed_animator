import type { Body, ScenarioDef, ScenarioId, ScenarioInstance, ShapeKind, Vec2 } from '../types';

const DEG = Math.PI / 180;

const SHAPES: Record<ShapeKind, { length: number; width: number; height: number; eye: number; radius: number }> = {
  train: { length: 12, width: 3, height: 3.6, eye: 3.0, radius: 4 },
  car: { length: 6, width: 2.4, height: 2.2, eye: 1.9, radius: 3 },
  boat: { length: 8, width: 2.6, height: 1.6, eye: 2.4, radius: 3 },
  raft: { length: 5, width: 4, height: 0.5, eye: 1.6, radius: 2.5 },
};

function body(id: 'A' | 'B', shape: ShapeKind, r0: Vec2, v: Vec2): Body {
  return { id, shape, r0, v, ...SHAPES[shape] };
}

export const speedOf = (v: Vec2): number => Math.hypot(v.x, v.y);

const parallelLike = (id: ScenarioId, name: string, description: string, sign: 1 | -1): ScenarioDef => ({
  id,
  name,
  description,
  params: [
    { key: 'vA', label: 'Aの速さ', unit: 'm/s', min: 0, max: 40, step: 1 },
    { key: 'vB', label: 'Bの速さ', unit: 'm/s', min: 0, max: 40, step: 1 },
    { key: 'gap', label: '横方向の間隔', unit: 'm', min: 6, max: 60, step: 1 },
    { key: 'dx', label: 'Bの初期位置（Aより前方）', unit: 'm', min: -400, max: 400, step: 5 },
    { key: 'T', label: '再生時間', unit: 's', min: 5, max: 60, step: 1 },
  ],
  presets:
    sign === 1
      ? [
          { label: 'Bが前方', values: { vA: 15, vB: 20, gap: 12, dx: 40, T: 20 } },
          { label: '同じ速さ', values: { vA: 15, vB: 15, gap: 12, dx: 40, T: 20 } },
          { label: 'Bが後方から', values: { vA: 15, vB: 25, gap: 12, dx: -80, T: 20 } },
        ]
      : [{ label: '標準', values: { vA: 15, vB: 20, gap: 12, dx: 240, T: 16 } }],
  build(p) {
    const A = body('A', 'train', { x: 0, y: 0 }, { x: p.vA, y: 0 });
    const B = body('B', 'car', { x: p.dx, y: p.gap }, { x: sign * p.vB, y: 0 });
    return { A, B, T: p.T, diagram: { kind: id } };
  },
});

const crossing: ScenarioDef = {
  id: 'crossing',
  name: '交差',
  description: '2つの物体が異なる向きに進み、進路が交わる。',
  params: [
    { key: 'vA', label: 'Aの速さ', unit: 'm/s', min: 0, max: 40, step: 1 },
    { key: 'vB', label: 'Bの速さ', unit: 'm/s', min: 0, max: 40, step: 1 },
    { key: 'theta', label: '交差角 θ（Bの向き）', unit: '°', min: 0, max: 180, step: 5 },
    { key: 'dA', label: 'Aの初期位置（交点から）', unit: 'm', min: 20, max: 400, step: 10 },
    { key: 'dB', label: 'Bの初期位置（交点から）', unit: 'm', min: 20, max: 400, step: 10 },
    { key: 'T', label: '再生時間', unit: 's', min: 5, max: 60, step: 1 },
  ],
  presets: [
    { label: '直交', values: { vA: 15, vB: 15, theta: 90, dA: 150, dB: 100, T: 20 } },
    { label: '60°', values: { vA: 15, vB: 20, theta: 60, dA: 150, dB: 150, T: 20 } },
    { label: '120°', values: { vA: 15, vB: 20, theta: 120, dA: 150, dB: 150, T: 20 } },
  ],
  build(p) {
    const uB = { x: Math.cos(p.theta * DEG), y: Math.sin(p.theta * DEG) };
    const A = body('A', 'train', { x: -p.dA, y: 0 }, { x: p.vA, y: 0 });
    const B = body('B', 'car', { x: -uB.x * p.dB, y: -uB.y * p.dB }, { x: uB.x * p.vB, y: uB.y * p.vB });
    return { A, B, T: p.T, diagram: { kind: 'crossing', crossing: { x: 0, y: 0 } } };
  },
};

const collision: ScenarioDef = {
  id: 'collision',
  name: 'コリジョンコース',
  description: '2つの物体が交点に向かって進む。交点への到達時刻を条件として与える。',
  params: [
    { key: 'vA', label: 'Aの速さ', unit: 'm/s', min: 1, max: 40, step: 1 },
    { key: 'vB', label: 'Bの速さ', unit: 'm/s', min: 1, max: 40, step: 1 },
    { key: 'theta', label: '交差角 θ（Bの向き）', unit: '°', min: 10, max: 170, step: 5 },
    { key: 'tc', label: 'Aが交点に着く時刻', unit: 's', min: 3, max: 30, step: 1 },
    { key: 'dt', label: 'Bの到着の遅れ Δt', unit: 's', min: -10, max: 10, step: 0.5 },
  ],
  presets: [
    { label: 'Δt = 0', values: { vA: 15, vB: 15, theta: 90, tc: 10, dt: 0 } },
    { label: 'Δt = 3 s', values: { vA: 15, vB: 15, theta: 90, tc: 10, dt: 3 } },
    { label: '斜め交差 Δt = 0', values: { vA: 15, vB: 20, theta: 60, tc: 10, dt: 0 } },
  ],
  build(p) {
    const uB = { x: Math.cos(p.theta * DEG), y: Math.sin(p.theta * DEG) };
    const tB = p.tc + p.dt;
    const A = body('A', 'train', { x: -p.vA * p.tc, y: 0 }, { x: p.vA, y: 0 });
    const B = body('B', 'car', { x: -uB.x * p.vB * tB, y: -uB.y * p.vB * tB }, { x: uB.x * p.vB, y: uB.y * p.vB });
    const T = Math.max(p.tc, tB) + 8;
    return { A, B, T, diagram: { kind: 'collision', crossing: { x: 0, y: 0 } } };
  },
};

const flow: ScenarioDef = {
  id: 'flow',
  name: '流れの中の運動',
  description: '一定の速さで流れる川（媒質）の上を、船が媒質に対してある速度で進む。Aは流れとともに漂う筏。',
  params: [
    { key: 'u', label: '流れの速さ v_A', unit: 'm/s', min: 0, max: 15, step: 0.5 },
    { key: 'vrel', label: '船の速さ（媒質に対して）', unit: 'm/s', min: 0, max: 20, step: 0.5 },
    { key: 'theta', label: '船の向き（流れの向きから）', unit: '°', min: 0, max: 180, step: 5 },
    { key: 'W', label: '川幅', unit: 'm', min: 40, max: 200, step: 5 },
    { key: 'T', label: '再生時間', unit: 's', min: 5, max: 60, step: 1 },
  ],
  presets: [
    { label: '同じ向き（θ=0°）', values: { u: 4, vrel: 6, theta: 0, W: 80, T: 20 } },
    { label: '逆向き・船が遅い', values: { u: 4, vrel: 2, theta: 180, W: 80, T: 20 } },
    { label: '逆向き・船が速い', values: { u: 4, vrel: 6, theta: 180, W: 80, T: 20 } },
    { label: '川を横切る（θ=90°）', values: { u: 4, vrel: 6, theta: 90, W: 80, T: 20 } },
    { label: '斜め（θ=60°）', values: { u: 4, vrel: 6, theta: 60, W: 80, T: 20 } },
  ],
  build(p) {
    const th = p.theta * DEG;
    const vRel = { x: p.vrel * Math.cos(th), y: p.vrel * Math.sin(th) };
    const flowV = { x: p.u, y: 0 };
    const oneD = Math.abs(Math.sin(th)) < 0.05;
    const y0 = oneD ? 0 : -p.W / 2 + 6;
    const B = body('B', 'boat', { x: 0, y: y0 }, { x: flowV.x + vRel.x, y: vRel.y });
    const A = body('A', 'raft', { x: 25, y: y0 + 10 }, flowV);
    return { A, B, T: p.T, medium: { flow: flowV, halfWidth: p.W / 2 }, vBRel: vRel, diagram: { kind: 'flow' } };
  },
};

export const SCENARIOS: ScenarioDef[] = [
  parallelLike('parallel', '並走', '2つの物体が同じ向きに直線上を進む。', 1),
  parallelLike('passing', 'すれ違い', '2つの物体が反対向きに進み、隣の線路ですれ違う。', -1),
  crossing,
  collision,
  flow,
];

export function getScenario(id: ScenarioId): ScenarioDef {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

export function defaultParams(def: ScenarioDef): Record<string, number> {
  return { ...def.presets[0].values };
}

export function buildInstance(id: ScenarioId, params: Record<string, number>): ScenarioInstance {
  return getScenario(id).build(params);
}
