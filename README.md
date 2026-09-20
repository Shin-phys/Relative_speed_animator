# 相対速度アニメーター

2物体の相対運動を、**3D一人称視点**と**2D俯瞰図**の2画面で観察する高校物理基礎向けWebアプリ。
3Dで「観測者に乗ったときの見え方」を体験し、2Dで速度ベクトルの引き算（v_BA = v_B − v_A）を作図で確かめる。

- 開発仕様書：[docs/SPEC.md](docs/SPEC.md)
- 技術構成：Vite + TypeScript + React + three.js（2DはCanvas 2D）／物理は等速直線運動の解析解

## 開発

```bash
npm install
npm run dev       # 開発サーバ
npm test          # physics/ の受け入れ確認テスト（vitest）
npm run build     # 型チェック + dist/ に静的ファイル一式を出力
```

## 公開（GitHub Pages）

`main` へ push すると `.github/workflows/deploy.yml` がテスト・ビルドして Pages に公開する。
初回のみ、リポジトリの Settings → Pages → Source を **GitHub Actions** にする。

## ディレクトリ構成

```
src/
  physics/     相対運動の計算（UI・描画に依存しない純粋関数）＋テスト
  scenarios/   シナリオのプリセット定義（並走・すれ違い・交差・コリジョンコース・流れの中の運動）
  state/       時刻・観測者・表示設定の共有ストア（zustand）、URLパラメータの読み書き
  scene3d/     three.js のシーン、物体、方位インジケータ（オーバーレイ）
  scene2d/     Canvas 2D 描画（基準系、ベクトル段階表示、相対軌跡、最接近）
  components/  設定パネル、時間制御バー、3D/2D画面、距離グラフ
  hooks/       キャンバスのリサイズ・再描画をストアに接続するフック
  types/       共有の型定義
```

シナリオの追加は `src/scenarios/index.ts` に `ScenarioDef` を足して `SCENARIOS` に登録するだけでよい。

## 共有リンク（URLパラメータ）

「条件設定 → 教員向け設定 → 共有リンクを作る」で、シナリオ・数値・観測者・先に表示する画面などを含むURLを生成できる。
例：`?s=collision&p=vA:15,vB:15,theta:90,tc:10,dt:0&obs=A&first=3d&hint=1&stage=0`
