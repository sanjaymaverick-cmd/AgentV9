import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { GameEngine, GameState } from './game/gameEngine';
import { VehicleCustomization, DisguiseType, GameSettings, CityPOI } from './types/game';
import { SaveManager, SaveDataV1, DEFAULT_CUSTOMIZATION } from './game/saveManager';
import { autoDetectQuality, isLargeDisplay } from './game/quality';
import { HUD } from './components/HUD';
import { TouchControls } from './components/TouchControls';
import { PerfChip } from './components/PerfChip';
import { soundEngine } from './game/audio';
import { Shield } from 'lucide-react';

const CustomizerModal = lazy(() => import('./components/CustomizerModal').then((m) => ({ default: m.CustomizerModal })));
const MissionsModal = lazy(() => import('./components/MissionsModal').then((m) => ({ default: m.MissionsModal })));
const ParentalModal = lazy(() => import('./components/ParentalModal').then((m) => ({ default: m.ParentalModal })));
const WalkthroughModal = lazy(() => import('./components/WalkthroughModal').then((m) => ({ default: m.WalkthroughModal })));
const MapExplorerModal = lazy(() => import('./components/MapExplorerModal').then((m) => ({ default: m.MapExplorerModal })));
const NPCDialogueModal = lazy(() => import('./components/NPCDialogueModal').then((m) => ({ default: m.NPCDialogueModal })));

const DebugMenu = import.meta.env.DEV
  ? React.lazy(() => import('./components/DebugMenu'))
  : null;

const STORAGE_KEY_SETTINGS = 'agent_v9_settings_v1';

function wantPerfHud(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('perf')) return true;
    if (localStorage.getItem('agent_v9_show_perf') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundVolume: 0.8,
  musicVolume: 0.4,
  voiceVolume: 1,
  steeringAssist: 0.5,
  timeLimitMinutes: 0,
  touchControls: true,
  qualityLevel: 'medium',
  touchControlMode: 'joystick',
  showControlsHelper: true,
  showPerfHud: false,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);

  const [initialSave] = useState<SaveDataV1 | null>(() => SaveManager.load());
  const [customization, setCustomization] = useState<VehicleCustomization>(
    () => initialSave?.customization ?? DEFAULT_CUSTOMIZATION
  );

  const [settings, setSettings] = useState<GameSettings>(() => {
    let stored: Partial<GameSettings> & { highQualityGraphics?: boolean } = {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) stored = JSON.parse(saved);
    } catch {
      /* fall through to defaults */
    }
    const qualityLevel: GameSettings['qualityLevel'] =
      stored.qualityLevel ??
      (typeof stored.highQualityGraphics === 'boolean'
        ? stored.highQualityGraphics
          ? 'high'
          : 'low'
        : autoDetectQuality());
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      qualityLevel,
      showPerfHud:
        stored.showPerfHud ??
        (wantPerfHud() ||
          (typeof window !== 'undefined' &&
            isLargeDisplay((window.innerWidth || 0) * (window.innerHeight || 0)))),
    };
  });

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [showParental, setShowParental] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [showTimeReminder, setShowTimeReminder] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);

  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;
    const el = containerRef.current;
    const custom = customization;
    const sets = settings;
    const save = initialSave;
    let cancelled = false;
    let engine: GameEngine | null = null;

    import('./game/gameEngine').then(({ GameEngine }) => {
      if (cancelled || !el) return;
      requestAnimationFrame(() => {
        if (cancelled || !el) return;
        engine = new GameEngine(el, custom, sets, save ?? undefined);
        engine.onStateUpdate = (newState) => {
          setGameState({ ...newState });
        };
        engine.onRequestSave = (data) => {
          SaveManager.save(data);
        };
        engineRef.current = engine;
        setGameState(engine.state);
      });
    });

    return () => {
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

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

  const handleStartAudio = () => {
    soundEngine.unlock();
    soundEngine.startMusic();
    setAudioStarted(true);
    const orient = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    void orient.lock?.('landscape').catch(() => {
      /* browsers only allow this in fullscreen / installed APK */
    });
  };

  const handleSaveCustomization = (newCustom: VehicleCustomization, newDisguise: DisguiseType) => {
    setCustomization(newCustom);
    if (engineRef.current) {
      engineRef.current.equipDisguise(newDisguise);
      engineRef.current.updateCustomization(newCustom);
    }
    setShowCustomizer(false);
  };

  const handleUpdateSettings = (newSettings: GameSettings) => {
    const prev = settings;
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    if (engineRef.current) {
      engineRef.current.settings = newSettings;
      if (newSettings.qualityLevel !== prev.qualityLevel) {
        engineRef.current.applyQuality(newSettings.qualityLevel);
      }
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') {
        e.preventDefault();
        setShowDebug((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    <main className="relative w-screen h-screen overflow-hidden bg-hud-bg text-hud-fg font-sans select-none">
      <div
        ref={containerRef}
        id="game-canvas-container"
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {!audioStarted && (
        <button
          id="tap-to-start"
          onClick={handleStartAudio}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-hud-bg/95 text-center p-6"
        >
          <span className="w-16 h-16 rounded-2xl bg-hud-accent/15 border border-hud-line flex items-center justify-center">
            <Shield className="w-8 h-8 text-hud-accent" />
          </span>
          <span className="text-2xl sm:text-3xl font-semibold tracking-wide text-hud-fg">
            Agent V9: Velocity City
          </span>
          <span className="mt-1 px-6 min-h-11 rounded-2xl bg-hud-accent text-hud-accent-fg font-semibold text-base inline-flex items-center">
            Tap to Start
          </span>
          <span className="text-xs text-hud-muted">Turns on engine sounds, music and mission voice</span>
        </button>
      )}

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
          onCycleCamera={() => engineRef.current?.cycleCameraMode()}
          onResetVehicle={() => engineRef.current?.resetVehicle()}
          onToggleTouchMode={() =>
            handleUpdateSettings({
              ...settings,
              touchControlMode: settings.touchControlMode === 'joystick' ? 'dpad' : 'joystick',
            })
          }
          touchControlMode={settings.touchControlMode}
          touchControlsActive={settings.touchControls && !gameState.gamepadConnected}
        />
      )}

      {gameState && settings.touchControls && !gameState.gamepadConnected && (
        <TouchControls
          engine={engineRef.current}
          isRiding={gameState.isRiding}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {(settings.showPerfHud || wantPerfHud()) && <PerfChip />}

      <Suspense fallback={null}>
      {gameState && gameState.activeNPCDialogue && (
        <NPCDialogueModal
          dialogueState={gameState.activeNPCDialogue}
          onAdvance={() => engineRef.current?.advanceNPCDialogue()}
          onClose={() => engineRef.current?.closeNPCDialogue()}
          onAcceptSideQuest={(questId) => engineRef.current?.startSideQuest(questId)}
        />
      )}

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

      {showWalkthrough && (
        <WalkthroughModal
          isOpen={showWalkthrough}
          onClose={() => setShowWalkthrough(false)}
          onSelectPOI={(pos, name) => handleSetGPS(pos, name)}
        />
      )}

      {showCustomizer && gameState && (
        <CustomizerModal
          customization={customization}
          stats={gameState.stats}
          currentDisguise={gameState.currentDisguise}
          onSave={handleSaveCustomization}
          onClose={() => setShowCustomizer(false)}
        />
      )}

      {showMissions && gameState && (
        <MissionsModal
          activeMission={gameState.activeMission}
          stats={gameState.stats}
          onClose={() => setShowMissions(false)}
        />
      )}

      {showParental && (
        <ParentalModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setShowParental(false)}
        />
      )}
      </Suspense>

      {showTimeReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-hud-bg border border-hud-line rounded-3xl p-6 max-w-md w-full text-center text-hud-fg">
            <h3 className="text-xl font-semibold">Agent break time</h3>
            <p className="text-sm text-hud-muted mt-2">
              You have been playing for {sessionMinutes} minutes. Stretch and rest your eyes.
            </p>
            <button
              onClick={() => setShowTimeReminder(false)}
              className="mt-5 px-6 min-h-11 rounded-2xl bg-hud-accent text-hud-accent-fg font-semibold text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {DebugMenu && showDebug && gameState && engineRef.current && (
        <React.Suspense fallback={null}>
          <DebugMenu
            engine={engineRef.current}
            state={gameState}
            onClose={() => setShowDebug(false)}
          />
        </React.Suspense>
      )}
    </main>
  );
}
