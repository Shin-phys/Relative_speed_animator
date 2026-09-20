import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';

/**
 * canvas をコンテナに合わせてリサイズし、ストアが変わるたびに1フレームに1回だけ draw を呼ぶ。
 * 3D・2D・グラフは同じストアの t を読むので、時刻が常に一致する。
 */
export function useCanvasView(
  draw: (w: number, h: number, dpr: number) => void,
  setup?: (w: number, h: number, dpr: number) => void,
  deps: unknown[] = [],
) {
  const ref = useRef<HTMLDivElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let w = el.clientWidth, h = el.clientHeight;
    const dpr = () => window.devicePixelRatio || 1;
    const run = () => {
      raf = 0;
      if (w > 0 && h > 0) drawRef.current(w, h, dpr());
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
    const ro = new ResizeObserver(() => {
      w = el.clientWidth;
      h = el.clientHeight;
      if (w > 0 && h > 0) setupRef.current?.(w, h, dpr());
      schedule();
    });
    ro.observe(el);
    if (w > 0 && h > 0) setupRef.current?.(w, h, dpr());
    const unsub = useStore.subscribe(schedule);
    schedule();
    return () => {
      ro.disconnect();
      unsub();
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
