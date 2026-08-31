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
  RadarEntity
} from '../types/game';
import { 
  createV9Motorcycle, 
  createAgentCharacter, 
  createMiniDrone, 
  createGiantCargoDrone 
} from './models';
import { buildVelocityCity, WorldObjects } from './world';
import { soundEngine } from './audio';
import { STORY_MISSION_MIDNIGHT_PROTOTYPE, SIDE_MISSIONS, calculateRank } from './missionEngine';
import {
  SaveDataV1,
  SAVE_DATA_VERSION,
  cloneDefaultStats,
  AUTOSAVE_DEBOUNCE_MS,
  PERIODIC_AUTOSAVE_SEC,
} from './saveManager';

export interface GameState {
  isRiding: boolean;
  isSilentMode: boolean;
  isMiniDroneActive: boolean;
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
  chaosAlertProgress: number; // 0 to 100
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
  private clock: THREE.Clock;

  // City & World Objects
  private world!: WorldObjects;
  private waypointGroup!: THREE.Group;
  private driftParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private refuelParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private gpsRibbonGroup!: THREE.Group;
  private lastLowFuelAlertTime = 0;
  private hasWarnedZeroFuel = false;
  private refuelSoundTimer = 0;
  private hudUpdateTimer = 0;

  // Player & Motorcycle 3D Models
  private motorcycle!: ReturnType<typeof createV9Motorcycle>;
  private agentChar!: ReturnType<typeof createAgentCharacter>;
  private miniDrone!: ReturnType<typeof createMiniDrone>;
  private bossDrone!: ReturnType<typeof createGiantCargoDrone>;

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

  public dronePos = new THREE.Vector3(-60, 2, -48);
  public droneRot = 0;
  public dronePitch = 0;

  // Orbit drag & view control
  public orbitYawOffset = 0;
  public orbitPitchOffset = 0;
  private isPointerDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

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
  private projectiles: { mesh: THREE.Mesh; vel: THREE.Vector3; type: 'emp' | 'foam'; life: number }[] = [];
  private foamBlobs: { mesh: THREE.Mesh; life: number }[] = [];
  private hologramDecoy: THREE.Group | null = null;
  private hologramTimer = 0;

  // Escort out animation state
  private isEscortingOut = false;
  private escortTimer = 0;

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

  constructor(
    container: HTMLElement,
    customization: VehicleCustomization,
    settings: GameSettings,
    savedGame?: SaveDataV1
  ) {
    this.container = container;
    this.customization = customization;
    this.settings = settings;
    this.clock = new THREE.Clock();

    const initialStats: PlayerStats = savedGame?.stats
      ? { ...cloneDefaultStats(), ...savedGame.stats }
      : cloneDefaultStats();

    this.state = {
      isRiding: true, // Start mounted for immediate fun
      isSilentMode: false,
      isMiniDroneActive: false,
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
    };

    // Three.js Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 800);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.initWorld();
    this.setupEventListeners();
    this.setupPointerControls();

    if (savedGame) {
      this.applySave(savedGame);
    }

    this.startLoop();

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

  // ---------------------------------------------------
  // INPUT & VIEW HANDLING
  // ---------------------------------------------------
  private setupPointerControls() {
    // Allows 360 degree drag to look around with mouse/touch
    const dom = this.container;

    const onPointerDown = (e: PointerEvent) => {
      // Ignore if clicking on UI buttons
      if ((e.target as HTMLElement)?.closest('button, input, select, a, .pointer-events-auto')) {
        return;
      }
      this.isPointerDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isPointerDragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      this.orbitYawOffset -= dx * 0.006;
      this.orbitPitchOffset = THREE.MathUtils.clamp(this.orbitPitchOffset + dy * 0.005, -0.4, 0.7);
    };

    const onPointerUp = () => {
      this.isPointerDragging = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  private setupEventListeners() {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger game hotkeys if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = true;
          break;
        case 'Space':
          this.input.jump = true;
          this.handleJumpOrBrake();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.boost = true;
          break;
        case 'KeyE':
          this.handleInteractAction();
          break;
        case 'KeyF':
          this.fireGadget();
          break;
        case 'KeyC':
          this.toggleSilentOrCrouch();
          break;
        case 'KeyV':
          this.cycleCameraMode();
          break;
        case 'KeyR':
          this.resetVehicle();
          break;
        case 'KeyH':
          this.honkHorn();
          break;
        case 'KeyQ':
          this.input.drift = true;
          break;
        case 'Digit1':
          this.switchGadget('emp');
          break;
        case 'Digit2':
          this.switchGadget('foam');
          break;
        case 'Digit3':
          this.switchGadget('drone');
          break;
        case 'Digit4':
          this.switchGadget('hologram');
          break;
        case 'Digit5':
          this.switchGadget('remote_v9');
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = false;
          break;
        case 'Space':
          this.input.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.boost = false;
          break;
        case 'KeyQ':
          this.input.drift = false;
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Resize handler
    const onResize = () => {
      if (!this.container) return;
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    };
    window.addEventListener('resize', onResize);
  }

  // ---------------------------------------------------
  // CAMERA & VIEW MODES
  // ---------------------------------------------------
  public setCameraMode(mode: CameraMode) {
    this.state.cameraMode = mode;
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0;
    soundEngine.playCameraSwitch();
    const modeNames: Record<CameraMode, string> = {
      chase: 'Chase Cam (Dynamic 3rd Person)',
      action: 'Action Cam (Low Cinematic)',
      fpv: 'Cockpit Cam (FPV Handlebars)',
      tactical: 'Tactical Cam (Overhead Map View)',
    };
    this.setNotification(`Camera Mode: ${modeNames[mode]}`);
    this.notifyState();
  }

  public cycleCameraMode() {
    const modes: CameraMode[] = ['chase', 'action', 'fpv', 'tactical'];
    const currentIndex = modes.indexOf(this.state.cameraMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.setCameraMode(nextMode);
  }

  public honkHorn() {
    if (!this.state.isRiding) {
      this.setNotification('Agent V9 acoustic chirp!');
    } else {
      this.setNotification('V9 Dual-Tone Spy Siren!');
    }
    soundEngine.playHorn();
  }

  public resetVehicle() {
    soundEngine.playReset();
    if (this.state.isRiding) {
      // Right the motorcycle upright and place safely
      this.bikeLean = 0;
      this.bikePitch = 0;
      this.bikeSpeed = 0;
      this.bikeVerticalVel = 0;
      this.isBikeGrounded = true;
      this.bikePos.y = 0;
      this.setNotification('Vehicle Righted & Stabilized!');
    } else {
      this.playerVel.set(0, 0, 0);
      this.playerPos.y = 0;
      this.isGrounded = true;
      this.setNotification('Agent Position Stabilized!');
    }
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0;
    this.notifyState();
  }

  // ---------------------------------------------------
  // ACTIONS & INTERACTIONS
  // ---------------------------------------------------
  public handleInteractAction() {
    if (this.isEscortingOut) return;

    // 0. Advance NPC Dialogue if active
    if (this.state.activeNPCDialogue) {
      this.advanceNPCDialogue();
      return;
    }

    // 0.1 Check for Nearby NPC to talk
    const pTarget = this.state.isRiding ? this.bikePos : this.playerPos;
    if (this.world.npcLocals) {
      for (const npc of this.world.npcLocals) {
        if (pTarget.distanceTo(npc.obj.position) < 4.2) {
          this.talkToNPC(npc.data.id);
          return;
        }
      }
    }

    // 1. Mount / Dismount V9
    const distToBike = this.playerPos.distanceTo(this.bikePos);
    if (!this.state.isRiding && distToBike < 4.2 && !this.state.isMiniDroneActive) {
      // Mount
      this.state.isRiding = true;
      this.agentChar.group.visible = false;
      this.motorcycle.riderMesh.visible = true;
      this.setNotification('Mounted V9! Press [W] to Accelerate, [Shift] for Nitro Boost');
      soundEngine.speak('V9 systems online.', 'v9');
      this.requestAutosave();
      this.notifyState();
      return;
    } else if (this.state.isRiding && Math.abs(this.bikeSpeed) < 8) {
      // Dismount
      this.state.isRiding = false;
      this.playerPos.copy(this.bikePos).add(new THREE.Vector3(-1.4, 0, 0));
      this.playerRot = this.bikeRot;
      this.agentChar.group.position.copy(this.playerPos);
      this.agentChar.group.visible = true;
      this.motorcycle.riderMesh.visible = false;
      this.bikeSpeed = 0;
      this.setNotification('Dismounted V9. Ready for on-foot infiltration!');
      this.requestAutosave();
      this.notifyState();
      return;
    }

    // 2. Disguise Lockers
    for (const locker of this.world.lockers) {
      const p = this.state.isRiding ? this.bikePos : this.playerPos;
      if (p.distanceTo(new THREE.Vector3(...locker.position)) < 3.2) {
        this.equipDisguise(locker.disguise as DisguiseType);
        return;
      }
    }

    // 3. Security Terminals (Hacking / Smarts Route)
    for (const term of this.world.terminals) {
      const p = this.state.isRiding ? this.bikePos : this.playerPos;
      if (p.distanceTo(new THREE.Vector3(...term.position)) < 3.5 && !term.hacked) {
        this.hackTerminal(term);
        return;
      }
    }

    // 4. Manual Refueling Trigger at Station
    if (this.state.fuelLevel < 100 && this.world.fuelStations) {
      const p = this.state.isRiding ? this.bikePos : this.playerPos;
      for (const st of this.world.fuelStations) {
        if (p.distanceTo(new THREE.Vector3(...st.position)) < 7.0) {
          this.state.isRefueling = true;
          this.state.fuelLevel = Math.min(100, this.state.fuelLevel + 25);
          soundEngine.playRefuelHum(this.state.fuelLevel);
          this.spawnRefuelParticle(st.position, this.bikePos);
          this.setNotification('⚡ Plasma Refuel Charged +25%');
          this.notifyState();
          return;
        }
      }
    }
  }

  public toggleSilentOrCrouch() {
    if (this.state.isRiding) {
      this.state.isSilentMode = !this.state.isSilentMode;
      this.setNotification(this.state.isSilentMode ? 'Silent Electric Mode: ON (Stealth)' : 'Silent Electric Mode: OFF (Turbo)');
      soundEngine.playJump();
    } else {
      this.isCrouching = !this.isCrouching;
      this.setNotification(this.isCrouching ? 'Crouching / Sneaking' : 'Standing');
    }
    this.notifyState();
  }

  public handleJumpOrBrake() {
    if (this.state.isRiding) {
      if (this.isBikeGrounded) {
        this.bikeVerticalVel = 9.5;
        this.isBikeGrounded = false;
        soundEngine.playJump();
        this.addStuntScore(50, 'SUPER JUMP');
      }
    } else {
      if (this.isGrounded) {
        this.playerVel.y = 7.2;
        this.isGrounded = false;
        soundEngine.playJump();
      }
    }
  }

  public switchGadget(gadget: GadgetType) {
    if (gadget === 'drone') {
      this.toggleMiniDrone();
      return;
    }
    if (gadget === 'remote_v9') {
      this.toggleRemoteV9();
      return;
    }
    this.state.currentGadget = gadget;
    this.setNotification(`Equipped Gadget: ${gadget.toUpperCase()}`);
    soundEngine.playJump();
    this.requestAutosave();
    this.notifyState();
  }

  public toggleMiniDrone() {
    this.state.isMiniDroneActive = !this.state.isMiniDroneActive;
    this.miniDrone.group.visible = this.state.isMiniDroneActive;
    if (this.state.isMiniDroneActive) {
      const basePos = this.state.isRiding ? this.bikePos : this.playerPos;
      this.dronePos.set(basePos.x, basePos.y + 3, basePos.z);
      this.droneRot = this.state.isRiding ? this.bikeRot : this.playerRot;
      this.setNotification('Mini Recon Drone deployed! Scan clues & hack relays from above.');
      soundEngine.speak('Mini drone airborne.', 'v9');
    } else {
      this.setNotification('Mini Drone recalled.');
    }
    this.notifyState();
  }

  public toggleRemoteV9() {
    if (this.state.isRiding) {
      this.setNotification('Must dismount V9 to drive remotely!');
      return;
    }
    this.state.isRemoteV9Active = !this.state.isRemoteV9Active;
    this.setNotification(this.state.isRemoteV9Active ? 'Remote V9 Control: ON (Decoy Mode)' : 'Remote V9 Control: OFF');
    soundEngine.speak(this.state.isRemoteV9Active ? 'Remote control engaged.' : 'Remote control offline.', 'v9');
    this.notifyState();
  }

  public fireGadget() {
    const origin = this.state.isMiniDroneActive
      ? this.dronePos.clone()
      : this.state.isRiding
      ? this.bikePos.clone().add(new THREE.Vector3(0, 0.8, 0))
      : this.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));

    const rot = this.state.isMiniDroneActive
      ? this.droneRot
      : this.state.isRiding
      ? this.bikeRot
      : this.playerRot;

    const dir = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot)).normalize();

    if (this.state.currentGadget === 'emp') {
      soundEngine.playEMP();
      this.setNotification('EMP Shockwave Fired!');

      // Spawn EMP beam mesh
      const empGeo = new THREE.SphereGeometry(0.5, 12, 12);
      const empMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
      const empMesh = new THREE.Mesh(empGeo, empMat);
      empMesh.position.copy(origin);
      this.scene.add(empMesh);
      this.projectiles.push({ mesh: empMesh, vel: dir.clone().multiplyScalar(40), type: 'emp', life: 1.5 });

      // Check immediate EMP disable in radius
      this.applyEMPRadius(origin, 12);
    } else if (this.state.currentGadget === 'foam') {
      soundEngine.playFoam();
      this.setNotification('Foam Blaster Fired! (Traps bots & blocks doors)');

      const foamGeo = new THREE.DodecahedronGeometry(0.6, 1);
      const foamMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.9 });
      const foamMesh = new THREE.Mesh(foamGeo, foamMat);
      foamMesh.position.copy(origin);
      this.scene.add(foamMesh);
      this.projectiles.push({ mesh: foamMesh, vel: dir.clone().multiplyScalar(30), type: 'foam', life: 2 });
    } else if (this.state.currentGadget === 'hologram') {
      this.deployHologramDecoy(origin);
    }
  }

  private applyEMPRadius(pos: THREE.Vector3, radius: number) {
    // 1. Check Guard Bots
    this.world.bots.forEach((b) => {
      if (b.obj.position.distanceTo(pos) < radius) {
        b.data.disabledUntil = Date.now() + 9000;
        b.cone.visible = false;
        this.setNotification(`EMP disabled ${b.data.name}!`);
        this.addXP(60, 'Bot EMP Hack');
      }
    });

    // 2. Check Boss Cargo Drone Relays (Step 5 climax)
    if (this.state.activeMission.currentStepIndex === 4 && this.bossDrone.group.visible) {
      this.bossDrone.relays.forEach((relay, i) => {
        if (!relay.disabled) {
          const worldPos = new THREE.Vector3();
          relay.mesh.getWorldPosition(worldPos);
          if (worldPos.distanceTo(pos) < 14) {
            relay.disabled = true;
            (relay.mesh.material as THREE.MeshBasicMaterial).color.set('#22c55e');
            this.state.bossRelaysRemaining--;
            soundEngine.playMissionComplete();
            this.setNotification(`Relay ${i + 1} Disabled! ${this.state.bossRelaysRemaining} remaining.`);
            this.addXP(250, 'Cargo Drone Relay Overload');

            if (this.state.bossRelaysRemaining <= 0) {
              this.completeStoryMission();
            }
          }
        }
      });
    }
  }

  private deployHologramDecoy(pos: THREE.Vector3) {
    if (this.hologramDecoy) {
      this.scene.remove(this.hologramDecoy);
    }
    const decoy = createAgentCharacter('agent_suit', '#38bdf8');
    decoy.group.position.copy(pos);
    this.scene.add(decoy.group);
    this.hologramDecoy = decoy.group;
    this.hologramTimer = 10; // 10 seconds

    this.setNotification('Hologram Decoy deployed! Guard bots distracted.');
    soundEngine.playAlert();

    // Attract bots toward decoy
    this.world.bots.forEach((b) => {
      b.data.alertLevel = 0;
      b.obj.lookAt(pos);
    });
  }

  public equipDisguise(disguise: DisguiseType) {
    this.state.currentDisguise = disguise;
    this.updateCustomization(this.customization);
    const disguiseNames: Record<DisguiseType, string> = {
      agent_suit: 'Agent Stealth Suit',
      delivery_worker: 'Velocity Courier Uniform',
      maintenance_tech: 'Technician Safety Outfit',
      lab_scientist: 'Research Lab Coat',
      race_crew: 'Velocity Grand Prix Crew',
    };
    this.setNotification(`Equipped Disguise: ${disguiseNames[disguise]}! Guards in designated zones won't suspect you.`);
    soundEngine.playCollectible();
    this.requestAutosave();
    this.notifyState();
  }

  public hackTerminal(term: WorldObjects['terminals'][0]) {
    term.hacked = true;
    (term.mesh.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: '#22c55e' });
    soundEngine.playMissionComplete();
    this.addXP(150, 'Security Terminal Hack (Smarts)');

    if (term.id === 'term_museum_dock') {
      this.world.museumLaserGate.visible = false;
      this.setNotification('Museum Security Laser Gate Deactivated! Loading dock unlocked.');
      this.checkMissionStepComplete('step_2_scan_dock', 'smarts');
    } else if (term.id === 'term_station_crane') {
      this.world.stationCraneGate.position.y += 6;
      this.setNotification('Station Gantry Crane Raised! Warehouse entrance open.');
      this.checkMissionStepComplete('step_4_infiltrate_station', 'smarts');
    } else {
      this.setNotification('Plaza Hologram Node activated! CHAOS alerts cleared.');
      this.state.chaosAlertLevel = 0;
      this.state.chaosAlertProgress = 0;
    }
    this.requestAutosave();
    this.notifyState();
  }

  // ---------------------------------------------------
  // MAIN UPDATE SIMULATION LOOP
  // ---------------------------------------------------
  private startLoop() {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private update(dt: number) {
    if (this.isEscortingOut) {
      this.updateEscortOut(dt);
      return;
    }

    // 1. Update Projectiles & Foam
    this.updateProjectiles(dt);

    // 2. Controller Update
    if (this.state.isMiniDroneActive) {
      this.updateMiniDrone(dt);
    } else if (this.state.isRiding || this.state.isRemoteV9Active) {
      this.updateMotorcycle(dt);
      if (!this.state.isRiding) {
        this.updateAgentOnFoot(dt);
      }
    } else {
      this.updateAgentOnFoot(dt);
    }

    // 3. Update Camera
    this.updateCamera(dt);

    // 4. Update Stealth & Security Bots
    this.updateSecurityBots(dt);

    // 5. Update World Collectibles & Stunt Rings
    this.updateWorldInteractions(dt);

    // 6. Update Fuel Stations & Refueling
    this.updateFuelStationsAndRefueling(dt);

    // 7. Mission Check & Boss Drone Update
    this.updateMissionLogic(dt);

    // 8. Update Autonomous City Traffic Vehicles
    this.updateTrafficVehicles(dt);

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
      this.syncRadarEntities();
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

  private updateTrafficVehicles(dt: number) {
    if (!this.world || !this.world.trafficVehicles) return;

    this.world.trafficVehicles.forEach((veh) => {
      if (veh.route.length < 2) return;

      const p1 = veh.route[veh.routeIndex];
      const nextIdx = (veh.routeIndex + 1) % veh.route.length;
      const p2 = veh.route[nextIdx];

      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const segDist = Math.hypot(dx, dz) || 1;

      // Advance along path
      veh.progress += (veh.speed * dt) / segDist;
      if (veh.progress >= 1.0) {
        veh.progress -= 1.0;
        veh.routeIndex = nextIdx;
      }

      // Interpolate position
      const curX = THREE.MathUtils.lerp(p1[0], p2[0], veh.progress);
      const curZ = THREE.MathUtils.lerp(p1[1], p2[1], veh.progress);
      veh.obj.position.x = curX;
      veh.obj.position.z = curZ;

      // Realistic Heading Direction
      const targetAngle = Math.atan2(dx, dz) + Math.PI;
      let rotDiff = targetAngle - veh.obj.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      veh.obj.rotation.y += rotDiff * Math.min(1, dt * 6);

      // Spin Wheels
      veh.wheels.forEach((w) => {
        w.rotation.x += veh.speed * dt * 2.4;
      });

      // Player Collision / Proximity Check
      const activePlayerPos = this.state.isRiding ? this.bikePos : this.playerPos;
      const distToPlayer = veh.obj.position.distanceTo(activePlayerPos);
      if (distToPlayer < 3.2) {
        // Subtle deflection feedback
        const pushDir = activePlayerPos.clone().sub(veh.obj.position).normalize();
        pushDir.y = 0;
        if (this.state.isRiding) {
          this.bikePos.add(pushDir.multiplyScalar(dt * 8));
          this.bikeSpeed *= 0.85;
        }
      }
    });
  }

  private syncRadarEntities() {
    const entities: RadarEntity[] = [];

    // 1. Player Agent Position
    entities.push({
      id: 'agent_player',
      type: 'player',
      x: this.playerPos.x,
      z: this.playerPos.z,
      rot: this.playerRot,
      label: 'Agent V9',
    });

    // 2. V9 Motorcycle Position
    entities.push({
      id: 'v9_motorcycle',
      type: 'bike',
      x: this.bikePos.x,
      z: this.bikePos.z,
      rot: this.bikeRot,
      label: 'V9 Turbo',
    });

    // 3. Mini Recon Drone
    if (this.state.isMiniDroneActive) {
      entities.push({
        id: 'mini_drone',
        type: 'drone',
        x: this.dronePos.x,
        z: this.dronePos.z,
        rot: this.droneRot,
        label: 'Recon Drone',
      });
    }

    // 4. Threat Guard Bots
    if (this.world && this.world.bots) {
      this.world.bots.forEach((bot) => {
        entities.push({
          id: bot.data.id,
          type: 'bot',
          x: bot.obj.position.x,
          z: bot.obj.position.z,
          rot: bot.obj.rotation.y,
          label: bot.data.name,
          alert: bot.data.alertLevel,
        });
      });
    }

    // 5. Security Cameras
    if (this.world && this.world.cameras) {
      this.world.cameras.forEach((cam) => {
        if (!cam.disabled) {
          entities.push({
            id: cam.id,
            type: 'camera',
            x: cam.position[0],
            z: cam.position[2],
            rot: cam.obj.rotation.y,
            label: 'Surveillance Cam',
          });
        }
      });
    }

    // 6. Cyber Fuel & Plasma Stations
    if (this.world && this.world.fuelStations) {
      this.world.fuelStations.forEach((fs) => {
        entities.push({
          id: fs.id,
          type: 'fuel',
          x: fs.position[0],
          z: fs.position[2],
          label: fs.name,
        });
      });
    }

    // 7. Autonomous Traffic Vehicles
    if (this.world && this.world.trafficVehicles) {
      this.world.trafficVehicles.forEach((tv) => {
        entities.push({
          id: tv.id,
          type: 'traffic',
          x: tv.obj.position.x,
          z: tv.obj.position.z,
          rot: tv.obj.rotation.y,
          style: tv.style,
        });
      });
    }

    // 8. Interactive Terminals & Lockers
    if (this.world && this.world.terminals) {
      this.world.terminals.forEach((term) => {
        entities.push({
          id: term.id,
          type: 'terminal',
          x: term.position[0],
          z: term.position[2],
          status: term.hacked ? 'hacked' : 'active',
          label: term.name,
        });
      });
    }

    // 9. Active Mission Objective
    const mission = this.state.activeMission;
    if (mission && !mission.completed) {
      const curStep = mission.steps[mission.currentStepIndex];
      if (curStep) {
        this.state.activeTargetPos = curStep.targetPosition;
        entities.push({
          id: 'mission_objective',
          type: 'objective',
          x: curStep.targetPosition[0],
          z: curStep.targetPosition[2],
          label: curStep.title,
        });
      }
    }

    // 10. NPC Locals & Quest Givers
    if (this.world && this.world.npcLocals) {
      this.world.npcLocals.forEach((npc) => {
        entities.push({
          id: npc.data.id,
          type: 'npc',
          x: npc.obj.position.x,
          z: npc.obj.position.z,
          rot: npc.obj.rotation.y,
          label: npc.data.name,
          style: npc.data.avatarColor,
        });
      });
    }

    // 11. City POIs
    if (this.world && this.world.cityPOIs) {
      this.world.cityPOIs.forEach((poi) => {
        entities.push({
          id: poi.id,
          type: 'poi',
          x: poi.position[0],
          z: poi.position[2],
          label: poi.name,
          category: poi.category,
        });
      });
    }

    this.state.radarEntities = entities;
  }

  private updateMotorcycle(dt: number) {
    const isControlActive = this.state.isRiding || this.state.isRemoteV9Active;
    const isOutOfFuel = this.state.fuelLevel <= 0;

    // Acceleration & Speed limits based on fuel and boost
    const accel = isOutOfFuel ? 7 : this.state.isBoosting ? 40 : 24;
    const maxSpeed = isOutOfFuel ? 6 : this.state.isBoosting ? 45 : 28;
    const reverseMax = isOutOfFuel ? -4 : -12;

    // Nitro consumption/recharge (only if has fuel)
    if (this.input.boost && isControlActive && this.state.nitroLevel > 0 && !isOutOfFuel) {
      this.state.nitroLevel = Math.max(0, this.state.nitroLevel - dt * 25);
      if (Math.random() < 0.3) soundEngine.playNitro();
    } else {
      this.state.nitroLevel = Math.min(100, this.state.nitroLevel + dt * 10);
    }

    // Fuel Consumption Calculation
    if (isControlActive && Math.abs(this.bikeSpeed) > 0.4 && !this.state.isRefueling) {
      let fuelBurnRate = 1.1 + (Math.abs(this.bikeSpeed) / 28) * 1.5;
      if (this.state.isBoosting) {
        fuelBurnRate += 3.2;
      }
      if (this.state.isSilentMode) {
        fuelBurnRate *= 0.45; // Silent electric eco mode
      }
      if (this.isDrifting) {
        fuelBurnRate += 0.7;
      }

      this.state.fuelLevel = Math.max(0, this.state.fuelLevel - fuelBurnRate * dt);

      // Low fuel warning beep & Kira audio
      if (this.state.fuelLevel <= 20 && this.state.fuelLevel > 0) {
        const now = Date.now();
        if (now - this.lastLowFuelAlertTime > 15000) {
          this.lastLowFuelAlertTime = now;
          soundEngine.playLowFuelBeep();
          if (this.state.fuelLevel <= 15) {
            soundEngine.speak('Caution Agent. Energy cell low. Check radar for nearest fuel station.', 'kira');
            this.setNotification('⚠️ V9 Energy Cells Critical (<20%)! Locate a Cyber Fuel Station.');
          }
        }
      } else if (this.state.fuelLevel <= 0 && !this.hasWarnedZeroFuel) {
        this.hasWarnedZeroFuel = true;
        soundEngine.speak('V9 Energy Cells depleted! Auxiliary solar crawl mode engaged.', 'kira');
        this.setNotification('⚠️ V9 Fuel Empty! Emergency Solar Crawl Active (13 MPH Max).');
      }
    }

    // Acceleration & Braking (Supports Keyboard & Virtual Joystick Analog Input)
    if (isControlActive) {
      const throttleInput = this.input.analogThrottle !== 0 
        ? this.input.analogThrottle 
        : this.input.forward ? 1 : this.input.backward ? -1 : 0;

      if (throttleInput > 0) {
        this.bikeSpeed = Math.min(maxSpeed, this.bikeSpeed + accel * throttleInput * dt);
      } else if (throttleInput < 0) {
        if (this.bikeSpeed > 0) {
          this.bikeSpeed = Math.max(0, this.bikeSpeed - 38 * Math.abs(throttleInput) * dt); // Brake
        } else {
          this.bikeSpeed = Math.max(reverseMax, this.bikeSpeed - 16 * Math.abs(throttleInput) * dt); // Reverse
        }
      } else {
        // Natural friction drag
        this.bikeSpeed *= Math.pow(0.92, dt * 60);
      }

      // Drift / Powerslide Mechanic
      const isDriftAction = this.input.drift || (this.input.jump && (this.input.left || this.input.right || Math.abs(this.input.analogSteer) > 0.2));
      this.isDrifting = isDriftAction && Math.abs(this.bikeSpeed) > 8;
      this.state.isDrifting = this.isDrifting;

      if (this.isDrifting) {
        if (Math.random() < 0.25) {
          soundEngine.playDrift();
          this.spawnDriftParticle();
        }
        this.addStuntScore(Math.round(dt * 25), 'CYBER DRIFT');
      }

      // Steering (Keyboard + Analog Joystick)
      let steerVal = 0;
      if (this.input.analogSteer !== 0) {
        steerVal = -this.input.analogSteer;
      } else if (this.input.left) {
        steerVal = 1;
      } else if (this.input.right) {
        steerVal = -1;
      }

      let steerSpeed = (3.4 * (1 + this.settings.steeringAssist * 0.45)) * Math.sign(this.bikeSpeed || 1);
      if (this.isDrifting) {
        steerSpeed *= 1.6;
      }

      if (steerVal !== 0) {
        const speedFactor = Math.min(1, Math.abs(this.bikeSpeed) / 5);
        this.bikeRot += steerSpeed * steerVal * dt * speedFactor;
        const targetLean = this.isDrifting ? steerVal * 0.58 : steerVal * 0.42;
        this.bikeLean = THREE.MathUtils.lerp(this.bikeLean, targetLean, dt * (this.isDrifting ? 12 : 8));
      } else {
        this.bikeLean = THREE.MathUtils.lerp(this.bikeLean, 0, dt * 10);
      }
    } else {
      this.bikeSpeed *= 0.9;
      this.isDrifting = false;
      this.state.isDrifting = false;
    }

    this.state.steerAngleDeg = Math.round(this.bikeLean * 55);

    // Gravity & Super Jump
    if (!this.isBikeGrounded) {
      this.bikeVerticalVel -= 22 * dt;
      this.bikePos.y += this.bikeVerticalVel * dt;
      if (this.bikePos.y <= 0) {
        this.bikePos.y = 0;
        this.bikeVerticalVel = 0;
        this.isBikeGrounded = true;
      }
    }

    // Position displacement
    const forwardX = -Math.sin(this.bikeRot) * this.bikeSpeed * dt;
    const forwardZ = -Math.cos(this.bikeRot) * this.bikeSpeed * dt;
    this.bikePos.x += forwardX;
    this.bikePos.z += forwardZ;

    // Check Stunt Ramps Collision
    const bikeBox = new THREE.Box3().setFromCenterAndSize(this.bikePos, new THREE.Vector3(1.5, 1.5, 2.5));
    for (const ramp of this.world.stuntRamps) {
      if (ramp.box.intersectsBox(bikeBox) && this.bikeSpeed > 13) {
        this.bikeVerticalVel = 14.5 * ramp.boostForce;
        this.isBikeGrounded = false;
        soundEngine.playJump();
        this.addStuntScore(150, 'MEGA RAMP LAUNCH');
      }
    }

    // Boundary limits
    this.bikePos.x = THREE.MathUtils.clamp(this.bikePos.x, -165, 165);
    this.bikePos.z = THREE.MathUtils.clamp(this.bikePos.z, -165, 165);

    // Apply to 3D Motorcycle Object
    this.motorcycle.group.position.copy(this.bikePos);
    this.motorcycle.group.rotation.y = this.bikeRot;
    this.motorcycle.group.rotation.z = this.bikeLean;

    // Spin wheels
    const spin = (this.bikeSpeed * dt) / 0.38;
    this.motorcycle.frontWheel.rotation.x += spin;
    this.motorcycle.backWheel.rotation.x += spin;

    // Update drift particles
    this.updateDriftParticles(dt);
  }

  private spawnDriftParticle() {
    const geo = new THREE.SphereGeometry(0.12, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? '#38bdf8' : '#00f2fe' });
    const p = new THREE.Mesh(geo, mat);

    // Spawn at rear wheel
    const rearPos = this.bikePos.clone().add(new THREE.Vector3(Math.sin(this.bikeRot) * 1.2, 0.15, Math.cos(this.bikeRot) * 1.2));
    p.position.copy(rearPos);
    this.scene.add(p);

    const vel = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3);
    this.driftParticles.push({ mesh: p, vel, life: 0.4 });
  }

  private updateDriftParticles(dt: number) {
    for (let i = this.driftParticles.length - 1; i >= 0; i--) {
      const part = this.driftParticles[i];
      part.mesh.position.add(part.vel.clone().multiplyScalar(dt));
      part.life -= dt;
      if (part.life <= 0) {
        this.scene.remove(part.mesh);
        this.driftParticles.splice(i, 1);
      }
    }
  }

  private updateAgentOnFoot(dt: number) {
    const moveSpeed = this.isSprinting ? 11 : this.isCrouching ? 3.5 : 6.5;
    const moveDir = new THREE.Vector3();

    if (this.input.forward || this.input.analogThrottle > 0.2) moveDir.z -= (this.input.forward ? 1 : this.input.analogThrottle);
    if (this.input.backward || this.input.analogThrottle < -0.2) moveDir.z += (this.input.backward ? 1 : -this.input.analogThrottle);
    if (this.input.left || this.input.analogSteer < -0.2) moveDir.x -= (this.input.left ? 1 : -this.input.analogSteer);
    if (this.input.right || this.input.analogSteer > 0.2) moveDir.x += (this.input.right ? 1 : this.input.analogSteer);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Rotate moveDir to camera orientation
      const camAngle = Math.atan2(this.camera.position.x - this.playerPos.x, this.camera.position.z - this.playerPos.z);
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);

      this.playerPos.x += moveDir.x * moveSpeed * dt;
      this.playerPos.z += moveDir.z * moveSpeed * dt;

      const targetAngle = Math.atan2(-moveDir.x, -moveDir.z);
      this.playerRot = THREE.MathUtils.lerp(this.playerRot, targetAngle, dt * 12);

      // Walking leg animation
      const walkTime = this.clock.getElapsedTime() * (moveSpeed * 1.5);
      this.agentChar.leftLeg.rotation.x = Math.sin(walkTime) * 0.6;
      this.agentChar.rightLeg.rotation.x = -Math.sin(walkTime) * 0.6;
      this.agentChar.leftArm.rotation.x = -Math.sin(walkTime) * 0.5;
      this.agentChar.rightArm.rotation.x = Math.sin(walkTime) * 0.5;

      // Noise generator
      this.state.stealthNoise = this.isCrouching ? 5 : this.isSprinting ? 75 : 30;
    } else {
      this.agentChar.leftLeg.rotation.x = 0;
      this.agentChar.rightLeg.rotation.x = 0;
      this.agentChar.leftArm.rotation.x = 0;
      this.agentChar.rightArm.rotation.x = 0;
      this.state.stealthNoise = 0;
    }

    // Agent Gravity
    if (!this.isGrounded) {
      this.playerVel.y -= 20 * dt;
      this.playerPos.y += this.playerVel.y * dt;
      if (this.playerPos.y <= 0) {
        this.playerPos.y = 0;
        this.playerVel.y = 0;
        this.isGrounded = true;
      }
    }

    this.agentChar.group.position.copy(this.playerPos);
    this.agentChar.group.rotation.y = this.playerRot;
    this.agentChar.group.scale.y = this.isCrouching ? 0.7 : 1;
  }

  private updateMiniDrone(dt: number) {
    const droneSpeed = 16;
    if (this.input.forward || this.input.analogThrottle > 0.2) {
      this.dronePos.x -= Math.sin(this.droneRot) * droneSpeed * dt;
      this.dronePos.z -= Math.cos(this.droneRot) * droneSpeed * dt;
    }
    if (this.input.backward || this.input.analogThrottle < -0.2) {
      this.dronePos.x += Math.sin(this.droneRot) * droneSpeed * dt;
      this.dronePos.z += Math.cos(this.droneRot) * droneSpeed * dt;
    }
    if (this.input.left || this.input.analogSteer < -0.2) this.droneRot += 2.8 * dt;
    if (this.input.right || this.input.analogSteer > 0.2) this.droneRot -= 2.8 * dt;
    if (this.input.jump) this.dronePos.y = Math.min(35, this.dronePos.y + 12 * dt);
    if (this.input.sneak) this.dronePos.y = Math.max(1, this.dronePos.y - 12 * dt);

    this.miniDrone.group.position.copy(this.dronePos);
    this.miniDrone.group.rotation.y = this.droneRot;

    // Spin drone propellers
    this.miniDrone.rotors.forEach((r) => (r.rotation.y += 0.8));
  }

  private updateCamera(dt: number) {
    const target = this.state.isMiniDroneActive
      ? this.dronePos
      : this.state.isRiding
      ? this.bikePos
      : this.playerPos;

    const baseRot = this.state.isMiniDroneActive
      ? this.droneRot
      : this.state.isRiding
      ? this.bikeRot
      : this.playerRot;

    // Auto-recenter orbit view smoothly while actively moving
    const isMoving = this.input.forward || this.input.backward || Math.abs(this.input.analogThrottle) > 0.2 || Math.abs(this.bikeSpeed) > 4;
    if (isMoving && !this.isPointerDragging) {
      this.orbitYawOffset = THREE.MathUtils.lerp(this.orbitYawOffset, 0, dt * 2.5);
      this.orbitPitchOffset = THREE.MathUtils.lerp(this.orbitPitchOffset, 0, dt * 2.5);
    }

    const effectiveRot = baseRot + this.orbitYawOffset;
    const mode = this.state.cameraMode;

    let dist = 7.5;
    let height = 3.0;
    let lookHeight = 1.3;

    if (this.state.isMiniDroneActive) {
      dist = 4.5;
      height = 1.8;
      lookHeight = 0.5;
    } else if (mode === 'action') {
      // Low, cinematic action angle showing bike suspension and flames
      dist = 4.8;
      height = 1.6;
      lookHeight = 1.1;
    } else if (mode === 'fpv') {
      // Cockpit / Handlebars First Person Perspective
      dist = -0.3;
      height = this.state.isRiding ? 1.38 : 1.7;
      lookHeight = 1.35;
    } else if (mode === 'tactical') {
      // Overhead Bird's-Eye Tactical Map view
      dist = 28.0;
      height = 36.0;
      lookHeight = 0.0;
    } else {
      // Default 'chase' view
      dist = this.state.isRiding ? 7.6 : 5.4;
      height = this.state.isRiding ? 3.0 : 2.4;
      lookHeight = 1.3;
    }

    const pitchBonus = mode === 'tactical' ? 0 : this.orbitPitchOffset * 5.0;
    const targetCamX = target.x + Math.sin(effectiveRot) * dist;
    const targetCamZ = target.z + Math.cos(effectiveRot) * dist;
    const targetCamY = Math.max(0.6, target.y + height + pitchBonus);

    // Vibration at high speed for FPV mode
    let vibX = 0;
    let vibY = 0;
    if (mode === 'fpv' && Math.abs(this.bikeSpeed) > 15) {
      vibX = (Math.random() - 0.5) * 0.04;
      vibY = (Math.random() - 0.5) * 0.04;
    }

    const targetPos = new THREE.Vector3(targetCamX + vibX, targetCamY + vibY, targetCamZ);
    const lerpSpeed = mode === 'fpv' ? 22 : 9;
    this.camera.position.lerp(targetPos, dt * lerpSpeed);

    if (mode === 'fpv') {
      // Look straight ahead in direction of vehicle
      const lookTargetX = target.x - Math.sin(effectiveRot) * 20;
      const lookTargetZ = target.z - Math.cos(effectiveRot) * 20;
      this.camera.lookAt(lookTargetX, target.y + lookHeight, lookTargetZ);
    } else {
      this.camera.lookAt(target.x, target.y + lookHeight, target.z);
    }

    // Dynamic FOV on boost / speed
    const baseFOV = mode === 'action' ? 70 : mode === 'fpv' ? 76 : 65;
    const boostFOVBonus = this.state.isBoosting ? 14 : Math.min(10, Math.abs(this.bikeSpeed) / 4);
    const targetFOV = baseFOV + boostFOVBonus;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 6);
    this.camera.updateProjectionMatrix();
  }

  private updateSecurityBots(dt: number) {
    const playerTarget = this.state.isRiding ? this.bikePos : this.playerPos;
    const isDisguisedInMuseum = this.state.currentDisguise === 'maintenance_tech' || this.state.currentDisguise === 'lab_scientist';
    const isDisguisedInStation = this.state.currentDisguise === 'race_crew' || this.state.currentDisguise === 'delivery_worker';

    this.world.bots.forEach((bot) => {
      // Disabled state
      if (Date.now() < bot.data.disabledUntil) {
        bot.cone.visible = false;
        return;
      }
      bot.cone.visible = true;

      // Patrol movement
      if (bot.data.patrolPoints && bot.data.patrolPoints.length > 1) {
        const targetPt = bot.data.patrolPoints[bot.data.currentPatrolIndex || 0];
        const tVec = new THREE.Vector3(...targetPt);
        const dist = bot.obj.position.distanceTo(tVec);

        if (dist < 0.6) {
          bot.data.currentPatrolIndex = ((bot.data.currentPatrolIndex || 0) + 1) % bot.data.patrolPoints.length;
        } else {
          const pDir = tVec.clone().sub(bot.obj.position).normalize();
          bot.obj.position.add(pDir.multiplyScalar(2.2 * dt));
          bot.obj.rotation.y = Math.atan2(pDir.x, pDir.z);
        }
      }

      // Detection Check
      const distToPlayer = bot.obj.position.distanceTo(playerTarget);
      const isEffectiveSilent = this.state.isRiding && this.state.isSilentMode;
      const detectDist = isEffectiveSilent ? bot.data.viewDistance * 0.5 : bot.data.viewDistance;

      if (distToPlayer < detectDist) {
        const toPlayer = playerTarget.clone().sub(bot.obj.position).normalize();
        const botFacing = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bot.obj.rotation.y);
        const angle = botFacing.angleTo(toPlayer);

        const inVisionCone = angle < THREE.MathUtils.degToRad(bot.data.viewAngle / 2);
        const isExempt = (bot.data.id.includes('museum') && isDisguisedInMuseum) || (bot.data.id.includes('station') && isDisguisedInStation);

        if (inVisionCone && !isExempt) {
          bot.data.alertLevel = Math.min(1, bot.data.alertLevel + dt * 1.5);
          (bot.cone.material as THREE.MeshBasicMaterial).color.set('#ef4444');
          (bot.cone.material as THREE.MeshBasicMaterial).opacity = 0.45;

          if (bot.data.alertLevel >= 1 && !this.isEscortingOut) {
            this.triggerEscortOut(bot.data.name);
          }
        } else {
          bot.data.alertLevel = Math.max(0, bot.data.alertLevel - dt * 0.8);
          (bot.cone.material as THREE.MeshBasicMaterial).color.set('#38bdf8');
          (bot.cone.material as THREE.MeshBasicMaterial).opacity = 0.15;
        }
      }
    });

    // Update Overall CHAOS Alert level
    const maxBotAlert = Math.max(0, ...this.world.bots.map((b) => b.data.alertLevel));
    this.state.stealthVisibility = Math.round(maxBotAlert * 100);
    this.state.chaosAlertProgress = Math.round(maxBotAlert * 100);
    if (this.state.chaosAlertProgress > 75 && this.state.chaosAlertLevel < 2) {
      this.state.chaosAlertLevel = 2;
      this.requestAutosave();
    }
  }

  private triggerEscortOut(guardName: string) {
    this.isEscortingOut = true;
    this.escortTimer = 3.5;
    soundEngine.playEscortOut();
    soundEngine.speak('Hold on there agent! Escorting you back outside the perimeter.', 'guard');
    this.setNotification(`Spotted by ${guardName}! Guard humorously escorting you outside.`);
    this.state.radioMessage = {
      sender: guardName,
      text: 'Hey! Unauthorized personnel must stay outside the loading perimeter. Try putting on a technician disguise or finding another way in!',
      time: Date.now(),
    };
    this.notifyState();
  }

  private updateEscortOut(dt: number) {
    this.escortTimer -= dt;
    // Fade / move smoothly back to safe sidewalk
    const safeSidewalk = new THREE.Vector3(0, 0, -50);
    this.playerPos.lerp(safeSidewalk, dt * 3);
    this.bikePos.lerp(safeSidewalk.clone().add(new THREE.Vector3(2, 0, 0)), dt * 3);

    if (this.escortTimer <= 0) {
      this.isEscortingOut = false;
      this.world.bots.forEach((b) => (b.data.alertLevel = 0));
      this.setNotification('Back outside! Choose your path: Speed (ramps), Stealth (disguise/vent), or Smarts (gadgets)!');
      this.notifyState();
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateWorldInteractions(dt: number) {
    const playerTarget = this.state.isRiding ? this.bikePos : this.playerPos;

    // 1. Collectibles (Spy Drives)
    this.world.collectibles.forEach((c) => {
      if (!c.collected && playerTarget.distanceTo(new THREE.Vector3(...c.position)) < 3.2) {
        c.collected = true;
        this.state.stats.secretsFound++;
        soundEngine.playCollectible();
        this.addXP(100, `Found Secret: ${c.name}`);
        this.setNotification(`Secret Found: ${c.name}! (${this.state.stats.secretsFound}/6)`);
        this.requestAutosave();
        // Remove 3D mesh
        const mesh = this.scene.getObjectByName(c.id);
        if (mesh) this.scene.remove(mesh);
      }
    });

    // 2. Stunt Rings
    this.world.stuntRings.forEach((r) => {
      r.mesh.rotation.y += 1.5 * dt;
      if (!r.collected && this.state.isRiding && this.bikePos.distanceTo(new THREE.Vector3(...r.position)) < 4.5) {
        r.collected = true;
        soundEngine.playMissionComplete();
        this.addStuntScore(200, 'HOOP STUNT MASTER');
        this.state.nitroLevel = 100;
        this.state.fuelLevel = Math.min(100, this.state.fuelLevel + 25);
        this.setNotification('STUNT RING CLEARED! Full Nitro + 25% Energy Refill!');
        (r.mesh.material as THREE.MeshBasicMaterial).color.set('#22c55e');
        this.requestAutosave();
      }
    });

    // 3. NPC Locals and Pedestrians
    let nearestNPCNearby: NPCLocal | null = null;
    let minNPCDist = 4.2;

    if (this.world.npcLocals) {
      this.world.npcLocals.forEach((npc) => {
        const dist = playerTarget.distanceTo(npc.obj.position);

        // Check proximity for interaction prompt
        if (dist < minNPCDist) {
          minNPCDist = dist;
          nearestNPCNearby = npc.data;
        }

        // Animate quest marker floating
        if (npc.questIcon) {
          npc.questIcon.rotation.y += 2.5 * dt;
          npc.questIcon.position.y = 2.4 + Math.sin(this.clock.getElapsedTime() * 4) * 0.15;
        }

        // Animate pedestrians walking along sidewalk routes
        if (npc.isPedestrian && npc.patrolRoute && npc.patrolRoute.length > 1) {
          const pRoute = npc.patrolRoute;
          const curIdx = npc.patrolIndex || 0;
          const nextIdx = (curIdx + 1) % pRoute.length;
          const targetPt = pRoute[nextIdx];
          const tVec = new THREE.Vector3(targetPt[0], 0.22, targetPt[1]);

          const pDist = npc.obj.position.distanceTo(tVec);
          if (pDist < 0.6) {
            npc.patrolIndex = nextIdx;
          } else {
            const pDir = tVec.clone().sub(npc.obj.position).normalize();
            npc.obj.position.add(pDir.multiplyScalar(2.0 * dt));
            npc.obj.rotation.y = Math.atan2(pDir.x, pDir.z);

            // Procedural walking limb animation
            const walkCycle = this.clock.getElapsedTime() * 7;
            npc.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
            npc.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
            npc.leftArm.rotation.x = -Math.sin(walkCycle) * 0.4;
            npc.rightArm.rotation.x = Math.sin(walkCycle) * 0.4;
          }
        }
      });
    }

    if (nearestNPCNearby) {
      if (this.state.nearInteraction !== 'talk') {
        this.state.nearInteraction = 'talk';
      }
    } else if (this.state.nearInteraction === 'talk') {
      this.state.nearInteraction = null;
    }

    // 4. Update GPS Route Progress & Distance
    if (this.state.activeGPSRoute) {
      const destVec = new THREE.Vector3(...this.state.activeGPSRoute.targetPos);
      const distToDest = playerTarget.distanceTo(destVec);
      this.state.activeGPSRoute.totalDistance = Math.round(distToDest);
      this.state.activeGPSRoute.etaSeconds = Math.max(2, Math.round(distToDest / (this.state.isRiding ? 22 : 6)));
      this.state.activeGPSRoute.nextTurnInstruction = this.calculateNextTurnInstruction(playerTarget, this.state.activeGPSRoute.waypoints);

      if (distToDest < 6.0) {
        soundEngine.playWaypoint();
        this.setNotification(`🎯 Arrived at GPS Destination: ${this.state.activeGPSRoute.destinationName}`);
        this.clearGPSRoute();
      }
    }
  }

  private updateFuelStationsAndRefueling(dt: number) {
    const time = this.clock.getElapsedTime();
    const playerTarget = this.state.isRiding ? this.bikePos : this.playerPos;

    let nearestStation: { name: string; distance: number; position: [number, number, number] } | null = null;
    let minDistance = Infinity;
    let inStationRange = false;
    let activeStationObj: WorldObjects['fuelStations'][0] | null = null;

    if (this.world.fuelStations) {
      this.world.fuelStations.forEach((station) => {
        // 1. Animate Station Holographic Fuel Icon & Pulse Rings
        if (station.holoIcon) {
          station.holoIcon.rotation.y += 2.0 * dt;
          station.holoIcon.position.y = 5.4 + Math.sin(time * 2.6) * 0.25;
        }

        if (station.pulseRing) {
          const ringScale = 1.0 + (Math.sin(time * 3.5) + 1.0) * 0.12;
          station.pulseRing.scale.set(ringScale, ringScale, ringScale);
        }

        // 2. Distance checks
        const sPos = new THREE.Vector3(...station.position);
        const dist = playerTarget.distanceTo(sPos);

        if (dist < minDistance) {
          minDistance = dist;
          nearestStation = {
            name: station.name,
            distance: Math.round(dist),
            position: station.position,
          };
        }

        // Check proximity to recharge pad (radius ~6.8m)
        if (dist < 6.8) {
          inStationRange = true;
          activeStationObj = station;
        }
      });
    }

    this.state.nearestFuelStation = nearestStation;

    // 3. Handle Refueling on Station Pad
    if (inStationRange && activeStationObj) {
      if (this.state.fuelLevel < 100) {
        this.state.nearInteraction = 'refuel';

        // Auto-refuel when slow/stopped or holding interact
        const isStationaryOrManual = Math.abs(this.bikeSpeed) < 12 || this.input.interact || !this.state.isRiding;

        if (isStationaryOrManual) {
          this.state.isRefueling = true;
          this.state.fuelLevel = Math.min(100, this.state.fuelLevel + dt * 32); // Fast full recharge in ~3.1s
          this.state.refuelProgress = Math.round(this.state.fuelLevel);
          this.hasWarnedZeroFuel = false;

          // Sound effect
          this.refuelSoundTimer += dt;
          if (this.refuelSoundTimer > 0.08) {
            soundEngine.playRefuelHum(this.state.fuelLevel);
            this.refuelSoundTimer = 0;
          }

          // Spawn visual plasma charging particles flowing from station dispenser to bike
          this.spawnRefuelParticle(activeStationObj.position, this.bikePos);

          if (this.state.fuelLevel >= 100) {
            this.state.fuelLevel = 100;
            this.state.isRefueling = false;
            soundEngine.playRefuelComplete();
            this.addXP(25, 'V9 Plasma Fast-Charge');
            this.setNotification('⚡ V9 Energy Cells 100% Fully Charged! (+25 XP)');
            soundEngine.speak('V9 energy cells fully restored and stabilized!', 'kira');
          }
        } else {
          this.state.isRefueling = false;
        }
      } else {
        if (this.state.isRefueling) this.state.isRefueling = false;
      }
    } else {
      if (this.state.isRefueling) this.state.isRefueling = false;
      if (this.state.nearInteraction === 'refuel') {
        this.state.nearInteraction = null;
      }
    }

    // 4. Update Plasma Refuel Particles
    this.updateRefuelParticles(dt);
  }

  private spawnRefuelParticle(fromPos: [number, number, number], toPos: THREE.Vector3) {
    if (this.refuelParticles.length > 25) return;
    const geo = new THREE.SphereGeometry(0.14, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.6 ? '#10b981' : '#00f2fe',
      transparent: true,
      opacity: 0.9,
    });
    const p = new THREE.Mesh(geo, mat);

    // Start from station dispenser / pump
    const pumpSource = new THREE.Vector3(fromPos[0], fromPos[1] + 2.2, fromPos[2] - 1.4);
    p.position.copy(pumpSource);

    // Direct velocity towards motorcycle fuel port
    const target = toPos.clone().add(new THREE.Vector3(0, 0.75, 0));
    const vel = target.sub(pumpSource).multiplyScalar(3.5);

    this.scene.add(p);
    this.refuelParticles.push({ mesh: p, vel, life: 0.35 });
  }

  private updateRefuelParticles(dt: number) {
    for (let i = this.refuelParticles.length - 1; i >= 0; i--) {
      const p = this.refuelParticles[i];
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.life -= dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / 0.35);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.refuelParticles.splice(i, 1);
      }
    }
  }

  private updateMissionLogic(dt: number) {
    const mission = this.state.activeMission;
    if (mission.completed) {
      if (this.waypointGroup) this.waypointGroup.visible = false;
      return;
    }

    const currentStep = mission.steps[mission.currentStepIndex];
    if (!currentStep) {
      if (this.waypointGroup) this.waypointGroup.visible = false;
      return;
    }

    const target = new THREE.Vector3(...currentStep.targetPosition);
    const pPos = this.state.isMiniDroneActive ? this.dronePos : this.state.isRiding ? this.bikePos : this.playerPos;
    const pRot = this.state.isMiniDroneActive ? this.droneRot : this.state.isRiding ? this.bikeRot : this.playerRot;
    const distToObjective = pPos.distanceTo(target);

    // Update HUD Compass & Distance metrics
    this.state.objectiveDistance = Math.round(distToObjective);

    // Calculate relative heading angle to objective (-180 to +180 deg)
    const toTarget = target.clone().sub(pPos);
    const targetAngle = Math.atan2(-toTarget.x, -toTarget.z);
    let diffAngle = targetAngle - pRot;
    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
    this.state.objectiveAngleDeg = Math.round(THREE.MathUtils.radToDeg(diffAngle));

    // Update 3D Holographic Waypoint Beacon
    if (this.waypointGroup) {
      this.waypointGroup.visible = true;
      this.waypointGroup.position.x = target.x;
      this.waypointGroup.position.z = target.z;
      this.waypointGroup.position.y = 0;

      const time = this.clock.getElapsedTime();
      const diamond = this.waypointGroup.getObjectByName('waypoint_diamond');
      if (diamond) {
        diamond.rotation.y = time * 2.2;
        diamond.position.y = 4.2 + Math.sin(time * 3) * 0.6;
      }

      const ring = this.waypointGroup.getObjectByName('waypoint_ring');
      if (ring) {
        const ringScale = 1 + (Math.sin(time * 4) + 1) * 0.2;
        ring.scale.set(ringScale, ringScale, ringScale);
      }
    }

    // Step 1: Reach Museum
    if (mission.currentStepIndex === 0 && distToObjective < 15) {
      this.checkMissionStepComplete('step_1_travel', 'speed');
      this.state.radioMessage = {
        sender: 'Agent Kira (HQ)',
        text: 'You reached the Museum! Scan the rear loading dock for clues about how CHAOS escaped.',
        time: Date.now(),
      };
      soundEngine.speak('You reached the museum. Scan the rear loading dock.', 'kira');
    }

    // Step 2: Scan Loading Dock
    if (mission.currentStepIndex === 1 && distToObjective < 10) {
      this.checkMissionStepComplete('step_2_scan_dock', 'stealth');
      this.state.radioMessage = {
        sender: 'Agent Kira (HQ)',
        text: 'Signal locked! A CHAOS transport drone just took off heading toward the Monorail Station! Pursue it!',
        time: Date.now(),
      };
      soundEngine.speak('Signal locked! CHAOS transport drone escaping towards the monorail station.', 'kira');
    }

    // Step 3: Follow Drone to Station
    if (mission.currentStepIndex === 2 && distToObjective < 18) {
      this.checkMissionStepComplete('step_3_chase_drone', 'speed');
      this.state.radioMessage = {
        sender: 'Agent Kira (HQ)',
        text: 'You reached the Cargo Station! Choose your infiltration path: SPEED (ramp jump), STEALTH (disguise/vent), or SMARTS (hack crane)!',
        time: Date.now(),
      };
      soundEngine.speak('Cargo station ahead. Infiltrate using speed, stealth, or smarts.', 'kira');
    }

    // Step 4: Infiltrate Station
    if (mission.currentStepIndex === 3) {
      // Speed path: jumped monorail ramp and entered track
      if (this.state.isRiding && this.bikePos.y > 6 && this.bikePos.distanceTo(new THREE.Vector3(85, 8, 20)) < 15) {
        this.checkMissionStepComplete('step_4_infiltrate_station', 'speed');
      }
      // Stealth path: wearing maintenance disguise near station interior
      else if (this.state.currentDisguise === 'maintenance_tech' && distToObjective < 12) {
        this.checkMissionStepComplete('step_4_infiltrate_station', 'stealth');
      }
    }

    // Step 5: Boss Cargo Drone
    if (mission.currentStepIndex === 4) {
      this.bossDrone.group.visible = true;
      // Animate giant cargo drone flying slowly along highway
      this.bossDrone.group.position.x = 40 + Math.sin(this.clock.getElapsedTime() * 0.4) * 20;
      this.bossDrone.group.position.z = 40 + (this.clock.getElapsedTime() % 60) * 1.5;
      this.bossDrone.rotors.forEach((r) => (r.rotation.y += 0.4));
    }
  }

  public checkMissionStepComplete(stepId: string, path: MissionPathChoice) {
    const step = this.state.activeMission.steps.find((s) => s.id === stepId);
    if (step && !step.completed) {
      step.completed = true;
      this.state.activeMission.chosenPath = path;
      this.state.activeMission.currentStepIndex++;
      soundEngine.playMissionComplete();
      this.addXP(200, `Objective Complete: ${step.title} (${path.toUpperCase()})`);
      this.setNotification(`Objective Complete via ${path.toUpperCase()} approach!`);
      this.requestAutosave();

      // Trigger Boss Step
      if (this.state.activeMission.currentStepIndex === 4) {
        this.bossDrone.group.visible = true;
        this.state.radioMessage = {
          sender: 'Agent Kira (HQ)',
          text: 'ALERT! CHAOS launched the Giant Cargo Drone with the energy core! Match its speed on V9 and fire EMP taggers at all 3 relays!',
          time: Date.now(),
        };
        soundEngine.speak('Alert! Giant cargo drone launched. Race underneath and disable all three EMP relays.', 'kira');
      }

      this.notifyState();
    }
  }

  public completeStoryMission() {
    this.state.activeMission.completed = true;
    soundEngine.playMissionComplete();
    this.addXP(this.state.activeMission.rewardXP, 'Story Mission Victory: The Midnight Prototype');
    this.state.stats.credits += this.state.activeMission.rewardCredits;
    this.state.stats.missionsCompleted.push(this.state.activeMission.id);

    this.state.radioMessage = {
      sender: 'Agent Kira (HQ)',
      text: 'OUTSTANDING WORK AGENT! The Giant Cargo Drone has safely landed, and the Midnight Prototype is secured! V9 Academy salutes you!',
      time: Date.now(),
    };
    soundEngine.speak('Outstanding work agent! The Midnight Prototype is secured! V9 Academy salutes you!', 'kira');

    // Confetti celebration!
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });

    this.setNotification('MISSION COMPLETE! Unlocked Holographic Cyber Paint & Super Jump Upgrade!');
    this.requestAutosave();
    this.notifyState();
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
  public setGPSDestination(target: CityPOI | [number, number, number], customName?: string) {
    const destPos: [number, number, number] = Array.isArray(target) ? target : target.position;
    const destName = typeof target === 'object' && 'name' in target ? target.name : (customName || 'GPS Destination');
    const destId = typeof target === 'object' && 'id' in target ? target.id : 'custom_dest';

    const pPos = this.state.isRiding ? this.bikePos : this.playerPos;
    const waypoints = this.calculateRoadPath([pPos.x, pPos.y, pPos.z], destPos);
    const totalDist = Math.round(this.calculatePathDistance(waypoints));
    const etaSec = Math.max(4, Math.round(totalDist / (this.state.isRiding ? 22 : 6)));

    const route: GPSRoute = {
      destinationId: destId,
      destinationName: destName,
      targetPos: destPos,
      waypoints: waypoints,
      totalDistance: totalDist,
      etaSeconds: etaSec,
      nextTurnInstruction: this.calculateNextTurnInstruction(pPos, waypoints),
    };

    this.state.activeGPSRoute = route;
    this.renderGPS3DRibbon(waypoints);
    this.setNotification(`GPS Routing Active: ${destName} (${totalDist}m)`);
    soundEngine.playWaypoint();
    this.notifyState();
  }

  public clearGPSRoute() {
    this.state.activeGPSRoute = null;
    if (this.gpsRibbonGroup) {
      while (this.gpsRibbonGroup.children.length > 0) {
        this.gpsRibbonGroup.remove(this.gpsRibbonGroup.children[0]);
      }
    }
    this.setNotification('GPS Route Cleared');
    this.notifyState();
  }

  private calculateRoadPath(from: [number, number, number], to: [number, number, number]): [number, number, number][] {
    const roadsX = [-85, 0, 85];
    const roadsZ = [-85, 0, 85];

    // Find closest road X and Z for start
    const startRoadX = roadsX.reduce((prev, curr) => Math.abs(curr - from[0]) < Math.abs(prev - from[0]) ? curr : prev);
    const startRoadZ = roadsZ.reduce((prev, curr) => Math.abs(curr - from[2]) < Math.abs(prev - from[2]) ? curr : prev);

    // Find closest road X and Z for destination
    const destRoadX = roadsX.reduce((prev, curr) => Math.abs(curr - to[0]) < Math.abs(prev - to[0]) ? curr : prev);
    const destRoadZ = roadsZ.reduce((prev, curr) => Math.abs(curr - to[2]) < Math.abs(prev - to[2]) ? curr : prev);

    const waypoints: [number, number, number][] = [];
    waypoints.push([from[0], 0.08, from[2]]);

    // Step 1: Connect to nearest road segment
    if (Math.abs(from[0] - startRoadX) < Math.abs(from[2] - startRoadZ)) {
      waypoints.push([startRoadX, 0.08, from[2]]);
      waypoints.push([startRoadX, 0.08, destRoadZ]);
    } else {
      waypoints.push([from[0], 0.08, startRoadZ]);
      waypoints.push([destRoadX, 0.08, startRoadZ]);
    }

    // Step 2: Route through intersection to destination road
    if (destRoadX !== startRoadX || destRoadZ !== startRoadZ) {
      waypoints.push([destRoadX, 0.08, destRoadZ]);
    }

    // Step 3: Connect to final point
    waypoints.push([destRoadX, 0.08, to[2]]);
    waypoints.push([to[0], 0.08, to[2]]);

    // Deduplicate close consecutive points
    const cleanWaypoints: [number, number, number][] = [waypoints[0]];
    for (let i = 1; i < waypoints.length; i++) {
      const p1 = new THREE.Vector3(...cleanWaypoints[cleanWaypoints.length - 1]);
      const p2 = new THREE.Vector3(...waypoints[i]);
      if (p1.distanceTo(p2) > 2.5) {
        cleanWaypoints.push(waypoints[i]);
      }
    }
    return cleanWaypoints;
  }

  private calculatePathDistance(waypoints: [number, number, number][]): number {
    let d = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = new THREE.Vector3(...waypoints[i]);
      const p2 = new THREE.Vector3(...waypoints[i + 1]);
      d += p1.distanceTo(p2);
    }
    return d;
  }

  private calculateNextTurnInstruction(playerPos: THREE.Vector3, waypoints: [number, number, number][]): string {
    if (waypoints.length < 2) return 'Arrive at destination';
    const nextPt = new THREE.Vector3(...waypoints[1]);
    const distToNext = Math.round(playerPos.distanceTo(nextPt));
    if (distToNext < 15 && waypoints.length > 2) {
      const p2 = new THREE.Vector3(...waypoints[2]);
      const v1 = nextPt.clone().sub(playerPos).normalize();
      const v2 = p2.clone().sub(nextPt).normalize();
      const cross = v1.x * v2.z - v1.z * v2.x;
      if (cross > 0.25) return `Turn right in ${distToNext}m`;
      if (cross < -0.25) return `Turn left in ${distToNext}m`;
      return `Continue straight for ${distToNext}m`;
    }
    return `Head towards ${this.state.activeGPSRoute?.destinationName || 'destination'} (${distToNext}m)`;
  }

  private renderGPS3DRibbon(waypoints: [number, number, number][]) {
    if (!this.gpsRibbonGroup) {
      this.gpsRibbonGroup = new THREE.Group();
      this.scene.add(this.gpsRibbonGroup);
    }
    while (this.gpsRibbonGroup.children.length > 0) {
      this.gpsRibbonGroup.remove(this.gpsRibbonGroup.children[0]);
    }

    const arrowMat = new THREE.MeshBasicMaterial({
      color: '#00f2fe',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(-0.8, -0.6);
    chevronShape.lineTo(0, 0.6);
    chevronShape.lineTo(0.8, -0.6);
    chevronShape.lineTo(0.5, -0.9);
    chevronShape.lineTo(0, 0.1);
    chevronShape.lineTo(-0.5, -0.9);
    chevronShape.closePath();
    const chevronGeo = new THREE.ShapeGeometry(chevronShape);
    chevronGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = new THREE.Vector3(...waypoints[i]);
      const p2 = new THREE.Vector3(...waypoints[i + 1]);
      const segmentDist = p1.distanceTo(p2);
      const dir = p2.clone().sub(p1).normalize();
      const angleY = Math.atan2(dir.x, dir.z);

      const count = Math.max(1, Math.floor(segmentDist / 4.5));
      for (let j = 0; j <= count; j++) {
        const t = j / count;
        const pos = p1.clone().lerp(p2, t);
        const mesh = new THREE.Mesh(chevronGeo, arrowMat);
        mesh.position.set(pos.x, 0.08, pos.z);
        mesh.rotation.y = angleY;
        this.gpsRibbonGroup.add(mesh);
      }
    }
  }

  // ---------------------------------------------------
  // NPC CONVERSATIONS & SIDE QUESTS
  // ---------------------------------------------------
  public talkToNPC(npcId?: string) {
    let targetNPC: WorldObjects['npcLocals'][0] | undefined;
    const playerTarget = this.state.isRiding ? this.bikePos : this.playerPos;

    if (npcId) {
      targetNPC = this.world.npcLocals.find((n) => n.data.id === npcId);
    } else {
      let minDist = 4.5;
      for (const npc of this.world.npcLocals) {
        const dist = playerTarget.distanceTo(npc.obj.position);
        if (dist < minDist) {
          minDist = dist;
          targetNPC = npc;
        }
      }
    }

    if (!targetNPC) return;

    this.state.activeNPCDialogue = {
      npc: targetNPC.data,
      lineIndex: 0,
    };

    soundEngine.speak(targetNPC.data.dialogue[0] || 'Hello agent!', 'kira');
    this.notifyState();
  }

  public advanceNPCDialogue() {
    if (!this.state.activeNPCDialogue) return;
    const { npc, lineIndex } = this.state.activeNPCDialogue;
    if (lineIndex + 1 < npc.dialogue.length) {
      this.state.activeNPCDialogue.lineIndex = lineIndex + 1;
      soundEngine.speak(npc.dialogue[lineIndex + 1], 'kira');
    } else {
      this.closeNPCDialogue();
    }
    this.notifyState();
  }

  public closeNPCDialogue() {
    this.state.activeNPCDialogue = null;
    this.notifyState();
  }

  public startSideQuest(questId: string) {
    this.closeNPCDialogue();
    const sideQuest = SIDE_MISSIONS.find((m) => m.id === questId);
    if (sideQuest) {
      this.state.activeMission = JSON.parse(JSON.stringify(sideQuest));
      this.state.activeMission.active = true;
      this.setNotification(`Side Mission Started: ${sideQuest.title}`);
      soundEngine.playMissionComplete();
      this.setGPSDestination(sideQuest.steps[0].targetPosition, sideQuest.title);
      this.requestAutosave();
    }
    this.notifyState();
  }

  private notifyState() {
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

  /** Persist immediately, bypassing the debounce (used on teardown and explicit saves). */
  public flushSave() {
    this.saveDirty = false;
    this.lastSaveAtMs = performance.now();
    this.onRequestSave?.(this.exportSave());
  }

  /** Snapshot every piece of progress the spec requires to survive a reload. */
  public exportSave(): SaveDataV1 {
    const m = this.state.activeMission;
    const isSideQuest = SIDE_MISSIONS.some((s) => s.id === m.id);
    return {
      version: SAVE_DATA_VERSION,
      savedAt: Date.now(),
      player: {
        isRiding: this.state.isRiding,
        isSilentMode: this.state.isSilentMode,
        playerPos: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
        playerRot: this.playerRot,
        bikePos: [this.bikePos.x, this.bikePos.y, this.bikePos.z],
        bikeRot: this.bikeRot,
        currentDisguise: this.state.currentDisguise,
        currentGadget: this.state.currentGadget,
      },
      mission: {
        activeMissionId: m.id,
        isSideQuest,
        currentStepIndex: m.currentStepIndex,
        chosenPath: m.chosenPath,
        completedStepIds: m.steps.filter((s) => s.completed).map((s) => s.id),
        completed: m.completed,
        bossRelaysRemaining: this.state.bossRelaysRemaining,
      },
      world: {
        collectedCollectibleIds: this.world.collectibles.filter((c) => c.collected).map((c) => c.id),
        collectedStuntRingIds: this.world.stuntRings.filter((r) => r.collected).map((r) => r.id),
        hackedTerminalIds: this.world.terminals.filter((t) => t.hacked).map((t) => t.id),
        chaosAlertLevel: this.state.chaosAlertLevel,
        chaosAlertProgress: this.state.chaosAlertProgress,
        fuelLevel: this.state.fuelLevel,
        nitroLevel: this.state.nitroLevel,
      },
      stats: this.state.stats,
      customization: this.customization,
    };
  }

  /** Restore a loaded save into the live scene. Runs once, during construction. */
  private applySave(data: SaveDataV1) {
    // --- Player & vehicle transforms ---
    const p = data.player;
    this.playerPos.set(...p.playerPos);
    this.playerRot = p.playerRot;
    this.bikePos.set(...p.bikePos);
    this.bikeRot = p.bikeRot;
    this.bikeSpeed = 0;
    this.playerVel.set(0, 0, 0);
    this.motorcycle.group.position.copy(this.bikePos);
    this.motorcycle.group.rotation.y = this.bikeRot;
    this.agentChar.group.position.copy(this.playerPos);
    this.agentChar.group.rotation.y = this.playerRot;

    this.state.isRiding = p.isRiding;
    this.state.isSilentMode = p.isSilentMode;

    // --- Inventory / appearance ---
    this.state.currentGadget = p.currentGadget;
    this.state.currentDisguise = p.currentDisguise;
    this.updateCustomization(this.customization); // rebuilds agent + bike for disguise/colours

    // Mount visibility must be re-asserted AFTER updateCustomization rebuilds the meshes.
    this.agentChar.group.visible = !p.isRiding;
    this.motorcycle.riderMesh.visible = p.isRiding;

    // --- Mission progress ---
    const template = data.mission.isSideQuest
      ? SIDE_MISSIONS.find((s) => s.id === data.mission.activeMissionId)
      : data.mission.activeMissionId === STORY_MISSION_MIDNIGHT_PROTOTYPE.id
      ? STORY_MISSION_MIDNIGHT_PROTOTYPE
      : undefined;

    if (template) {
      const mission: Mission = JSON.parse(JSON.stringify(template));
      mission.active = true;
      mission.completed = data.mission.completed;
      mission.chosenPath = data.mission.chosenPath;
      mission.currentStepIndex = Math.max(
        0,
        Math.min(data.mission.currentStepIndex, mission.steps.length)
      );
      mission.steps.forEach((s, i) => {
        s.completed = i < mission.currentStepIndex || data.mission.completedStepIds.includes(s.id);
      });
      this.state.activeMission = mission;
      this.state.bossRelaysRemaining = data.mission.bossRelaysRemaining;
      if (!mission.completed && mission.currentStepIndex >= 4) {
        this.bossDrone.group.visible = true;
      }
    }

    // --- World object state ---
    const w = data.world;
    this.world.collectibles.forEach((c) => {
      if (w.collectedCollectibleIds.includes(c.id)) {
        c.collected = true;
        const mesh = this.scene.getObjectByName(c.id);
        if (mesh) this.scene.remove(mesh);
      }
    });
    this.world.stuntRings.forEach((r) => {
      if (w.collectedStuntRingIds.includes(r.id)) {
        r.collected = true;
        (r.mesh.material as THREE.MeshBasicMaterial).color.set('#22c55e');
      }
    });
    this.world.terminals.forEach((t) => {
      if (w.hackedTerminalIds.includes(t.id)) {
        t.hacked = true;
        (t.mesh.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: '#22c55e' });
        if (t.id === 'term_museum_dock') this.world.museumLaserGate.visible = false;
        if (t.id === 'term_station_crane') this.world.stationCraneGate.position.y += 6;
      }
    });

    this.state.chaosAlertLevel = w.chaosAlertLevel;
    this.state.chaosAlertProgress = w.chaosAlertProgress;
    this.state.fuelLevel = w.fuelLevel;
    this.state.nitroLevel = w.nitroLevel;

    // --- Framing ---
    this.state.notification = 'Progress restored — welcome back, Agent!';
    this.state.radioMessage = {
      sender: 'Agent Kira (HQ)',
      text: 'Welcome back, Agent V9. Picking up right where you left off. Check your objective marker.',
      time: Date.now(),
    };
    this.lastSaveAtMs = performance.now();
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
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
