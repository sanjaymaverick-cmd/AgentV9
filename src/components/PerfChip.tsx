import React, { useEffect, useState } from 'react';
import type { PerfSnapshot } from '../game/perfHarness';

/**
 * Tiny production-safe FPS strip for B4 tablet profiling.
 * Hidden unless Parental → Show FPS, `?perf=1`, or localStorage agent_v9_show_perf=1.
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
    <div className="fixed bottom-1 left-1 z-[70] pointer-events-none font-mono text-[10px] leading-tight text-cyan-100/90 bg-slate-950/75 border border-cyan-500/40 rounded px-1.5 py-1">
      <div>
        FPS <b className={hot ? 'text-red-400' : 'text-emerald-400'}>{snap.fps || '–'}</b>
        <span className="text-slate-400"> min {snap.minFps || '–'}</span>
        <span className="text-slate-400"> {snap.avgFrameMs}ms</span>
      </div>
      <div className="text-slate-400">
        {snap.quality.toUpperCase()} pr{snap.pixelRatio.toFixed(2)} {snap.drawingBuffer[0]}×{snap.drawingBuffer[1]}
        {snap.shadows ? ' sh' : ''}
        {snap.antialias ? ' aa' : ''}
      </div>
      <div className="text-slate-500">
        {snap.calls} dc · {(snap.tris / 1000).toFixed(0)}k tri
        {snap.heapMB != null ? ` · ${snap.heapMB}MB` : ''}
      </div>
    </div>
  );
};
