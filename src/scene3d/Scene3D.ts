import * as THREE from 'three';
import type { ScenarioInstance, Vec2, ViewDir, Observer } from '../types';
import { distToSegment, effectiveTime, headingOf, posAt, add, scale } from '../physics/motion';
import type { Closest } from '../physics/motion';
import { makeBody } from './bodies';

export const HFOV_DEG = 65;
const VIEW_ANGLE: Record<ViewDir, number> = { front: 0, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2 };

export interface Render3D {
  t: number;
  observer: Observer;
  viewDir: ViewDir;
  groundPos: Vec2;
  info: Closest;
}

const hash = (i: number, j: number): number => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function gridTexture(base: string, line: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line;
  g.lineWidth = 6;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function waterTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#2f7fa8';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 4;
  g.lineCap = 'round';
  for (const [x, y] of [[30, 40], [150, 90], [80, 170], [200, 220], [220, 20]]) {
    g.beginPath();
    g.moveTo(x - 22, y);
    g.quadraticCurveTo(x, y - 8, x + 22, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const CELL = 10;
const TREE_S = 60;
const MAX_TREES = 1400;

export class Scene3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.3, 6000);
  private ground: THREE.Mesh;
  private mountains = new THREE.Group();
  private trunks: THREE.InstancedMesh;
  private crowns: THREE.InstancedMesh;
  private scenarioGroup = new THREE.Group();
  private bodies: Partial<Record<'A' | 'B', THREE.Group>> = {};
  private waterTex: THREE.CanvasTexture | null = null;
  private ring: THREE.Mesh;
  private flash: THREE.Mesh;
  private inst!: ScenarioInstance;
  private tmp = new THREE.Object3D();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    // 背景（空のグラデーション）
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 256;
    const g = cv.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5f9bd6');
    grad.addColorStop(0.5, '#d4e6f4');
    grad.addColorStop(1, '#d4e6f4');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    this.scene.background = new THREE.CanvasTexture(cv);
    this.scene.fog = new THREE.Fog(0xd4e6f4, 250, 1600);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b8f5a, 1.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);

    // 地面（格子）— カメラに追従しつつ格子の整数倍で動かし、動かない地面に見せる
    const gt = gridTexture('#7aa565', '#9cc186');
    gt.repeat.set(3000 / CELL, 3000 / CELL);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ map: gt }));
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    // 遠景（山並み）— カメラ位置に追従させ、方位の目印にする
    this.buildMountains();
    this.scene.add(this.mountains);

    // 木（インスタンス）
    this.trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 6, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), MAX_TREES);
    this.crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(3.6, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2f6b3a }), MAX_TREES);
    this.trunks.frustumCulled = false;
    this.crowns.frustumCulled = false;
    this.scene.add(this.trunks, this.crowns);

    this.scene.add(this.scenarioGroup);

    // 衝突エフェクト
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff3b1f, transparent: true, side: THREE.DoubleSide, fog: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, fog: false }));
    this.flash.visible = false;
    this.scene.add(this.ring, this.flash);
  }

  private buildMountains(): void {
    const R = 2300;
    const N = 36;
    for (let i = 0; i < N; i++) {
      const az = (i / N) * Math.PI * 2 + (hash(i, 1) - 0.5) * 0.08;
      const h = 160 + hash(i, 2) * 260;
      const w = 220 + hash(i, 3) * 260;
      const shade = 0.55 + hash(i, 4) * 0.2;
      const c = new THREE.Color().setRGB(0.47 * shade + 0.15, 0.55 * shade + 0.17, 0.68 * shade + 0.14);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), new THREE.MeshBasicMaterial({ color: c, fog: false }));
      cone.position.set(Math.cos(az) * R, h / 2, -Math.sin(az) * R);
      this.mountains.add(cone);
    }
    // 方位の目印：雪をかぶった高い山（+y方向＝地図の上）、双子山（-x方向）
    const peak = (az: number, h: number, w: number, snow: boolean, dr = 0) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 8), new THREE.MeshBasicMaterial({ color: 0x5f7590, fog: false }));
      m.position.set(Math.cos(az) * (R - 150 + dr), h / 2, -Math.sin(az) * (R - 150 + dr));
      this.mountains.add(m);
      if (snow) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, h * 0.32, 8), new THREE.MeshBasicMaterial({ color: 0xf4f7fb, fog: false }));
        cap.position.set(m.position.x, h * 0.84, m.position.z);
        this.mountains.add(cap);
      }
    };
    peak(Math.PI / 2, 620, 300, true);
    peak(Math.PI - 0.1, 430, 200, false);
    peak(Math.PI + 0.1, 380, 180, false);
    peak(-Math.PI / 4, 300, 500, false);
  }

  setScenario(inst: ScenarioInstance): void {
    this.inst = inst;
    // 前のシナリオを破棄
    while (this.scenarioGroup.children.length) {
      const c = this.scenarioGroup.children.pop()!;
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    this.bodies = {};
    this.waterTex = null;

    // 進路（線路・道路）
    if (!inst.medium) {
      for (const b of [inst.A, inst.B]) {
        const sp = Math.hypot(b.v.x, b.v.y);
        if (sp < 1e-9) continue;
        const track = new THREE.Mesh(new THREE.BoxGeometry(3600, 0.06, b.shape === 'train' ? 5 : 6), new THREE.MeshLambertMaterial({ color: b.shape === 'train' ? 0x6a6f76 : 0x4a4d52 }));
        track.position.set(b.r0.x, 0.03, -b.r0.y);
        track.rotation.y = Math.atan2(b.v.y, b.v.x);
        this.scenarioGroup.add(track);
      }
    } else {
      const W = inst.medium.halfWidth * 2;
      const tex = waterTexture();
      const tile = 20;
      tex.repeat.set(6000 / tile, W / tile);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, W), new THREE.MeshLambertMaterial({ map: tex }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.05;
      this.scenarioGroup.add(water);
      this.waterTex = tex;
    }
    for (const b of [inst.A, inst.B]) {
      const g = makeBody(b);
      this.bodies[b.id] = g;
      this.scenarioGroup.add(g);
    }
  }

  resize(w: number, h: number, dpr: number): void {
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = (2 * Math.atan(Math.tan((HFOV_DEG * Math.PI) / 360) / this.camera.aspect) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  }

  private avoid(p: Vec2, obsGround: Vec2 | null): boolean {
    const inst = this.inst;
    if (inst.medium) {
      if (Math.abs(p.y) < inst.medium.halfWidth + 14) return true;
    } else {
      for (const b of [inst.A, inst.B]) {
        const sp = Math.hypot(b.v.x, b.v.y);
        const a = add(b.r0, scale(headingOf(b.v), -2500));
        const c = add(b.r0, scale(headingOf(b.v), 2500));
        if (sp > 1e-9 ? distToSegment(p, a, c) < 14 : Math.hypot(p.x - b.r0.x, p.y - b.r0.y) < 14) return true;
      }
    }
    if (obsGround && Math.hypot(p.x - obsGround.x, p.y - obsGround.y) < 12) return true;
    return false;
  }

  private updateTrees(cam: Vec2, obsGround: Vec2 | null): void {
    let n = 0;
    const put = (x: number, y: number, s: number) => {
      if (n >= MAX_TREES || this.avoid({ x, y }, obsGround)) return;
      this.tmp.position.set(x, 3 * s, -y);
      this.tmp.scale.set(s, s, s);
      this.tmp.updateMatrix();
      this.trunks.setMatrixAt(n, this.tmp.matrix);
      this.tmp.position.set(x, (6 + 5) * s, -y);
      this.tmp.updateMatrix();
      this.crowns.setMatrixAt(n, this.tmp.matrix);
      n++;
    };
    const ci = Math.round(cam.x / TREE_S);
    const cj = Math.round(cam.y / TREE_S);
    for (let i = -14; i <= 14; i++) {
      for (let j = -14; j <= 14; j++) {
        const ii = ci + i, jj = cj + j;
        put(ii * TREE_S + (hash(ii, jj) - 0.5) * 36, jj * TREE_S + (hash(jj, ii + 7) - 0.5) * 36, 0.8 + hash(ii + 3, jj + 5) * 0.7);
      }
    }
    if (this.inst.medium) {
      // 岸沿いの木（流れに対する目印）
      const S = 26;
      const c = Math.round(cam.x / S);
      const yb = this.inst.medium.halfWidth + 9;
      for (let i = -30; i <= 30; i++) {
        const ii = c + i;
        for (const sgn of [-1, 1]) put(ii * S + (hash(ii, sgn) - 0.5) * 8, sgn * (yb + hash(ii, sgn + 9) * 6), 0.9 + hash(ii, 4 + sgn) * 0.4);
      }
    }
    this.trunks.count = n;
    this.crowns.count = n;
    this.trunks.instanceMatrix.needsUpdate = true;
    this.crowns.instanceMatrix.needsUpdate = true;
  }

  render(s: Render3D): { camPos: Vec2; heading: Vec2 } {
    const inst = this.inst;
    const tc = s.info.tCollision;
    const te = effectiveTime(s.t, tc);
    const pA = posAt(inst.A, te);
    const pB = posAt(inst.B, te);

    for (const [id, p, b] of [['A', pA, inst.A], ['B', pB, inst.B]] as const) {
      const g = this.bodies[id];
      if (!g) continue;
      g.position.set(p.x, 0, -p.y);
      const sp = Math.hypot(b.v.x, b.v.y);
      g.rotation.y = sp > 1e-9 ? Math.atan2(b.v.y, b.v.x) : 0;
      g.visible = s.observer !== id;
    }

    let camPos: Vec2, heading: Vec2, eye: number;
    if (s.observer === 'A') { camPos = pA; heading = headingOf(inst.A.v); eye = inst.A.eye; }
    else if (s.observer === 'B') { camPos = pB; heading = headingOf(inst.B.v); eye = inst.B.eye; }
    else { camPos = s.groundPos; heading = { x: 1, y: 0 }; eye = 1.7; }
    const phi = Math.atan2(heading.y, heading.x) + VIEW_ANGLE[s.viewDir];
    this.camera.position.set(camPos.x, eye, -camPos.y);
    this.camera.lookAt(camPos.x + Math.cos(phi), eye, -camPos.y - Math.sin(phi));

    // 地面・遠景の追従
    this.ground.position.set(Math.round(camPos.x / CELL) * CELL, 0, -Math.round(camPos.y / CELL) * CELL);
    this.mountains.position.set(camPos.x, 0, -camPos.y);
    this.updateTrees(camPos, s.observer === 'ground' ? camPos : null);

    // 川面の模様は流れとともに動く
    if (this.waterTex && inst.medium) {
      const tile = 20;
      this.waterTex.offset.x = -(inst.medium.flow.x * te) / tile;
      this.waterTex.offset.y = (inst.medium.flow.y * te) / tile;
    }

    // 衝突エフェクト
    if (tc !== null && s.t > tc) {
      const age = s.t - tc;
      const mid = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
      const r = 3 + Math.min(age, 1.5) * 18;
      const a = Math.max(0, 1 - age / 2.0);
      this.ring.visible = a > 0;
      this.ring.position.set(mid.x, 0.4, -mid.y);
      this.ring.scale.set(r, r, r);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = a;
      this.flash.visible = a > 0;
      this.flash.position.set(mid.x, 2.5, -mid.y);
      const fr = 2 + Math.min(age, 0.6) * 8;
      this.flash.scale.set(fr, fr, fr);
      (this.flash.material as THREE.MeshBasicMaterial).opacity = a * 0.55;
    } else {
      this.ring.visible = false;
      this.flash.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
    return { camPos, heading };
  }

  /** 地面上の点（高さ h）の画面座標（0..1、左上原点）。カメラの前方にあるか */
  project(p: Vec2, h: number): { x: number; y: number; inFront: boolean } {
    const v = new THREE.Vector3(p.x, h, -p.y);
    const inFront = v.clone().sub(this.camera.position).dot(this.camera.getWorldDirection(new THREE.Vector3())) > 0;
    v.project(this.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, inFront };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

