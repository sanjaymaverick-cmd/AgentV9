import React, { useState, useRef } from 'react';
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
  Sparkles,
  Eye,
  BatteryCharging,
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
}) => {
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const [lookActive, setLookActive] = useState(false);
  const [lookPos, setLookPos] = useState({ x: 0, y: 0 });
  const lookBaseRef = useRef<HTMLDivElement>(null);
  const lookTouchIdRef = useRef<number | null>(null);

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
    engine.input.analogSteer = normX;
    engine.input.analogThrottle = -normY;
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

  const refueling = engine.state.nearInteraction === 'refuel' || engine.state.isRefueling;

  return (
    <div
      id="touch-controls-root"
      className="absolute inset-0 pointer-events-none z-30 flex items-end justify-between px-3 pb-3 sm:px-4 sm:pb-4 select-none touch-none"
    >
      {/* LEFT — move only. Camera / reset / stick-vs-dpad live in the HUD Menu. */}
      <div className="pointer-events-auto" data-hud="move">
        {settings?.touchControlMode === 'dpad' ? (
          <div className="grid grid-cols-3 gap-1.5 w-28 h-28 sm:w-36 sm:h-36">
            <div />
            <button
              id="touch-forward-btn"
              type="button"
              onPointerDown={() => setInput('forward', true)}
              onPointerUp={() => setInput('forward', false)}
              onPointerLeave={() => setInput('forward', false)}
              className="touch-btn w-full h-full"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <div />
            <button
              id="touch-left-btn"
              type="button"
              onPointerDown={() => setInput('left', true)}
              onPointerUp={() => setInput('left', false)}
              onPointerLeave={() => setInput('left', false)}
              className="touch-btn w-full h-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="touch-btn opacity-40 pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-hud-accent/60" />
            </div>
            <button
              id="touch-right-btn"
              type="button"
              onPointerDown={() => setInput('right', true)}
              onPointerUp={() => setInput('right', false)}
              onPointerLeave={() => setInput('right', false)}
              className="touch-btn w-full h-full"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div />
            <button
              id="touch-backward-btn"
              type="button"
              onPointerDown={() => setInput('backward', true)}
              onPointerUp={() => setInput('backward', false)}
              onPointerLeave={() => setInput('backward', false)}
              className="touch-btn w-full h-full"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <div />
          </div>
        ) : (
          <div
            ref={joystickBaseRef}
            id="virtual-joystick-base"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
            className="touch-stick"
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
              <div className="w-full h-px bg-hud-accent" />
              <div className="absolute h-full w-px bg-hud-accent" />
            </div>
            <div
              id="virtual-joystick-thumb"
              style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
              className={`touch-thumb ${joystickActive ? 'scale-110' : ''}`}
            />
          </div>
        )}
      </div>

      {/* RIGHT — look stacked above actions so the world center stays clear. */}
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        <div className="flex flex-col items-center" data-hud="look">
          <div
            ref={lookBaseRef}
            id="look-joystick-base"
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
            onTouchCancel={handleLookEnd}
            className="touch-stick touch-stick-look"
          >
            <div
              id="look-joystick-thumb"
              style={{ transform: `translate(${lookPos.x}px, ${lookPos.y}px)` }}
              className={`touch-thumb touch-thumb-sm flex items-center justify-center ${lookActive ? 'scale-110' : ''}`}
            >
              <Eye className="w-3.5 h-3.5 text-hud-accent-fg" />
            </div>
          </div>
          <span className="mt-1 text-[10px] font-semibold tracking-widest text-hud-muted">LOOK</span>
        </div>

        <div className="flex flex-col items-end gap-3" data-hud="actions">
          <div className="flex items-center gap-3">
            <button
              id="touch-horn-btn"
              type="button"
              onClick={() => {
                triggerHaptic();
                engine.honkHorn();
              }}
              className="touch-btn"
              title="Horn"
            >
              <Volume2 className="w-4 h-4" />
              Horn
            </button>
            <button
              id="touch-drift-btn"
              type="button"
              onPointerDown={() => {
                triggerHaptic();
                engine.input.drift = true;
              }}
              onPointerUp={() => (engine.input.drift = false)}
              onPointerLeave={() => (engine.input.drift = false)}
              className="touch-btn"
              title="Drift"
            >
              <Sparkles className="w-4 h-4" />
              Drift
            </button>
            {refueling ? (
              <button
                id="touch-refuel-btn"
                type="button"
                onClick={() => {
                  triggerHaptic();
                  engine.handleInteractAction();
                }}
                className="touch-btn text-hud-ok"
                title="Refuel"
              >
                <BatteryCharging className="w-4 h-4" />
                Refuel
              </button>
            ) : (
              <button
                id="touch-interact-btn"
                type="button"
                onClick={() => {
                  triggerHaptic();
                  engine.handleInteractAction();
                }}
                className="touch-btn"
                title={isRiding ? 'Dismount' : 'Mount'}
              >
                <Wrench className="w-4 h-4" />
                {isRiding ? 'Off' : 'Mount'}
              </button>
            )}
          </div>

          <div className="flex items-end gap-3">
            <button
              id="touch-gadget-btn"
              type="button"
              onClick={() => {
                triggerHaptic();
                engine.fireGadget();
              }}
              className="touch-btn touch-btn-lg"
              title="Fire gadget"
            >
              <Crosshair className="w-5 h-5" />
              Fire
            </button>
            <button
              id="touch-jump-btn"
              type="button"
              onPointerDown={() => {
                triggerHaptic();
                engine.input.jump = true;
                engine.handleJumpOrBrake();
              }}
              onPointerUp={() => (engine.input.jump = false)}
              className="touch-btn touch-btn-lg"
              title="Jump"
            >
              <Zap className="w-5 h-5" />
              Jump
            </button>
            <button
              id="touch-boost-btn"
              type="button"
              onPointerDown={() => {
                triggerHaptic();
                engine.input.boost = true;
              }}
              onPointerUp={() => (engine.input.boost = false)}
              onPointerLeave={() => (engine.input.boost = false)}
              className="touch-btn touch-btn-lg touch-btn-warn"
              title="Nitro"
            >
              <Flame className="w-5 h-5" />
              Boost
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
