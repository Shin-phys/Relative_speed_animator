import { create } from 'zustand';
import { buildInstance, defaultParams, getScenario } from '../scenarios';
import { closestApproach, type Closest } from '../physics/motion';
import type { ConstructionMode, Observer, ScenarioId, ScenarioInstance, ViewDir, Vec2 } from '../types';

export type FirstView = '3d' | '2d';
export const SPEEDS = [0.25, 0.5, 1, 2] as const;

export interface AppState {
  scenarioId: ScenarioId;
  params: Record<string, number>;
  inst: ScenarioInstance;
  info: Closest;

  // 時間
  t: number;
  playing: boolean;
  speed: number;
  frameDt: number;

  // 観測者・3D
  observer: Observer;
  groundPos: Vec2;
  viewDir: ViewDir;

  // 画面の表示
  show3d: boolean;
  show2d: boolean;

  // 教員設定
  firstView: FirstView;
  hints3d: boolean;
  initialStage: number;

  // 2D 表示設定
  stage: number;
  construction: ConstructionMode;
  vScale: number;
  showTrack: boolean;
  showPerp: boolean;
  showFov: boolean;
  showStrobe: boolean;
  showGraph: boolean;
  strobeDt: number;
  viewResetToken: number;

  setScenario(id: ScenarioId): void;
  setParam(key: string, v: number): void;
  applyPreset(i: number): void;
  set(p: Partial<AppState>): void;
  setT(t: number): void;
  step(dir: 1 | -1): void;
  tick(dtReal: number): void;
  reset(): void;
  jumpClosest(): void;
}

function derive(id: ScenarioId, params: Record<string, number>) {
  const inst = buildInstance(id, params);
  return { inst, info: closestApproach(inst.A, inst.B, inst.T) };
}

const initId: ScenarioId = 'parallel';
const initParams = defaultParams(getScenario(initId));

export const useStore = create<AppState>((set, get) => ({
  scenarioId: initId,
  params: initParams,
  ...derive(initId, initParams),

  t: 0,
  playing: false,
  speed: 1,
  frameDt: 0.5,

  observer: 'A',
  groundPos: { x: 0, y: -30 },
  viewDir: 'front',

  show3d: true,
  show2d: false,

  firstView: '3d',
  hints3d: false,
  initialStage: 0,

  stage: 0,
  construction: 'chain',
  vScale: 4,
  showTrack: true,
  showPerp: true,
  showFov: true,
  showStrobe: false,
  showGraph: true,
  strobeDt: 1,
  viewResetToken: 0,

  setScenario(id) {
    const params = defaultParams(getScenario(id));
    set({
      scenarioId: id,
      params,
      ...derive(id, params),
      t: 0,
      playing: false,
      stage: get().initialStage,
      observer: id === 'flow' ? 'ground' : get().observer,
      ...(id === 'flow' ? { groundPos: { x: 20, y: -(params.W / 2 + 15) }, viewDir: 'left' as ViewDir } : {}),
      viewResetToken: get().viewResetToken + 1,
    });
  },
  setParam(key, v) {
    const params = { ...get().params, [key]: v };
    set({ params, ...derive(get().scenarioId, params), t: 0, playing: false, viewResetToken: get().viewResetToken + 1 });
  },
  applyPreset(i) {
    const def = getScenario(get().scenarioId);
    const params = { ...def.presets[i].values };
    set({ params, ...derive(def.id, params), t: 0, playing: false, viewResetToken: get().viewResetToken + 1 });
  },
  set(p) {
    set(p);
  },
  setT(t) {
    set({ t: Math.min(get().inst.T, Math.max(0, t)) });
  },
  step(dir) {
    const { t, frameDt, inst } = get();
    set({ t: Math.min(inst.T, Math.max(0, t + dir * frameDt)), playing: false });
  },
  tick(dtReal) {
    const { t, speed, inst, playing } = get();
    if (!playing) return;
    const nt = t + dtReal * speed;
    if (nt >= inst.T) set({ t: inst.T, playing: false });
    else set({ t: nt });
  },
  reset() {
    set({ t: 0, playing: false });
  },
  jumpClosest() {
    const { info } = get();
    if (info.tJump !== null) set({ t: info.tJump, playing: false });
  },
}));

// ---- URLパラメータ（配布用の共有リンク） ----

export function stateToQuery(s: AppState): string {
  const q = new URLSearchParams();
  q.set('s', s.scenarioId);
  q.set('p', Object.entries(s.params).map(([k, v]) => `${k}:${v}`).join(','));
  q.set('obs', s.observer);
  q.set('dir', s.viewDir);
  q.set('first', s.firstView);
  if (s.hints3d) q.set('hint', '1');
  q.set('stage', String(s.initialStage));
  q.set('mode', s.construction);
  q.set('gx', String(s.groundPos.x));
  q.set('gy', String(s.groundPos.y));
  return q.toString();
}

export function applyQuery(search: string): void {
  const q = new URLSearchParams(search);
  const id = q.get('s') as ScenarioId | null;
  if (!id) return;
  const def = getScenario(id);
  const params = defaultParams(def);
  const p = q.get('p');
  if (p) {
    for (const kv of p.split(',')) {
      const [k, v] = kv.split(':');
      const spec = def.params.find((x) => x.key === k);
      const n = Number(v);
      if (spec && Number.isFinite(n)) params[k] = Math.min(spec.max, Math.max(spec.min, n));
    }
  }
  const first: FirstView = q.get('first') === '2d' ? '2d' : '3d';
  const obs = q.get('obs');
  const dir = q.get('dir');
  const stage = Math.min(3, Math.max(0, Number(q.get('stage') ?? 0) || 0));
  useStore.setState({
    scenarioId: def.id,
    params,
    ...derive(def.id, params),
    observer: obs === 'A' || obs === 'B' || obs === 'ground' ? obs : 'A',
    viewDir: dir === 'back' || dir === 'left' || dir === 'right' ? dir : 'front',
    firstView: first,
    show3d: first === '3d',
    show2d: first === '2d',
    hints3d: q.get('hint') === '1',
    initialStage: stage,
    stage,
    construction: q.get('mode') === 'tail' ? 'tail' : 'chain',
    groundPos: { x: Number(q.get('gx') ?? 0) || 0, y: Number(q.get('gy') ?? -30) || -30 },
    t: 0,
    playing: false,
  });
}
