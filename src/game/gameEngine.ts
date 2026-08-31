import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { 
  PlayerStats, 
  VehicleCustomization, 
  DisguiseType, 
  GadgetType, 
  Mission, 
  MissionPathChoice,
  GameSettings,
  CameraMode,
  CityPOI,
  GPSRoute,
  NPCLocal,
  RadarEntity,
  QualityLevel
} from '../types/game';
import { 
  createV9Motorcycle, 
  createAgentCharacter, 
  createMiniDrone, 
  createGiantCargoDrone 
} from './models';
import { buildVelocityCity, WorldObjects } from './world';
import { resizeNightSky } from './cityBuildings';
import { soundEngine } from './audio';
import { STORY_MISSION_MIDNIGHT_PROTOTYPE, SIDE_MISSIONS, calculateRank } from './missionEngine';
import {
  SaveDataV1,
  SAVE_DATA_VERSION,
  cloneDefaultStats,
  AUTOSAVE_DEBOUNCE_MS,
  PERIODIC_AUTOSAVE_SEC,
} from './saveManager';
import type { DebugTools } from './debugTools';
import { MotorcyclePhysics } from './motorcyclePhysics';
import { StealthAI } from './stealthAI';
import { CameraRig } from './cameraRig';
import { MissionRunner } from './missionRunner';
import { GPSNavigator } from './gpsNavigator';
import { WorldSystems } from './worldSystems';
import { RadarSync } from './radarSync';
import { EngineInput } from './engineInput';
import { PlayerActions } from './playerActions';
import { NPCDialogue } from './npcDialogue';
import { GamepadInput } from './gamepadInput';
import { SaveController } from './saveController';
import { ChaosAlertManager } from './chaosAlertManager';
import { RaceManager, RacePhase } from './raceManager';
import { ChaseController, ChasePhase } from './chaseController';
import { DroneTagManager } from './droneTagManager';
import { QualityPreset, QUALITY_PRESETS, isSoftwareWebGL, resolvePixelRatio, shouldAntialias } from './quality';
import { MeshPool, PARTICLE_GEO } from './objectPool';
import { PerfHarness } from './perfHarness';

export interface GameState {
  isRiding: boolean;
  isSilentMode: boolean;
  isMiniDroneActive: boolean;
  droneBattery: number;
  droneReturning: boolean;
  isRemoteV9Active: boolean;
  currentDisguise: DisguiseType;
  currentGadget: GadgetType;
  cameraMode: CameraMode;
  speedMPH: number;
  fuelLevel: number; // 0 to 100
  isRefueling: boolean;
  refuelProgress: number; // 0 to 100
  nearestFuelStation: { name: string; distance: number; position: [number, number, number] } | null;
  nitroLevel: number; // 0 to 100
  isBoosting: boolean;
  isDrifting: boolean;
  steerAngleDeg: number;
  objectiveDistance: number;
  objectiveAngleDeg: number;
  stealthVisibility: number; // 0 to 100
  stealthNoise: number; // 0 to 100
  chaosAlertLevel: number; // 0 to 5
  chaosAlertProgress: number; // 0 to 100 toward the next level
  chaosPhase: 'idle' | 'escalating' | 'cooling';
  raceActive: boolean;
  racePhase: RacePhase;
  raceId: string;
  raceTimeSec: number;
  raceParSec: number;
  raceGateIndex: number;
  raceGateTotal: number;
  raceCountdownSec: number;
  raceBestTimeSec: number | null;
  raceWrongGate: boolean;
  chaseActive: boolean;
  chasePhase: ChasePhase;
  chaseDistance: number;
  chaseFailMeter: number;
  chaseCheckpoint: number;
  chaseCheckpointTotal: number;
  droneTagActive: boolean;
  droneTagTagged: number;
  droneTagTotal: number;
  nearInteraction: string | null;
  activeMission: Mission;
  stats: PlayerStats;
  radioMessage: { sender: string; text: string; time: number } | null;
  notification: string | null;
  stuntScoreStreak: number;
  bossRelaysRemaining: number;
  playerHeadingRad: number;
  bikeHeadingRad: number;
  droneHeadingRad: number;
  activeTargetPos: [number, number, number] | null;
  radarEntities: RadarEntity[];
  activeGPSRoute: GPSRoute | null;
  activeNPCDialogue: { npc: NPCLocal; lineIndex: number } | null;
  allCityPOIs: CityPOI[];
  allNPCs: NPCLocal[];
  gamepadConnected: boolean;
}

/**
 * Every control channel the engine reads each frame.
 * Digital channels are booleans (button held / not held); analog channels are
 * normalised floats in the -1..+1 range coming from the touch joystick or a gamepad stick.
 */
export interface EngineInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  boost: boolean;
  interact: boolean;
  gadget: boolean;
  sneak: boolean;
  drift: boolean;
  /** -1 (full left) .. +1 (full right) */
  analogSteer: number;
  /** -1 (full brake/reverse) .. +1 (full throttle) */
  analogThrottle: number;
}

/** Just the digital (boolean) channels of EngineInputState — safe to set from a button. */
export type EngineButtonInput = {
  [K in keyof EngineInputState]: EngineInputState[K] extends boolean ? K : never;
}[keyof EngineInputState];

export class GameEngine {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;
  public timer: THREE.Timer;

  // City & World Objects
  // NOTE: several fields below are `public` only so the extracted subsystems
  // (MotorcyclePhysics, StealthAI, MissionRunner, GPSNavigator, CameraRig) can share
  // them. Treat them as engine-internal — UI still never touches these.
  public world!: WorldObjects;
  public waypointGroup!: THREE.Group;
  public driftParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  public refuelParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  public driftPool!: MeshPool;
  public refuelPool!: MeshPool;
  public gpsRibbonGroup!: THREE.Group;
  public lastLowFuelAlertTime = 0;
  public hasWarnedZeroFuel = false;
  public refuelSoundTimer = 0;
  private hudUpdateTimer = 0;

  // Player & Motorcycle 3D Models
  public motorcycle!: ReturnType<typeof createV9Motorcycle>;
  public agentChar!: ReturnType<typeof createAgentCharacter>;
  public miniDrone!: ReturnType<typeof createMiniDrone>;
  public bossDrone!: ReturnType<typeof createGiantCargoDrone>;

  // Physics & Transforms
  public playerPos = new THREE.Vector3(-60, 0, -48);
  public playerRot = 0; // Yaw radians
  public playerVel = new THREE.Vector3();
  public isGrounded = true;
  public isCrouching = false;
  public isSprinting = false;

  public bikePos = new THREE.Vector3(-60, 0, -48);
  public bikeRot = 0;
  public bikeSpeed = 0; // m/s
  public bikeSteer = 0;
  public bikeLean = 0;
  public bikePitch = 0;
  public bikeVerticalVel = 0;
  public isBikeGrounded = true;
  public isDrifting = false;
  public bikeCrashStun = 0;
  public bikeCrashCooldown = 0;
  public crashShake = 0;

  public dronePos = new THREE.Vector3(-60, 2, -48);
  public droneRot = 0;
  public dronePitch = 0;
  public droneLowWarned = false;
  public droneRangeWarned = false;

  // Orbit drag & view control (shared with CameraRig)
  /** World-space camera heading — independent of player/bike facing so look-around can stick. */
  public cameraYaw = 0;
  public orbitYawOffset = 0;
  public orbitPitchOffset = 0;
  public isPointerDragging = false;
  public lastPointerX = 0;
  public lastPointerY = 0;

  // Controls input state
  public input: EngineInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    boost: false,
    interact: false,
    gadget: false,
    sneak: false,
    drift: false,
    analogSteer: 0, // -1 to +1 from touch joystick
    analogThrottle: 0, // -1 to +1 from touch joystick
  };

  // Foam & Projectiles
  public projectiles: { mesh: THREE.Mesh; vel: THREE.Vector3; type: 'emp' | 'foam'; life: number }[] = [];
  public foamBlobs: { mesh: THREE.Mesh; life: number; box: THREE.Box3 }[] = [];
  public hologramDecoy: THREE.Group | null = null;
  public hologramTimer = 0;

  // Escort out animation state
  public isEscortingOut = false;
  public escortTimer = 0;

  // Game & Mission State
  public state: GameState;
  public customization: VehicleCustomization;
  public settings: GameSettings;
  public onStateUpdate?: (state: GameState) => void;

  /** Called with a fresh snapshot whenever the engine wants progress persisted. */
  public onRequestSave?: (data: SaveDataV1) => void;
  private saveDirty = false;
  private lastSaveAtMs = 0;
  private periodicSaveTimer = 0;

  /**
   * Dev-only debug controls (spec §33). Assigned asynchronously from `./debugTools`
   * when `import.meta.env.DEV`; the whole branch is dead-code-eliminated in production,
   * so the module and its chunk never ship. Stays null in prod.
   */
  public debug: DebugTools | null = null;

  // Active graphics preset (spec §26). Particle spawners read the caps below.
  public currentQuality: QualityPreset = QUALITY_PRESETS.medium;
  public maxDriftParticles = QUALITY_PRESETS.medium.maxDriftParticles;
  public maxRefuelParticles = QUALITY_PRESETS.medium.maxRefuelParticles;

  // Extracted subsystems — constructed in initWorld() once handles exist.
  private motorcyclePhysics!: MotorcyclePhysics;
  public stealthAI!: StealthAI;
  public cameraRig!: CameraRig;
  public missionRunner!: MissionRunner;
  public gpsNavigator!: GPSNavigator;
  public worldSystems!: WorldSystems;
  public radarSync!: RadarSync;
  public engineInput!: EngineInput;
  public playerActions!: PlayerActions;
  public npcDialogue!: NPCDialogue;
  public saveController!: SaveController;
  public gamepadInput!: GamepadInput;
  public chaosAlertManager!: ChaosAlertManager;
  public raceManager!: RaceManager;
  public chaseController!: ChaseController;
  public droneTagManager!: DroneTagManager;
  public perf!: PerfHarness;
  /** Story mission parked while a side sprint runs, so accepting Maya doesn't wipe progress. */
  public stashedStoryMission: Mission | null = null;

  constructor(
    container: HTMLElement,
    customization: VehicleCustomization,
    settings: GameSettings,
    savedGame?: SaveDataV1
  ) {
    this.container = container;
    this.customization = customization;
    this.settings = settings;
    this.timer = new THREE.Timer();

    const initialStats: PlayerStats = savedGame?.stats
      ? { ...cloneDefaultStats(), ...savedGame.stats }
      : cloneDefaultStats();

    this.state = {
      isRiding: true, // Start mounted for immediate fun
      isSilentMode: false,
      isMiniDroneActive: false,
      droneBattery: 100,
      droneReturning: false,
      isRemoteV9Active: false,
      currentDisguise: 'agent_suit',
      currentGadget: 'emp',
      cameraMode: 'chase',
      speedMPH: 0,
      fuelLevel: 100,
      isRefueling: false,
      refuelProgress: 100,
      nearestFuelStation: null,
      nitroLevel: 100,
      isBoosting: false,
      isDrifting: false,
      steerAngleDeg: 0,
      objectiveDistance: 0,
      objectiveAngleDeg: 0,
      stealthVisibility: 10,
      stealthNoise: 20,
      chaosAlertLevel: 0,
      chaosAlertProgress: 0,
      chaosPhase: 'idle',
      raceActive: false,
      racePhase: 'idle',
      raceId: '',
      raceTimeSec: 0,
      raceParSec: 45,
      raceGateIndex: 0,
      raceGateTotal: 8,
      raceCountdownSec: 0,
      raceBestTimeSec: null,
      raceWrongGate: false,
      chaseActive: false,
      chasePhase: 'idle',
      chaseDistance: 0,
      chaseFailMeter: 0,
      chaseCheckpoint: 0,
      chaseCheckpointTotal: 8,
      droneTagActive: false,
      droneTagTagged: 0,
      droneTagTotal: 4,
      nearInteraction: null,
      activeMission: JSON.parse(JSON.stringify(STORY_MISSION_MIDNIGHT_PROTOTYPE)),
      stats: initialStats,
      radioMessage: {
        sender: 'Agent Kira (HQ)',
        text: 'Agent V9! Welcome to Velocity City. Check your minimap and ride north to investigate the Technology Museum!',
        time: Date.now(),
      },
      notification: 'Mission Started: The Midnight Prototype',
      stuntScoreStreak: 0,
      bossRelaysRemaining: 3,
      playerHeadingRad: 0,
      bikeHeadingRad: 0,
      droneHeadingRad: 0,
      activeTargetPos: [-30, 0, -85],
      radarEntities: [],
      activeGPSRoute: null,
      activeNPCDialogue: null,
      allCityPOIs: [],
      allNPCs: [],
      gamepadConnected: false,
    };

    // Three.js Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    const viewW = Math.max(1, container.clientWidth || 1280);
    const viewH = Math.max(1, container.clientHeight || 720);
    this.camera = new THREE.PerspectiveCamera(65, viewW / viewH, 0.1, 800);

    const cssPixels = viewW * viewH;
    this.renderer = new THREE.WebGLRenderer({
      antialias: shouldAntialias(settings.qualityLevel, cssPixels),
      powerPreference: 'high-performance',
      // Dev-only: lets canvas.toDataURL capture a frame. Production keeps the default (false).
      preserveDrawingBuffer: !!import.meta.env.DEV,
    });
    this.renderer.setSize(viewW, viewH);
    this.renderer.setPixelRatio(resolvePixelRatio(settings.qualityLevel, viewW, viewH, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.initWorld();
    this.perf = new PerfHarness(this);
    this.applyQuality(this.settings.qualityLevel, false);
    this.engineInput.attach();
    this.gamepadInput.attach();
    this.cameraRig.attachPointerControls();

    if (savedGame) {
      this.saveController.apply(savedGame);
    }
    this.cameraYaw = this.state.isRiding ? this.bikeRot : this.playerRot;

    this.startLoop();

    if (import.meta.env.DEV) {
      import('./debugTools')
        .then((m) => {
          this.debug = m.attachDebugTools(this);
        })
        .catch(() => {
          /* dev-only; ignore */
        });
    }

    // Kira voice intro — skipped on a resumed game so we don't replay the opening brief.
    if (!savedGame) {
      setTimeout(() => {
        soundEngine.speak('Agent V9, welcome to Velocity City. Head north to the Technology Museum to investigate the breach.', 'kira');
      }, 1200);
    }
  }

  private initWorld() {
    this.world = buildVelocityCity(this.scene);
    this.state.allCityPOIs = this.world.cityPOIs || [];
    this.state.allNPCs = (this.world.npcLocals || []).map((n) => n.data);

    // Create GPS Ribbon Group
    this.gpsRibbonGroup = new THREE.Group();
    this.scene.add(this.gpsRibbonGroup);

    // Create Motorcycle V9
    this.motorcycle = createV9Motorcycle(this.customization);
    this.motorcycle.group.position.copy(this.bikePos);
    this.scene.add(this.motorcycle.group);

    // Create On-Foot Agent
    this.agentChar = createAgentCharacter(this.state.currentDisguise, this.customization.suitColor);
    this.agentChar.group.position.copy(this.playerPos);
    this.agentChar.group.visible = !this.state.isRiding;
    this.scene.add(this.agentChar.group);

    // Create Mini Recon Drone
    this.miniDrone = createMiniDrone();
    this.miniDrone.group.visible = false;
    this.scene.add(this.miniDrone.group);

    // Create Boss Cargo Drone
    this.bossDrone = createGiantCargoDrone();
    this.bossDrone.group.position.set(40, 14, 70);
    this.bossDrone.group.visible = false; // Becomes visible during climax step 5
    this.scene.add(this.bossDrone.group);

    // Create 3D Holographic Waypoint Pillar
    this.initWaypointBeacon();

    // Wire up extracted per-frame subsystems now that all handles exist.
    this.motorcyclePhysics = new MotorcyclePhysics(this);
    this.stealthAI = new StealthAI(this);
    this.cameraRig = new CameraRig(this);
    this.missionRunner = new MissionRunner(this);
    this.gpsNavigator = new GPSNavigator(this);
    this.worldSystems = new WorldSystems(this);
    this.radarSync = new RadarSync(this);
    this.engineInput = new EngineInput(this);
    this.playerActions = new PlayerActions(this);
    this.npcDialogue = new NPCDialogue(this);
    this.saveController = new SaveController(this);
    this.gamepadInput = new GamepadInput(this);
    this.chaosAlertManager = new ChaosAlertManager(this);
    this.raceManager = new RaceManager(this);
    this.chaseController = new ChaseController(this);
    this.droneTagManager = new DroneTagManager(this);
    this.driftPool = new MeshPool(this.scene, () => new THREE.Mesh(
      PARTICLE_GEO,
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    ));
    this.refuelPool = new MeshPool(this.scene, () => new THREE.Mesh(
      PARTICLE_GEO,
      new THREE.MeshBasicMaterial({ color: '#10b981', transparent: true, opacity: 0.9 })
    ));
  }

  private initWaypointBeacon() {
    this.waypointGroup = new THREE.Group();

    // Holographic vertical laser pillar
    const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 45, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 22.5;
    this.waypointGroup.add(beam);

    // Floating pulsing diamond icon
    const diamondGeo = new THREE.OctahedronGeometry(1.6, 0);
    const diamondMat = new THREE.MeshStandardMaterial({
      color: '#00f2fe',
      emissive: '#0284c7',
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.9,
    });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.name = 'waypoint_diamond';
    diamond.position.y = 4.5;
    this.waypointGroup.add(diamond);

    // Ground Pulse Rings
    const ringGeo = new THREE.RingGeometry(1.8, 2.4, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.name = 'waypoint_ring';
    ring.position.y = 0.1;
    this.waypointGroup.add(ring);

    this.scene.add(this.waypointGroup);
  }

  public updateCustomization(custom: VehicleCustomization) {
    this.customization = custom;
    // Remove old bike and create customized one
    this.scene.remove(this.motorcycle.group);
    this.motorcycle = createV9Motorcycle(custom);
    this.motorcycle.group.position.copy(this.bikePos);
    this.motorcycle.group.rotation.y = this.bikeRot;
    this.scene.add(this.motorcycle.group);

    // Update agent suit
    this.scene.remove(this.agentChar.group);
    this.agentChar = createAgentCharacter(this.state.currentDisguise, custom.suitColor);
    this.agentChar.group.position.copy(this.playerPos);
    this.agentChar.group.visible = !this.state.isRiding;
    this.scene.add(this.agentChar.group);

    this.requestAutosave();
  }

  /**
   * Apply a graphics quality preset (spec §26). Safe to call at any time — it retunes
   * the renderer, shadows, draw distance / fog, particle caps and hides surplus
   * autonomous agents. Does NOT persist; App.tsx owns the settings write.
   */
  public applyQuality(level: QualityLevel, notify = true) {
    const q = QUALITY_PRESETS[level];
    this.currentQuality = q;
    this.maxDriftParticles = q.maxDriftParticles;
    this.maxRefuelParticles = q.maxRefuelParticles;

    // Renderer
    const shadows = q.shadows && !isSoftwareWebGL(this.renderer.getContext());
    const cssW = Math.max(1, this.container.clientWidth || window.innerWidth || 1280);
    const cssH = Math.max(1, this.container.clientHeight || window.innerHeight || 720);
    this.renderer.setPixelRatio(resolvePixelRatio(level, cssW, cssH, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = shadows;

    // Shadows — force the shadow map to rebuild at the new resolution.
    const sun = this.world.sunLight;
    sun.castShadow = shadows;
    sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;

    // Draw distance + fog
    this.camera.far = q.drawDistance;
    this.camera.updateProjectionMatrix();
    resizeNightSky(this.world.nightSky, q.drawDistance);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = q.fogDensity;
    }

    // Trim autonomous agents — the world spawns HIGH's pool; hide the surplus.
    this.world.trafficVehicles.forEach((v, i) => (v.obj.visible = i < q.trafficCount));
    let peds = 0;
    this.world.npcLocals.forEach((n) => {
      if (n.isPedestrian) n.obj.visible = peds++ < q.pedestrianCount;
    });

    this.chaosAlertManager.applyQualityTrim();

    if (notify) this.setNotification(`Graphics: ${level.toUpperCase()}`);
  }

  // ---------------------------------------------------
  // INPUT & VIEW HANDLING
  // ---------------------------------------------------
  // ---------------------------------------------------
  // CAMERA & VIEW MODES
  // ---------------------------------------------------
  /** Public delegators kept so external callers (TouchControls, keybinds) don't change. */
  public setCameraMode(mode: CameraMode) {
    this.cameraRig.setMode(mode);
  }

  public cycleCameraMode() {
    this.cameraRig.cycleMode();
  }

  // Player-action delegators — App / TouchControls / EngineInput / debug call these.
  public honkHorn() { this.playerActions.honkHorn(); }
  public resetVehicle() { this.playerActions.resetVehicle(); }
  public handleInteractAction() { this.playerActions.handleInteractAction(); }
  public toggleSilentOrCrouch() { this.playerActions.toggleSilentOrCrouch(); }
  public handleJumpOrBrake() { this.playerActions.handleJumpOrBrake(); }
  public switchGadget(gadget: GadgetType) { this.playerActions.switchGadget(gadget); }
  public toggleMiniDrone() { this.playerActions.toggleMiniDrone(); }
  public toggleRemoteV9() { this.playerActions.toggleRemoteV9(); }
  public fireGadget() { this.playerActions.fireGadget(); }
  public equipDisguise(disguise: DisguiseType) { this.playerActions.equipDisguise(disguise); }
  public hackTerminal(term: WorldObjects['terminals'][0]) { this.playerActions.hackTerminal(term); }

  // ---------------------------------------------------
  // MAIN UPDATE SIMULATION LOOP
  // ---------------------------------------------------
  private startLoop() {
    const loop = () => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.1);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.perf?.tick(dt);
      this.perf?.afterRender();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private update(dt: number) {
    if (this.isEscortingOut) {
      this.stealthAI.updateEscortOut(dt);
      return;
    }

    // 0. Poll gamepad into the shared input struct (before any consumer reads it).
    this.gamepadInput.poll();

    // 1. Update Projectiles & Foam
    this.worldSystems.updateProjectiles(dt);

    this.worldSystems.updateMuseumAccess();

    // 2. Controller Update
    this.worldSystems.updateMiniDrone(dt);
    if (this.state.isMiniDroneActive) {
      // Pilot the drone; body/bike wait until it docks.
    } else if (this.state.isRiding || this.state.isRemoteV9Active) {
      this.motorcyclePhysics.update(dt);
      if (!this.state.isRiding) {
        this.worldSystems.updateAgentOnFoot(dt);
      }
    } else {
      this.worldSystems.updateAgentOnFoot(dt);
    }

    // 3. Update Camera
    this.cameraRig.update(dt);

    // 4. Update Stealth & Security Bots
    this.stealthAI.update(dt);

    // 4b. City-wide CHAOS heat (reads sightings reported this frame by stealth + cameras)
    this.chaosAlertManager.update(dt);

    // 5. Update World Collectibles & Stunt Rings
    this.worldSystems.updateWorldInteractions(dt);

    // 6. Update Fuel Stations & Refueling
    this.worldSystems.updateFuelStationsAndRefueling(dt);

    // 7. Downtown race (updates the current objective gate before the mission compass)
    this.raceManager.update(dt);

    // 7b. Story chase (transport drone path) — also writes the live objective
    this.chaseController.update(dt);

    // 7c. Officer Jax plaza drone-tagger
    this.droneTagManager.update(dt);

    // 8. Mission Check & Boss Drone Update
    this.missionRunner.update(dt);

    // 9. Update Autonomous City Traffic Vehicles
    this.worldSystems.updateLod();
    this.worldSystems.updateTrafficVehicles(dt);

    // 9. Update Sounds
    const speedRatio = Math.abs(this.bikeSpeed) / 45;
    soundEngine.updateEngine(speedRatio, this.state.isRiding, this.state.isSilentMode);

    // 10. Update HUD & Real-Time Radar State
    this.state.speedMPH = Math.round(Math.abs(this.bikeSpeed) * 2.237);
    this.state.isBoosting = this.input.boost && this.state.nitroLevel > 0 && this.state.fuelLevel > 0;
    this.state.playerHeadingRad = this.playerRot;
    this.state.bikeHeadingRad = this.bikeRot;
    this.state.droneHeadingRad = this.droneRot;

    // Real-Time Radar Sync tick (~30 FPS for ultra-smooth dynamic tracking without overhead)
    this.hudUpdateTimer += dt;
    if (this.hudUpdateTimer >= 0.033) {
      this.radarSync.sync();
      this.notifyState();
      this.hudUpdateTimer = 0;
    }

    // Autosave: heartbeat captures the player's position; event-driven writes are debounced.
    this.periodicSaveTimer += dt;
    if (this.periodicSaveTimer >= PERIODIC_AUTOSAVE_SEC) {
      this.periodicSaveTimer = 0;
      this.saveDirty = true;
    }
    if (this.saveDirty && performance.now() - this.lastSaveAtMs >= AUTOSAVE_DEBOUNCE_MS) {
      this.flushSave();
    }
  }

  // Public delegators — kept so hackTerminal / StealthAI / debug callers are unchanged.
  public checkMissionStepComplete(stepId: string, path: MissionPathChoice) {
    this.missionRunner.checkStep(stepId, path);
  }

  public completeStoryMission() {
    this.missionRunner.completeStoryMission();
  }

  public addXP(amount: number, reason: string) {
    this.state.stats.xp += amount;
    const newRank = calculateRank(this.state.stats.xp);
    if (newRank !== this.state.stats.rank) {
      this.state.stats.rank = newRank;
      soundEngine.playMissionComplete();
      this.setNotification(`RANK PROMOTION: You are now a ${newRank}!`);
      soundEngine.speak(`Congratulations agent. You have been promoted to ${newRank}!`, 'kira');
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.4 } });
    } else {
      this.setNotification(`+${amount} XP (${reason})`);
    }
    this.notifyState();
  }

  public addStuntScore(points: number, stuntName: string) {
    this.state.stuntScoreStreak += points;
    this.state.stats.stuntsCompleted++;
    if (this.state.stuntScoreStreak > this.state.stats.stuntHighScore) {
      this.state.stats.stuntHighScore = this.state.stuntScoreStreak;
    }
    // Stunts provide kinetic energy recovery
    this.state.fuelLevel = Math.min(100, this.state.fuelLevel + 6);
    this.state.nitroLevel = Math.min(100, this.state.nitroLevel + 12);
    this.addXP(Math.round(points / 2), `Stunt: ${stuntName}`);
    this.notifyState();
  }

  public setNotification(text: string) {
    this.state.notification = text;
    this.notifyState();
  }

  // ---------------------------------------------------
  // GPS ROUTING & NAVIGATION
  // ---------------------------------------------------
  // Public delegators — App.tsx and startSideQuest call these.
  public setGPSDestination(target: CityPOI | [number, number, number], customName?: string) {
    this.gpsNavigator.setDestination(target, customName);
  }

  public clearGPSRoute() {
    this.gpsNavigator.clearRoute();
  }

  // ---------------------------------------------------
  // NPC CONVERSATIONS & SIDE QUESTS
  // ---------------------------------------------------
  // NPC dialogue delegators.
  public talkToNPC(npcId?: string) { this.npcDialogue.talkToNPC(npcId); }
  public advanceNPCDialogue() { this.npcDialogue.advanceNPCDialogue(); }
  public closeNPCDialogue() { this.npcDialogue.closeNPCDialogue(); }
  public startSideQuest(questId: string) { this.npcDialogue.startSideQuest(questId); }

  public notifyState() {
    if (this.onStateUpdate) {
      this.onStateUpdate({ ...this.state });
    }
  }

  // ---------------------------------------------------
  // SAVE / LOAD (spec §21)
  // ---------------------------------------------------

  /** Mark progress dirty; the next update tick writes it once the debounce window passes. */
  public requestAutosave() {
    this.saveDirty = true;
  }

  /** Reset the autosave debounce clock (called after any write, incl. a restore). */
  public markSaved() {
    this.lastSaveAtMs = performance.now();
  }

  /** Full progress snapshot for persistence. */
  public exportSave(): SaveDataV1 {
    return this.saveController.export();
  }

  /** Persist immediately, bypassing the debounce (used on teardown and explicit saves). */
  public flushSave() {
    this.saveDirty = false;
    this.markSaved();
    this.onRequestSave?.(this.saveController.export());
  }


  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.perf?.detach();
    // Best-effort final autosave so a reload right after an action keeps it.
    try {
      this.onRequestSave?.(this.exportSave());
    } catch {
      /* engine may be half torn down; ignore */
    }
    soundEngine.stopMusic();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
