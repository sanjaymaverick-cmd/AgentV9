import React, { useState } from 'react';
import * as THREE from 'three';
import { GameState } from '../game/gameEngine';
import { RadarEntity } from '../types/game';
import { Compass, ZoomIn, ZoomOut, Navigation, Radio, ShieldAlert, Zap, Cpu, Car, MapPin, User, Fuel, Flag } from 'lucide-react';

interface MiniMapProps {
  playerPos: THREE.Vector3;
  playerRot: number;
  bikePos: THREE.Vector3;
  targetPos?: [number, number, number];
  isRiding: boolean;
  state: GameState;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerPos,
  playerRot,
  bikePos,
  targetPos,
  isRiding,
  state,
}) => {
  // Radar display modes: 'heading' (rotates with player) | 'north' (fixed north up)
  const [radarMode, setRadarMode] = useState<'heading' | 'north'>('heading');
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 0 = Tactical (75m), 1 = Standard (140m), 2 = Wide (260m)

  // Zoom ranges in world units (meters)
  const zoomRanges = [75, 140, 260];
  const baseRange = zoomRanges[zoomLevel] || 140;

  // Dynamic speed zoom adaptation: expand radius slightly when speeding for better reaction time
  const speedRatio = Math.min(1, (state.speedMPH || 0) / 75);
  const currentRange = baseRange + speedRatio * 40;

  // Radar dimensions in CSS pixels
  const radarSize = 176; // px diameter
  const radiusPx = radarSize / 2;

  // Active tracked origin (Drone when active, Bike when riding, Player when on foot)
  const activePos = state.isMiniDroneActive
    ? { x: state.radarEntities.find((e) => e.type === 'drone')?.x ?? playerPos.x, z: state.radarEntities.find((e) => e.type === 'drone')?.z ?? playerPos.z }
    : isRiding
    ? { x: bikePos.x, z: bikePos.z }
    : { x: playerPos.x, z: playerPos.z };

  // Active Heading in radians
  const activeHeading = state.isMiniDroneActive
    ? state.droneHeadingRad || 0
    : isRiding
    ? state.bikeHeadingRad || 0
    : state.playerHeadingRad || playerRot || 0;

  // Transform world coordinates into Radar screen position (px from center)
  const getRadarCoords = (worldX: number, worldZ: number) => {
    const relX = worldX - activePos.x;
    const relZ = worldZ - activePos.z;

    let rotX = relX;
    let rotY = relZ;

    if (radarMode === 'heading') {
      const cos = Math.cos(activeHeading);
      const sin = Math.sin(activeHeading);
      rotX = relX * cos - relZ * sin;
      rotY = relX * sin + relZ * cos;
    }

    const dist = Math.hypot(rotX, rotY);
    const scale = radiusPx / currentRange;

    let screenX = radiusPx + rotX * scale;
    let screenY = radiusPx + rotY * scale;

    const isOffRadar = dist > currentRange;

    if (isOffRadar) {
      const angle = Math.atan2(rotY, rotX);
      const edgeRadius = radiusPx - 10;
      screenX = radiusPx + Math.cos(angle) * edgeRadius;
      screenY = radiusPx + Math.sin(angle) * edgeRadius;
    }

    return { screenX, screenY, dist, isOffRadar };
  };

  // Convert GPS waypoints to SVG path
  const renderGPSRouteSVG = () => {
    if (!state.activeGPSRoute || !state.activeGPSRoute.waypoints || state.activeGPSRoute.waypoints.length < 2) {
      return null;
    }

    const points = state.activeGPSRoute.waypoints.map((wp) => {
      const { screenX, screenY } = getRadarCoords(wp[0], wp[2]);
      return `${screenX.toFixed(1)},${screenY.toFixed(1)}`;
    });

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {/* Glow backdrop */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#00f2fe"
          strokeWidth="6"
          strokeOpacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Crisp core line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeDasharray="6,4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-pulse"
        />
      </svg>
    );
  };

  // Render City Road Grid
  const renderRoadGridSVG = () => {
    const roadXCoords = [-85, 0, 85];
    const roadZCoords = [-85, 0, 85];

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        {/* Vertical Avenues */}
        {roadXCoords.map((rx) => {
          const pTop = getRadarCoords(rx, -160);
          const pBot = getRadarCoords(rx, 160);
          return (
            <line
              key={`rx-${rx}`}
              x1={pTop.screenX}
              y1={pTop.screenY}
              x2={pBot.screenX}
              y2={pBot.screenY}
              stroke="#06b6d4"
              strokeWidth="6"
            />
          );
        })}
        {/* Horizontal Streets */}
        {roadZCoords.map((rz) => {
          const pLeft = getRadarCoords(-160, rz);
          const pRight = getRadarCoords(160, rz);
          return (
            <line
              key={`rz-${rz}`}
              x1={pLeft.screenX}
              y1={pLeft.screenY}
              x2={pRight.screenX}
              y2={pRight.screenY}
              stroke="#06b6d4"
              strokeWidth="6"
            />
          );
        })}
      </svg>
    );
  };

  const northAngleDeg = radarMode === 'heading' ? THREE.MathUtils.radToDeg(activeHeading) : 0;

  return (
    <div className="relative flex flex-col items-center select-none group pointer-events-auto">
      {/* ---------------- MAIN CIRCULAR RADAR HUD ---------------- */}
      <div 
        id="v9-tactical-radar"
        className="relative w-[176px] h-[176px] rounded-full border-2 border-cyan-400/80 bg-slate-950/95 backdrop-blur-md overflow-hidden shadow-2xl transition-all"
        style={{
          boxShadow: '0 0 24px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(15, 23, 42, 0.95)',
        }}
      >
        {/* Road Grid Overlay */}
        {renderRoadGridSVG()}

        {/* GPS Dynamic Route Layer */}
        {renderGPSRouteSVG()}

        {/* Radar Concentric Distance Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
          <div className="w-[33%] h-[33%] rounded-full border border-cyan-400/40" />
          <div className="absolute w-[66%] h-[66%] rounded-full border border-cyan-400/30" />
          <div className="absolute w-full h-full rounded-full border border-cyan-400/20" />
        </div>

        {/* Crosshair grid lines */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
          <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent" />
        </div>

        {/* Cyberpunk Dynamic Rotating Radar Sweep */}
        <div 
          className="absolute inset-0 rounded-full animate-spin origin-center pointer-events-none"
          style={{ animationDuration: '3.2s' }}
        >
          <div 
            className="w-1/2 h-1/2 rounded-tl-full"
            style={{
              background: 'conic-gradient(from 180deg at 100% 100%, rgba(6, 182, 212, 0.35) 0deg, transparent 75deg)',
            }}
          />
        </div>

        {/* ---------------- CARDINAL COMPASS BEZEL ---------------- */}
        <div 
          className="absolute inset-0 pointer-events-none transition-transform duration-75"
          style={{
            transform: `rotate(${northAngleDeg}deg)`,
            transformOrigin: 'center center',
          }}
        >
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-black text-cyan-300 drop-shadow-[0_0_4px_#38bdf8]">
            N
          </div>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500">
            S
          </div>
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-500">
            E
          </div>
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-500">
            W
          </div>
        </div>

        {/* ---------------- REAL-TIME ENTITY BLIPS ---------------- */}
        {state.radarEntities.map((entity) => {
          // Skip drawing active player entity on center (drawn separately)
          if (
            (entity.type === 'player' && !isRiding && !state.isMiniDroneActive) ||
            (entity.type === 'bike' && isRiding && !state.isMiniDroneActive) ||
            (entity.type === 'drone' && state.isMiniDroneActive)
          ) {
            return null;
          }

          const { screenX, screenY, dist, isOffRadar } = getRadarCoords(entity.x, entity.z);

          // 1. Mission Objective Target Beacon
          if (entity.type === 'objective') {
            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-25 pointer-events-none"
                style={{ left: screenX, top: screenY }}
              >
                <div className={`relative flex items-center justify-center ${isOffRadar ? 'animate-pulse' : ''}`}>
                  <div className="w-4.5 h-4.5 rounded-full bg-amber-400/30 border border-amber-300 animate-ping absolute" />
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-950 flex items-center justify-center text-[8px] font-black text-black shadow-md shadow-amber-500/50">
                    ★
                  </div>
                  {isOffRadar && (
                    <div className="absolute -top-3.5 whitespace-nowrap text-[7px] font-black bg-slate-900/90 text-amber-300 px-1 rounded border border-amber-500/50">
                      {Math.round(dist)}m
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // 2. NPC Locals & Quest Givers
          if (entity.type === 'npc') {
            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                style={{ left: screenX, top: screenY }}
                title={entity.label}
              >
                <div className="w-3 h-3 rounded-full border border-white flex items-center justify-center text-[7px] font-bold text-white shadow-md"
                  style={{ backgroundColor: entity.style || '#ec4899' }}
                >
                  !
                </div>
              </div>
            );
          }

          // 3. Cyber Fuel Stations
          if (entity.type === 'fuel') {
            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none"
                style={{ left: screenX, top: screenY }}
                title={entity.label}
              >
                <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[7px] font-black text-slate-950 shadow-sm shadow-emerald-500/50">
                  ⚡
                </div>
              </div>
            );
          }

          // 4. Points of Interest (POIs)
          if (entity.type === 'poi') {
            const isGas = entity.category === 'fuel';
            const isStory = entity.category === 'story';
            const isSide = entity.category === 'side';
            const isStunt = entity.category === 'stunt';

            const bgClass = isGas ? 'bg-emerald-500' : isStory ? 'bg-amber-400' : isSide ? 'bg-pink-500' : isStunt ? 'bg-purple-500' : 'bg-sky-400';
            const char = isGas ? '⚡' : isStory ? '★' : isSide ? '🚩' : isStunt ? '⚡' : '📍';

            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-12 pointer-events-none"
                style={{ left: screenX, top: screenY }}
                title={entity.label}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${bgClass} border border-slate-950 flex items-center justify-center text-[6px] text-white`}>
                  {char}
                </div>
              </div>
            );
          }

          // 5. Autonomous Traffic Vehicles (Moving Cyber Cars)
          if (entity.type === 'traffic') {
            const carRot = radarMode === 'heading' ? (entity.rot || 0) - activeHeading : entity.rot || 0;
            const carColor = entity.style === 'patrol' ? 'bg-sky-400' : 'bg-blue-300';

            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                style={{
                  left: screenX,
                  top: screenY,
                  transform: `translate(-50%, -50%) rotate(${carRot}rad)`,
                }}
              >
                <div className={`w-2 h-3.5 rounded-sm ${carColor} border border-slate-900 shadow-sm flex flex-col justify-between items-center`}>
                  <div className="w-1.5 h-0.5 bg-white rounded-t-sm" />
                  <div className="w-1.5 h-0.5 bg-red-500 rounded-b-sm" />
                </div>
              </div>
            );
          }

          // 6. Security Threat Bots & Vision Cones
          if (entity.type === 'bot') {
            const isHighAlert = (entity.alert || 0) > 0.4;
            const botRot = radarMode === 'heading' ? (entity.rot || 0) - activeHeading : entity.rot || 0;

            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none"
                style={{ left: screenX, top: screenY }}
              >
                <div className="relative flex items-center justify-center">
                  {/* FOV Vision cone projection on radar */}
                  <div
                    className="absolute w-8 h-8 pointer-events-none"
                    style={{
                      transform: `rotate(${botRot}rad)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <div
                      className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[14px] ${
                        isHighAlert ? 'border-t-red-500/40' : 'border-t-sky-400/20'
                      }`}
                    />
                  </div>

                  {/* Threat Bot Blip */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full border border-white shadow-md ${
                      isHighAlert ? 'bg-red-500 animate-ping' : 'bg-red-400'
                    }`}
                  />
                </div>
              </div>
            );
          }

          // 6b. CHAOS pursuit units (search / interceptors / tracker / elite / roadblocks)
          if (entity.type === 'chaos') {
            const hot = (entity.alert || 0) > 0.6;
            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-16 pointer-events-none"
                style={{ left: screenX, top: screenY }}
                title={entity.label}
              >
                <div
                  className={`w-2.5 h-2.5 rotate-45 border border-white shadow-md ${
                    hot ? 'bg-red-500 animate-pulse' : 'bg-orange-400'
                  }`}
                />
              </div>
            );
          }

          // 7. Security Cameras
          if (entity.type === 'camera') {
            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                style={{ left: screenX, top: screenY }}
              >
                <div className="w-2 h-2 rounded-xs bg-amber-500 border border-slate-900" />
              </div>
            );
          }

          // 8. Dismounted V9 Motorcycle (when player is on foot)
          if (entity.type === 'bike' && !isRiding) {
            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none"
                style={{ left: screenX, top: screenY }}
                title="V9 Motorcycle"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-3.5 h-3.5 rounded-full bg-cyan-400/40 animate-ping absolute" />
                  <div className="w-3 h-3 rounded-full bg-cyan-400 border border-white flex items-center justify-center text-[7px] font-black text-slate-950 shadow-md shadow-cyan-400/80">
                    V9
                  </div>
                </div>
              </div>
            );
          }

          // 9. Interactive Terminals
          if (entity.type === 'terminal') {
            const isHacked = entity.status === 'hacked';
            return (
              <div
                key={entity.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                style={{ left: screenX, top: screenY }}
                title={entity.label}
              >
                <div className={`w-2.5 h-2.5 rounded-xs border border-white flex items-center justify-center text-[6px] font-bold text-slate-950 ${
                  isHacked ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}>
                  T
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* ---------------- CENTER PLAYER / V9 AGENT INDICATOR ---------------- */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        >
          <div className="relative flex items-center justify-center">
            {/* Range Pulse Ripple */}
            <div className="w-6 h-6 rounded-full bg-cyan-400/15 border border-cyan-400/30 animate-pulse absolute" />

            {/* Directional Arrow */}
            <div
              className="w-4 h-4 flex items-center justify-center transition-transform duration-75"
              style={{
                transform: radarMode === 'heading' 
                  ? 'rotate(0deg)' 
                  : `rotate(${-activeHeading * (180 / Math.PI)}deg)`,
              }}
            >
              {state.isMiniDroneActive ? (
                <div className="w-3 h-3 rounded-full bg-amber-400 border border-white shadow-md shadow-amber-400/60" />
              ) : isRiding ? (
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[11px] border-b-cyan-300 drop-shadow-[0_0_6px_#06b6d4]" />
              ) : (
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-cyan-400 drop-shadow-[0_0_4px_#38bdf8]" />
              )}
            </div>
          </div>
        </div>

        {/* Inner Tactical Distance Ring Tag */}
        <div className="absolute bottom-1 right-2 text-[8px] font-mono font-bold text-cyan-400/70 pointer-events-none">
          {Math.round(currentRange)}m
        </div>
      </div>

      {/* ---------------- RADAR CONTROLS & STATUS BAR ---------------- */}
      <div className="flex items-center justify-between w-[176px] mt-1.5 px-1">
        {/* Mode Toggle: Heading Up vs North Up */}
        <button
          onClick={() => setRadarMode((m) => (m === 'heading' ? 'north' : 'heading'))}
          className="px-2 py-0.5 rounded-md bg-slate-900/90 hover:bg-cyan-950/80 border border-cyan-500/40 text-[9px] font-mono font-bold text-cyan-300 flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
          title="Toggle Heading Up / North Up"
        >
          <Navigation className={`w-2.5 h-2.5 ${radarMode === 'heading' ? 'text-cyan-300' : 'text-slate-400 rotate-45'}`} />
          <span>{radarMode === 'heading' ? 'HDG-UP' : 'NORTH'}</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0, z - 1))}
            disabled={zoomLevel === 0}
            className="w-5 h-5 rounded-md bg-slate-900/90 hover:bg-cyan-950/80 disabled:opacity-30 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-[11px] font-bold shadow-md transition active:scale-95 cursor-pointer"
            title="Zoom In (Tactical Range)"
          >
            +
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.min(zoomRanges.length - 1, z + 1))}
            disabled={zoomLevel === zoomRanges.length - 1}
            className="w-5 h-5 rounded-md bg-slate-900/90 hover:bg-cyan-950/80 disabled:opacity-30 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-[11px] font-bold shadow-md transition active:scale-95 cursor-pointer"
            title="Zoom Out (Regional Range)"
          >
            -
          </button>
        </div>
      </div>

      {/* GPS Coordinates Readout */}
      <div className="w-[176px] text-[8px] font-mono text-cyan-400/80 flex justify-between px-1 mt-0.5">
        <span>X: {Math.round(activePos.x)}</span>
        <span>Z: {Math.round(activePos.z)}</span>
        <span className="text-emerald-400">{state.speedMPH} MPH</span>
      </div>
    </div>
  );
};
