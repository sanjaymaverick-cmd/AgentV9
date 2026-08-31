import * as THREE from 'three';
import { VehicleCustomization, DisguiseType } from '../types/game';

// Helper for generating stylized textures
export function createGridTexture(color1: string, color2: string, size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = color2;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#22252a';
  ctx.fillRect(0, 0, 128, 128);
  
  // Road markings
  ctx.strokeStyle = '#353942';
  ctx.lineWidth = 1;
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    ctx.fillStyle = Math.random() > 0.5 ? '#1a1c20' : '#2d323a';
    ctx.fillRect(x, y, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ----------------------------------------------------
// MOTORCYCLE V9 3D BUILDER (REALISTIC HIGH-FIDELITY CYBER SUPERBIKE)
// ----------------------------------------------------
export function createV9Motorcycle(custom: VehicleCustomization): {
  group: THREE.Group;
  frontWheel: THREE.Group;
  backWheel: THREE.Group;
  handlebar: THREE.Group;
  riderMesh: THREE.Group;
  underglowLight: THREE.PointLight;
  bodyMesh: THREE.Mesh;
  boostFlameLeft: THREE.Mesh;
  boostFlameRight: THREE.Mesh;
  headlightSpot: THREE.SpotLight;
} {
  const group = new THREE.Group();
  group.name = 'V9_Motorcycle';

  // Realistic PBR Materials
  const paintMat = new THREE.MeshStandardMaterial({
    color: custom.bodyColor,
    roughness: 0.15,
    metalness: 0.85,
    envMapIntensity: 1.2,
  });

  const secondaryMat = new THREE.MeshStandardMaterial({
    color: custom.secondaryColor,
    roughness: 0.25,
    metalness: 0.75,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#121316',
    roughness: 0.4,
    metalness: 0.6,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: '#1a1c23',
    roughness: 0.5,
    metalness: 0.85,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.08,
    metalness: 0.98,
  });

  const goldForkMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    roughness: 0.15,
    metalness: 0.92,
  });

  const brakeBremboMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    roughness: 0.3,
    metalness: 0.6,
  });

  const glowMat = new THREE.MeshBasicMaterial({
    color: custom.underglowColor,
  });

  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: '#0d0e11',
    roughness: 0.85,
    metalness: 0.05,
  });

  const rimAlloyMat = new THREE.MeshStandardMaterial({
    color: custom.rimColor,
    roughness: 0.18,
    metalness: 0.92,
  });

  const leatherSeatMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    roughness: 0.7,
    metalness: 0.1,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.75,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.2,
  });

  // 1. CHASSIS: Twin-Spar Aluminum Perimeter Frame
  const frameGroup = new THREE.Group();
  
  // Left and Right Frame Spars
  const sparGeo = new THREE.BoxGeometry(0.08, 0.22, 1.4);
  const leftSpar = new THREE.Mesh(sparGeo, darkSteelMat);
  leftSpar.position.set(-0.24, 0.65, -0.05);
  leftSpar.rotation.x = -0.15;
  const rightSpar = new THREE.Mesh(sparGeo, darkSteelMat);
  rightSpar.position.set(0.24, 0.65, -0.05);
  rightSpar.rotation.x = -0.15;
  frameGroup.add(leftSpar, rightSpar);

  // Central Engine / Plasma Reactor Core Housing
  const engineBlockGeo = new THREE.BoxGeometry(0.42, 0.38, 0.75);
  const engineBlock = new THREE.Mesh(engineBlockGeo, darkSteelMat);
  engineBlock.position.set(0, 0.48, -0.05);
  engineBlock.castShadow = true;
  frameGroup.add(engineBlock);

  // Engine Cooling Ribs
  for (let i = -3; i <= 3; i++) {
    const finGeo = new THREE.BoxGeometry(0.46, 0.02, 0.6);
    const fin = new THREE.Mesh(finGeo, chromeMat);
    fin.position.set(0, 0.36 + i * 0.045, -0.05);
    frameGroup.add(fin);
  }

  // Cylindrical Plasma Reactor with Glowing Glass Core
  const reactorChamberGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 12);
  reactorChamberGeo.rotateZ(Math.PI / 2);
  const reactorChamber = new THREE.Mesh(reactorChamberGeo, glassMat);
  reactorChamber.position.set(0, 0.52, -0.05);
  frameGroup.add(reactorChamber);

  const coreRodGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.46, 8);
  coreRodGeo.rotateZ(Math.PI / 2);
  const coreRod = new THREE.Mesh(coreRodGeo, glowMat);
  coreRod.position.set(0, 0.52, -0.05);
  frameGroup.add(coreRod);

  // Rear Mono-Shock Damper with Spring
  const shockDamperGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.32, 8);
  const shockDamper = new THREE.Mesh(shockDamperGeo, chromeMat);
  shockDamper.position.set(0, 0.55, 0.35);
  shockDamper.rotation.x = 0.5;
  frameGroup.add(shockDamper);

  const springGeo = new THREE.TorusGeometry(0.065, 0.02, 8, 16);
  for (let s = 0; s < 4; s++) {
    const springCoil = new THREE.Mesh(springGeo, brakeBremboMat);
    springCoil.position.set(0, 0.48 + s * 0.06, 0.4 - s * 0.03);
    springCoil.rotation.x = 0.5;
    frameGroup.add(springCoil);
  }

  // Rear Swingarm (Aluminum Structure connected to rear wheel hub)
  const swingarmGeo = new THREE.BoxGeometry(0.07, 0.1, 0.82);
  const leftSwingarm = new THREE.Mesh(swingarmGeo, darkSteelMat);
  leftSwingarm.position.set(-0.2, 0.38, 0.42);
  leftSwingarm.rotation.x = -0.15;
  const rightSwingarm = new THREE.Mesh(swingarmGeo, darkSteelMat);
  rightSwingarm.position.set(0.2, 0.38, 0.42);
  rightSwingarm.rotation.x = -0.15;
  frameGroup.add(leftSwingarm, rightSwingarm);

  group.add(frameGroup);

  // 2. SCULPTED BODYWORK & FUEL/BATTERY CELL FAIRINGS
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 1.2), paintMat);
  bodyMesh.position.set(0, 0.72, -0.15);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Ergonomic Fuel Tank with Knee Indents
  const tankTopGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.75, 8);
  tankTopGeo.rotateX(Math.PI / 2);
  const tankTop = new THREE.Mesh(tankTopGeo, paintMat);
  tankTop.position.set(0, 0.88, -0.22);
  tankTop.scale.set(0.95, 0.75, 1);
  tankTop.castShadow = true;
  group.add(tankTop);

  // Knee Grip Pads (Textured Silicone)
  [-0.26, 0.26].forEach((kx) => {
    const padGeo = new THREE.BoxGeometry(0.03, 0.16, 0.32);
    const pad = new THREE.Mesh(padGeo, carbonMat);
    pad.position.set(kx, 0.82, -0.2);
    group.add(pad);
  });

  // Top Neon Energy Spine
  const spineGeo = new THREE.BoxGeometry(0.06, 0.03, 0.85);
  const spine = new THREE.Mesh(spineGeo, glowMat);
  spine.position.set(0, 0.98, -0.2);
  group.add(spine);

  // Aerodynamic Front Nose Fairing & Carbon Winglets
  const noseGeo = new THREE.ConeGeometry(0.34, 0.78, 6);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, secondaryMat);
  nose.position.set(0, 0.82, -0.88);
  nose.castShadow = true;
  group.add(nose);

  // Downforce Aero Winglets (Left & Right)
  [-0.34, 0.34].forEach((wx) => {
    const wingGeo = new THREE.BoxGeometry(0.2, 0.025, 0.3);
    const wing = new THREE.Mesh(wingGeo, carbonMat);
    wing.position.set(wx, 0.78, -0.8);
    wing.rotation.z = wx > 0 ? -0.2 : 0.2;
    wing.rotation.y = wx > 0 ? -0.25 : 0.25;
    group.add(wing);
  });

  // Iridium Tinted Windshield
  const shieldGeo = new THREE.PlaneGeometry(0.38, 0.35);
  const shield = new THREE.Mesh(shieldGeo, glassMat);
  shield.position.set(0, 1.08, -0.78);
  shield.rotation.x = -0.62;
  group.add(shield);

  // Perforated Leather Rider Seat
  const seatGeo = new THREE.BoxGeometry(0.34, 0.1, 0.52);
  const seat = new THREE.Mesh(seatGeo, leatherSeatMat);
  seat.position.set(0, 0.84, 0.22);
  seat.castShadow = true;
  group.add(seat);

  // Rear Pillion Cowl (Aerodynamic Tail)
  const tailGeo = new THREE.ConeGeometry(0.25, 0.55, 6);
  tailGeo.rotateX(Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, paintMat);
  tail.position.set(0, 0.88, 0.62);
  group.add(tail);

  // Rear Cyber LED Tail Light (Strip)
  const tailLightGeo = new THREE.BoxGeometry(0.26, 0.04, 0.04);
  const tailLightMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const tailLight = new THREE.Mesh(tailLightGeo, tailLightMat);
  tailLight.position.set(0, 0.86, 0.88);
  group.add(tailLight);

  // 3. FRONT COCKPIT, FORKS, HANDLEBARS & HEADLIGHT
  // Inverted Telescopic Front Suspension Forks (Gold stanchions + Chrome sliders)
  const forkGroup = new THREE.Group();
  [-0.18, 0.18].forEach((fx) => {
    // Upper Stanchion (Gold anodized)
    const upperGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.45, 12);
    const upper = new THREE.Mesh(upperGeo, goldForkMat);
    upper.position.set(fx, 0.72, -0.85);
    upper.rotation.x = 0.28;
    forkGroup.add(upper);

    // Lower Slider (Polished Chrome)
    const lowerGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.48, 12);
    const lower = new THREE.Mesh(lowerGeo, chromeMat);
    lower.position.set(fx, 0.45, -0.93);
    lower.rotation.x = 0.28;
    forkGroup.add(lower);
  });
  group.add(forkGroup);

  // Handlebars & Cockpit Digital Dashboard
  const handlebar = new THREE.Group();
  handlebar.position.set(0, 0.96, -0.66);

  // Clip-On Bars
  const barGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.72, 8);
  barGeo.rotateZ(Math.PI / 2);
  const barMesh = new THREE.Mesh(barGeo, chromeMat);
  handlebar.add(barMesh);

  // Grips
  const gripGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.16, 8);
  gripGeo.rotateZ(Math.PI / 2);
  [-0.3, 0.3].forEach((gx) => {
    const grip = new THREE.Mesh(gripGeo, darkSteelMat);
    grip.position.x = gx;
    handlebar.add(grip);

    // Brake / Clutch Levers
    const leverGeo = new THREE.BoxGeometry(0.12, 0.015, 0.025);
    const lever = new THREE.Mesh(leverGeo, chromeMat);
    lever.position.set(gx + (gx > 0 ? -0.04 : 0.04), -0.02, -0.06);
    handlebar.add(lever);

    // Bar-End Aero Mirrors
    const mirrorStemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6);
    mirrorStemGeo.rotateZ(gx > 0 ? 0.6 : -0.6);
    const stem = new THREE.Mesh(mirrorStemGeo, darkSteelMat);
    stem.position.set(gx + (gx > 0 ? 0.06 : -0.06), 0.05, 0);
    handlebar.add(stem);

    const mirrorHeadGeo = new THREE.BoxGeometry(0.08, 0.05, 0.02);
    const mirrorHead = new THREE.Mesh(mirrorHeadGeo, carbonMat);
    mirrorHead.position.set(gx + (gx > 0 ? 0.1 : -0.1), 0.1, 0);
    handlebar.add(mirrorHead);

    const mirrorGlassGeo = new THREE.PlaneGeometry(0.07, 0.04);
    const mirrorGlass = new THREE.Mesh(mirrorGlassGeo, chromeMat);
    mirrorGlass.position.set(gx + (gx > 0 ? 0.1 : -0.1), 0.1, 0.011);
    handlebar.add(mirrorGlass);
  });

  // Digital Color TFT Dashboard Display Cluster
  const dashGeo = new THREE.BoxGeometry(0.22, 0.12, 0.06);
  const dashMesh = new THREE.Mesh(dashGeo, darkSteelMat);
  dashMesh.position.set(0, 0.04, -0.04);
  dashMesh.rotation.x = -0.4;
  handlebar.add(dashMesh);

  const screenGeo = new THREE.PlaneGeometry(0.18, 0.09);
  const screenMat = new THREE.MeshBasicMaterial({ color: '#00f2fe' });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 0.042, -0.009);
  screen.rotation.x = -0.4;
  handlebar.add(screen);

  group.add(handlebar);

  // Twin Projector LED Headlights
  const lightHousingGeo = new THREE.BoxGeometry(0.26, 0.08, 0.08);
  const lightHousing = new THREE.Mesh(lightHousingGeo, darkSteelMat);
  lightHousing.position.set(0, 0.76, -1.08);
  group.add(lightHousing);

  [-0.07, 0.07].forEach((lx) => {
    const lensGeo = new THREE.SphereGeometry(0.038, 12, 12);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(lx, 0.76, -1.12);
    group.add(lens);
  });

  // Headlight SpotBeam for night driving
  const headlightSpot = new THREE.SpotLight('#ffffff', 3.0, 45, Math.PI / 5, 0.45);
  headlightSpot.position.set(0, 0.8, -1.1);
  headlightSpot.target.position.set(0, 0, -25);
  group.add(headlightSpot);
  group.add(headlightSpot.target);

  // 4. REALISTIC WHEELS (Directional Rubber Tread + 5-Spoke Alloy Rims + Brembo Disc Brakes)
  function buildRealisticWheel(isFront: boolean): THREE.Group {
    const wGroup = new THREE.Group();

    // Tire: Main Body
    const tireOuter = new THREE.TorusGeometry(0.38, 0.12, 14, 28);
    const tireMesh = new THREE.Mesh(tireOuter, tireRubberMat);
    tireMesh.castShadow = true;
    wGroup.add(tireMesh);

    // Tread Grooves (Multiple Torus slices)
    for (let r = 0; r < 8; r++) {
      const treadRibGeo = new THREE.TorusGeometry(0.395, 0.015, 6, 20);
      const treadRib = new THREE.Mesh(treadRibGeo, darkSteelMat);
      treadRib.rotation.y = (r * Math.PI) / 4;
      wGroup.add(treadRib);
    }

    // Forged Alloy 5-Spoke Wheel Rim
    const hubCenterGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12);
    hubCenterGeo.rotateX(Math.PI / 2);
    const hubCenter = new THREE.Mesh(hubCenterGeo, rimAlloyMat);
    wGroup.add(hubCenter);

    for (let s = 0; s < 5; s++) {
      const angle = (s * Math.PI * 2) / 5;
      const spokeGeo = new THREE.BoxGeometry(0.04, 0.28, 0.06);
      const spoke = new THREE.Mesh(spokeGeo, rimAlloyMat);
      spoke.position.set(Math.sin(angle) * 0.18, Math.cos(angle) * 0.18, 0);
      spoke.rotation.z = -angle;
      wGroup.add(spoke);
    }

    // Rim Outer Neon Glow Ring
    const neonRingGeo = new THREE.TorusGeometry(0.28, 0.022, 8, 20);
    const neonRing = new THREE.Mesh(neonRingGeo, glowMat);
    wGroup.add(neonRing);

    // Ventilated Stainless Steel Brake Rotor Discs
    const discGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 20);
    discGeo.rotateX(Math.PI / 2);
    const discL = new THREE.Mesh(discGeo, chromeMat);
    discL.position.z = -0.09;
    const discR = new THREE.Mesh(discGeo, chromeMat);
    discR.position.z = 0.09;
    wGroup.add(discL);
    if (isFront) wGroup.add(discR);

    // High-Performance Radial Brake Calipers (Red Brembo Style)
    const caliperGeo = new THREE.BoxGeometry(0.08, 0.14, 0.06);
    const caliperL = new THREE.Mesh(caliperGeo, brakeBremboMat);
    caliperL.position.set(0.18, 0.14, -0.09);
    wGroup.add(caliperL);

    return wGroup;
  }

  // Front Wheel Assembly
  const frontWheel = buildRealisticWheel(true);
  frontWheel.position.set(0, 0.38, -0.98);
  frontWheel.rotation.y = Math.PI / 2;
  group.add(frontWheel);

  // Back Wheel Assembly
  const backWheel = buildRealisticWheel(false);
  backWheel.position.set(0, 0.38, 0.78);
  backWheel.rotation.y = Math.PI / 2;
  group.add(backWheel);

  // 5. DUAL TITANIUM UNDERTAIL EXHAUSTS & NITRO BOOST FLAMES
  const boostFlameLeft = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.45, 8),
    new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0 })
  );
  boostFlameLeft.rotateX(-Math.PI / 2);
  boostFlameLeft.position.set(-0.2, 0.58, 1.15);

  const boostFlameRight = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.45, 8),
    new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0 })
  );
  boostFlameRight.rotateX(-Math.PI / 2);
  boostFlameRight.position.set(0.2, 0.58, 1.15);

  [-0.2, 0.2].forEach((ex) => {
    // Titanium Canister
    const canGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.65, 12);
    canGeo.rotateX(Math.PI / 2);
    const can = new THREE.Mesh(canGeo, chromeMat);
    can.position.set(ex, 0.58, 0.75);
    can.rotation.x = -0.15;
    group.add(can);

    // Carbon Heat Shield
    const shieldGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.35, 8);
    shieldGeo.rotateX(Math.PI / 2);
    const shield = new THREE.Mesh(shieldGeo, carbonMat);
    shield.position.set(ex, 0.58, 0.68);
    shield.rotation.x = -0.15;
    group.add(shield);

    // Burnt Titanium Nozzle Tip
    const tipGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.08, 12);
    tipGeo.rotateX(Math.PI / 2);
    const tipMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.2, metalness: 0.9 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(ex, 0.62, 1.08);
    tip.rotation.x = -0.15;
    group.add(tip);
  });

  group.add(boostFlameLeft, boostFlameRight);

  // 6. UNDERGLOW GROUND NEON LIGHT
  const underglowLight = new THREE.PointLight(custom.underglowColor, 2.4, 4.5);
  underglowLight.position.set(0, 0.2, 0);
  group.add(underglowLight);

  // 7. MOUNTED RIDER MODEL (Realistic Rider Positure)
  const riderMesh = createRiderMesh(custom.suitColor);
  riderMesh.position.set(0, 0.82, 0.12);
  riderMesh.rotation.x = 0.32; // Aerodynamic tuck forward
  group.add(riderMesh);

  return {
    group,
    frontWheel,
    backWheel,
    handlebar,
    riderMesh,
    underglowLight,
    bodyMesh,
    boostFlameLeft,
    boostFlameRight,
    headlightSpot,
  };
}

// ----------------------------------------------------
// AGENT HERO ON-FOOT 3D BUILDER (REALISTIC ANATOMY & TACTICAL SPY RIG)
// ----------------------------------------------------
export function createAgentCharacter(disguise: DisguiseType, suitColor = '#0284c7'): {
  group: THREE.Group;
  head: THREE.Group;
  body: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  backpack: THREE.Group;
  visorGlow: THREE.Mesh;
  disguiseProp?: THREE.Object3D;
} {
  const group = new THREE.Group();
  group.name = 'AgentPlayer';

  let armorColor = suitColor;
  let undersuitColor = '#18181b';
  let accentColor = '#38bdf8';

  if (disguise === 'delivery_worker') {
    armorColor = '#f97316';
    undersuitColor = '#334155';
    accentColor = '#facc15';
  } else if (disguise === 'maintenance_tech') {
    armorColor = '#eab308';
    undersuitColor = '#0f172a';
    accentColor = '#ffffff';
  } else if (disguise === 'lab_scientist') {
    armorColor = '#f8fafc';
    undersuitColor = '#475569';
    accentColor = '#06b6d4';
  } else if (disguise === 'race_crew') {
    armorColor = '#ef4444';
    undersuitColor = '#18181b';
    accentColor = '#f59e0b';
  }

  // Realistic Materials
  const armorMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.35, metalness: 0.65 });
  const undersuitMat = new THREE.MeshStandardMaterial({ color: undersuitColor, roughness: 0.7, metalness: 0.15 });
  const darkKevlarMat = new THREE.MeshStandardMaterial({ color: '#090a0f', roughness: 0.55, metalness: 0.45 });
  const metalPlateMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.2, metalness: 0.9 });
  const visorMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f5d0c5', roughness: 0.65 });

  // 1. TORSO & TACTICAL BALLISTIC VEST
  const body = new THREE.Group();
  body.position.y = 1.05;

  // Undersuit Core
  const underTorsoGeo = new THREE.CylinderGeometry(0.2, 0.17, 0.62, 10);
  const underTorso = new THREE.Mesh(underTorsoGeo, undersuitMat);
  underTorso.castShadow = true;
  body.add(underTorso);

  // Ballistic Chest Plate
  const chestPlateGeo = new THREE.BoxGeometry(0.44, 0.32, 0.24);
  const chestPlate = new THREE.Mesh(chestPlateGeo, armorMat);
  chestPlate.position.set(0, 0.12, 0.05);
  chestPlate.castShadow = true;
  body.add(chestPlate);

  // Abdominal Armor Segment
  const abPlateGeo = new THREE.BoxGeometry(0.38, 0.2, 0.2);
  const abPlate = new THREE.Mesh(abPlateGeo, darkKevlarMat);
  abPlate.position.set(0, -0.12, 0.03);
  body.add(abPlate);

  // Agent V9 Illuminated Crest
  const crestGeo = new THREE.OctahedronGeometry(0.04, 0);
  const crest = new THREE.Mesh(crestGeo, visorMat);
  crest.position.set(0, 0.16, 0.18);
  body.add(crest);

  // Tactical Utility Belt & Holster
  const beltGeo = new THREE.BoxGeometry(0.42, 0.07, 0.26);
  const belt = new THREE.Mesh(beltGeo, darkKevlarMat);
  belt.position.y = -0.28;
  body.add(belt);

  // EMP Blaster Holster on Right Thigh
  const holsterGeo = new THREE.BoxGeometry(0.08, 0.18, 0.1);
  const holster = new THREE.Mesh(holsterGeo, darkKevlarMat);
  holster.position.set(0.24, -0.36, 0.02);
  body.add(holster);

  group.add(body);

  // 2. HEAD & AERODYNAMIC SPY HELMET
  const head = new THREE.Group();
  head.position.set(0, 1.54, 0);

  // Helmet Shell
  const helmetGeo = new THREE.SphereGeometry(0.19, 14, 14);
  const helmet = new THREE.Mesh(helmetGeo, armorMat);
  helmet.scale.set(0.95, 1.05, 1.08);
  helmet.castShadow = true;
  head.add(helmet);

  // Neck Collar
  const neckGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.12, 8);
  const neck = new THREE.Mesh(neckGeo, undersuitMat);
  neck.position.y = -0.16;
  head.add(neck);

  // Multi-Spectral Holographic Spy Visor
  const visorGeo = new THREE.BoxGeometry(0.24, 0.09, 0.12);
  const visorGlow = new THREE.Mesh(visorGeo, visorMat);
  visorGlow.position.set(0, 0.02, 0.12);
  head.add(visorGlow);

  // Tactical Comms Antenna with Beacon LED
  const antGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6);
  const antenna = new THREE.Mesh(antGeo, metalPlateMat);
  antenna.position.set(0.16, 0.15, -0.05);
  antenna.rotation.z = -0.2;
  head.add(antenna);

  const antLedGeo = new THREE.SphereGeometry(0.018, 6, 6);
  const antLed = new THREE.Mesh(antLedGeo, visorMat);
  antLed.position.set(0.18, 0.25, -0.05);
  head.add(antLed);

  group.add(head);

  // 3. KINETIC BATTERY BACKPACK & POWER CELL
  const backpack = new THREE.Group();
  backpack.position.set(0, 1.12, -0.18);

  const packBaseGeo = new THREE.BoxGeometry(0.32, 0.44, 0.14);
  const packBase = new THREE.Mesh(packBaseGeo, darkKevlarMat);
  packBase.castShadow = true;
  backpack.add(packBase);

  // Energy Fuel Bars (4-level dynamic visual indicator)
  for (let b = 0; b < 4; b++) {
    const barGeo = new THREE.BoxGeometry(0.18, 0.035, 0.02);
    const bar = new THREE.Mesh(barGeo, visorMat);
    bar.position.set(0, -0.12 + b * 0.08, -0.075);
    backpack.add(bar);
  }
  group.add(backpack);

  // 4. ARTICULATED ARMS (Shoulder Pauldrons + Elbow Pads + Combat Gloves)
  function buildArm(isLeft: boolean): THREE.Group {
    const armGroup = new THREE.Group();
    const side = isLeft ? -1 : 1;
    armGroup.position.set(side * 0.28, 1.3, 0);

    // Shoulder Pauldron
    const pauldronGeo = new THREE.SphereGeometry(0.09, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const pauldron = new THREE.Mesh(pauldronGeo, armorMat);
    pauldron.position.set(side * 0.04, 0, 0);
    pauldron.scale.set(1, 1.2, 1);
    armGroup.add(pauldron);

    // Bicep / Upper Arm
    const bicepGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.24, 8);
    const bicep = new THREE.Mesh(bicepGeo, undersuitMat);
    bicep.position.set(0, -0.12, 0);
    bicep.castShadow = true;
    armGroup.add(bicep);

    // Forearm & Combat Gauntlet
    const gauntletGeo = new THREE.BoxGeometry(0.11, 0.26, 0.11);
    const gauntlet = new THREE.Mesh(gauntletGeo, darkKevlarMat);
    gauntlet.position.set(0, -0.32, 0);
    gauntlet.castShadow = true;
    armGroup.add(gauntlet);

    // Knuckle Guard
    const knuckleGeo = new THREE.BoxGeometry(0.08, 0.03, 0.06);
    const knuckle = new THREE.Mesh(knuckleGeo, metalPlateMat);
    knuckle.position.set(0, -0.44, 0.03);
    armGroup.add(knuckle);

    return armGroup;
  }

  const leftArm = buildArm(true);
  const rightArm = buildArm(false);
  group.add(leftArm, rightArm);

  // 5. ARTICULATED LEGS (Cargo Pants + Knee Guards + Combat Boots)
  function buildLeg(isLeft: boolean): THREE.Group {
    const legGroup = new THREE.Group();
    const side = isLeft ? -1 : 1;
    legGroup.position.set(side * 0.14, 0.72, 0);

    // Thigh
    const thighGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.34, 8);
    const thigh = new THREE.Mesh(thighGeo, undersuitMat);
    thigh.position.y = -0.16;
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Reinforced Knee Armor Plate
    const kneeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.06);
    const knee = new THREE.Mesh(kneeGeo, armorMat);
    knee.position.set(0, -0.32, 0.06);
    legGroup.add(knee);

    // Shin & Heavy Combat Boot
    const shinGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.32, 8);
    const shin = new THREE.Mesh(shinGeo, darkKevlarMat);
    shin.position.y = -0.46;
    shin.castShadow = true;
    legGroup.add(shin);

    // Boot Foot with Tread Sole
    const bootGeo = new THREE.BoxGeometry(0.13, 0.12, 0.22);
    const boot = new THREE.Mesh(bootGeo, darkKevlarMat);
    boot.position.set(0, -0.66, 0.04);
    boot.castShadow = true;
    legGroup.add(boot);

    return legGroup;
  }

  const leftLeg = buildLeg(true);
  const rightLeg = buildLeg(false);
  group.add(leftLeg, rightLeg);

  return {
    group,
    head,
    body,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    backpack,
    visorGlow,
  };
}

function createRiderMesh(suitColor: string): THREE.Group {
  const r = createAgentCharacter('agent_suit', suitColor);
  // Pose rider for motorcycle grip
  r.leftArm.rotation.x = -0.7;
  r.rightArm.rotation.x = -0.7;
  r.leftLeg.rotation.x = 0.9;
  r.rightLeg.rotation.x = 0.9;
  r.leftLeg.position.y = 0.4;
  r.rightLeg.position.y = 0.4;
  return r.group;
}

// ----------------------------------------------------
// REALISTIC AUTONOMOUS CYBER TRAFFIC VEHICLE BUILDER
// ----------------------------------------------------
export function createCyberTrafficCar(
  style: 'sports' | 'sedan' | 'patrol' = 'sports',
  paintColor = '#3b82f6'
): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  headlights: THREE.SpotLight[];
} {
  const group = new THREE.Group();
  group.name = `CyberCar_${style}`;

  // Materials
  const paintMat = new THREE.MeshStandardMaterial({
    color: style === 'patrol' ? '#0f172a' : paintColor,
    metalness: 0.85,
    roughness: 0.22,
  });
  const carbonMat = new THREE.MeshStandardMaterial({ color: '#090a0f', roughness: 0.35, metalness: 0.8 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.7,
    transparent: true,
    opacity: 0.85,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.2 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const taillightMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const neonCyan = new THREE.MeshBasicMaterial({ color: style === 'patrol' ? '#38bdf8' : '#00f2fe' });

  // 1. Lower Chassis & Aerodynamic Floor
  const chassisGeo = new THREE.BoxGeometry(2.0, 0.45, 4.4);
  const chassis = new THREE.Mesh(chassisGeo, carbonMat);
  chassis.position.y = 0.45;
  chassis.castShadow = true;
  group.add(chassis);

  // 2. Sculpted Upper Body (Aerodynamic Streamlined Cyberpunk Coupe)
  const cabinGeo = new THREE.BoxGeometry(1.72, 0.58, 2.6);
  const cabin = new THREE.Mesh(cabinGeo, paintMat);
  cabin.position.set(0, 0.85, -0.1);
  cabin.castShadow = true;
  group.add(cabin);

  // Sloped Fastback Roof Canopy
  const roofGeo = new THREE.BoxGeometry(1.5, 0.42, 1.8);
  const roof = new THREE.Mesh(roofGeo, glassMat);
  roof.position.set(0, 1.25, -0.2);
  group.add(roof);

  // Front Hood Scoop & Aero Splitter
  const hoodGeo = new THREE.BoxGeometry(1.85, 0.22, 1.3);
  const hood = new THREE.Mesh(hoodGeo, paintMat);
  hood.position.set(0, 0.65, -1.45);
  hood.rotation.x = 0.12;
  group.add(hood);

  // Front Carbon Aero Splitter
  const splitterGeo = new THREE.BoxGeometry(2.05, 0.08, 0.5);
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.22, -2.15);
  group.add(splitter);

  // Rear Trunk & Diffuser
  const rearWingGeo = new THREE.BoxGeometry(1.9, 0.06, 0.35);
  const rearWing = new THREE.Mesh(rearWingGeo, carbonMat);
  rearWing.position.set(0, 1.15, 1.9);
  group.add(rearWing);

  // Patrol Lightbar if police/security vehicle
  if (style === 'patrol') {
    const lightbarGeo = new THREE.BoxGeometry(1.2, 0.12, 0.2);
    const lightbar = new THREE.Mesh(lightbarGeo, neonCyan);
    lightbar.position.set(0, 1.5, -0.2);
    group.add(lightbar);
  }

  // 3. Headlights & Taillights
  const headlights: THREE.SpotLight[] = [];
  [-0.75, 0.75].forEach((hx) => {
    const headMeshGeo = new THREE.BoxGeometry(0.35, 0.1, 0.08);
    const headMesh = new THREE.Mesh(headMeshGeo, headlightMat);
    headMesh.position.set(hx, 0.62, -2.18);
    group.add(headMesh);

    const spot = new THREE.SpotLight('#ffffff', 2.8, 35, Math.PI / 6, 0.4);
    spot.position.set(hx, 0.65, -2.2);
    spot.target.position.set(hx, 0, -20);
    group.add(spot);
    group.add(spot.target);
    headlights.push(spot);
  });

  // Full-width Horizon Cyber LED Tail Light Bar
  const tailBarGeo = new THREE.BoxGeometry(1.85, 0.08, 0.06);
  const tailBar = new THREE.Mesh(tailBarGeo, taillightMat);
  tailBar.position.set(0, 0.72, 2.18);
  group.add(tailBar);

  // 4. Wheels & Brembo Brakes
  const wheels: THREE.Mesh[] = [];
  const wheelPositions: [number, number, number][] = [
    [-1.02, 0.42, -1.35], // Front Left
    [1.02, 0.42, -1.35],  // Front Right
    [-1.02, 0.42, 1.35],  // Rear Left
    [1.02, 0.42, 1.35],   // Rear Right
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);

    // Tire
    const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Rim
    const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.29, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rim);

    // Glowing Rim Accent Ring
    const ringGeo = new THREE.TorusGeometry(0.24, 0.018, 6, 16);
    ringGeo.rotateY(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, neonCyan);
    wheelGroup.add(ring);

    group.add(wheelGroup);
    wheels.push(tire);
  });

  // Ground Underglow Light
  const underglow = new THREE.PointLight(style === 'patrol' ? '#38bdf8' : '#06b6d4', 2.0, 4.0);
  underglow.position.set(0, 0.2, 0);
  group.add(underglow);

  return { group, wheels, headlights };
}

// ----------------------------------------------------
// MINI RECON DRONE 3D BUILDER
// ----------------------------------------------------
export function createMiniDrone(): {
  group: THREE.Group;
  rotors: THREE.Mesh[];
  scannerLight: THREE.SpotLight;
} {
  const group = new THREE.Group();
  group.name = 'MiniDrone';

  const bodyMat = new THREE.MeshStandardMaterial({ color: '#0284c7', metalness: 0.7, roughness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

  // Core
  const coreGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.15, 8);
  const core = new THREE.Mesh(coreGeo, bodyMat);
  group.add(core);

  // 4 Arm extensions
  const armGeo = new THREE.BoxGeometry(0.65, 0.03, 0.04);
  const arm1 = new THREE.Mesh(armGeo, darkMat);
  const arm2 = new THREE.Mesh(armGeo, darkMat);
  arm2.rotation.y = Math.PI / 2;
  group.add(arm1, arm2);

  // 4 Propellers
  const rotors: THREE.Mesh[] = [];
  const rotorGeo = new THREE.BoxGeometry(0.24, 0.01, 0.03);
  const positions: [number, number][] = [
    [0.32, 0],
    [-0.32, 0],
    [0, 0.32],
    [0, -0.32],
  ];

  positions.forEach(([x, z]) => {
    const motorGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8);
    const motor = new THREE.Mesh(motorGeo, darkMat);
    motor.position.set(x, 0.04, z);
    group.add(motor);

    const rMesh = new THREE.Mesh(rotorGeo, glowMat);
    rMesh.position.set(x, 0.08, z);
    group.add(rMesh);
    rotors.push(rMesh);
  });

  // Scanner Spotlight
  const scannerLight = new THREE.SpotLight('#38bdf8', 2.5, 20, Math.PI / 4, 0.4);
  scannerLight.position.set(0, -0.1, 0);
  scannerLight.target.position.set(0, -10, 0);
  group.add(scannerLight);
  group.add(scannerLight.target);

  return { group, rotors, scannerLight };
}

// ----------------------------------------------------
// CHAOS SECURITY BOT & ENEMY DRONE
// ----------------------------------------------------
export function createChaosGuardBot(name: string): {
  group: THREE.Group;
  eye: THREE.Mesh;
  coneMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = `CHAOS_Bot_${name}`;

  const botMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 });
  const chaosRed = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.9 });

  // Chassis / Dome
  const domeGeo = new THREE.SphereGeometry(0.4, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, botMat);
  dome.position.y = 0.5;
  dome.castShadow = true;
  group.add(dome);

  const baseGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.4, 12);
  const base = new THREE.Mesh(baseGeo, botMat);
  base.position.y = 0.35;
  group.add(base);

  // Wheels / Treads
  const w1Geo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 10);
  w1Geo.rotateZ(Math.PI / 2);
  const w1 = new THREE.Mesh(w1Geo, wheelMat);
  w1.position.set(-0.4, 0.18, 0);
  const w2 = new THREE.Mesh(w1Geo, wheelMat);
  w2.position.set(0.4, 0.18, 0);
  group.add(w1, w2);

  // Glowing Eye
  const eyeGeo = new THREE.BoxGeometry(0.25, 0.08, 0.08);
  const eye = new THREE.Mesh(eyeGeo, chaosRed);
  eye.position.set(0, 0.65, 0.36);
  group.add(eye);

  // Antenna
  const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6);
  const ant = new THREE.Mesh(antGeo, botMat);
  ant.position.set(0.15, 0.9, -0.1);
  group.add(ant);

  // Detection Vision Cone (Visible translucent cone projecting on ground)
  const coneGeo = new THREE.ConeGeometry(3.2, 8, 16, 1, true);
  coneGeo.rotateX(-Math.PI / 2);
  coneGeo.translate(0, 0, 4);
  const coneMat = new THREE.MeshBasicMaterial({
    color: '#ef4444',
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.position.set(0, 0.5, 0);
  group.add(coneMesh);

  return { group, eye, coneMesh };
}

// ----------------------------------------------------
// SECURITY CAMERA (sweeping cone — ChaosAlertManager / spec §12)
// ----------------------------------------------------
export function createSecurityCamera(id: string): { group: THREE.Group; coneMesh: THREE.Mesh } {
  const group = new THREE.Group();
  group.name = `CHAOS_Cam_${id}`;

  const steel = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.75, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.4 });
  const lensMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8), steel);
  pole.position.y = -2.1;
  group.add(pole);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.42), dark);
  group.add(head);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 10), lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.24;
  group.add(lens);

  const coneGeo = new THREE.ConeGeometry(4.2, 11, 16, 1, true);
  coneGeo.rotateX(-Math.PI / 2);
  coneGeo.translate(0, 0, 5.5);
  const coneMesh = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  group.add(coneMesh);

  return { group, coneMesh };
}

// ----------------------------------------------------
// CHAOS PURSUIT DRONE (search / interceptor)
// ----------------------------------------------------
export function createChaosPursuitDrone(kind: 'search' | 'interceptor'): {
  group: THREE.Group;
  rotors: THREE.Mesh[];
  coneMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = kind === 'search' ? 'CHAOS_SearchDrone' : 'CHAOS_Interceptor';

  const accent = kind === 'search' ? '#f97316' : '#ef4444';
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.75, roughness: 0.28 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#09090b', metalness: 0.5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: accent });

  const scale = kind === 'search' ? 1.15 : 1.35;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.16, 8), bodyMat);
  group.add(core);

  const armGeo = new THREE.BoxGeometry(0.72, 0.03, 0.045);
  const arm1 = new THREE.Mesh(armGeo, darkMat);
  const arm2 = new THREE.Mesh(armGeo, darkMat);
  arm2.rotation.y = Math.PI / 2;
  group.add(arm1, arm2);

  const rotors: THREE.Mesh[] = [];
  const rotorGeo = new THREE.BoxGeometry(0.28, 0.012, 0.035);
  const motorGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.07, 8);
  (
    [
      [0.34, 0],
      [-0.34, 0],
      [0, 0.34],
      [0, -0.34],
    ] as [number, number][]
  ).forEach(([x, z]) => {
    const motor = new THREE.Mesh(motorGeo, darkMat);
    motor.position.set(x, 0.05, z);
    group.add(motor);
    const blade = new THREE.Mesh(rotorGeo, glowMat);
    blade.position.set(x, 0.09, z);
    group.add(blade);
    rotors.push(blade);
  });

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), glowMat);
  eye.position.set(0, -0.08, 0.18);
  group.add(eye);

  const coneGeo = new THREE.ConeGeometry(kind === 'search' ? 5 : 4, kind === 'search' ? 12 : 9, 16, 1, true);
  coneGeo.rotateX(Math.PI / 2);
  coneGeo.translate(0, 0, kind === 'search' ? 6 : 4.5);
  const coneMesh = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  // Search drone scans downward; interceptors look forward.
  if (kind === 'search') coneMesh.rotation.x = Math.PI / 2.6;
  group.add(coneMesh);

  group.scale.setScalar(scale);
  return { group, rotors, coneMesh };
}

export function createChaosTracker(): { group: THREE.Group; pulse: THREE.Mesh } {
  const group = new THREE.Group();
  group.name = 'CHAOS_Tracker';
  const glow = new THREE.MeshBasicMaterial({ color: '#f43f5e' });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glow);
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.04, 6, 18),
    new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  return { group, pulse: ring };
}

export function createChaosRoadblock(): { group: THREE.Group } {
  const group = new THREE.Group();
  group.name = 'CHAOS_Roadblock';
  const stripe = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.4, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.5, roughness: 0.4 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.15, 0.7), stripe);
  bar.position.y = 0.7;
  group.add(bar);
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.28, 1.1), dark);
  base.position.y = 0.14;
  group.add(base);
  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6);
  const p1 = new THREE.Mesh(postGeo, dark);
  p1.position.set(-2.4, 0.8, 0);
  const p2 = new THREE.Mesh(postGeo, dark);
  p2.position.set(2.4, 0.8, 0);
  group.add(p1, p2);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.7, 8),
    new THREE.MeshBasicMaterial({ color: '#f97316' })
  );
  cone.position.set(-2.9, 0.4, 0.7);
  group.add(cone);
  return { group };
}

export function createElitePursuitRobot(name: string): {
  group: THREE.Group;
  coneMesh: THREE.Mesh;
} {
  const { group, coneMesh } = createChaosGuardBot(name);
  group.name = `CHAOS_Elite_${name}`;
  group.scale.setScalar(1.65);
  // Taller chassis cue — a second red "crown" light.
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#f43f5e' })
  );
  crown.position.set(0, 1.15, 0);
  group.add(crown);
  return { group, coneMesh };
}

// ----------------------------------------------------
// GIANT CHAOS CARGO DRONE (BOSS CLIMAX)
// ----------------------------------------------------
export function createGiantCargoDrone(): {
  group: THREE.Group;
  rotors: THREE.Mesh[];
  relays: { mesh: THREE.Mesh; disabled: boolean }[];
} {
  const group = new THREE.Group();
  group.name = 'Giant_CHAOS_Cargo_Drone';

  const hullMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.3 });
  const yellowHazard = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#f43f5e' });

  // Main Cargo Hull
  const hullGeo = new THREE.BoxGeometry(3.2, 1.2, 5.5);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow = true;
  group.add(hull);

  // Glowing Prototype Container held below
  const contGeo = new THREE.BoxGeometry(1.8, 1.4, 2.8);
  const cont = new THREE.Mesh(contGeo, yellowHazard);
  cont.position.set(0, -1.1, 0);
  group.add(cont);

  // 4 Giant Rotor Wings
  const rotors: THREE.Mesh[] = [];
  const wingPositions: [number, number][] = [
    [3.5, 2.5],
    [-3.5, 2.5],
    [3.5, -2.5],
    [-3.5, -2.5],
  ];

  const rotorGeo = new THREE.BoxGeometry(2.4, 0.05, 0.3);
  wingPositions.forEach(([x, z]) => {
    // Strut
    const strutGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8);
    const strut = new THREE.Mesh(strutGeo, hullMat);
    strut.position.set(x * 0.5, 0.2, z * 0.5);
    strut.rotation.z = x > 0 ? -0.8 : 0.8;
    group.add(strut);

    // Motor Pod
    const podGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.6, 12);
    const pod = new THREE.Mesh(podGeo, hullMat);
    pod.position.set(x, 0.5, z);
    group.add(pod);

    // Propeller Blade
    const rBlade = new THREE.Mesh(rotorGeo, glowMat);
    rBlade.position.set(x, 0.85, z);
    group.add(rBlade);
    rotors.push(rBlade);
  });

  // 3 EMP Relays that the player must target and disable
  const relays: { mesh: THREE.Mesh; disabled: boolean }[] = [];
  const relayGeo = new THREE.SphereGeometry(0.35, 10, 10);
  const relayPositions: [number, number, number][] = [
    [0, -0.6, -2.2], // Front relay
    [-1.2, -0.6, 0.5], // Left relay
    [1.2, -0.6, 0.5], // Right relay
  ];

  relayPositions.forEach((pos, i) => {
    const rMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    const rMesh = new THREE.Mesh(relayGeo, rMat);
    rMesh.position.set(...pos);
    rMesh.name = `EMP_Relay_${i + 1}`;
    group.add(rMesh);
    relays.push({ mesh: rMesh, disabled: false });
  });

  return { group, rotors, relays };
}

// ----------------------------------------------------
// CYBER FUEL & PLASMA RECHARGE STATION 3D MODEL
// ----------------------------------------------------
export function createCyberFuelStation(id: string, name: string): {
  group: THREE.Group;
  holoIcon: THREE.Mesh;
  pulseRing: THREE.Mesh;
  pumpLights: THREE.Mesh[];
  padBox: THREE.Box3;
} {
  const group = new THREE.Group();
  group.name = `Fuel_Station_${id}`;

  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.7 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.9 });
  const neonCyan = new THREE.MeshBasicMaterial({ color: '#00f2fe' });
  const neonGreen = new THREE.MeshBasicMaterial({ color: '#10b981' });
  const neonGlowMat = new THREE.MeshStandardMaterial({
    color: '#059669',
    emissive: '#10b981',
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  // 1. Ground Recharge Base / Island
  const baseGeo = new THREE.BoxGeometry(7.5, 0.25, 6.0);
  const baseMesh = new THREE.Mesh(baseGeo, darkMat);
  baseMesh.position.y = 0.125;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Ground Glowing Ring / Pad
  const ringGeo = new THREE.RingGeometry(1.6, 2.3, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const pulseRing = new THREE.Mesh(ringGeo, neonGreen);
  pulseRing.position.set(0, 0.26, 0.8);
  group.add(pulseRing);

  // Chevron floor strip
  const chevGeo = new THREE.PlaneGeometry(1.8, 0.25);
  chevGeo.rotateX(-Math.PI / 2);
  for (let i = -1; i <= 1; i++) {
    const chev = new THREE.Mesh(chevGeo, neonCyan);
    chev.position.set(0, 0.265, 0.8 + i * 0.7);
    group.add(chev);
  }

  // 2. Dual Support Pillars
  const pillarGeo = new THREE.BoxGeometry(0.5, 4.2, 0.5);
  [-2.8, 2.8].forEach((px) => {
    const pillar = new THREE.Mesh(pillarGeo, carbonMat);
    pillar.position.set(px, 2.1, -1.8);
    pillar.castShadow = true;
    group.add(pillar);

    // Neon stripe on pillar
    const stripeGeo = new THREE.PlaneGeometry(0.12, 3.8);
    const stripe = new THREE.Mesh(stripeGeo, neonCyan);
    stripe.position.set(px + (px > 0 ? -0.26 : 0.26), 2.1, -1.8);
    stripe.rotation.y = px > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(stripe);
  });

  // 3. Overhead Cyber Canopy Roof
  const canopyGeo = new THREE.BoxGeometry(8.0, 0.45, 6.5);
  const canopy = new THREE.Mesh(canopyGeo, darkMat);
  canopy.position.set(0, 4.2, 0);
  canopy.castShadow = true;
  group.add(canopy);

  // Glowing Canopy Edge Trim
  const trimGeo = new THREE.BoxGeometry(8.1, 0.12, 6.6);
  const trim = new THREE.Mesh(trimGeo, neonCyan);
  trim.position.set(0, 4.2, 0);
  group.add(trim);

  // 4. Central Fuel Pump Station Terminal
  const pumpLights: THREE.Mesh[] = [];
  const pumpGeo = new THREE.BoxGeometry(1.4, 2.0, 0.8);
  const pumpMesh = new THREE.Mesh(pumpGeo, darkMat);
  pumpMesh.position.set(0, 1.1, -1.8);
  pumpMesh.castShadow = true;
  group.add(pumpMesh);

  // Digital Pump Display Screen
  const screenGeo = new THREE.PlaneGeometry(1.0, 0.6);
  const screenMat = new THREE.MeshBasicMaterial({ color: '#10b981' });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.4, -1.39);
  group.add(screen);
  pumpLights.push(screen);

  // Nozzle / Hose Dispenser Pods
  [-0.55, 0.55].forEach((hx) => {
    const nozzleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
    const nozzle = new THREE.Mesh(nozzleGeo, neonCyan);
    nozzle.position.set(hx, 1.0, -1.35);
    nozzle.rotation.z = hx > 0 ? 0.3 : -0.3;
    group.add(nozzle);
    pumpLights.push(nozzle);
  });

  // 5. Overhead Rotating Holographic Fuel / Energy Icon
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0, 5.4, 0);

  // Octahedral Energy Core / Fuel Canister
  const iconGeo = new THREE.OctahedronGeometry(0.7, 0);
  const holoIcon = new THREE.Mesh(iconGeo, neonGlowMat);
  holoGroup.add(holoIcon);

  // Outer orbital halo ring
  const haloGeo = new THREE.TorusGeometry(1.1, 0.06, 8, 24);
  const halo = new THREE.Mesh(haloGeo, neonCyan);
  halo.rotation.x = Math.PI / 3;
  holoGroup.add(halo);

  group.add(holoGroup);

  // Pad Bounding Box for Triggering Refuel Interaction
  const padBox = new THREE.Box3();
  padBox.setFromCenterAndSize(new THREE.Vector3(0, 1.5, 0.8), new THREE.Vector3(6.5, 3.0, 5.5));

  return { group, holoIcon, pulseRing, pumpLights, padBox };
}

// ----------------------------------------------------
// URBAN ENVIRONMENT 3D BUILDERS
// ----------------------------------------------------

// 1. Cyber Street Lamp
export function createStreetLight(color = '#38bdf8'): {
  group: THREE.Group;
  light: THREE.SpotLight;
} {
  const group = new THREE.Group();
  group.name = 'StreetLight';

  const poleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.2 });
  const bulbMat = new THREE.MeshBasicMaterial({ color });

  // Base
  const baseGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8);
  const base = new THREE.Mesh(baseGeo, poleMat);
  base.position.y = 0.3;
  group.add(base);

  // Vertical Pole
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 8);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 3.6;
  pole.castShadow = true;
  group.add(pole);

  // Curved Top Arm
  const armGeo = new THREE.BoxGeometry(1.8, 0.12, 0.14);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(0.7, 6.8, 0);
  arm.rotation.z = -0.15;
  group.add(arm);

  // Lamp Head Fixture
  const headGeo = new THREE.BoxGeometry(0.65, 0.15, 0.3);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(1.4, 6.6, 0);
  group.add(head);

  // Glowing Bulb Lens
  const bulbGeo = new THREE.PlaneGeometry(0.55, 0.22);
  bulbGeo.rotateX(Math.PI / 2);
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(1.4, 6.51, 0);
  group.add(bulb);

  // SpotLight casting light downward onto street/sidewalk
  const light = new THREE.SpotLight(color, 2.4, 25, Math.PI / 4.5, 0.5, 1.2);
  light.position.set(1.4, 6.5, 0);
  light.target.position.set(1.4, 0, 0);
  group.add(light);
  group.add(light.target);

  return { group, light };
}

// 2. Cyber Tree / Urban Planter
export function createCyberTree(foliageColor = '#10b981'): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CyberTree';

  const planterMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6, metalness: 0.5 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#090a0f', roughness: 0.4, metalness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.2, metalness: 0.4, emissive: foliageColor, emissiveIntensity: 0.2 });
  const neonCyan = new THREE.MeshBasicMaterial({ color: '#06b6d4' });

  // Planter Box
  const planterGeo = new THREE.CylinderGeometry(1.2, 0.9, 0.7, 8);
  const planter = new THREE.Mesh(planterGeo, planterMat);
  planter.position.y = 0.35;
  planter.castShadow = true;
  group.add(planter);

  // Planter neon accent ring
  const ringGeo = new THREE.TorusGeometry(1.15, 0.03, 6, 16);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, neonCyan);
  ring.position.y = 0.55;
  group.add(ring);

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 3.2, 8);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2.1;
  trunk.castShadow = true;
  group.add(trunk);

  // Tiered Geometric Holographic Canopy
  [
    { y: 3.5, rad: 1.6, h: 1.4 },
    { y: 4.5, rad: 1.2, h: 1.2 },
    { y: 5.3, rad: 0.8, h: 1.0 },
  ].forEach((tier) => {
    const coneGeo = new THREE.ConeGeometry(tier.rad, tier.h, 6);
    const cone = new THREE.Mesh(coneGeo, leafMat);
    cone.position.y = tier.y;
    cone.castShadow = true;
    group.add(cone);
  });

  return group;
}

// 3. Cyber Transit Bus Shelter
export function createBusStop(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BusStop';

  const frameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.8, roughness: 0.3 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transmission: 0.8, opacity: 0.7, transparent: true, roughness: 0.1 });
  const screenMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
  const seatMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 });

  // Base platform
  const baseGeo = new THREE.BoxGeometry(4.2, 0.15, 2.2);
  const base = new THREE.Mesh(baseGeo, frameMat);
  base.position.y = 0.08;
  group.add(base);

  // Glass Back Wall
  const backGeo = new THREE.BoxGeometry(4.0, 2.5, 0.08);
  const backWall = new THREE.Mesh(backGeo, glassMat);
  backWall.position.set(0, 1.4, -0.95);
  group.add(backWall);

  // Roof Canopy
  const roofGeo = new THREE.BoxGeometry(4.4, 0.12, 2.5);
  const roof = new THREE.Mesh(roofGeo, frameMat);
  roof.position.set(0, 2.7, 0);
  group.add(roof);

  // Integrated Bench
  const benchGeo = new THREE.BoxGeometry(2.6, 0.08, 0.5);
  const bench = new THREE.Mesh(benchGeo, seatMat);
  bench.position.set(0, 0.55, -0.6);
  group.add(bench);

  // Digital Transit Display Schedule
  const signGeo = new THREE.PlaneGeometry(0.9, 1.4);
  const sign = new THREE.Mesh(signGeo, screenMat);
  sign.position.set(1.5, 1.5, -0.9);
  group.add(sign);

  return group;
}

/** Vertical drive-through hoop for the downtown sprint (spec §19). */
export function createRaceCheckpoint(index: number): { group: THREE.Group; ring: THREE.Mesh } {
  const group = new THREE.Group();
  group.name = `RaceGate_${index + 1}`;

  const ringMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.16, 8, 24), ringMat);
  ring.position.y = 2.2;
  group.add(ring);

  const pad = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.08;
  group.add(pad);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.0, 6),
    new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.7, roughness: 0.3 })
  );
  post.position.set(3.2, 1.0, 0);
  group.add(post);

  return { group, ring };
}

// 4. Street Bench
export function createStreetBench(): THREE.Group {
  const group = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.8, roughness: 0.3 });
  const slatMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', metalness: 0.4, roughness: 0.3 });

  // Legs
  [-0.8, 0.8].forEach((lx) => {
    const legGeo = new THREE.BoxGeometry(0.08, 0.45, 0.55);
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.25, 0);
    group.add(leg);
  });

  // Seat
  const seatGeo = new THREE.BoxGeometry(1.9, 0.06, 0.55);
  const seat = new THREE.Mesh(seatGeo, slatMat);
  seat.position.set(0, 0.48, 0);
  group.add(seat);

  // Backrest
  const backGeo = new THREE.BoxGeometry(1.9, 0.4, 0.06);
  const back = new THREE.Mesh(backGeo, slatMat);
  back.position.set(0, 0.75, -0.24);
  group.add(back);

  return group;
}

// 5. Crosswalk Signal Beacon Post
export function createCrosswalkSignal(): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8 });
  const boxMat = new THREE.MeshStandardMaterial({ color: '#090a0f', roughness: 0.5 });
  const walkLightMat = new THREE.MeshBasicMaterial({ color: '#10b981' });

  // Post
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8);
  const post = new THREE.Mesh(postGeo, poleMat);
  post.position.y = 1.3;
  group.add(post);

  // Housing Box
  const boxGeo = new THREE.BoxGeometry(0.3, 0.5, 0.2);
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(0, 2.2, 0.12);
  group.add(box);

  // Glowing Pedestrian Walk Sign
  const walkGeo = new THREE.PlaneGeometry(0.2, 0.35);
  const walk = new THREE.Mesh(walkGeo, walkLightMat);
  walk.position.set(0, 2.2, 0.23);
  group.add(walk);

  return group;
}

// ----------------------------------------------------
// LOCAL NPC CITIZEN & PEDESTRIAN BUILDER
// ----------------------------------------------------
export function createLocalNPCMesh(
  suitColor = '#3b82f6',
  skinTone = '#fcd34d',
  isQuestGiver = false,
  questGiverName = ''
): {
  group: THREE.Group;
  head: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  questIcon?: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = `NPC_${questGiverName || 'Citizen'}`;

  const clothesMat = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.5, metalness: 0.2 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.6 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
  const visorMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

  // 1. Torso / Jacket
  const torsoGeo = new THREE.BoxGeometry(0.44, 0.58, 0.24);
  const torso = new THREE.Mesh(torsoGeo, clothesMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  // 2. Head & Cyber Visor / Glasses
  const headGeo = new THREE.BoxGeometry(0.26, 0.28, 0.26);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.52;
  head.castShadow = true;
  group.add(head);

  // Cyber Visor / Shades
  const visorGeo = new THREE.BoxGeometry(0.28, 0.08, 0.12);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 1.54, 0.12);
  group.add(visor);

  // 3. Arms
  function makeArm(isLeft: boolean): THREE.Group {
    const armGroup = new THREE.Group();
    armGroup.position.set(isLeft ? -0.28 : 0.28, 1.28, 0);

    const sleeveGeo = new THREE.BoxGeometry(0.12, 0.44, 0.12);
    const sleeve = new THREE.Mesh(sleeveGeo, clothesMat);
    sleeve.position.y = -0.22;
    armGroup.add(sleeve);

    const handGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.48;
    armGroup.add(hand);

    return armGroup;
  }

  const leftArm = makeArm(true);
  const rightArm = makeArm(false);
  group.add(leftArm, rightArm);

  // 4. Legs
  function makeLeg(isLeft: boolean): THREE.Group {
    const legGroup = new THREE.Group();
    legGroup.position.set(isLeft ? -0.12 : 0.12, 0.76, 0);

    const pantGeo = new THREE.BoxGeometry(0.14, 0.52, 0.14);
    const pant = new THREE.Mesh(pantGeo, pantsMat);
    pant.position.y = -0.26;
    legGroup.add(pant);

    const shoeGeo = new THREE.BoxGeometry(0.15, 0.1, 0.22);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(0, -0.56, 0.04);
    legGroup.add(shoe);

    return legGroup;
  }

  const leftLeg = makeLeg(true);
  const rightLeg = makeLeg(false);
  group.add(leftLeg, rightLeg);

  // 5. Floating Dialogue / Quest Exclamation Marker if Quest Giver
  let questIcon: THREE.Mesh | undefined;
  if (isQuestGiver) {
    const iconGeo = new THREE.OctahedronGeometry(0.24, 0);
    const iconMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
    questIcon = new THREE.Mesh(iconGeo, iconMat);
    questIcon.position.set(0, 2.05, 0);
    group.add(questIcon);

    // Floating speech ring
    const ringGeo = new THREE.RingGeometry(0.28, 0.34, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fbbf24', side: THREE.DoubleSide }));
    ring.position.set(0, 2.05, 0);
    group.add(ring);
  }

  return {
    group,
    head,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    questIcon,
  };
}

