import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, GameState } from '../game/gameEngine';
import { DisguiseType } from '../types/game';

/**
 * Dev-only debug overlay (spec §33).
 *
 * This whole module is code-split behind `import.meta.env.DEV` in App.tsx, so it — and
 * every `engine.debug*` method it reaches — is absent from production bundles. Toggle with
 * the backtick (`) key.
 */

interface DebugMenuProps {
  engine: GameEngine;
  state: GameState;
  onClose: () => void;
}

const DISGUISES: DisguiseType[] = [
  'agent_suit',
  'delivery_worker',
  'maintenance_tech',
  'lab_scientist',
  'race_crew',
];

const QUALITY_LEVELS: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

const btn =
  'px-2 py-1 rounded-md bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-slate-200 ' +
  'text-[11px] font-bold uppercase tracking-wide transition cursor-pointer disabled:opacity-40 ' +
  'disabled:cursor-not-allowed';

export default function DebugMenu({ engine, state, onClose }: DebugMenuProps) {
  const [fps, setFps] = useState(0);
  const [heapMB, setHeapMB] = useState<number | null>(null);
  const [teleportPoiId, setTeleportPoiId] = useState('');

  // Lightweight FPS + heap sampler — dev-only, so the extra rAF loop is acceptable.
  const frameRef = useRef({ count: 0, last: performance.now(), raf: 0 });
  useEffect(() => {
    const tick = () => {
      const f = frameRef.current;
      f.count++;
      const now = performance.now();
      if (now - f.last >= 500) {
        setFps(Math.round((f.count * 1000) / (now - f.last)));
        f.count = 0;
        f.last = now;
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        if (mem) setHeapMB(Math.round(mem.usedJSHeapSize / 1048576));
      }
      f.raf = requestAnimationFrame(tick);
    };
    frameRef.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current.raf);
  }, []);

  const mission = state.activeMission;
  const pois = state.allCityPOIs ?? [];

  const dbg = engine.debug;
  const doTeleport = () => {
    const poi = pois.find((p) => p.id === teleportPoiId);
    if (poi) dbg?.teleport(poi.position);
  };

  return (
    <div className="fixed top-3 right-3 z-[60] w-64 max-h-[92vh] overflow-y-auto rounded-xl border border-fuchsia-500/50 bg-slate-950/95 backdrop-blur-sm shadow-2xl text-slate-200 select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-fuchsia-950/40">
        <span className="text-xs font-black uppercase tracking-widest text-fuchsia-300">
          Debug Menu · dev
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-sm cursor-pointer px-1">
          ✕
        </button>
      </div>

      <div className="p-3 space-y-3 text-[11px]">
        {/* Perf readout */}
        <div className="flex gap-3 font-mono text-slate-300">
          <span>
            FPS <b className={fps && fps < 30 ? 'text-red-400' : 'text-emerald-400'}>{fps || '–'}</b>
          </span>
          <span>
            HEAP <b className="text-cyan-300">{heapMB != null ? `${heapMB}MB` : 'n/a'}</b>
          </span>
        </div>

        {/* Mission stage */}
        <section className="space-y-1">
          <h3 className="font-bold uppercase text-slate-400">Mission — {mission.title}</h3>
          <div className="grid grid-cols-5 gap-1">
            {mission.steps.map((s, i) => (
              <button
                key={s.id}
                title={s.title}
                onClick={() => dbg?.jumpToMissionStep(i)}
                className={`${btn} ${i === mission.currentStepIndex ? '!bg-cyan-500 !text-slate-950' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="text-slate-500 leading-tight">
            Step {mission.currentStepIndex + 1}/{mission.steps.length}: {mission.steps[mission.currentStepIndex]?.title}
          </p>
        </section>

        {/* Teleport */}
        <section className="space-y-1">
          <h3 className="font-bold uppercase text-slate-400">Teleport</h3>
          <div className="flex gap-1">
            <select
              value={teleportPoiId}
              onChange={(e) => setTeleportPoiId(e.target.value)}
              className="flex-1 min-w-0 rounded-md bg-slate-800 px-1 py-1 text-[11px] text-slate-200"
            >
              <option value="">Select POI…</option>
              {pois.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button onClick={doTeleport} disabled={!teleportPoiId} className={btn}>
              Go
            </button>
          </div>
          <button onClick={() => engine.resetVehicle()} className={`${btn} w-full`}>
            Reset V9
          </button>
        </section>

        {/* Resources */}
        <section className="space-y-1">
          <h3 className="font-bold uppercase text-slate-400">Resources</h3>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => dbg?.refill()} className={btn}>
              Refill fuel/nitro
            </button>
            <button onClick={() => dbg?.clearChaos()} className={btn}>
              Clear CHAOS
            </button>
          </div>
        </section>

        {/* Disguises */}
        <section className="space-y-1">
          <h3 className="font-bold uppercase text-slate-400">Disguise</h3>
          <div className="grid grid-cols-2 gap-1">
            {DISGUISES.map((d) => (
              <button
                key={d}
                onClick={() => dbg?.equipDisguise(d)}
                className={`${btn} ${state.currentDisguise === d ? '!bg-cyan-500 !text-slate-950' : ''}`}
              >
                {d.replace('_', ' ')}
              </button>
            ))}
          </div>
          <button onClick={() => dbg?.unlockAllDisguises()} className={`${btn} w-full`}>
            Unlock all
          </button>
        </section>

        {/* Quality */}
        <section className="space-y-1">
          <h3 className="font-bold uppercase text-slate-400">Render quality</h3>
          <div className="grid grid-cols-3 gap-1">
            {QUALITY_LEVELS.map((q) => (
              <button key={q} onClick={() => dbg?.setRenderQuality(q)} className={btn}>
                {q}
              </button>
            ))}
          </div>
        </section>

        <p className="text-slate-600 text-[10px] pt-1 border-t border-slate-800">
          Toggle with <kbd className="text-slate-400">`</kbd>
        </p>
      </div>
    </div>
  );
}
