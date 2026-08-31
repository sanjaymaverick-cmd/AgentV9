import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameEngine, GameState } from './game/gameEngine';
import { VehicleCustomization, DisguiseType, GameSettings, CityPOI } from './types/game';
import { SaveManager, SaveDataV1, DEFAULT_CUSTOMIZATION } from './game/saveManager';
import { HUD } from './components/HUD';
import { CustomizerModal } from './components/CustomizerModal';
import { MissionsModal } from './components/MissionsModal';
import { ParentalModal } from './components/ParentalModal';
import { WalkthroughModal } from './components/WalkthroughModal';
import { MapExplorerModal } from './components/MapExplorerModal';
import { NPCDialogueModal } from './components/NPCDialogueModal';
import { TouchControls } from './components/TouchControls';
import { soundEngine } from './game/audio';

// Trivial device-local settings live outside the versioned save (see saveManager.ts).
const STORAGE_KEY_SETTINGS = 'agent_v9_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  soundVolume: 0.8,
  musicVolume: 0.4,
  voiceVolume: 1,
  steeringAssist: 0.5,
  timeLimitMinutes: 0,
  touchControls: true,
  highQualityGraphics: true,
  touchControlMode: 'joystick',
  showControlsHelper: true,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);

  // One versioned save, loaded (and migrated) once for this mount.
  const [initialSave] = useState<SaveDataV1 | null>(() => SaveManager.load());
  const [customization, setCustomization] = useState<VehicleCustomization>(
    () => initialSave?.customization ?? DEFAULT_CUSTOMIZATION
  );

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Modals state
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [showParental, setShowParental] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [showTimeReminder, setShowTimeReminder] = useState(false);

  // Initialize Three.js Game Engine
  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;

    const engine = new GameEngine(containerRef.current, customization, settings, initialSave ?? undefined);
    engine.onStateUpdate = (newState) => {
      setGameState({ ...newState });
    };
    engine.onRequestSave = (data) => {
      SaveManager.save(data);
    };

    engineRef.current = engine;
    setGameState(engine.state);

    // Start background synth music loop
    soundEngine.startMusic();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Track session play timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionMinutes((prev) => {
        const next = prev + 1;
        if (settings.timeLimitMinutes > 0 && next >= settings.timeLimitMinutes) {
          setShowTimeReminder(true);
        }
        return next;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [settings.timeLimitMinutes]);

  // Handle Customizer Save
  const handleSaveCustomization = (newCustom: VehicleCustomization, newDisguise: DisguiseType) => {
    setCustomization(newCustom);
    if (engineRef.current) {
      // Both calls flag an autosave; SaveManager writes the new look with the rest of progress.
      engineRef.current.equipDisguise(newDisguise);
      engineRef.current.updateCustomization(newCustom);
    }
    setShowCustomizer(false);
  };

  // Handle Settings Update
  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    if (engineRef.current) {
      engineRef.current.settings = newSettings;
    }
  };

  // Handle GPS route set from Map Explorer or Walkthrough
  const handleSetGPS = (target: CityPOI | [number, number, number], customName?: string) => {
    if (engineRef.current) {
      engineRef.current.setGPSDestination(target, customName);
    }
  };

  const handleClearGPS = () => {
    if (engineRef.current) {
      engineRef.current.clearGPSRoute();
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white font-sans select-none">
      
      {/* 3D WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        id="game-canvas-container"
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Primary HUD Overlay */}
      {gameState && engineRef.current && (
        <HUD
          state={gameState}
          playerPos={engineRef.current.playerPos}
          playerRot={engineRef.current.playerRot}
          bikePos={engineRef.current.bikePos}
          onOpenCustomizer={() => setShowCustomizer(true)}
          onOpenMissions={() => setShowMissions(true)}
          onOpenParental={() => setShowParental(true)}
          onOpenWalkthrough={() => setShowWalkthrough(true)}
          onOpenMap={() => setShowMap(true)}
          onClearGPS={handleClearGPS}
          onSelectGadget={(g) => engineRef.current?.switchGadget(g)}
          onToggleSilent={() => engineRef.current?.toggleSilentOrCrouch()}
          onInteract={() => engineRef.current?.handleInteractAction()}
        />
      )}

      {/* On-Screen Touch Controls */}
      {gameState && settings.touchControls && (
        <TouchControls 
          engine={engineRef.current} 
          isRiding={gameState.isRiding} 
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* Modal: Interactive NPC Dialogue */}
      {gameState && gameState.activeNPCDialogue && (
        <NPCDialogueModal
          dialogueState={gameState.activeNPCDialogue}
          onAdvance={() => engineRef.current?.advanceNPCDialogue()}
          onClose={() => engineRef.current?.closeNPCDialogue()}
          onAcceptSideQuest={(questId) => engineRef.current?.startSideQuest(questId)}
        />
      )}

      {/* Modal: City Map & GPS Explorer */}
      {showMap && gameState && engineRef.current && (
        <MapExplorerModal
          isOpen={showMap}
          onClose={() => setShowMap(false)}
          pois={gameState.allCityPOIs || []}
          playerPos={[engineRef.current.bikePos.x, engineRef.current.bikePos.y, engineRef.current.bikePos.z]}
          activeGPSDestinationId={gameState.activeGPSRoute?.destinationId}
          onSetGPS={(poi) => handleSetGPS(poi)}
          onClearGPS={handleClearGPS}
        />
      )}

      {/* Modal: Game Walkthrough & Manual */}
      {showWalkthrough && (
        <WalkthroughModal
          isOpen={showWalkthrough}
          onClose={() => setShowWalkthrough(false)}
          onSelectPOI={(pos, name) => handleSetGPS(pos, name)}
        />
      )}

      {/* Modal: V9 Customization Garage */}
      {showCustomizer && gameState && (
        <CustomizerModal
          customization={customization}
          stats={gameState.stats}
          currentDisguise={gameState.currentDisguise}
          onSave={handleSaveCustomization}
          onClose={() => setShowCustomizer(false)}
        />
      )}

      {/* Modal: Missions Dossier */}
      {showMissions && gameState && (
        <MissionsModal
          activeMission={gameState.activeMission}
          stats={gameState.stats}
          onClose={() => setShowMissions(false)}
        />
      )}

      {/* Modal: Parental & Settings */}
      {showParental && (
        <ParentalModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setShowParental(false)}
        />
      )}

      {/* Parental Play Time Reminder Alert */}
      {showTimeReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-amber-300 uppercase">Agent Break Time!</h3>
            <p className="text-sm text-slate-300 mt-2">
              You have been playing for {sessionMinutes} minutes. It is a great time to stretch and rest your eyes!
            </p>
            <button
              onClick={() => setShowTimeReminder(false)}
              className="mt-5 px-6 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase cursor-pointer"
            >
              Got It, Agent!
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
