import React from 'react';
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
  Award, 
  CheckCircle2, 
  AlertTriangle,
  Navigation,
  Activity,
  Fuel,
  BatteryCharging,
  BatteryWarning,
  ZapOff,
  BookOpen,
  MapPin,
  MessageSquare,
  X,
  CornerUpRight
} from 'lucide-react';
import { GameState } from '../game/gameEngine';
import { soundEngine } from '../game/audio';
import { MiniMap } from './MiniMap';
import * as THREE from 'three';

interface HUDProps {
  state: GameState;
  playerPos: THREE.Vector3;
  playerRot: number;
  bikePos: THREE.Vector3;
  onOpenCustomizer: () => void;
  onOpenMissions: () => void;
  onOpenParental: () => void;
  onOpenWalkthrough: () => void;
  onOpenMap: () => void;
  onClearGPS: () => void;
  onSelectGadget: (g: GameState['currentGadget']) => void;
  onToggleSilent: () => void;
  onInteract: () => void;
  /** When the on-screen touch controls are shown, their top bar (CAM / RESET) sits
   *  in the top-left — nudge the profile column down so it doesn't clip "AGENT V-09". */
  touchControlsActive?: boolean;
}

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
  touchControlsActive = false,
}) => {
  const currentStep = state.activeMission.steps[state.activeMission.currentStepIndex];
  const targetPos = currentStep?.targetPosition;

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-5 font-sans">
      
      {/* ---------------- TOP BAR ---------------- */}
      <div className="flex items-start justify-between gap-3 w-full">
        {/* Left Column: Agent Profile & Rank + Mission Objectives / Radio */}
        <div className={`pointer-events-auto flex flex-col gap-2.5 max-w-xs sm:max-w-sm ${touchControlsActive ? 'mt-11 sm:mt-12' : ''}`}>
          {/* Agent Profile & Rank */}
          <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-2.5 px-3.5 shadow-xl shadow-cyan-950/40">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/30 border border-cyan-300/40 shrink-0">
              <Shield className="w-5 h-5 text-cyan-100" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">Agent V-09</span>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {state.stats.rank}
                </span>
              </div>
              {/* XP Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (state.stats.xp % 500) / 5)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold mt-0.5">
                <span>XP: {state.stats.xp}</span>
                <span>💎 {state.stats.credits}</span>
              </div>
            </div>
          </div>

          {/* Mission Objective Card (Positioned in upper-left to keep bottom-left clear for touch joystick) */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-3 shadow-xl shadow-cyan-950/40">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <h4 className="text-[11px] font-black text-white uppercase tracking-wider">
                  {state.activeMission.title} ({state.activeMission.currentStepIndex + 1}/5)
                </h4>
              </div>
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                Active Story
              </span>
            </div>

            <p className="text-[11px] text-cyan-200 font-semibold leading-snug">
              {currentStep ? currentStep.instruction : 'All mission objectives completed!'}
            </p>

            {/* Approach Hints (Speed / Stealth / Smarts) */}
            {currentStep && (
              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1 text-[9px]">
                <div className="flex items-center gap-1.5 text-orange-300 font-bold">
                  <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                  <span className="truncate">SPEED: {currentStep.approachHint.speed}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <EyeOff className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">STEALTH: {currentStep.approachHint.stealth}</span>
                </div>
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">SMARTS: {currentStep.approachHint.smarts}</span>
                </div>
              </div>
            )}
          </div>

          {/* Radio Transmission */}
          {state.radioMessage && (
            <div className="bg-slate-950/90 border border-blue-500/40 rounded-xl p-2.5 flex items-start gap-2 shadow-lg animate-in fade-in slide-in-from-left duration-200">
              <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-400/50 flex items-center justify-center shrink-0">
                <Radio className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-cyan-400">{state.radioMessage.sender}</span>
                  <button 
                    onClick={() => soundEngine.speak(state.radioMessage!.text, 'kira')}
                    className="text-[9px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-2.5 h-2.5" /> Replay
                  </button>
                </div>
                <p className="text-[10px] text-slate-200 mt-0.5 font-medium leading-tight line-clamp-3">
                  "{state.radioMessage.text}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Center: GPS Navigation Banner & Objective Compass */}
        <div className="flex flex-col items-center gap-2 max-w-lg">
          {/* Active Turn-by-Turn GPS Navigation Banner */}
          {state.activeGPSRoute && (
            <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-md border-2 border-cyan-400/80 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-2xl shadow-cyan-950/80 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shrink-0">
                <CornerUpRight className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                    GPS ROUTE: {state.activeGPSRoute.destinationName}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    ({state.activeGPSRoute.totalDistance}m // ETA ~{state.activeGPSRoute.etaSeconds}s)
                  </span>
                </div>
                <span className="text-xs font-bold text-white leading-tight">
                  {state.activeGPSRoute.nextTurnInstruction}
                </span>
              </div>
              <button
                onClick={onClearGPS}
                className="p-1 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Cancel GPS Route"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Holographic Objective Navigation Compass (if no custom GPS route active) */}
          {!state.activeGPSRoute && targetPos && !state.activeMission.completed && (
            <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-400/50 rounded-2xl px-4 py-1.5 flex items-center gap-2.5 shadow-lg shadow-cyan-950/60">
              <div 
                className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 transition-transform duration-100"
                style={{ transform: `rotate(${state.objectiveAngleDeg}deg)` }}
              >
                <Navigation className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-black text-cyan-400 uppercase">OBJECTIVE</span>
                <span className="text-xs font-mono font-black text-white">{state.objectiveDistance}m</span>
              </div>
            </div>
          )}

          {state.notification && (
            <div className="animate-bounce bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white font-extrabold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-lg border border-cyan-300/50 flex items-center gap-2 text-center">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
              <span>{state.notification}</span>
            </div>
          )}
        </div>

        {/* Right: Radar MiniMap & Navigation Shortcut Controls */}
        <div className={`pointer-events-auto flex items-start gap-3 ${touchControlsActive ? 'mt-11 sm:mt-12' : ''}`}>
          {/* Quick Action Buttons */}
          <div className="flex flex-col gap-1.5">
            <button
              id="hud-map-btn"
              onClick={onOpenMap}
              className="w-9 h-9 rounded-xl bg-slate-900/85 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
              title="City Map & GPS Navigation (Explore Gas Stations & Landmarks)"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              id="hud-walkthrough-btn"
              onClick={onOpenWalkthrough}
              className="w-9 h-9 rounded-xl bg-slate-900/85 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
              title="Game Manual & Walkthrough Guide"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              id="hud-missions-btn"
              onClick={onOpenMissions}
              className="w-9 h-9 rounded-xl bg-slate-900/85 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
              title="Mission Dossier"
            >
              <Compass className="w-4 h-4" />
            </button>
            <button
              id="hud-garage-btn"
              onClick={onOpenCustomizer}
              className="w-9 h-9 rounded-xl bg-slate-900/85 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
              title="V9 Garage & Customization"
            >
              <Wrench className="w-4 h-4" />
            </button>
            <button
              id="hud-settings-btn"
              onClick={onOpenParental}
              className="w-9 h-9 rounded-xl bg-slate-900/85 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer"
              title="Settings & Parental Controls"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* MiniMap */}
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

      {/* ---------------- MIDDLE SECTION: ALERT & PROMPTS ---------------- */}
      <div className="flex flex-col items-center justify-center gap-3">
        {/* CHAOS Alert Meter */}
        {state.chaosAlertProgress > 0 && (
          <div className="bg-slate-900/90 border border-red-500/60 rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg shadow-red-950/60 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-[11px] font-black text-red-400 uppercase tracking-wider flex items-center gap-2">
                CHAOS Suspicion Alert (Lvl {state.chaosAlertLevel})
              </div>
              <div className="w-44 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${state.chaosAlertProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Interactive Refueling Station Card */}
        {(state.nearInteraction === 'refuel' || state.isRefueling) && (
          <div className="pointer-events-auto bg-slate-950/95 border-2 border-emerald-400/80 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-emerald-950/80 flex flex-col items-center gap-2 text-center max-w-xs animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 animate-pulse">
                <BatteryCharging className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  {state.nearestFuelStation?.name || 'Cyber Fuel Station'}
                </h4>
                <span className="text-[10px] font-bold text-emerald-400">
                  {state.isRefueling ? '⚡ Recharging Plasma Energy Cells...' : 'Recharge Pad In Range'}
                </span>
              </div>
            </div>

            {/* Live Refueling Progress Gauge */}
            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-emerald-500/50 p-0.5 mt-1">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-150 animate-pulse"
                style={{ width: `${state.fuelLevel}%` }}
              />
            </div>
            <div className="flex justify-between w-full text-[10px] font-mono font-bold text-emerald-300">
              <span>Energy: {Math.round(state.fuelLevel)}%</span>
              <span>Fast-Charge: 32 kW/s</span>
            </div>

            <button
              onClick={onInteract}
              className="mt-1 w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-xs py-2 px-4 rounded-xl border border-white shadow-lg flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>{state.isRefueling ? '⚡ Fast-Charging (Hold Position)' : 'Tap or Press [E] to Refuel'}</span>
            </button>
          </div>
        )}

        {/* Low Fuel Critical Alert */}
        {state.fuelLevel <= 20 && !state.isRefueling && (
          <div className="bg-slate-900/90 border border-amber-500/60 rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg shadow-amber-950/60 animate-bounce">
            <BatteryWarning className={`w-5 h-5 ${state.fuelLevel <= 0 ? 'text-red-400 animate-spin' : 'text-amber-400'}`} />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2 text-amber-300">
                {state.fuelLevel <= 0 ? '⚠️ EMERGENCY SOLAR CRAWL (0% FUEL)' : '⚠️ V9 ENERGY CELLS LOW (<20%)'}
              </div>
              {state.nearestFuelStation && (
                <div className="text-[10px] text-slate-300 font-semibold mt-0.5">
                  Nearest Station: <span className="text-emerald-400 font-bold">{state.nearestFuelStation.name}</span> ({state.nearestFuelStation.distance}m)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contextual Action Prompt for NPC Interaction */}
        {state.nearInteraction === 'talk' && (
          <div className="pointer-events-auto">
            <button
              onClick={onInteract}
              className="animate-bounce bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-full border-2 border-white shadow-xl flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Press [E] or Tap to Talk</span>
            </button>
          </div>
        )}

        {/* Contextual Action Prompt for Mounting */}
        {!state.isRiding && playerPos.distanceTo(bikePos) < 4.5 && state.nearInteraction !== 'refuel' && state.nearInteraction !== 'talk' && (
          <div className="pointer-events-auto">
            <button
              onClick={onInteract}
              className="animate-bounce bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm px-5 py-2.5 rounded-full border-2 border-white shadow-xl flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Press [E] or Tap to Mount V9</span>
            </button>
          </div>
        )}
      </div>

      {/* ---------------- BOTTOM BAR (Centralized to keep Left & Right clear for Touch Controls) ---------------- */}
      <div className="flex items-end justify-between w-full">
        
        {/* Left Spacer to guarantee zero overlap with left joystick */}
        <div className="hidden md:block w-36 pointer-events-none" />

        {/* Center: Futuristic Speedometer & Gauges + Gadget Quick Bar */}
        <div className="pointer-events-auto flex flex-col items-center gap-2 mx-auto">
          
          {/* Speedometer & Energy Cells Cluster with Integrated Silent Mode Toggle */}
          <div className="flex items-center gap-2">
            {/* Silent Mode / Stealth Toggle */}
            <button
              id="silent-mode-toggle-btn"
              onClick={onToggleSilent}
              className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition shadow-lg cursor-pointer ${
                state.isSilentMode
                  ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                  : 'bg-slate-900/85 backdrop-blur-md border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Toggle Silent Electric Mode (Press C)"
            >
              {state.isSilentMode ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{state.isSilentMode ? 'SILENT' : 'TURBO'}</span>
            </button>

            {/* Speedometer & Energy Cells Cluster */}
            <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-2 px-3.5 sm:px-4 flex items-center gap-3 shadow-xl shadow-cyan-950/50 relative">
              {state.isDrifting && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-500 text-white font-black text-[8px] px-2 py-0.5 rounded-full border border-purple-300 animate-bounce tracking-widest whitespace-nowrap">
                  DRIFTING!
                </span>
              )}

              {state.isRefueling && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-black text-[8px] px-2.5 py-0.5 rounded-full border border-emerald-200 animate-pulse tracking-widest shadow-md whitespace-nowrap">
                  ⚡ FAST CHARGE!
                </span>
              )}

              {state.fuelLevel <= 0 && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-[7px] px-2 py-0.5 rounded-full border border-red-300 animate-pulse tracking-wider shadow-md whitespace-nowrap">
                  SOLAR CRAWL
                </span>
              )}

              {/* Speed readout */}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 tracking-tight">
                  {state.speedMPH}
                </span>
                <span className="text-[9px] font-black text-cyan-500 uppercase">MPH</span>
              </div>

              <div className="h-7 w-px bg-slate-700/60" />

              {/* Gauges Column */}
              <div className="flex flex-col gap-1 w-24 sm:w-28">
                {/* 1. Energy Cells */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[8px] font-extrabold">
                    <span className="flex items-center gap-0.5 text-emerald-400">
                      <Fuel className="w-2.5 h-2.5" />
                      ENG
                    </span>
                    <span className={`font-mono ${
                      state.fuelLevel <= 20 
                        ? 'text-red-400 animate-pulse' 
                        : state.fuelLevel <= 45 
                        ? 'text-amber-400' 
                        : 'text-emerald-300'
                    }`}>
                      {Math.round(state.fuelLevel)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className={`h-full rounded-full transition-all duration-150 ${
                        state.fuelLevel <= 20
                          ? 'bg-gradient-to-r from-red-600 to-amber-500 animate-pulse'
                          : state.fuelLevel <= 45
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                      }`}
                      style={{ width: `${state.fuelLevel}%` }}
                    />
                  </div>
                </div>

                {/* 2. Nitro Gauge */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[8px] font-extrabold text-amber-400">
                    <span className="flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 text-orange-400" />
                      NITRO
                    </span>
                    <span className="font-mono text-amber-300">
                      {Math.round(state.nitroLevel)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all"
                      style={{ width: `${state.nitroLevel}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Gadget Quick Bar */}
          <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 p-1.5 rounded-2xl shadow-xl">
            {[
              { id: 'emp', label: 'EMP Tagger', key: '1', icon: Zap, color: 'text-cyan-400' },
              { id: 'foam', label: 'Foam Blaster', key: '2', icon: Shield, color: 'text-orange-400' },
              { id: 'drone', label: 'Mini Drone', key: '3', icon: Crosshair, color: 'text-purple-400' },
              { id: 'hologram', label: 'Holo Decoy', key: '4', icon: Sparkles, color: 'text-yellow-400' },
              { id: 'remote_v9', label: 'Remote V9', key: '5', icon: Gauge, color: 'text-emerald-400' },
            ].map((gadget) => {
              const isSelected = state.currentGadget === gadget.id;
              const Icon = gadget.icon;
              return (
                <button
                  key={gadget.id}
                  id={`gadget-btn-${gadget.id}`}
                  onClick={() => onSelectGadget(gadget.id as any)}
                  className={`flex flex-col items-center justify-center w-10 h-11 sm:w-11 sm:h-12 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/30 border-cyan-400 shadow-md shadow-cyan-500/30 scale-105'
                      : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700/80 text-slate-400'
                  }`}
                  title={`${gadget.label} (Press ${gadget.key} or [G] to fire)`}
                >
                  <span className="text-[8px] font-black text-slate-400">{gadget.key}</span>
                  <Icon className={`w-3.5 h-3.5 ${gadget.color} mt-0.5`} />
                  <span className="text-[7px] font-bold mt-0.5 text-slate-300 truncate max-w-[38px]">
                    {gadget.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

        </div>

        {/* Right Spacer to guarantee zero overlap with right action cluster */}
        <div className="hidden md:block w-36 pointer-events-none" />

      </div>

    </div>
  );
};
