import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Flame, 
  Crosshair, 
  Wrench, 
  Volume2, 
  Camera, 
  RotateCcw, 
  Sparkles,
  Eye,
  Navigation,
  Move,
  Fuel,
  BatteryCharging
} from 'lucide-react';
import type { GameEngine, EngineButtonInput } from '../game/gameEngine';
import { GameSettings } from '../types/game';

interface TouchControlsProps {
  engine: GameEngine | null;
  isRiding: boolean;
  settings?: GameSettings;
  onUpdateSettings?: (settings: GameSettings) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ 
  engine, 
  isRiding,
  settings,
  onUpdateSettings 
}) => {
  const [controlMode, setControlMode] = useState<'joystick' | 'dpad'>(settings?.touchControlMode || 'joystick');
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const [lookActive, setLookActive] = useState(false);
  const [lookPos, setLookPos] = useState({ x: 0, y: 0 });
  const lookBaseRef = useRef<HTMLDivElement>(null);
  const lookTouchIdRef = useRef<number | null>(null);

  // Sync settings if changed externally
  useEffect(() => {
    if (settings?.touchControlMode && settings.touchControlMode !== controlMode) {
      setControlMode(settings.touchControlMode);
    }
  }, [settings?.touchControlMode]);

  if (!engine) return null;

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const setInput = (key: EngineButtonInput, val: boolean) => {
    if (engine) {
      engine.input[key] = val;
      if (val) triggerHaptic();
    }
  };

  // Joystick touch handlers
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setJoystickActive(true);
    updateJoystickPos(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystickPos(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        if (engine) {
          engine.input.analogSteer = 0;
          engine.input.analogThrottle = 0;
          engine.input.forward = false;
          engine.input.backward = false;
          engine.input.left = false;
          engine.input.right = false;
        }
        break;
      }
    }
  };

  const updateJoystickPos = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current || !engine) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = rect.width / 2;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const normX = (clampedDist / maxRadius) * Math.cos(angle);
    const normY = (clampedDist / maxRadius) * Math.sin(angle);

    setJoystickPos({
      x: normX * (maxRadius * 0.75),
      y: normY * (maxRadius * 0.75),
    });

    // Pass analog values to engine
    engine.input.analogSteer = normX; // -1 (left) to +1 (right)
    engine.input.analogThrottle = -normY; // +1 (up/forward) to -1 (down/backward)

    // Digital fallback
    engine.input.forward = normY < -0.3;
    engine.input.backward = normY > 0.3;
    engine.input.left = normX < -0.3;
    engine.input.right = normX > 0.3;
  };

  const handleLookStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    setLookActive(true);
    updateLookPos(touch.clientX, touch.clientY);
  };

  const handleLookMove = (e: React.TouchEvent) => {
    if (!lookActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        updateLookPos(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        setLookActive(false);
        setLookPos({ x: 0, y: 0 });
        if (engine) {
          engine.input.analogLookX = 0;
          engine.input.analogLookY = 0;
        }
        break;
      }
    }
  };

  const updateLookPos = (clientX: number, clientY: number) => {
    if (!lookBaseRef.current || !engine) return;
    const rect = lookBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const normX = (clampedDist / maxRadius) * Math.cos(angle);
    const normY = (clampedDist / maxRadius) * Math.sin(angle);
    setLookPos({
      x: normX * (maxRadius * 0.75),
      y: normY * (maxRadius * 0.75),
    });
    engine.input.analogLookX = normX;
    engine.input.analogLookY = -normY;
  };

  const toggleControlMode = () => {
    const nextMode = controlMode === 'joystick' ? 'dpad' : 'joystick';
    setControlMode(nextMode);
    if (settings && onUpdateSettings) {
      onUpdateSettings({ ...settings, touchControlMode: nextMode });
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 pb-4 select-none touch-none">
      
      {/* Top Helper / Mode Switcher Bar */}
      <div className="flex items-center justify-between pointer-events-auto px-2">
        {/* Quick Camera & Reset Controls */}
        <div className="flex items-center gap-2">
          <button
            id="touch-camera-btn"
            onClick={() => {
              triggerHaptic();
              engine.cycleCameraMode();
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-400/40 text-cyan-300 active:scale-95 flex items-center gap-1.5 text-xs font-black shadow-lg cursor-pointer"
            title="Cycle Camera View (Chase, Action, FPV, Tactical)"
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline uppercase">{engine.state.cameraMode} CAM</span>
          </button>

          <button
            id="touch-reset-btn"
            onClick={() => {
              triggerHaptic();
              engine.resetVehicle();
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-orange-400/40 text-orange-300 active:scale-95 flex items-center gap-1.5 text-xs font-black shadow-lg cursor-pointer"
            title="Reset / Right Vehicle Upright"
          >
            <RotateCcw className="w-4 h-4 text-orange-400" />
            <span className="hidden sm:inline">RESET</span>
          </button>
        </div>

        {/* D-Pad / Joystick Toggle */}
        <button
          id="touch-mode-toggle-btn"
          onClick={toggleControlMode}
          className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-cyan-300 hover:text-white flex items-center gap-1.5 text-xs font-black shadow-lg active:scale-95 cursor-pointer"
          title="Toggle between Virtual Joystick and D-Pad"
        >
          {controlMode === 'joystick' ? <Move className="w-4 h-4 text-cyan-400" /> : <Navigation className="w-4 h-4 text-amber-400" />}
          <span>{controlMode === 'joystick' ? 'JOYSTICK' : 'D-PAD'}</span>
        </button>
      </div>

      {/* Main Bottom Controls Layout */}
      <div className="flex items-end justify-between w-full">
        
        {/* LEFT: Movement (Joystick or D-Pad) */}
        <div className="pointer-events-auto flex flex-col items-center">
          {controlMode === 'joystick' ? (
            /* Virtual Analog Joystick */
            <div
              ref={joystickBaseRef}
              id="virtual-joystick-base"
              onTouchStart={handleJoystickStart}
              onTouchMove={handleJoystickMove}
              onTouchEnd={handleJoystickEnd}
              onTouchCancel={handleJoystickEnd}
              className="relative w-36 h-36 rounded-full bg-slate-950/75 backdrop-blur-md border-2 border-cyan-400/50 flex items-center justify-center shadow-2xl shadow-cyan-950/80 touch-none active:border-cyan-300"
            >
              {/* Outer directional guide crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                <div className="w-full h-0.5 bg-cyan-400" />
                <div className="absolute h-full w-0.5 bg-cyan-400" />
              </div>

              {/* Joystick Center Thumb Puck */}
              <div
                id="virtual-joystick-thumb"
                style={{
                  transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                }}
                className={`w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-white shadow-xl flex items-center justify-center transition-transform duration-75 pointer-events-none ${
                  joystickActive ? 'scale-110 shadow-cyan-400/80 ring-4 ring-cyan-400/40' : 'scale-100'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white/40" />
              </div>
            </div>
          ) : (
            /* Classic Responsive D-Pad */
            <div className="grid grid-cols-3 gap-1.5 w-36 h-36">
              <div />
              <button
                id="touch-forward-btn"
                onPointerDown={() => setInput('forward', true)}
                onPointerUp={() => setInput('forward', false)}
                onPointerLeave={() => setInput('forward', false)}
                className="w-11 h-11 rounded-2xl bg-slate-900/90 active:bg-cyan-500 border border-cyan-400/50 text-cyan-300 active:text-slate-950 flex items-center justify-center shadow-lg transition active:scale-95 touch-none"
              >
                <ChevronUp className="w-6 h-6" />
              </button>
              <div />

              <button
                id="touch-left-btn"
                onPointerDown={() => setInput('left', true)}
                onPointerUp={() => setInput('left', false)}
                onPointerLeave={() => setInput('left', false)}
                className="w-11 h-11 rounded-2xl bg-slate-900/90 active:bg-cyan-500 border border-cyan-400/50 text-cyan-300 active:text-slate-950 flex items-center justify-center shadow-lg transition active:scale-95 touch-none"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="w-11 h-11 rounded-2xl bg-slate-950/40 border border-cyan-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-cyan-400/40" />
              </div>
              <button
                id="touch-right-btn"
                onPointerDown={() => setInput('right', true)}
                onPointerUp={() => setInput('right', false)}
                onPointerLeave={() => setInput('right', false)}
                className="w-11 h-11 rounded-2xl bg-slate-900/90 active:bg-cyan-500 border border-cyan-400/50 text-cyan-300 active:text-slate-950 flex items-center justify-center shadow-lg transition active:scale-95 touch-none"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              <div />
              <button
                id="touch-backward-btn"
                onPointerDown={() => setInput('backward', true)}
                onPointerUp={() => setInput('backward', false)}
                onPointerLeave={() => setInput('backward', false)}
                className="w-11 h-11 rounded-2xl bg-slate-900/90 active:bg-cyan-500 border border-cyan-400/50 text-cyan-300 active:text-slate-950 flex items-center justify-center shadow-lg transition active:scale-95 touch-none"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
              <div />
            </div>
          )}
        </div>

        {/* LOOK pad — free orbit, does not steal the move stick */}
        <div className="pointer-events-auto flex flex-col items-center mb-2">
          <div
            ref={lookBaseRef}
            id="look-joystick-base"
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
            onTouchCancel={handleLookEnd}
            className="relative w-28 h-28 rounded-full bg-slate-950/60 backdrop-blur-md border-2 border-violet-400/50 flex items-center justify-center shadow-xl shadow-violet-950/50 touch-none active:border-violet-300"
          >
            <div
              id="look-joystick-thumb"
              style={{ transform: `translate(${lookPos.x}px, ${lookPos.y}px)` }}
              className={`w-11 h-11 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-600 border-2 border-white/80 shadow-lg flex items-center justify-center pointer-events-none ${
                lookActive ? 'scale-110 ring-4 ring-violet-400/40' : 'scale-100'
              }`}
            >
              <Eye className="w-4 h-4 text-white" />
            </div>
          </div>
          <span className="mt-1 text-[9px] font-black tracking-widest text-violet-200/80">LOOK</span>
        </div>

        {/* RIGHT: Action Cluster (Drive, Drift, Horn, Jump, Gadget, Nitro) */}
        <div className="pointer-events-auto flex items-end gap-2.5 sm:gap-3">
          
          {/* Secondary Action Row (Horn, Drift, Mount) */}
          <div className="flex flex-col gap-2">
            {/* Horn / Siren */}
            <button
              id="touch-horn-btn"
              onClick={() => {
                triggerHaptic();
                engine.honkHorn();
              }}
              className="w-11 h-11 rounded-2xl bg-slate-900/90 active:bg-yellow-400 border border-yellow-400/50 text-yellow-300 active:text-slate-950 flex flex-col items-center justify-center shadow-lg transition active:scale-95 touch-none cursor-pointer"
              title="Honk Spy Siren / Horn"
            >
              <Volume2 className="w-4 h-4" />
              <span className="text-[7px] font-black uppercase">HORN</span>
            </button>

            {/* Drift / Powerslide */}
            <button
              id="touch-drift-btn"
              onPointerDown={() => {
                triggerHaptic();
                engine.input.drift = true;
              }}
              onPointerUp={() => (engine.input.drift = false)}
              onPointerLeave={() => (engine.input.drift = false)}
              className="w-11 h-11 rounded-2xl bg-purple-950/90 active:bg-purple-500 border border-purple-400/50 text-purple-300 active:text-white flex flex-col items-center justify-center shadow-lg transition active:scale-95 touch-none cursor-pointer"
              title="Cyber Drift / Powerslide"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-[7px] font-black uppercase">DRIFT</span>
            </button>

            {/* Refuel / Fast-Charge Action */}
            {(engine.state.nearInteraction === 'refuel' || engine.state.isRefueling) ? (
              <button
                id="touch-refuel-btn"
                onClick={() => {
                  triggerHaptic();
                  engine.handleInteractAction();
                }}
                className="w-11 h-11 rounded-2xl bg-emerald-500 active:bg-emerald-400 border border-white text-slate-950 flex flex-col items-center justify-center shadow-lg transition active:scale-95 touch-none cursor-pointer animate-pulse"
                title="Refuel / Recharge V9"
              >
                <BatteryCharging className="w-4 h-4 fill-slate-950" />
                <span className="text-[7px] font-black uppercase">REFUEL</span>
              </button>
            ) : (
              /* Mount / Dismount */
              <button
                id="touch-interact-btn"
                onClick={() => {
                  triggerHaptic();
                  engine.handleInteractAction();
                }}
                className="w-11 h-11 rounded-2xl bg-slate-900/90 active:bg-emerald-400 border border-emerald-400/50 text-emerald-300 active:text-slate-950 flex flex-col items-center justify-center shadow-lg transition active:scale-95 touch-none cursor-pointer"
                title="Mount / Dismount V9"
              >
                <Wrench className="w-4 h-4" />
                <span className="text-[7px] font-black">{isRiding ? 'DISMOUNT' : 'MOUNT'}</span>
              </button>
            )}
          </div>

          {/* Primary Action Buttons (Fire, Jump, Boost) */}
          <div className="flex items-center gap-2">
            {/* Fire Gadget */}
            <button
              id="touch-gadget-btn"
              onClick={() => {
                triggerHaptic();
                engine.fireGadget();
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 active:from-cyan-400 active:to-blue-500 text-white flex flex-col items-center justify-center shadow-xl border border-cyan-300/60 transition active:scale-95 touch-none cursor-pointer"
              title="Fire Gadget"
            >
              <Crosshair className="w-5 h-5" />
              <span className="text-[8px] font-black tracking-wider">FIRE</span>
            </button>

            {/* Jump */}
            <button
              id="touch-jump-btn"
              onPointerDown={() => {
                triggerHaptic();
                engine.input.jump = true;
                engine.handleJumpOrBrake();
              }}
              onPointerUp={() => (engine.input.jump = false)}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-900/90 active:bg-cyan-500 border border-cyan-400/50 text-cyan-300 active:text-slate-950 flex flex-col items-center justify-center shadow-lg transition active:scale-95 touch-none cursor-pointer"
              title="Super Jump"
            >
              <Zap className="w-5 h-5" />
              <span className="text-[8px] font-black">JUMP</span>
            </button>

            {/* Nitro Boost */}
            <button
              id="touch-boost-btn"
              onPointerDown={() => {
                triggerHaptic();
                engine.input.boost = true;
              }}
              onPointerUp={() => (engine.input.boost = false)}
              onPointerLeave={() => (engine.input.boost = false)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 active:from-orange-400 active:to-amber-400 text-slate-950 flex flex-col items-center justify-center shadow-xl border-2 border-amber-300 transition active:scale-95 touch-none cursor-pointer"
              title="Nitro Boost"
            >
              <Flame className="w-6 h-6 text-white animate-pulse" />
              <span className="text-[8px] font-black text-white">BOOST</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
