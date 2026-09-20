import * as THREE from 'three';
import type { Body } from '../types';

export const BODY_COLOR = { A: 0x0072b2, B: 0xd55e00 } as const;
export const BODY_CSS = { A: '#0072b2', B: '#d55e00' } as const;

const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
const box = (w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z);
  return m;
};

function labelSprite(id: 'A' | 'B', top: number): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = BODY_CSS[id];
  g.beginPath();
  if (id === 'A') g.arc(64, 64, 56, 0, Math.PI * 2);
  else g.roundRect(8, 8, 112, 112, 20);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#fff';
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold 84px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(id, 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(6, 6, 1);
  sp.position.set(0, top + 4.5, 0);
  return sp;
}

/** 物体の見た目。ローカル +x が進行方向。 */
export function makeBody(b: Body): THREE.Group {
  const g = new THREE.Group();
  const main = BODY_COLOR[b.id];
  const { length: L, width: W, height: H } = b;
  const body = new THREE.Group();
  g.add(body);
  switch (b.shape) {
    case 'train':
      body.add(box(L, H * 0.8, W, main, 0, H * 0.5, 0));
      body.add(box(L * 0.92, H * 0.22, W + 0.06, 0x1d2b3a, 0, H * 0.66, 0));
      body.add(box(L * 0.98, 0.25, W * 0.9, 0xdddddd, 0, H * 0.92, 0));
      body.add(box(1.4, H * 0.6, W * 0.92, 0xf0e442, L / 2 + 0.3, H * 0.42, 0));
      break;
    case 'car':
      body.add(box(L, H * 0.42, W, main, 0, H * 0.4, 0));
      body.add(box(L * 0.5, H * 0.4, W * 0.9, 0xeeeeee, -L * 0.08, H * 0.8, 0));
      body.add(box(0.6, 0.5, W * 0.7, 0xf0e442, L / 2 + 0.1, H * 0.4, 0));
      break;
    case 'boat': {
      body.add(box(L * 0.75, H * 0.5, W, main, -L * 0.125, H * 0.25, 0));
      const geo = new THREE.ConeGeometry((W / 2) * Math.SQRT2, L * 0.25, 4);
      geo.rotateY(Math.PI / 4);
      geo.rotateZ(-Math.PI / 2);
      const bow = new THREE.Mesh(geo, mat(main));
      bow.position.set(L * 0.25 + L * 0.125 + 0.0, H * 0.25, 0);
      bow.scale.y = (H * 0.5) / W;
      body.add(bow);
      body.add(box(L * 0.25, H * 0.6, W * 0.6, 0xeeeeee, -L * 0.2, H * 0.8, 0));
      break;
    }
    case 'raft': {
      body.add(box(L, H, W, 0xb08a55, 0, H / 2, 0));
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), mat(0x444444));
      mast.position.set(0, H + 1.3, 0);
      body.add(mast);
      body.add(box(0.05, 0.7, 1.1, main, 0, H + 2.2, 0.55));
      break;
    }
  }
  g.add(labelSprite(b.id, H + (b.shape === 'raft' ? 2.6 : 0)));
  g.userData.mesh = body;
  return g;
}
