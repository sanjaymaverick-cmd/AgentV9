import * as THREE from 'three';
import { 
  createAsphaltTexture, 
  createChaosGuardBot,
  createSecurityCamera,
  createCyberFuelStation, 
  createCyberTrafficCar,
  createStreetLight,
  createCyberTree,
  createBusStop,
  createStreetBench,
  createCrosswalkSignal,
  createLocalNPCMesh,
  createRaceCheckpoint,
} from './models';
import { DOWNTOWN_RACE_GATES } from './tunables';
import { SecurityBot, CollectibleItem, CityPOI, NPCLocal, RestrictedZone } from '../types/game';
import {
  addNightSky,
  buildingCollider,
  createAcademyHQ,
  createCargoStation,
  createCityBuilding,
  createTechMuseum,
  type BuildingStyle,
} from './cityBuildings';

export interface TrafficVehicle {
  id: string;
  obj: THREE.Group;
  wheels: THREE.Mesh[];
  speed: number;
  routeIndex: number;
  route: [number, number][];
  progress: number;
  style: 'sports' | 'sedan' | 'patrol';
  color: string;
}

export interface NPCObject {
  data: NPCLocal;
  obj: THREE.Group;
  head: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  questIcon?: THREE.Mesh;
  isPedestrian: boolean;
  patrolRoute?: [number, number][];
  patrolIndex?: number;
  patrolProgress?: number;
}

export interface SecurityCameraObject {
  id: string;
  obj: THREE.Group;
  cone: THREE.Mesh;
  sweepAngle: number;
  sweepCenter: number;
  position: [number, number, number];
  disabled: boolean;
  disabledUntil: number;
  viewDistance: number;
  viewAngle: number;
}

export interface RaceCheckpointObject {
  index: number;
  position: [number, number, number];
  group: THREE.Group;
  ring: THREE.Mesh;
}

export interface UndergroundZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldObjects {
  scene: THREE.Scene;
  colliders: THREE.Box3[];
  stuntRamps: { box: THREE.Box3; boostForce: number }[];
  terminals: { id: string; position: [number, number, number]; name: string; mesh: THREE.Mesh; hacked: boolean }[];
  lockers: { id: string; disguise: string; position: [number, number, number]; mesh: THREE.Mesh }[];
  collectibles: CollectibleItem[];
  bots: { data: SecurityBot; obj: THREE.Group; cone: THREE.Mesh }[];
  restrictedZones: RestrictedZone[];
  navWaypoints: [number, number, number][];
  cameras: SecurityCameraObject[];
  undergroundZone: UndergroundZone;
  stuntRings: { id: string; mesh: THREE.Mesh; position: [number, number, number]; collected: boolean }[];
  raceCheckpoints: RaceCheckpointObject[];
  fuelStations: {
    id: string;
    name: string;
    position: [number, number, number];
    obj: THREE.Group;
    padBox: THREE.Box3;
    holoIcon: THREE.Mesh;
    pulseRing: THREE.Mesh;
  }[];
  trafficVehicles: TrafficVehicle[];
  streetLights: { group: THREE.Group; light: THREE.SpotLight }[];
  trees: THREE.Group[];
  npcLocals: NPCObject[];
  cityPOIs: CityPOI[];
  museumLaserGate: THREE.Mesh;
  museumLaserBox: THREE.Box3;
  museumStaffDoor: { mesh: THREE.Mesh; box: THREE.Box3; open: boolean };
  museumStaffRoom: { minX: number; maxX: number; minZ: number; maxZ: number };
  interiorColliders: THREE.Box3[];
  stationCraneGate: THREE.Mesh;
  sunLight: THREE.DirectionalLight; // exposed so quality presets can retune shadows
  nightSky: THREE.Mesh;
}

export function buildVelocityCity(scene: THREE.Scene): WorldObjects {
  const colliders: THREE.Box3[] = [];
  const stuntRamps: { box: THREE.Box3; boostForce: number }[] = [];
  const terminals: WorldObjects['terminals'] = [];
  const lockers: WorldObjects['lockers'] = [];
  const collectibles: CollectibleItem[] = [];
  const bots: WorldObjects['bots'] = [];
  const cameras: WorldObjects['cameras'] = [];
  const stuntRings: WorldObjects['stuntRings'] = [];
  const raceCheckpoints: WorldObjects['raceCheckpoints'] = [];
  const fuelStations: WorldObjects['fuelStations'] = [];
  const trafficVehicles: TrafficVehicle[] = [];
  const streetLights: WorldObjects['streetLights'] = [];
  const trees: THREE.Group[] = [];
  const npcLocals: NPCObject[] = [];

  // ---------------------------------------------------
  // 1. SKY, FOG & AMBIENT LIGHTING
  // ---------------------------------------------------
  scene.fog = new THREE.FogExp2('#121826', 0.0042);
  const nightSky = addNightSky(scene);

  const hemiLight = new THREE.HemisphereLight('#c5d4e8', '#1a1524', 0.72);
  scene.add(hemiLight);
  const fill = new THREE.AmbientLight('#1b2436', 0.22);
  scene.add(fill);

  const sunLight = new THREE.DirectionalLight('#ffe8c8', 1.7);
  sunLight.position.set(70, 110, 45);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 300;
  sunLight.shadow.camera.left = -130;
  sunLight.shadow.camera.right = 130;
  sunLight.shadow.camera.top = 130;
  sunLight.shadow.camera.bottom = -130;
  scene.add(sunLight);

  // ---------------------------------------------------
  // 2. MASTER GROUND BED & ASPHALT ROADS
  // ---------------------------------------------------
  const asphaltTex = createAsphaltTexture();
  asphaltTex.repeat.set(50, 50);
  const baseGroundMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.85,
    metalness: 0.1,
  });
  const baseGround = new THREE.Mesh(new THREE.PlaneGeometry(380, 380), baseGroundMat);
  baseGround.rotation.x = -Math.PI / 2;
  baseGround.receiveShadow = true;
  scene.add(baseGround);

  // Material Library for Roads, Footpaths, Curbs & Markings
  const roadMat = new THREE.MeshStandardMaterial({ color: '#161922', roughness: 0.88, metalness: 0.08 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72, metalness: 0.18 });
  const curbMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 });
  const yellowLineMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
  const whiteMarkMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
  const crosswalkMat = new THREE.MeshBasicMaterial({ color: '#e2e8f0' });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: '#00f2fe' });
  const grassMat = new THREE.MeshStandardMaterial({ color: '#064e3b', roughness: 0.95 });

  // ---------------------------------------------------
  // 3. ROAD NETWORK (Avenues, Boulevards & Expressways)
  // ---------------------------------------------------
  interface RoadDef {
    x: number;
    z: number;
    w: number;
    d: number;
    isVertical: boolean;
  }

  const roads: RoadDef[] = [
    // Grand Central North-South Boulevard
    { x: 0, z: 0, w: 16, d: 320, isVertical: true },
    // East-West Downtown Expressway
    { x: 0, z: 0, w: 320, d: 16, isVertical: false },
    // Museum District North Ring (Z = -85)
    { x: 0, z: -85, w: 260, d: 14, isVertical: false },
    // South Tech Parkway (Z = 85)
    { x: 0, z: 85, w: 260, d: 14, isVertical: false },
    // West Academy Avenue (X = -85)
    { x: -85, z: 0, w: 14, d: 260, isVertical: true },
    // East Monorail Cargo Loop (X = 85)
    { x: 85, z: 0, w: 14, d: 260, isVertical: true },
  ];

  roads.forEach((rd) => {
    // 1. Road Surface
    const rdMesh = new THREE.Mesh(new THREE.PlaneGeometry(rd.w, rd.d), roadMat);
    rdMesh.rotation.x = -Math.PI / 2;
    rdMesh.position.set(rd.x, 0.02, rd.z);
    rdMesh.receiveShadow = true;
    scene.add(rdMesh);

    // 2. Dual Yellow Median Center Line
    if (rd.isVertical) {
      [-0.15, 0.15].forEach((offset) => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.18, rd.d), yellowLineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(rd.x + offset, 0.03, rd.z);
        scene.add(line);
      });

      // White Dashed Lane Dividers (Outer lanes)
      [-4.0, 4.0].forEach((laneX) => {
        for (let lz = -rd.d / 2 + 10; lz < rd.d / 2 - 10; lz += 12) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5.0), whiteMarkMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(rd.x + laneX, 0.035, rd.z + lz);
          scene.add(dash);
        }
      });
    } else {
      [-0.15, 0.15].forEach((offset) => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(rd.w, 0.18), yellowLineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(rd.x, 0.03, rd.z + offset);
        scene.add(line);
      });

      // White Dashed Lane Dividers (Outer lanes)
      [-4.0, 4.0].forEach((laneZ) => {
        for (let lx = -rd.w / 2 + 10; lx < rd.w / 2 - 10; lx += 12) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 0.18), whiteMarkMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(rd.x + lx, 0.035, rd.z + laneZ);
          scene.add(dash);
        }
      });
    }
  });

  // ---------------------------------------------------
  // 4. ELEVATED FOOTPATHS / SIDEWALKS & CURBS
  // ---------------------------------------------------
  // City Block Sidewalk Rectangles (surrounding each urban quadrant)
  const sidewalkBlocks: { x: number; z: number; w: number; d: number }[] = [
    // NW Quadrant (Academy & Museum Side)
    { x: -44, z: -44, w: 68, d: 68 },
    // NE Quadrant (Museum North & Highrise Side)
    { x: 44, z: -44, w: 68, d: 68 },
    // SW Quadrant (Southwest Tech Block)
    { x: -44, z: 44, w: 68, d: 68 },
    // SE Quadrant (Cargo Station & Monorail Plaza)
    { x: 44, z: 44, w: 68, d: 68 },
  ];

  sidewalkBlocks.forEach((sb) => {
    // Elevated Sidewalk Platform
    const swMesh = new THREE.Mesh(new THREE.BoxGeometry(sb.w, 0.22, sb.d), sidewalkMat);
    swMesh.position.set(sb.x, 0.11, sb.z);
    swMesh.receiveShadow = true;
    scene.add(swMesh);

    // Beveled Curb Border (Edge around the sidewalk)
    const curbBorder = new THREE.Mesh(new THREE.BoxGeometry(sb.w + 0.3, 0.24, sb.d + 0.3), curbMat);
    curbBorder.position.set(sb.x, 0.1, sb.z);
    scene.add(curbBorder);

    // Inner Green Grass Landscaping Island in quadrant
    const grassMesh = new THREE.Mesh(new THREE.PlaneGeometry(sb.w - 18, sb.d - 18), grassMat);
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.position.set(sb.x, 0.23, sb.z);
    grassMesh.receiveShadow = true;
    scene.add(grassMesh);
  });

  // ---------------------------------------------------
  // 5. CROSSWALKS (ZEBRA STRIPES) & PEDESTRIAN SIGNALS
  // ---------------------------------------------------
  const crosswalks: { x: number; z: number; isVertical: boolean }[] = [
    // Central Plaza Crossings
    { x: 0, z: -12, isVertical: false },
    { x: 0, z: 12, isVertical: false },
    { x: -12, z: 0, isVertical: true },
    { x: 12, z: 0, isVertical: true },

    // Museum District Crossings
    { x: 0, z: -76, isVertical: false },
    { x: -85, z: -76, isVertical: false },
    { x: 85, z: -76, isVertical: false },

    // Cargo Monorail Crossings
    { x: 76, z: 0, isVertical: true },
    { x: -76, z: 0, isVertical: true },
    { x: 0, z: 76, isVertical: false },
  ];

  crosswalks.forEach((cw) => {
    const barCount = 7;
    const barWidth = 0.8;
    const barLen = 6.0;

    for (let i = 0; i < barCount; i++) {
      const offset = (i - (barCount - 1) / 2) * 1.5;
      if (cw.isVertical) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(barLen, barWidth), crosswalkMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(cw.x, 0.04, cw.z + offset);
        scene.add(stripe);
      } else {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, barLen), crosswalkMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(cw.x + offset, 0.04, cw.z);
        scene.add(stripe);
      }
    }

    // Pedestrian Signal Post on each corner
    const signal1 = createCrosswalkSignal();
    signal1.position.set(cw.x + (cw.isVertical ? 4.5 : -5.5), 0.22, cw.z + (cw.isVertical ? -5.5 : 4.5));
    scene.add(signal1);
  });

  // ---------------------------------------------------
  // 6. CENTRAL FOUNTAIN & PLAZA
  // ---------------------------------------------------
  const plazaGeo = new THREE.CylinderGeometry(24, 24, 0.24, 32);
  const plaza = new THREE.Mesh(plazaGeo, sidewalkMat);
  plaza.position.set(0, 0.12, 0);
  scene.add(plaza);

  const fountainGeo = new THREE.CylinderGeometry(4.5, 5.2, 1.4, 16);
  const fountain = new THREE.Mesh(fountainGeo, curbMat);
  fountain.position.set(0, 0.7, 0);
  scene.add(fountain);
  colliders.push(new THREE.Box3().setFromObject(fountain));

  const waterGeo = new THREE.CylinderGeometry(4.1, 4.1, 0.9, 16);
  const waterMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.85 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0, 1.1, 0);
  scene.add(water);

  // Central Holographic Fountain Spire
  const spireGeo = new THREE.ConeGeometry(0.8, 6.5, 8);
  const spireMat = new THREE.MeshBasicMaterial({ color: '#00f2fe' });
  const spire = new THREE.Mesh(spireGeo, spireMat);
  spire.position.set(0, 4.2, 0);
  scene.add(spire);

  [10, 16, 22].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 32), neonCyanMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2 + i * 0.02;
    scene.add(ring);
  });

  // ---------------------------------------------------
  // 7. STREETLIGHTS, TREES, BUS STOPS & BENCHES
  // ---------------------------------------------------
  // Streetlights along avenues
  const streetLightCoords: [number, number, number][] = [
    [-10, 0.22, -35],
    [10, 0.22, -35],
    [-10, 0.22, 35],
    [10, 0.22, 35],
    [-35, 0.22, -10],
    [-35, 0.22, 10],
    [35, 0.22, -10],
    [35, 0.22, 10],
    [-10, 0.22, -115],
    [10, 0.22, -115],
    [-75, 0.22, -35],
    [75, 0.22, -35],
  ];

  streetLightCoords.forEach(([lx, ly, lz]) => {
    const sl = createStreetLight('#38bdf8');
    sl.group.position.set(lx, ly, lz);
    sl.group.rotation.y = lx < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(sl.group);
    streetLights.push(sl);
  });

  // Cyber Trees in Plazas and sidewalk corridors
  const cyberTreeCoords: [number, number, string][] = [
    [-14, -14, '#10b981'],
    [14, -14, '#06b6d4'],
    [-14, 14, '#06b6d4'],
    [14, 14, '#10b981'],
    [-55, -25, '#10b981'],
    [-25, -55, '#3b82f6'],
    [55, -25, '#ec4899'],
    [25, 55, '#10b981'],
    [-55, 55, '#06b6d4'],
  ];

  cyberTreeCoords.forEach(([tx, tz, col]) => {
    const tree = createCyberTree(col);
    tree.position.set(tx, 0.22, tz);
    scene.add(tree);
    trees.push(tree);
  });

  // Benches and Bus Stops
  const benchCoords: [number, number, number][] = [
    [-18, 0, -5],
    [18, 0, 5],
    [-5, 0, 18],
    [5, 0, -18],
  ];
  benchCoords.forEach(([bx, by, bz]) => {
    const bench = createStreetBench();
    bench.position.set(bx, 0.22, bz);
    scene.add(bench);
  });

  const busStop1 = createBusStop();
  busStop1.position.set(-10, 0.22, -60);
  busStop1.rotation.y = Math.PI / 2;
  scene.add(busStop1);

  const busStop2 = createBusStop();
  busStop2.position.set(60, 0.22, -10);
  scene.add(busStop2);

  // ---------------------------------------------------
  // 8. MAJOR LANDMARK BUILDINGS & MISSIONS
  // ---------------------------------------------------
  const darkSteel = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.7 });

  // A. V9 Academy Spy HQ (West District) — collider footprints unchanged
  scene.add(createAcademyHQ());
  colliders.push(buildingCollider(-80, -50, 34, 28, 14));
  colliders.push(buildingCollider(-80, -50, 18, 18, 62));

  // B. Technology Museum — hollow enterable hall (C5)
  const museum = createTechMuseum();
  scene.add(museum.group);
  const interiorColliders = museum.interiorColliders;
  const museumStaffDoor = museum.staffDoor;
  const museumStaffRoom = museum.staffRoom;
  const museumLaserBox = museum.laserBox;

  const laserGate = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  laserGate.position.set(0, 2, -101.7);
  laserGate.name = 'MuseumLaserGate';
  scene.add(laserGate);

  const ventRamp = createStuntRamp([24, 0, -85], Math.PI / 2, 1.2);
  scene.add(ventRamp.mesh);
  stuntRamps.push(ventRamp);

  // C. Monorail Cargo Station — still a solid mesh with a proximity objective
  // (step 4 stealth completes inside the footprint). No outer AABB until it is
  // hollowed like the museum; colliding it would block that step.
  scene.add(createCargoStation());

  const craneGate = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 1), new THREE.MeshStandardMaterial({ color: '#ca8a04', metalness: 0.5 }));
  craneGate.position.set(85, 4, 7.5);
  craneGate.name = 'StationCraneGate';
  scene.add(craneGate);

  // Elevated Monorail Track Beam & Pillars
  [
    [85, 8, -60],
    [85, 8, -20],
    [85, 8, 20],
    [85, 8, 60],
    [55, 8, 90],
    [15, 8, 90],
  ].forEach(([x, y, z]) => {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, y, 8), darkSteel);
    pil.position.set(x, y / 2, z);
    scene.add(pil);
    colliders.push(new THREE.Box3().setFromObject(pil));
  });

  const rail = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 120), darkSteel);
  rail.position.set(85, 8, 0);
  scene.add(rail);

  // Stunt Ramp onto Monorail (Speed path)
  const speedRamp = createStuntRamp([85, 0, -85], 0, 1.4);
  scene.add(speedRamp.mesh);
  stuntRamps.push(speedRamp);

  // D. District towers — windowed facades, setbacks, roof plant, neon corners
  const towerDefs: {
    x: number; z: number; w: number; d: number; h: number;
    style: BuildingStyle; sign: string; seed: number;
  }[] = [
    { x: -45, z: -30, w: 22, d: 22, h: 35, style: 'office', sign: 'NOVA BANK', seed: 21 },
    { x: -45, z: 25, w: 20, d: 24, h: 45, style: 'tech', sign: 'MESH LABS', seed: 22 },
    { x: -45, z: 75, w: 24, d: 20, h: 28, style: 'residential', sign: 'HELIX COURT', seed: 23 },
    { x: 45, z: -35, w: 24, d: 22, h: 40, style: 'plaza', sign: 'CYBER BITES', seed: 24 },
    { x: 45, z: 30, w: 22, d: 20, h: 50, style: 'tech', sign: 'PULSE TOWER', seed: 25 },
    { x: 45, z: 80, w: 26, d: 22, h: 32, style: 'office', sign: 'DRIFT ARCADE', seed: 26 },
    { x: -85, z: 25, w: 22, d: 22, h: 38, style: 'tech', sign: 'ACADEMY ANNEX', seed: 27 },
    { x: -85, z: 75, w: 20, d: 20, h: 30, style: 'residential', sign: 'WEST LOFTS', seed: 28 },
    { x: 0, z: 60, w: 28, d: 22, h: 42, style: 'office', sign: 'SKYLINE HOTEL', seed: 29 },
    { x: 0, z: 110, w: 30, d: 24, h: 36, style: 'plaza', sign: 'NORTH SPIRE', seed: 30 },
  ];

  towerDefs.forEach((t) => {
    const b = createCityBuilding({
      width: t.w,
      depth: t.d,
      height: t.h,
      style: t.style,
      seed: t.seed,
      name: t.sign,
      sign: t.sign,
    });
    b.position.set(t.x, 0, t.z);
    scene.add(b);
    colliders.push(buildingCollider(t.x, t.z, t.w, t.d, t.h));
  });

  // Street-level shop blocks so avenues aren't empty lots
  const shopDefs: { x: number; z: number; w: number; d: number; h: number; style: BuildingStyle; sign: string; seed: number }[] = [
    { x: -30, z: -52, w: 12, d: 10, h: 11, style: 'plaza', sign: 'NITRO CAFE', seed: 41 },
    { x: 30, z: -52, w: 12, d: 10, h: 12, style: 'office', sign: 'CHIP SHOP', seed: 42 },
    { x: -30, z: 42, w: 12, d: 10, h: 10, style: 'residential', sign: 'VINYL MART', seed: 43 },
    { x: 30, z: 42, w: 12, d: 10, h: 13, style: 'tech', sign: 'GADGET HUB', seed: 44 },
  ];
  shopDefs.forEach((t) => {
    const b = createCityBuilding({
      width: t.w, depth: t.d, height: t.h, style: t.style, seed: t.seed, name: t.sign, sign: t.sign,
    });
    b.position.set(t.x, 0, t.z);
    scene.add(b);
    colliders.push(buildingCollider(t.x, t.z, t.w, t.d, t.h));
  });

  // Stunt Ramps
  [
    [0, -45, 0, 1.3],
    [-25, 0, Math.PI / 2, 1.25],
    [25, 0, -Math.PI / 2, 1.25],
    [-60, 60, Math.PI / 4, 1.5],
    [65, -45, -Math.PI / 4, 1.4],
  ].forEach(([x, z, rot, boost]) => {
    const r = createStuntRamp([x, 0, z], rot, boost);
    scene.add(r.mesh);
    stuntRamps.push(r);
  });

  // Floating Stunt Rings
  [
    [0, 9, -58],
    [-38, 8, 0],
    [38, 8, 0],
    [85, 12, -70],
  ].forEach((pos, i) => {
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.25, 8, 20), new THREE.MeshBasicMaterial({ color: '#f59e0b' }));
    ringMesh.position.set(...(pos as [number, number, number]));
    scene.add(ringMesh);
    stuntRings.push({ id: `ring_${i + 1}`, mesh: ringMesh, position: pos as [number, number, number], collected: false });
  });

  DOWNTOWN_RACE_GATES.forEach((pos, index) => {
    const { group, ring } = createRaceCheckpoint(index);
    group.position.set(pos[0], 0, pos[2]);
    scene.add(group);
    raceCheckpoints.push({
      index,
      position: [pos[0], pos[1], pos[2]],
      group,
      ring,
    });
  });

  // ---------------------------------------------------
  // 9. DISGUISE LOCKERS & SECURITY TERMINALS
  // ---------------------------------------------------
  const lockerDefs: { id: string; disguise: string; pos: [number, number, number] }[] = [
    { id: 'locker_tech', disguise: 'maintenance_tech', pos: [-14, 1, -76] },
    { id: 'locker_courier', disguise: 'delivery_worker', pos: [-55, 1, -45] },
    { id: 'locker_science', disguise: 'lab_scientist', pos: [14, 1, -75] },
    { id: 'locker_race', disguise: 'race_crew', pos: [70, 1, 10] },
  ];

  lockerDefs.forEach((loc) => {
    const lMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.8), new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.5 }));
    lMesh.position.set(...loc.pos);
    scene.add(lMesh);
    lockers.push({ id: loc.id, disguise: loc.disguise, position: loc.pos, mesh: lMesh });
  });

  const terminalDefs: { id: string; name: string; pos: [number, number, number] }[] = [
    { id: 'term_museum_dock', name: 'Museum Laser Security Terminal', pos: [-10, 0.8, -76] },
    { id: 'term_station_crane', name: 'Cargo Gantry Crane Console', pos: [78, 0.8, 8] },
    { id: 'term_city_decoy', name: 'Plaza Hologram Projector Node', pos: [8, 0.8, 12] },
  ];

  terminalDefs.forEach((t) => {
    const tMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.6), new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.3 }));
    tMesh.position.set(...t.pos);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
    screen.position.set(0, 0.2, 0.31);
    tMesh.add(screen);
    scene.add(tMesh);
    terminals.push({ id: t.id, name: t.name, position: t.pos, mesh: tMesh, hacked: false });
  });

  // Secret Spy Collectibles
  const collectibleDefs: { id: string; name: string; type: CollectibleItem['type']; pos: [number, number, number]; hint: string }[] = [
    { id: 'col_1', name: 'CHAOS Master Blueprint', type: 'spy_drive', pos: [-80, 14.5, -45], hint: 'On top of the V9 Academy garage roof' },
    { id: 'col_2', name: 'V9 Nitro Prototype Core', type: 'prototype_part', pos: [0, 11, -85], hint: 'Perched on the Museum skylight vent' },
    { id: 'col_3', name: 'Coded Transmission Log', type: 'spy_drive', pos: [85, 9, 30], hint: 'Hidden atop the Cargo Station catwalk' },
    { id: 'col_4', name: 'Silent Electric Damper Spec', type: 'prototype_part', pos: [0, 1.5, 0], hint: 'Under the Central Plaza Cyber Fountain' },
    { id: 'col_5', name: 'Underground Tunnel Map', type: 'spy_drive', pos: [45, 1, -30], hint: 'Behind the Downtown Cyber Bites skyscraper' },
    { id: 'col_6', name: 'EMP Coil Booster', type: 'prototype_part', pos: [-45, 1, 70], hint: 'In the alley behind the South Tech Tower' },
  ];

  collectibleDefs.forEach((c) => {
    const cMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: c.type === 'prototype_part' ? '#eab308' : '#a855f7' }));
    cMesh.position.set(...c.pos);
    scene.add(cMesh);
    collectibles.push({ id: c.id, name: c.name, type: c.type, position: c.pos, collected: false, hint: c.hint });
  });

  // Security Threat Bots
  const botDefs: SecurityBot[] = [
    {
      id: 'bot_museum_1',
      type: 'guard_bot',
      name: 'CHAOS Sentinel Alpha',
      position: [-5, 0, -96],
      rotation: 0,
      patrolPoints: [[-10, 0, -96], [10, 0, -96]],
      currentPatrolIndex: 0,
      viewAngle: 60,
      viewDistance: 8,
      alertLevel: 0,
      disabledUntil: 0,
      trappedByFoamUntil: 0,
      zoneId: 'museum_dock',
    },
    {
      id: 'bot_museum_2',
      type: 'guard_bot',
      name: 'CHAOS Sentinel Beta',
      position: [0, 0, -70],
      rotation: Math.PI,
      patrolPoints: [[-15, 0, -70], [15, 0, -70]],
      currentPatrolIndex: 0,
      viewAngle: 60,
      viewDistance: 8,
      alertLevel: 0,
      disabledUntil: 0,
      trappedByFoamUntil: 0,
      zoneId: 'museum_dock',
    },
    {
      id: 'bot_station_1',
      type: 'guard_bot',
      name: 'CHAOS Station Patrol',
      position: [75, 0, 20],
      rotation: -Math.PI / 2,
      patrolPoints: [[75, 0, 5], [75, 0, 40]],
      currentPatrolIndex: 0,
      viewAngle: 65,
      viewDistance: 9,
      alertLevel: 0,
      disabledUntil: 0,
      trappedByFoamUntil: 0,
      zoneId: 'station_cargo',
    },
    {
      id: 'bot_museum_3',
      type: 'guard_bot',
      name: 'CHAOS Interior Sentinel',
      position: [0, 0, -94],
      rotation: 0,
      patrolPoints: [[-8, 0, -94], [8, 0, -94]],
      currentPatrolIndex: 0,
      viewAngle: 70,
      viewDistance: 7,
      alertLevel: 0,
      disabledUntil: 0,
      trappedByFoamUntil: 0,
      zoneId: 'museum_dock',
    },
  ];

  botDefs.forEach((bData) => {
    const { group: botGroup, coneMesh } = createChaosGuardBot(bData.id);
    botGroup.position.set(...bData.position);
    scene.add(botGroup);
    bots.push({ data: bData, obj: botGroup, cone: coneMesh });
  });

  const restrictedZones: RestrictedZone[] = [
    {
      id: 'museum_dock',
      allowedDisguises: ['maintenance_tech', 'lab_scientist'],
      minX: -22,
      maxX: 22,
      minZ: -118,
      maxZ: -62,
    },
    {
      id: 'station_cargo',
      allowedDisguises: ['race_crew', 'delivery_worker', 'maintenance_tech'],
      minX: 62,
      maxX: 108,
      minZ: -8,
      maxZ: 52,
    },
  ];

  const navWaypoints: [number, number, number][] = [
    [0, 0, -96],
    [0, 0, -83],
    [0, 0, -70],
    [-12, 0, -83],
    [12, 0, -83],
    [75, 0, 20],
    [85, 0, 10],
    [70, 0, 10],
    [0, 0, -76],
    [0, 0, -94],
    [-10, 0, -94],
    [10, 0, -94],
  ];

  // Sweeping security cameras (spec §12). L2 CHAOS enhances range/sweep — see ChaosAlertManager.
  // TODO: fold camera perception into GuardAI with the named awareness states.
  const cameraDefs: { id: string; pos: [number, number, number]; yaw: number; sweep: number }[] = [
    { id: 'cam_museum_front', pos: [8, 4.6, -68], yaw: Math.PI, sweep: 0.85 },
    { id: 'cam_museum_dock', pos: [7, 4.2, -99], yaw: 0, sweep: 0.7 },
    { id: 'cam_museum_hall', pos: [0, 4.8, -80], yaw: 0, sweep: 0.9 },
    { id: 'cam_station', pos: [78, 5.2, 12], yaw: Math.PI / 2, sweep: 0.75 },
    { id: 'cam_plaza', pos: [14, 5.0, 10], yaw: -2.3, sweep: 0.9 },
  ];
  cameraDefs.forEach((def) => {
    const { group, coneMesh } = createSecurityCamera(def.id);
    group.position.set(...def.pos);
    group.rotation.y = def.yaw;
    scene.add(group);
    cameras.push({
      id: def.id,
      obj: group,
      cone: coneMesh,
      sweepAngle: def.sweep,
      sweepCenter: def.yaw,
      position: def.pos,
      disabled: false,
      disabledUntil: 0,
      viewDistance: 14,
      viewAngle: 50,
    });
  });

  // Covered service underpass — street-level (physics stays at y=0) decay route (spec §17).
  const tunnelMat = new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.45, roughness: 0.65 });
  const wallMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.5, roughness: 0.5 });
  const tunnelFloor = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: '#0b1220', roughness: 0.92 })
  );
  tunnelFloor.position.set(45, 0.06, -17);
  scene.add(tunnelFloor);
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(26, 4.2, 0.55), wallMat);
  wallN.position.set(45, 2.1, -22);
  scene.add(wallN);
  colliders.push(new THREE.Box3().setFromObject(wallN));
  const wallS = new THREE.Mesh(new THREE.BoxGeometry(26, 4.2, 0.55), wallMat);
  wallS.position.set(45, 2.1, -12);
  scene.add(wallS);
  colliders.push(new THREE.Box3().setFromObject(wallS));
  const tunnelRoof = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.45, 10.8), tunnelMat);
  tunnelRoof.position.set(45, 4.35, -17);
  scene.add(tunnelRoof);
  const guideStrip = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.05, 0.28),
    new THREE.MeshBasicMaterial({ color: '#f59e0b' })
  );
  guideStrip.position.set(45, 0.1, -17);
  scene.add(guideStrip);
  const undergroundZone: UndergroundZone = { minX: 32, maxX: 58, minZ: -22, maxZ: -12 };

  // ---------------------------------------------------
  // 10. CYBER FUEL & PLASMA FAST-CHARGE STATIONS
  // ---------------------------------------------------
  const fuelStationDefs: { id: string; name: string; pos: [number, number, number]; rotY: number }[] = [
    { id: 'fuel_academy', name: 'V9 Academy Fast-Charge Hub', pos: [-65, 0, -35], rotY: 0 },
    { id: 'fuel_museum', name: 'Museum District Plasma Station', pos: [-32, 0, -80], rotY: Math.PI / 2 },
    { id: 'fuel_plaza', name: 'Central Downtown Cyber Fuel Pad', pos: [22, 0, 18], rotY: -Math.PI / 4 },
    { id: 'fuel_cargo', name: 'East Cargo Bay Energy Depot', pos: [65, 0, -35], rotY: -Math.PI / 2 },
  ];

  fuelStationDefs.forEach((fDef) => {
    const st = createCyberFuelStation(fDef.id, fDef.name);
    st.group.position.set(...fDef.pos);
    st.group.rotation.y = fDef.rotY;
    scene.add(st.group);

    const worldPadBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(fDef.pos[0], fDef.pos[1] + 1.5, fDef.pos[2]),
      new THREE.Vector3(7.5, 3.5, 7.0)
    );

    fuelStations.push({
      id: fDef.id,
      name: fDef.name,
      position: fDef.pos,
      obj: st.group,
      padBox: worldPadBox,
      holoIcon: st.holoIcon,
      pulseRing: st.pulseRing,
    });
  });

  // ---------------------------------------------------
  // 11. NPC LOCALS & CITIZEN PEDESTRIANS
  // ---------------------------------------------------
  const npcDefinitions: NPCLocal[] = [
    {
      id: 'npc_maya',
      name: 'Maya "Drift Queen"',
      title: 'Pro Street Racer & Mechanic',
      avatarColor: '#ec4899',
      position: [14, 0.22, 8],
      rotation: -Math.PI / 3,
      district: 'Downtown Central Plaza',
      dialogue: [
        "Hey Agent! Love that V9 superbike! The twin-spar frame has incredible cornering balance.",
        "If you want to test your drift boost, check out the Velocity Sprint Challenge across the downtown rooftops!",
        "Hit the orange jump ramps at top speed to trigger high-score multiplier streaks!"
      ],
      sideQuestId: 'side_race_downtown',
      sideQuestOffer: 'Start Checkpoint Sprint Challenge'
    },
    {
      id: 'npc_dr_aris',
      name: 'Dr. Aris Vance',
      title: 'Museum Chief Curator',
      avatarColor: '#38bdf8',
      position: [8, 0.22, -72],
      rotation: Math.PI,
      district: 'Museum District',
      dialogue: [
        "Agent V9, thank goodness you're here! CHAOS broke into our zero-gravity exhibit last night!",
        "They set up a red laser defense grid across the rear loading bay. You can hack the terminal or sneak through the roof vent!",
        "Please recover our experimental prototype core before they load it onto the cargo monorail!"
      ],
    },
    {
      id: 'npc_dex',
      name: 'Dex "Wiretap"',
      title: 'Underground Tech Courier',
      avatarColor: '#f59e0b',
      position: [70, 0.22, 10],
      rotation: -Math.PI / 2,
      district: 'East Cargo Bay Depot',
      dialogue: [
        "Psst! Keep it quiet, Agent. The CHAOS sentinels are guarding the main gantry crane.",
        "There's a disguise locker near the cargo containers with a Maintenance Tech uniform.",
        "Put on the disguise and you can walk right past the sentinel bots without raising suspicion!"
      ],
    },
    {
      id: 'npc_officer_jax',
      name: 'Officer Jax Sterling',
      title: 'City Traffic & Drone Marshall',
      avatarColor: '#0284c7',
      position: [-10, 0.22, -32],
      rotation: Math.PI / 2,
      district: 'North Boulevard',
      dialogue: [
        "Agent, 4 hijacked delivery drones are flying erratically over the downtown plaza!",
        "Use your EMP Pulse Blaster or Foam Cannon to tag and neutralize them before they collide with traffic.",
        "Keep an eye on your fuel gauge—there's a fast-charge plasma station right around the corner!"
      ],
      sideQuestId: 'side_drone_tag',
      sideQuestOffer: 'Start Rogue Drone Tagger Challenge'
    },
    {
      id: 'npc_kira',
      name: 'Kira Vance',
      title: 'V9 Academy Tactical Handler',
      avatarColor: '#10b981',
      position: [-58, 0.22, -44],
      rotation: 0,
      district: 'V9 Academy Quarter',
      dialogue: [
        "Welcome back to HQ, Agent. Your V9 motorcycle is fully tuned and equipped with 5 non-lethal spy gadgets.",
        "Remember: you can press [C] or use Silent Electric Mode to sneak past sound sensors unnoticed.",
        "You can customize your bike paint, neon underglow, and exhaust effects in the V9 Garage anytime!"
      ],
    },
  ];

  npcDefinitions.forEach((npcDef) => {
    const npcMesh = createLocalNPCMesh(npcDef.avatarColor, '#fcd34d', true, npcDef.name);
    npcMesh.group.position.set(...npcDef.position);
    npcMesh.group.rotation.y = npcDef.rotation;
    scene.add(npcMesh.group);

    npcLocals.push({
      data: npcDef,
      obj: npcMesh.group,
      head: npcMesh.head,
      leftLeg: npcMesh.leftLeg,
      rightLeg: npcMesh.rightLeg,
      leftArm: npcMesh.leftArm,
      rightArm: npcMesh.rightArm,
      questIcon: npcMesh.questIcon,
      isPedestrian: false,
    });
  });

  // Pedestrian Citizens walking on sidewalks
  const pedestrianConfigs: {
    id: string;
    name: string;
    color: string;
    route: [number, number][];
  }[] = [
    {
      id: 'ped_1',
      name: 'Citizen Kai',
      color: '#6366f1',
      route: [[-18, -18], [-18, -60], [-45, -60], [-45, -18]],
    },
    {
      id: 'ped_2',
      name: 'Citizen Zoe',
      color: '#14b8a6',
      route: [[18, -18], [60, -18], [60, -50], [18, -50]],
    },
    {
      id: 'ped_3',
      name: 'Citizen Leo',
      color: '#e11d48',
      route: [[-18, 18], [-60, 18], [-60, 60], [-18, 60]],
    },
    {
      id: 'ped_4',
      name: 'Citizen Sam',
      color: '#ca8a04',
      route: [[18, 18], [18, 60], [60, 60], [60, 18]],
    },
  ];

  pedestrianConfigs.forEach((pCfg, idx) => {
    const pMesh = createLocalNPCMesh(pCfg.color, '#fed7aa', false, pCfg.name);
    const start = pCfg.route[0];
    pMesh.group.position.set(start[0], 0.22, start[1]);
    scene.add(pMesh.group);

    npcLocals.push({
      data: {
        id: pCfg.id,
        name: pCfg.name,
        title: 'Velocity Citizen',
        avatarColor: pCfg.color,
        position: [start[0], 0.22, start[1]],
        rotation: 0,
        district: 'Downtown',
        dialogue: [
          "Nice day in Velocity City!",
          "Watch out for the CHAOS patrol drones overhead.",
          "The neon lights look stunning from the monorail track!"
        ]
      },
      obj: pMesh.group,
      head: pMesh.head,
      leftLeg: pMesh.leftLeg,
      rightLeg: pMesh.rightLeg,
      leftArm: pMesh.leftArm,
      rightArm: pMesh.rightArm,
      isPedestrian: true,
      patrolRoute: pCfg.route,
      patrolIndex: 0,
      patrolProgress: (idx * 0.25) % 1.0,
    });
  });

  // ---------------------------------------------------
  // 12. AUTONOMOUS CITY TRAFFIC CARS
  // ---------------------------------------------------
  const trafficConfigs: {
    id: string;
    style: 'sports' | 'sedan' | 'patrol';
    color: string;
    speed: number;
    route: [number, number][];
  }[] = [
    {
      id: 'traffic_patrol_1',
      style: 'patrol',
      color: '#0284c7',
      speed: 12,
      route: [[-50, -50], [50, -50], [50, 50], [-50, 50]],
    },
    {
      id: 'traffic_sports_1',
      style: 'sports',
      color: '#ec4899',
      speed: 18,
      route: [[-100, -30], [-30, -100], [70, -100], [100, 30], [-30, 80]],
    },
    {
      id: 'traffic_sedan_1',
      style: 'sedan',
      color: '#10b981',
      speed: 14,
      route: [[30, -70], [30, 70], [-70, 70], [-70, -70]],
    },
    {
      id: 'traffic_sports_2',
      style: 'sports',
      color: '#eab308',
      speed: 16,
      route: [[70, 60], [-60, 60], [-60, -60], [70, -60]],
    },
  ];

  trafficConfigs.forEach((cfg, idx) => {
    const car = createCyberTrafficCar(cfg.style, cfg.color);
    const startPoint = cfg.route[0];
    car.group.position.set(startPoint[0], 0, startPoint[1]);
    scene.add(car.group);

    trafficVehicles.push({
      id: cfg.id,
      obj: car.group,
      wheels: car.wheels,
      speed: cfg.speed,
      routeIndex: 0,
      route: cfg.route,
      progress: (idx * 0.25) % 1.0,
      style: cfg.style,
      color: cfg.color,
    });
  });

  // ---------------------------------------------------
  // 13. COMPREHENSIVE CITY POI DIRECTORY (FOR GPS ROUTING)
  // ---------------------------------------------------
  const cityPOIs: CityPOI[] = [
    {
      id: 'poi_academy',
      name: 'V9 Academy Spy HQ',
      category: 'landmark',
      position: [-80, 1, -50],
      description: 'Underground spy headquarters, gadget armory, and primary spawn base.',
      iconType: 'shield',
      district: 'Academy Quarter',
    },
    {
      id: 'poi_museum',
      name: 'Technology Museum Exhibit Hall',
      category: 'story',
      position: [0, 1, -80],
      description: 'Main story destination where the Zero-Gravity Prototype was stolen.',
      iconType: 'star',
      district: 'Museum District',
    },
    {
      id: 'poi_dock',
      name: 'Museum Laser Loading Bay',
      category: 'story',
      position: [0, 1, -102],
      description: 'Heavily guarded security dock protected by laser grids and sentinel bots.',
      iconType: 'lock',
      district: 'Museum District',
    },
    {
      id: 'poi_cargo',
      name: 'Abandoned Monorail Cargo Depot',
      category: 'story',
      position: [85, 2, 25],
      description: 'CHAOS logistics hub where the giant cargo drone is prepped for flight.',
      iconType: 'train',
      district: 'East Cargo Bay',
    },
    {
      id: 'poi_plaza',
      name: 'Central Plaza & Cyber Fountain',
      category: 'landmark',
      position: [0, 1, 0],
      description: 'Heart of Velocity City connecting all four major districts.',
      iconType: 'fountain',
      district: 'Downtown Core',
    },
    {
      id: 'poi_fuel_academy',
      name: 'V9 Academy Fast-Charge Hub',
      category: 'fuel',
      position: [-65, 0, -35],
      description: '32 kW/s high-voltage energy pad near HQ.',
      iconType: 'zap',
      district: 'Academy Quarter',
    },
    {
      id: 'poi_fuel_museum',
      name: 'Museum District Plasma Station',
      category: 'fuel',
      position: [-32, 0, -80],
      description: 'Rapid energy cell charging depot near the museum ring road.',
      iconType: 'zap',
      district: 'Museum District',
    },
    {
      id: 'poi_fuel_plaza',
      name: 'Central Downtown Cyber Fuel Pad',
      category: 'fuel',
      position: [22, 0, 18],
      description: 'Convenient fast-charging pad situated right off the main avenue.',
      iconType: 'zap',
      district: 'Downtown Core',
    },
    {
      id: 'poi_fuel_cargo',
      name: 'East Cargo Bay Energy Depot',
      category: 'fuel',
      position: [65, 0, -35],
      description: 'Industrial-grade recharge pad near the monorail station.',
      iconType: 'zap',
      district: 'East Cargo Bay',
    },
    {
      id: 'poi_monorail_ramp',
      name: 'Skyline Monorail Stunt Launch Ramp',
      category: 'stunt',
      position: [85, 1, -85],
      description: 'Mega orange stunt ramp that launches superbike onto the high monorail track!',
      iconType: 'flame',
      district: 'East Cargo Bay',
    },
    {
      id: 'poi_side_race',
      name: "Maya's Checkpoint Sprint",
      category: 'side',
      position: [14, 1, 8],
      description: '8-checkpoint rooftop and alley sprint challenge against the clock.',
      iconType: 'flag',
      district: 'Downtown Core',
    },
    {
      id: 'poi_side_drone',
      name: 'Rogue Drone Tagger Zone',
      category: 'side',
      position: [-10, 1, -32],
      description: 'Neutralize 4 hijacked rogue delivery drones causing traffic havoc.',
      iconType: 'target',
      district: 'North Boulevard',
    },
    {
      id: 'poi_tunnel',
      name: 'Service Underpass',
      category: 'secret',
      position: [45, 1, -17],
      description: 'Covered service tunnel. Ride through to shake CHAOS scanners.',
      iconType: 'lock',
      district: 'Downtown Core',
    },
  ];

  return {
    scene,
    colliders,
    stuntRamps,
    terminals,
    lockers,
    collectibles,
    bots,
    restrictedZones,
    navWaypoints,
    cameras,
    undergroundZone,
    stuntRings,
    raceCheckpoints,
    fuelStations,
    trafficVehicles,
    streetLights,
    trees,
    npcLocals,
    cityPOIs,
    museumLaserGate: laserGate,
    museumLaserBox,
    museumStaffDoor,
    museumStaffRoom,
    interiorColliders,
    stationCraneGate: craneGate,
    sunLight,
    nightSky,
  };
}

/** City footprints + museum walls + currently-closed gates. */
export function gatherCollisionBoxes(world: WorldObjects): THREE.Box3[] {
  const boxes = world.colliders.concat(world.interiorColliders);
  if (world.museumLaserGate.visible) boxes.push(world.museumLaserBox);
  if (!world.museumStaffDoor.open) boxes.push(world.museumStaffDoor.box);
  return boxes;
}

function createStuntRamp(pos: [number, number, number], rotY: number, boostForce: number) {
  const group = new THREE.Group();
  group.position.set(...pos);
  group.rotation.y = rotY;

  const rampMat = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.6, roughness: 0.3 });
  const neonMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

  const width = 6;
  const height = 2.4;
  const length = 7;

  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, 0);
  shape.lineTo(length / 2, height);
  shape.lineTo(length / 2, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.center();
  geo.rotateY(Math.PI / 2);

  const mesh = new THREE.Mesh(geo, rampMat);
  mesh.position.y = height / 2;
  group.add(mesh);

  const chevronGeo = new THREE.PlaneGeometry(width * 0.7, 0.4);
  for (let i = 0; i < 3; i++) {
    const ch = new THREE.Mesh(chevronGeo, neonMat);
    ch.position.set(0, (height / 3) * (i + 0.5) + 0.1, (length / 4) * (i - 1));
    ch.rotation.x = -Math.atan2(height, length);
    group.add(ch);
  }

  const box = new THREE.Box3().setFromObject(group);
  return { mesh: group, box, boostForce };
}
