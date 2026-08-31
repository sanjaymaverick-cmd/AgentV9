import * as THREE from 'three';

/**
 * Procedural city architecture (spec: everything from primitives + canvas textures).
 * Facades are baked window grids — not per-window meshes — so a tower is still a
 * handful of draw calls. Landmarks keep the same collider footprints as the old boxes.
 */

export type BuildingStyle = 'office' | 'residential' | 'tech' | 'industrial' | 'plaza';

interface Palette {
  wall: string;
  panel: string;
  frame: string;
  litA: string;
  litB: string;
  darkWin: string;
  neon: string;
  shop: string;
}

const PALETTES: Record<BuildingStyle, Palette> = {
  office: {
    wall: '#1a2744',
    panel: '#243656',
    frame: '#0b1220',
    litA: '#dbeafe',
    litB: '#fef3c7',
    darkWin: '#07101c',
    neon: '#38bdf8',
    shop: '#0ea5e9',
  },
  residential: {
    wall: '#2a2038',
    panel: '#3b2d4e',
    frame: '#140c1c',
    litA: '#fde68a',
    litB: '#fda4af',
    darkWin: '#120818',
    neon: '#f472b6',
    shop: '#fb7185',
  },
  tech: {
    wall: '#08302e',
    panel: '#0f4a46',
    frame: '#021714',
    litA: '#5eead4',
    litB: '#c4b5fd',
    darkWin: '#03110f',
    neon: '#2dd4bf',
    shop: '#22d3ee',
  },
  industrial: {
    wall: '#2a241c',
    panel: '#3f362a',
    frame: '#12100c',
    litA: '#fbbf24',
    litB: '#fdba74',
    darkWin: '#0c0a08',
    neon: '#f59e0b',
    shop: '#ca8a04',
  },
  plaza: {
    wall: '#1e2a44',
    panel: '#2a3b5c',
    frame: '#0b1220',
    litA: '#7dd3fc',
    litB: '#f0abfc',
    darkWin: '#0a1222',
    neon: '#22d3ee',
    shop: '#38bdf8',
  },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d')!;
}

function toTexture(ctx: CanvasRenderingContext2D, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(ctx.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

const facadeCache = new Map<string, THREE.CanvasTexture>();
let roofTex: THREE.CanvasTexture | null = null;
let skyTex: THREE.CanvasTexture | null = null;

export function createNightSkyTexture(): THREE.CanvasTexture {
  if (skyTex) return skyTex;
  const W = 512;
  const H = 256;
  const ctx = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050816');
  g.addColorStop(0.38, '#0b1a3a');
  g.addColorStop(0.52, '#163056');
  g.addColorStop(0.58, '#1c3d5c');
  g.addColorStop(0.72, '#0e1a30');
  g.addColorStop(1, '#070b14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Horizon glow
  const hg = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.55);
  hg.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
  hg.addColorStop(0.45, 'rgba(99, 102, 241, 0.08)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, H);

  // Sparse stars
  const rng = mulberry32(90210);
  for (let i = 0; i < 180; i++) {
    const x = rng() * W;
    const y = rng() * H * 0.48;
    const a = 0.25 + rng() * 0.7;
    ctx.fillStyle = `rgba(226,232,240,${a})`;
    ctx.fillRect(x, y, rng() > 0.85 ? 2 : 1, 1);
  }
  skyTex = toTexture(ctx, false);
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  return skyTex;
}

function createRoofTexture(): THREE.CanvasTexture {
  if (roofTex) return roofTex;
  const S = 128;
  const ctx = makeCanvas(S, S);
  ctx.fillStyle = '#1b2433';
  ctx.fillRect(0, 0, S, S);
  const rng = mulberry32(77);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = rng() > 0.5 ? '#151c28' : '#243044';
    ctx.fillRect(rng() * S, rng() * S, 2, 2);
  }
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, S - 12, S - 12);
  roofTex = toTexture(ctx, true);
  roofTex.repeat.set(2, 2);
  return roofTex;
}

function createFacadeTexture(style: BuildingStyle, seed: number): THREE.CanvasTexture {
  const key = `${style}:${seed}`;
  const hit = facadeCache.get(key);
  if (hit) return hit;

  const S = 256;
  const pal = PALETTES[style];
  const rng = mulberry32(seed * 997 + style.length * 13);
  const ctx = makeCanvas(S, S);

  ctx.fillStyle = pal.wall;
  ctx.fillRect(0, 0, S, S);

  // Cladding panels
  ctx.strokeStyle = pal.panel;
  ctx.lineWidth = 1;
  for (let x = 0; x < S; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, S);
    ctx.stroke();
  }

  const shopH = Math.floor(S * 0.2);
  ctx.fillStyle = pal.frame;
  ctx.fillRect(0, S - shopH, S, shopH);
  ctx.fillStyle = pal.shop;
  ctx.globalAlpha = 0.85;
  const bays = style === 'industrial' ? 3 : 4;
  const bayW = (S - 16) / bays;
  for (let i = 0; i < bays; i++) {
    const bx = 8 + i * bayW + 4;
    ctx.fillRect(bx, S - shopH + 10, bayW - 10, shopH - 18);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.neon;
  ctx.fillRect(0, S - shopH - 3, S, 3);

  const cols = style === 'industrial' ? 4 : 6;
  const rows = style === 'industrial' ? 5 : 8;
  const marginX = 10;
  const marginY = 8;
  const usableW = S - marginX * 2;
  const usableH = S - shopH - 14 - marginY;
  const cellW = usableW / cols;
  const cellH = usableH / rows;
  const pad = style === 'industrial' ? 6 : 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * cellW + pad;
      const y = marginY + r * cellH + pad;
      const w = cellW - pad * 2;
      const h = cellH - pad * 2;
      ctx.fillStyle = pal.frame;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      const lit = rng() > (style === 'industrial' ? 0.62 : 0.38);
      if (lit) {
        ctx.fillStyle = rng() > 0.55 ? pal.litA : pal.litB;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x, y, w, h * 0.35);
      } else {
        ctx.fillStyle = pal.darkWin;
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  const tex = toTexture(ctx, true);
  facadeCache.set(key, tex);
  return tex;
}

function createSignTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const ctx = makeCanvas(256, 64);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, 256, 4);
  ctx.fillRect(0, 60, 256, 4);
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.fillText(text, 128, 34);
  return toTexture(ctx, false);
}

function facadeMaterial(tex: THREE.CanvasTexture, repeatX: number, repeatY: number): THREE.MeshStandardMaterial {
  const map = tex.clone();
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    emissive: '#ffffff',
    emissiveMap: map,
    emissiveIntensity: 0.42,
    roughness: 0.45,
    metalness: 0.35,
  });
}

function roofMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: createRoofTexture(),
    color: '#94a3b8',
    roughness: 0.85,
    metalness: 0.25,
  });
}

const steelMat = () =>
  new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.35 });
const darkMat = () =>
  new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.4 });

export interface CityBuildingOpts {
  width: number;
  depth: number;
  height: number;
  style: BuildingStyle;
  seed: number;
  name?: string;
  sign?: string;
}

export function createCityBuilding(opts: CityBuildingOpts): THREE.Group {
  const { width: w, depth: d, height: h, style, seed, sign } = opts;
  const group = new THREE.Group();
  group.name = opts.name ?? `CityBuilding_${seed}`;
  const pal = PALETTES[style];
  const rng = mulberry32(seed + 19);
  const facade = createFacadeTexture(style, seed);

  const rx = Math.max(1, Math.round(w / 8));
  const rz = Math.max(1, Math.round(d / 8));
  const ry = Math.max(2, Math.round(h / 5));
  const matX = facadeMaterial(facade, rz, ry);
  const matZ = facadeMaterial(facade, rx, ry);
  const roofMat = roofMaterial();
  const bottomMat = darkMat();

  const bodyH = h >= 36 ? h * 0.62 : h;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), [matX, matX, roofMat, bottomMat, matZ, matZ]);
  body.position.y = bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  if (h >= 36) {
    const tw = w * 0.72;
    const td = d * 0.72;
    const th = h - bodyH;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), [matX, matX, roofMat, bottomMat, matZ, matZ]);
    tower.position.y = bodyH + th / 2;
    tower.castShadow = true;
    group.add(tower);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(tw + 0.6, 0.35, td + 0.6),
      new THREE.MeshStandardMaterial({ color: pal.neon, emissive: pal.neon, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.6 })
    );
    cap.position.y = h + 0.1;
    group.add(cap);
  } else {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.3, d + 0.5),
      new THREE.MeshStandardMaterial({ color: pal.neon, emissive: pal.neon, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.55 })
    );
    cap.position.y = h + 0.08;
    group.add(cap);
  }

  // Roof furniture
  const roofY = h + 0.4;
  const units = h > 24 ? 3 : 2;
  for (let i = 0; i < units; i++) {
    const uw = 1.6 + rng() * 2.2;
    const ud = 1.4 + rng() * 1.8;
    const uh = 0.8 + rng() * 1.4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(uw, uh, ud), steelMat());
    box.position.set((rng() - 0.5) * (w * 0.45), roofY + uh / 2, (rng() - 0.5) * (d * 0.45));
    group.add(box);
  }

  if (h > 22) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.5, 6), steelMat());
    mast.position.set(w * 0.18, roofY + 2.4, d * 0.12);
    group.add(mast);
    const blink = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 6, 6),
      new THREE.MeshBasicMaterial({ color: '#ef4444' })
    );
    blink.position.copy(mast.position);
    blink.position.y += 2.4;
    group.add(blink);
  }

  if (sign) {
    const signTex = createSignTexture(sign, pal.frame, pal.neon);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.72, 14), 2.2),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: false })
    );
    signMesh.position.set(0, Math.min(h * 0.55, 16), d / 2 + 0.12);
    group.add(signMesh);
  }

  // Vertical neon corner pipes
  const pipeMat = new THREE.MeshBasicMaterial({ color: pal.neon });
  const pipeH = Math.min(h, 22);
  const pipeGeo = new THREE.CylinderGeometry(0.07, 0.07, pipeH, 5);
  (
    [
      [w / 2, d / 2],
      [-w / 2, d / 2],
      [w / 2, -d / 2],
      [-w / 2, -d / 2],
    ] as [number, number][]
  ).forEach(([px, pz]) => {
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.set(px, pipeH / 2, pz);
    group.add(pipe);
  });

  return group;
}

export function createAcademyHQ(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'V9_Academy_HQ';
  group.position.set(-80, 0, -50);

  const facade = createFacadeTexture('tech', 1);
  const matX = facadeMaterial(facade, 3, 3);
  const matZ = facadeMaterial(facade, 4, 3);
  const roofMat = roofMaterial();
  const curtain = createFacadeTexture('tech', 99);
  const curtainMap = curtain.clone();
  curtainMap.wrapS = THREE.RepeatWrapping;
  curtainMap.wrapT = THREE.RepeatWrapping;
  curtainMap.repeat.set(3, 7);
  curtainMap.needsUpdate = true;
  const glass = new THREE.MeshStandardMaterial({
    map: curtainMap,
    emissive: '#ffffff',
    emissiveMap: curtainMap,
    emissiveIntensity: 0.28,
    color: '#8fb4c9',
    metalness: 0.72,
    roughness: 0.22,
  });
  const cyan = new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    emissive: '#0891b2',
    emissiveIntensity: 0.45,
    metalness: 0.5,
    roughness: 0.3,
  });
  const steel = steelMat();

  const base = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 28), [matX, matX, roofMat, darkMat(), matZ, matZ]);
  base.position.y = 7;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(34.4, 0.35, 28.4), cyan);
  trim.position.y = 14.05;
  group.add(trim);

  // East entrance (faces downtown) — keep the canopy modest so it doesn't eat the spawn camera
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.28, 6.5), steel);
  canopy.position.set(18.4, 4.6, 0);
  group.add(canopy);
  const canopyEdge = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 6.6), cyan);
  canopyEdge.position.set(18.4, 4.48, 0);
  group.add(canopyEdge);
  [0, 1, 2].forEach((i) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 5.2 - i * 0.4), steel);
    step.position.set(19.2 + i * 0.35, 0.22 + i * 0.22, 0);
    group.add(step);
  });
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 3.6, 3.2),
    new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: '#0891b2',
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.2,
    })
  );
  door.position.set(17.05, 2.6, 0);
  group.add(door);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 1.8),
    new THREE.MeshBasicMaterial({ map: createSignTexture('V9 ACADEMY', '#042f2e', '#5eead4') })
  );
  sign.position.set(17.2, 8.4, 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(8, 10.5, 48, 12), glass);
  tower.position.y = 38;
  tower.castShadow = true;
  group.add(tower);

  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.2 - i * 0.25, 0.12, 6, 20), cyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 18 + i * 7.2;
    group.add(ring);
  }

  const emblem = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.38, 8, 24), cyan);
  emblem.position.y = 63;
  group.add(emblem);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), cyan);
  core.position.y = 63;
  group.add(core);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 8, 6), steel);
  spire.position.y = 68;
  group.add(spire);

  return group;
}

export function createTechMuseum(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Tech_Museum';
  group.position.set(0, 0, -85);

  const facade = createFacadeTexture('office', 4);
  const matX = facadeMaterial(facade, 4, 2);
  const matZ = facadeMaterial(facade, 5, 2);
  const stone = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.35, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({
    color: '#7dd3fc',
    emissive: '#0369a1',
    emissiveIntensity: 0.3,
    metalness: 0.8,
    roughness: 0.1,
    transparent: true,
    opacity: 0.65,
  });
  const cyan = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(42, 1.1, 36), stone);
  plinth.position.y = 0.55;
  plinth.receiveShadow = true;
  group.add(plinth);

  const hall = new THREE.Mesh(new THREE.BoxGeometry(38, 10, 32), [matX, matX, roofMaterial(), darkMat(), matZ, matZ]);
  hall.position.y = 6.1;
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(36, 2.4, 0.2), cyan);
  ribbon.position.set(0, 8.2, 16.15);
  group.add(ribbon);

  // South colonnade (faces downtown / plaza)
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 8.5, 8), stone);
    col.position.set(i * 6.2, 5.3, 17.6);
    col.castShadow = true;
    group.add(col);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(28, 0.7, 2.2), stone);
  lintel.position.set(0, 9.7, 17.6);
  group.add(lintel);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 2),
    new THREE.MeshBasicMaterial({ map: createSignTexture('TECH MUSEUM', '#0f172a', '#7dd3fc') })
  );
  sign.position.set(0, 11.2, 18.8);
  group.add(sign);

  const pyramid = new THREE.Mesh(new THREE.ConeGeometry(13, 11, 4), glass);
  pyramid.geometry.rotateY(Math.PI / 4);
  pyramid.position.y = 16.4;
  group.add(pyramid);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), cyan);
  glow.position.y = 12.5;
  group.add(glow);

  // Loading dock (north)
  const dock = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 12), [
    facadeMaterial(createFacadeTexture('industrial', 8), 2, 1),
    facadeMaterial(createFacadeTexture('industrial', 8), 2, 1),
    roofMaterial(),
    darkMat(),
    facadeMaterial(createFacadeTexture('industrial', 8), 2, 1),
    facadeMaterial(createFacadeTexture('industrial', 8), 2, 1),
  ]);
  dock.position.set(0, 3, -22);
  dock.castShadow = true;
  group.add(dock);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(16.2, 0.5, 12.2),
    new THREE.MeshBasicMaterial({ color: '#eab308' })
  );
  stripe.position.set(0, 5.9, -22);
  group.add(stripe);
  for (let i = -1; i <= 1; i++) {
    const bay = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 0.12), new THREE.MeshBasicMaterial({ color: '#111827' }));
    bay.position.set(i * 4.4, 2.2, -28.05);
    group.add(bay);
  }

  return group;
}

export function createCargoStation(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Cargo_Station';
  group.position.set(85, 0, 30);

  const facade = createFacadeTexture('industrial', 11);
  const matX = facadeMaterial(facade, 5, 3);
  const matZ = facadeMaterial(facade, 4, 3);
  const hazard = new THREE.MeshBasicMaterial({ color: '#eab308' });
  const steel = steelMat();

  const hall = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 45), [matX, matX, roofMaterial(), darkMat(), matZ, matZ]);
  hall.position.y = 7;
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  const band = new THREE.Mesh(new THREE.BoxGeometry(40.3, 1.1, 45.3), hazard);
  band.position.y = 4.2;
  group.add(band);

  // Vertical ribs
  for (let i = -3; i <= 3; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.35, 13.5, 0.35), steel);
    rib.position.set(i * 5.4, 7, 22.6);
    group.add(rib);
  }

  for (let i = -1; i <= 1; i++) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(6.5, 8, 0.2), new THREE.MeshBasicMaterial({ color: '#1e293b' }));
    door.position.set(i * 10, 4.2, -22.6);
    group.add(door);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.25, 0.22), hazard);
    bar.position.set(i * 10, 8.2, -22.62);
    group.add(bar);
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 2.2),
    new THREE.MeshBasicMaterial({ map: createSignTexture('CARGO BAY', '#1c1917', '#fbbf24') })
  );
  sign.position.set(0, 11.6, -22.7);
  sign.rotation.y = Math.PI;
  group.add(sign);

  // Roof sawtooth sheds
  for (let i = -1; i <= 1; i++) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 8), steel);
    shed.position.set(i * 12, 15.2, 4);
    group.add(shed);
  }

  return group;
}

export function addNightSky(scene: THREE.Scene): void {
  // Equirect sky as scene.background — survives quality draw-distance changes
  // (a sky sphere would clip on LOW where camera.far is 320).
  scene.background = createNightSkyTexture();
}

/** Explicit AABB matching the original landmark / tower footprints. */
export function buildingCollider(x: number, z: number, w: number, d: number, h: number): THREE.Box3 {
  return new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d));
}
