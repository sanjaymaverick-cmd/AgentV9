import React, { useEffect, useState } from 'react';
import {
  Shield,
  Zap,
  Eye,
  EyeOff,
  Radio,
  Gauge,
  Sparkles,
  Crosshair,
  Wrench,
  Flame,
  Volume2,
  Settings,
  Compass,
  AlertTriangle,
  Timer,
  Navigation,
  Fuel,
  BatteryCharging,
  BatteryWarning,
  BookOpen,
  MapPin,
  MessageSquare,
  X,
  CornerUpRight,
  Camera,
  RotateCcw,
  Menu,
  Move,
} from 'lucide-react';
import type { GameState } from '../game/gameEngine';
import { soundEngine } from '../game/audio';
import { CHAOS } from '../game/tunables';
import { MiniMap } from './MiniMap';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface HUDProps {
  state: GameState;
  playerPos: Vec3;
  playerRot: number;
  bikePos: Vec3;
  onOpenCustomizer: () => void;
  onOpenMissions: () => void;
  onOpenParental: () => void;
  onOpenWalkthrough: () => void;
  onOpenMap: () => void;
  onClearGPS: () => void;
  onSelectGadget: (g: GameState['currentGadget']) => void;
  onToggleSilent: () => void;
  onInteract: () => void;
  onCycleCamera?: () => void;
  onResetVehicle?: () => void;
  onToggleTouchMode?: () => void;
  touchControlMode?: 'joystick' | 'dpad';
  touchControlsActive?: boolean;
}

const GADGETS = [
  { id: 'emp', label: 'EMP', key: '1', icon: Zap },
  { id: 'foam', label: 'Foam', key: '2', icon: Shield },
  { id: 'drone', label: 'Drone', key: '3', icon: Crosshair },
  { id: 'hologram', label: 'Holo', key: '4', icon: Sparkles },
  { id: 'remote_v9', label: 'Remote', key: '5', icon: Gauge },
] as const;

export const HUD: React.FC<HUDProps> = ({
  state,
  playerPos,
  playerRot,
  bikePos,
  onOpenCustomizer,
  onOpenMissions,
  onOpenParental,
  onOpenWalkthrough,
  onOpenMap,
  onClearGPS,
  onSelectGadget,
  onToggleSilent,
  onInteract,
  onCycleCamera,
  onResetVehicle,
  onToggleTouchMode,
  touchControlMode = 'joystick',
  touchControlsActive = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const currentStep = state.activeMission.steps[state.activeMission.currentStepIndex];
  const targetPos = currentStep?.targetPosition;
  const nearBike =
    !state.isRiding &&
    Math.hypot(playerPos.x - bikePos.x, playerPos.y - bikePos.y, playerPos.z - bikePos.z) < 4.5 &&
    state.nearInteraction !== 'refuel' &&
    state.nearInteraction !== 'talk';

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('#hud-menu-btn, #hud-menu-panel')) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const run = (fn?: () => void) => {
    fn?.();
    closeMenu();
  };

  const showHudPrompts = !touchControlsActive;

  return (
    <div className="hud-safe absolute inset-0 pointer-events-none select-none font-sans text-hud-fg">
      <div
        className="absolute top-0 left-0 pointer-events-auto flex flex-col gap-3 max-w-[min(20rem,min(40vw,calc(100vw-9.5rem)))]"
      >
        <div data-hud="identity" className="hud-panel flex items-center gap-3 px-3 py-2">
          <div className="w-11 h-11 rounded-[10px] bg-hud-accent/15 border border-hud-line flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-hud-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-hud-accent">Agent V-09</span>
              <span className="text-[10px] font-semibold text-hud-muted border border-hud-line rounded-full px-2 py-0.5">
                {state.stats.rank}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-semibold font-mono tabular-nums text-hud-accent leading-none">
                {state.speedMPH}
              </span>
              <span className="text-[10px] font-semibold uppercase text-hud-muted">mph</span>
              <span className="ml-auto text-[10px] font-medium text-hud-muted tabular-nums">{state.stats.credits} cr</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              <Meter label="Energy" icon={<Fuel className="w-3 h-3" />} value={state.fuelLevel} hot={state.fuelLevel <= 20} />
              <Meter label="Nitro" icon={<Flame className="w-3 h-3" />} value={state.nitroLevel} />
            </div>
          </div>
          <button
            id="silent-mode-toggle-btn"
            type="button"
            onClick={onToggleSilent}
            className={`hud-btn shrink-0 ${state.isSilentMode ? 'text-hud-ok border-hud-ok/40' : ''}`}
            title="Silent mode"
          >
            {state.isSilentMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="button"
          data-hud="brief"
          onClick={() => setBriefOpen((v) => !v)}
          className="hud-panel text-left px-3 py-2.5 w-full"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-hud-accent">
              {state.activeMission.title}
            </span>
            <span className="text-[10px] tabular-nums text-hud-muted">
              {Math.min(state.activeMission.currentStepIndex + 1, state.activeMission.steps.length)}/
              {state.activeMission.steps.length}
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug text-hud-fg line-clamp-2">
            {currentStep ? currentStep.instruction : 'All objectives complete'}
          </p>
          {briefOpen && currentStep && (
            <div className="mt-2 pt-2 border-t border-hud-line flex flex-col gap-1 text-[11px] text-hud-muted">
              <span>Speed — {currentStep.approachHint.speed}</span>
              {currentStep.approachHint.stealth !== 'N/A' && (
                <span>Stealth — {currentStep.approachHint.stealth}</span>
              )}
              <span>Smarts — {currentStep.approachHint.smarts}</span>
            </div>
          )}
        </button>

        {state.radioMessage && (
          <div className="hud-panel px-3 py-2.5 flex items-start gap-2">
            <Radio className="w-4 h-4 text-hud-accent shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-hud-accent">{state.radioMessage.sender}</span>
                <button
                  type="button"
                  onClick={() => soundEngine.speak(state.radioMessage!.text, 'kira')}
                  className="text-[10px] text-hud-muted hover:text-hud-fg inline-flex items-center gap-1 min-h-11"
                >
                  <Volume2 className="w-3 h-3" /> Replay
                </button>
              </div>
              <p className="text-xs text-hud-fg mt-0.5 leading-snug line-clamp-3">{state.radioMessage.text}</p>
            </div>
          </div>
        )}

        <div data-hud="events" className="flex flex-col items-stretch gap-2 w-full">
        {state.activeGPSRoute && (
          <div className="hud-panel px-3 py-2 flex items-center gap-3 w-full">
            <CornerUpRight className="w-5 h-5 text-hud-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-hud-accent truncate">
                {state.activeGPSRoute.destinationName}
                <span className="ml-2 text-hud-muted tabular-nums font-mono normal-case tracking-normal">
                  {state.activeGPSRoute.totalDistance}m
                </span>
              </div>
              <div className="text-xs font-medium truncate">{state.activeGPSRoute.nextTurnInstruction}</div>
            </div>
            <button type="button" onClick={onClearGPS} className="hud-btn w-11 h-11" title="Clear GPS">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {!state.activeGPSRoute && targetPos && !state.activeMission.completed && (
          <div className="hud-panel px-3 py-1.5 flex items-center gap-2">
            <div style={{ transform: `rotate(${state.objectiveAngleDeg}deg)` }}>
              <Navigation className="w-4 h-4 text-hud-accent fill-hud-accent" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-hud-muted">Objective</span>
            <span className="text-sm font-mono tabular-nums">{state.objectiveDistance}m</span>
          </div>
        )}
        {state.notification && (
          <div className="hud-panel px-3 py-2 text-xs font-medium text-center">{state.notification}</div>
        )}
        {(state.chasePhase === 'running' || state.chasePhase === 'recovering') && (
          <EventChip
            icon={<Crosshair className="w-4 h-4" />}
            label={state.chasePhase === 'recovering' ? 'Signal resetting' : 'Stay with the drone'}
            value={`${state.chaseDistance}m`}
            meter={state.chaseFailMeter}
            hot={state.chaseFailMeter > 70}
          />
        )}
        {state.isMiniDroneActive && (
          <EventChip
            icon={
              state.droneBattery <= 22 ? (
                <BatteryWarning className="w-4 h-4 text-hud-danger" />
              ) : (
                <BatteryCharging className="w-4 h-4" />
              )
            }
            label={state.droneReturning ? 'Returning' : 'Recon drone'}
            value={`${Math.round(state.droneBattery)}%`}
            meter={state.droneBattery}
            hot={state.droneBattery <= 22}
          />
        )}
        {state.droneTagActive && (
          <EventChip
            icon={<Crosshair className="w-4 h-4" />}
            label="Rogue drones"
            value={`${state.droneTagTagged}/${state.droneTagTotal}`}
          />
        )}
        {state.racePhase !== 'idle' && (
          <EventChip
            icon={<Timer className="w-4 h-4" />}
            label={
              state.racePhase === 'countdown'
                ? `Get ready ${state.raceCountdownSec}`
                : state.racePhase === 'racing'
                ? `Gate ${state.raceGateIndex + 1}/${state.raceGateTotal}`
                : state.racePhase === 'won'
                ? 'Finished'
                : 'DNF — ride START to retry'
            }
            value={
              state.racePhase === 'countdown'
                ? '0.0s'
                : `${Math.min(state.raceTimeSec, state.raceParSec).toFixed(1)}s`
            }
            hot={state.racePhase === 'racing' && state.raceParSec - state.raceTimeSec < 8}
          />
        )}
        {(state.chaosAlertLevel > 0 || state.chaosAlertProgress > 0) && (
          <EventChip
            icon={<AlertTriangle className="w-4 h-4 text-hud-danger" />}
            label={`CHAOS ${CHAOS.levelNames[state.chaosAlertLevel] ?? 'Alert'}`}
            value={`Lvl ${state.chaosAlertLevel}`}
            meter={state.chaosAlertProgress}
            hot={state.chaosPhase !== 'cooling'}
          />
        )}
        {state.fuelLevel <= 20 && !state.isRefueling && (
          <EventChip
            icon={<BatteryWarning className="w-4 h-4 text-hud-warn" />}
            label={state.fuelLevel <= 0 ? 'Solar crawl — empty' : 'Energy low'}
            value={state.nearestFuelStation ? `${state.nearestFuelStation.name} ${state.nearestFuelStation.distance}m` : `${Math.round(state.fuelLevel)}%`}
            hot
          />
        )}
      </div>
      </div>

      <div className="absolute top-0 right-0 pointer-events-auto flex flex-col items-end gap-2">
        <div className="relative" data-hud="menu">
          <button
            id="hud-menu-btn"
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="hud-btn"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div
              id="hud-menu-panel"
              className="hud-panel absolute right-0 top-12 z-40 w-52 p-2 flex flex-col gap-1"
            >
              <MenuRow id="hud-map-btn" icon={MapPin} label="City map" onClick={() => run(onOpenMap)} />
              <MenuRow id="hud-missions-btn" icon={Compass} label="Missions" onClick={() => run(onOpenMissions)} />
              <MenuRow id="hud-garage-btn" icon={Wrench} label="Garage" onClick={() => run(onOpenCustomizer)} />
              <MenuRow id="hud-walkthrough-btn" icon={BookOpen} label="Guide" onClick={() => run(onOpenWalkthrough)} />
              <MenuRow id="hud-settings-btn" icon={Settings} label="Settings" onClick={() => run(onOpenParental)} />
              {onCycleCamera && (
                <MenuRow id="touch-camera-btn" icon={Camera} label="Cycle camera" onClick={() => run(onCycleCamera)} />
              )}
              {onResetVehicle && (
                <MenuRow id="touch-reset-btn" icon={RotateCcw} label="Reset bike" onClick={() => run(onResetVehicle)} />
              )}
              {onToggleTouchMode && (
                <MenuRow
                  id="touch-mode-toggle-btn"
                  icon={Move}
                  label={touchControlMode === 'joystick' ? 'Use D-pad' : 'Use stick'}
                  onClick={() => run(onToggleTouchMode)}
                />
              )}
            </div>
          )}
        </div>
        <div data-hud="radar">
          <MiniMap
            playerPos={playerPos}
            playerRot={playerRot}
            bikePos={bikePos}
            targetPos={targetPos}
            isRiding={state.isRiding}
            state={state}
          />
        </div>
      </div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-3 ${
          touchControlsActive ? 'bottom-[17rem]' : 'bottom-4'
        }`}
      >
        {showHudPrompts && (state.nearInteraction === 'refuel' || state.isRefueling) && (
          <div className="hud-panel px-4 py-3 w-[min(100%,20rem)] text-center">
            <div className="text-xs font-semibold">{state.nearestFuelStation?.name || 'Fuel station'}</div>
            <div className="mt-2 h-2 rounded-full bg-hud-track overflow-hidden">
              <div className="h-full bg-hud-ok" style={{ width: `${state.fuelLevel}%` }} />
            </div>
            <button type="button" onClick={onInteract} className="hud-btn w-full mt-3 h-11 text-xs font-semibold text-hud-fg">
              {state.isRefueling ? 'Charging — hold still' : 'Refuel'}
            </button>
          </div>
        )}
        {showHudPrompts && state.nearInteraction === 'talk' && (
          <button type="button" onClick={onInteract} className="hud-btn h-12 px-5 gap-2 text-sm font-semibold text-hud-fg">
            <MessageSquare className="w-4 h-4" /> Talk
          </button>
        )}
        {showHudPrompts && nearBike && (
          <button type="button" onClick={onInteract} className="hud-btn h-12 px-5 gap-2 text-sm font-semibold text-hud-fg">
            <Zap className="w-4 h-4" /> Mount V9
          </button>
        )}

        {!touchControlsActive && (
          <div data-hud="speedo" className="hud-panel flex items-center gap-3 px-3 py-2">
            <div className="flex items-baseline gap-1 min-w-[4.5rem]">
              <span className="text-3xl font-semibold font-mono tabular-nums text-hud-accent leading-none">
                {state.speedMPH}
              </span>
              <span className="text-[10px] font-semibold uppercase text-hud-muted">mph</span>
            </div>
            <div className="flex flex-col gap-1.5 w-28">
              <Meter label="Energy" icon={<Fuel className="w-3 h-3" />} value={state.fuelLevel} hot={state.fuelLevel <= 20} />
              <Meter label="Nitro" icon={<Flame className="w-3 h-3" />} value={state.nitroLevel} />
            </div>
          </div>
        )}

        {!touchControlsActive && (
          <div data-hud="gadgets" className="hud-panel flex items-center gap-2 p-2">
            {GADGETS.map((g) => {
              const selected = state.currentGadget === g.id;
              const Icon = g.icon;
              return (
                <button
                  key={g.id}
                  id={`gadget-btn-${g.id}`}
                  type="button"
                  onClick={() => onSelectGadget(g.id)}
                  className={`hud-btn flex-col gap-0.5 w-11 h-11 ${selected ? 'border-hud-accent text-hud-accent' : 'text-hud-muted'}`}
                  title={`${g.label} (${g.key})`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[9px] font-medium hidden sm:block">{g.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {touchControlsActive && (
          <div className="hidden">
            {GADGETS.map((g) => (
              <button
                key={g.id}
                id={`gadget-btn-${g.id}`}
                type="button"
                onClick={() => onSelectGadget(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function Meter({
  label,
  icon,
  value,
  hot,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  hot?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] font-semibold text-hud-muted">
        <span className="inline-flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className={`tabular-nums ${hot ? 'text-hud-danger' : ''}`}>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-hud-track overflow-hidden mt-0.5">
        <div className={`h-full rounded-full ${hot ? 'bg-hud-danger' : 'bg-hud-accent'}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function EventChip({
  icon,
  label,
  value,
  meter,
  hot,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meter?: number;
  hot?: boolean;
}) {
  return (
    <div className={`hud-panel px-3 py-2 flex items-center gap-2 w-full ${hot ? 'border-hud-danger/50' : ''}`}>
      <span className="text-hud-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-hud-muted truncate">{label}</div>
        <div className="text-sm font-mono tabular-nums">{value}</div>
        {meter != null && (
          <div className="mt-1 h-1 rounded-full bg-hud-track overflow-hidden">
            <div className={`h-full ${hot ? 'bg-hud-danger' : 'bg-hud-accent'}`} style={{ width: `${meter}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuRow({
  id,
  icon: Icon,
  label,
  onClick,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 min-h-11 px-2 rounded-[10px] text-sm text-hud-fg hover:bg-white/5 w-full text-left"
    >
      <Icon className="w-4 h-4 text-hud-accent" />
      {label}
    </button>
  );
}
