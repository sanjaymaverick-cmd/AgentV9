import React, { useEffect, useState } from 'react';
import type { PerfSnapshot } from '../game/perfHarness';

/**
 * Tiny production-safe FPS strip for B4 tablet profiling.
 * Hidden unless Parental → Show FPS, `?perf=1`, or localStorage agent_v9_show_perf=1.
 * Mid-left so it never sits on the move stick.
 */
export const PerfChip: React.FC = () => {
  const [snap, setSnap] = useState<PerfSnapshot | null>(null);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const probe = window.__agentV9;
      if (probe?.ready) setSnap(probe.snapshot());
      id = window.setTimeout(tick, 500);
    };
    tick();
    return () => window.clearTimeout(id);
  }, []);

  if (!snap) return null;
  const hot = snap.fps > 0 && snap.fps < 30;
  return (
    <div
      data-hud="perf"
      className="fixed top-[max(8px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[70] pointer-events-none font-mono text-[10px] leading-tight text-hud-fg bg-hud-panel border border-hud-line rounded-[10px] px-2 py-1.5"
    >
      <div>
        FPS <b className={hot ? 'text-hud-danger' : 'text-hud-ok'}>{snap.fps || '–'}</b>
        <span className="text-hud-muted"> min {snap.minFps || '–'}</span>
        <span className="text-hud-muted"> {snap.avgFrameMs}ms</span>
      </div>
      <div className="text-hud-muted">
        {snap.quality.toUpperCase()} pr{snap.pixelRatio.toFixed(2)} {snap.drawingBuffer[0]}×{snap.drawingBuffer[1]}
        {snap.shadows ? ' sh' : ''}
        {snap.antialias ? ' aa' : ''}
      </div>
      <div className="text-hud-muted">
        {snap.calls} dc · {(snap.tris / 1000).toFixed(0)}k tri
        {snap.heapMB != null ? ` · ${snap.heapMB}MB` : ''}
      </div>
    </div>
  );
};
