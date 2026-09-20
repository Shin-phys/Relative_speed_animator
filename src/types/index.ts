export interface Vec2 {
  x: number;
  y: number;
}
export type BodyId = 'A' | 'B';
export type Observer = 'A' | 'B' | 'ground';
export type ViewDir = 'front' | 'back' | 'left' | 'right';
export type ShapeKind = 'train' | 'car' | 'boat' | 'raft';
export type ConstructionMode = 'chain' | 'tail';

/** 地面系 (x右, y上) での等速直線運動する物体 */
export interface Body {
  id: BodyId;
  r0: Vec2;
  v: Vec2;
  /** 当たり判定半径 [m] */
  radius: number;
  shape: ShapeKind;
  /** 表示寸法 [m] */
  length: number;
  width: number;
  height: number;
  /** 目線の高さ [m] */
  eye: number;
}

/** 川など、媒質が流れている場合の情報（流れは +x 方向） */
export interface Medium {
  flow: Vec2;
  halfWidth: number;
}

export interface ScenarioInstance {
  A: Body;
  B: Body;
  /** 再生区間 [0, T] [s] */
  T: number;
  medium?: Medium;
  /** 流れの中の運動：媒質に対するBの速度 */
  vBRel?: Vec2;
  /** 条件設定の簡易図用 */
  diagram: {
    crossing?: Vec2;
    kind: ScenarioId;
  };
}

export type ScenarioId = 'parallel' | 'passing' | 'crossing' | 'collision' | 'flow';

export interface ParamSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export interface Preset {
  label: string;
  values: Record<string, number>;
}

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  /** 結論を先に示さない、状況の説明のみ */
  description: string;
  params: ParamSpec[];
  presets: Preset[];
  build(values: Record<string, number>): ScenarioInstance;
}
