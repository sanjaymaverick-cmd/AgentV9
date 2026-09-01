import * as THREE from 'three';
import type { QualityLevel } from '../types/game';
import type { GameEngine } from './gameEngine';

/**
 * B4 on-device / headless profiler.
 *
 * Sampled from the engine loop (no extra rAF). Always attached as
 * `window.__agentV9` so a production APK can dump numbers without the
 * DEV-only debug menu. Teleport / throttle are for the profile script
 * and the on-screen chip — they do not change gameplay otherwise.
 */
export interface PerfSnapshot {
  fps: number;
  minFps: number;
  avgFrameMs: number;
  worstFrameMs: number;
  calls: number;
  tris: number;
  geometries: number;
  textures: number;
  programs: number;
  heapMB: number | null;
  quality: QualityLevel;
  pixelRatio: number;
  drawingBuffer: [number, number];
  shadows: boolean;
  antialias: boolean;
  meshCount: number;
  visibleMeshes: number;
  objectCount: number;
  css: [number, number];
  dpr: number;
  bikeSpeed: number;
  pos: [number, number, number];
  ready: true;
}

export interface AgentV9Probe {
  ready: boolean;
  snapshot(): PerfSnapshot;
  resetStats(): void;
  applyQuality(level: QualityLevel): void;
  teleport(pos: [number, number, number]): void;
  setThrottle(on: boolean): void;
  /** QA: held keys, same mapping as the keyboard. `[]` clears. */
  setKeys(codes: string[]): void;
  setLook(x: number, y: number): void;
  getYaw(): number;
  getCameraYaw(): number;
  getSpeed(): number;
  setYaw(rad: number): void;
  getPlayerPos(): [number, number, number];
  getCameraPos(): [number, number, number];
  isRiding(): boolean;
  dismount(): void;
}

declare global {
  interface Window {
    __agentV9?: AgentV9Probe;
  }
}

export class PerfHarness {
  private frames = 0;
  private windowMs = 0;
  private worstMs = 0;
  private lastFps = 0;
  private lastAvg = 0;
  private lastWorst = 0;
  private minFps = 999;
  private calls = 0;
  private tris = 0;

  constructor(private e: GameEngine) {
    this.attach();
  }

  tick(dt: number) {
    const ms = dt * 1000;
    this.frames++;
    this.windowMs += ms;
    if (ms > this.worstMs) this.worstMs = ms;
    if (this.windowMs >= 500) {
      this.lastFps = Math.round((this.frames * 1000) / this.windowMs);
      this.lastAvg = this.windowMs / this.frames;
      this.lastWorst = this.worstMs;
      this.minFps = Math.min(this.minFps, this.lastFps || 999);
      this.frames = 0;
      this.windowMs = 0;
      this.worstMs = 0;
    }
  }

  afterRender() {
    const info = this.e.renderer.info;
    this.calls = info.render.calls;
    this.tris = info.render.triangles;
  }

  resetStats() {
    this.frames = 0;
    this.windowMs = 0;
    this.worstMs = 0;
    this.lastFps = 0;
    this.lastAvg = 0;
    this.lastWorst = 0;
    this.minFps = 999;
  }

  snapshot(): PerfSnapshot {
    const e = this.e;
    const gl = e.renderer.getContext();
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    let meshCount = 0;
    let visibleMeshes = 0;
    let objectCount = 0;
    e.scene.traverse((obj) => {
      objectCount++;
      if ((obj as THREE.Mesh).isMesh) {
        meshCount++;
        if (obj.visible) visibleMeshes++;
      }
    });
    return {
      fps: this.lastFps,
      minFps: this.minFps === 999 ? this.lastFps : this.minFps,
      avgFrameMs: Math.round(this.lastAvg * 10) / 10,
      worstFrameMs: Math.round(this.lastWorst * 10) / 10,
      calls: this.calls,
      tris: this.tris,
      geometries: e.renderer.info.memory.geometries,
      textures: e.renderer.info.memory.textures,
      programs: e.renderer.info.programs?.length ?? 0,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      quality: e.settings.qualityLevel,
      pixelRatio: e.renderer.getPixelRatio(),
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      shadows: e.renderer.shadowMap.enabled,
      antialias: Boolean((e.renderer.getContextAttributes() as { antialias?: boolean } | null)?.antialias),
      meshCount,
      visibleMeshes,
      objectCount,
      css: [window.innerWidth, window.innerHeight],
      dpr: window.devicePixelRatio || 1,
      bikeSpeed: e.bikeSpeed,
      pos: [Math.round(e.bikePos.x), Math.round(e.bikePos.y), Math.round(e.bikePos.z)],
      ready: true,
    };
  }

  teleport(pos: [number, number, number]) {
    const e = this.e;
    e.bikePos.set(pos[0], pos[1], pos[2]);
    e.playerPos.set(pos[0], pos[1], pos[2]);
    e.bikeSpeed = 0;
    e.bikeVerticalVel = 0;
    e.isBikeGrounded = true;
    e.motorcycle.group.position.copy(e.bikePos);
    e.agentChar.group.position.copy(e.playerPos);
    e.dronePos.set(pos[0], pos[1] + 3, pos[2]);
    e.cameraRig.resetLook();
  }

  setThrottle(on: boolean) {
    this.e.input.forward = on;
    this.e.input.analogThrottle = on ? 1 : 0;
  }

  setKeys(codes: string[]) {
    const has = (c: string) => codes.includes(c);
    const e = this.e;
    e.input.forward = has('KeyW') || has('ArrowUp');
    e.input.backward = has('KeyS') || has('ArrowDown');
    e.input.left = has('KeyA') || has('ArrowLeft');
    e.input.right = has('KeyD') || has('ArrowRight');
    e.input.analogThrottle = 0;
    e.input.analogSteer = 0;
    e.input.analogLookX = 0;
    e.input.analogLookY = 0;
  }

  private attach() {
    const e = this.e;
    const probe: AgentV9Probe = {
      ready: true,
      snapshot: () => this.snapshot(),
      resetStats: () => this.resetStats(),
      applyQuality: (level) => {
        e.settings.qualityLevel = level;
        e.applyQuality(level, false);
      },
      teleport: (pos) => this.teleport(pos),
      setThrottle: (on) => this.setThrottle(on),
      setKeys: (codes) => this.setKeys(codes),
      setLook: (x, y) => {
        e.input.analogLookX = x;
        e.input.analogLookY = y;
      },
      getYaw: () => (e.state.isRiding ? e.bikeRot : e.playerRot),
      getCameraYaw: () => e.cameraYaw,
      setYaw: (rad: number) => {
        e.bikeRot = rad;
        e.playerRot = rad;
        e.cameraYaw = rad;
        e.cameraRig.resetLook();
      },
      getSpeed: () => e.bikeSpeed,
      getPlayerPos: () => [e.playerPos.x, e.playerPos.y, e.playerPos.z],
      getCameraPos: () => [e.camera.position.x, e.camera.position.y, e.camera.position.z],
      isRiding: () => e.state.isRiding,
      dismount: () => {
        e.bikeSpeed = 0;
        if (e.state.isRiding) e.handleInteractAction();
      },
    };
    if (typeof window !== 'undefined') window.__agentV9 = probe;
  }

  detach() {
    if (typeof window !== 'undefined' && window.__agentV9) delete window.__agentV9;
  }
}
