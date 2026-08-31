import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { RadarEntity } from '../types/game';
import { soundEngine } from './audio';
import { CHAOS } from './tunables';
import {
  createChaosPursuitDrone,
  createChaosTracker,
  createChaosRoadblock,
  createElitePursuitRobot,
} from './models';

/**
 * City-wide CHAOS escalation (spec §17).
 *
 * Owns level 0–5, progress toward the next level, per-level pursuit spawns, and every
 * decay route (hide, escape radius, disguise change, Academy safe zone, tracker EMP,
 * underground underpass). StealthAI reports sightings; it no longer writes the meter.
 *
 * TODO(C4): camera perception here is a stop-gap — move it into StealthAI with the
 * named Unaware/Curious/Investigating/Alert/Searching states.
 */
type PursuitKind = 'search' | 'interceptor';

interface PursuitDrone {
  kind: PursuitKind;
  group: THREE.Group;
  rotors: THREE.Mesh[];
  cone: THREE.Mesh;
  disabledUntil: number;
  orbitAngle: number;
}

interface TrackerUnit {
  group: THREE.Group;
  pulse: THREE.Mesh;
  disabledUntil: number;
}

interface RoadblockUnit {
  group: THREE.Group;
  box: THREE.Box3;
}

interface EliteUnit {
  group: THREE.Group;
  cone: THREE.Mesh;
  disabledUntil: number;
}

const LEVEL_VOICES: readonly string[] = [
  'CHAOS has lost the trail. You are clear.',
  'Search drone inbound. Stay out of its scanner.',
  'Cameras just went aggressive. Watch the cones.',
  'Interceptor drones launched. You can outrun them on V9.',
  'Roadblocks and a tracker are live. EMP the tracker to shake them.',
  'Elite pursuit robot on the ground. Do not let it catch you.',
];

export class ChaosAlertManager {
  private heat = 0;
  private lastKnown = new THREE.Vector3();
  private hideTimer = 0;
  private safeTimer = 0;
  private disguiseCooldown = 0;
  private frameSight = 0;
  private escalatingThisFrame = false;
  private decayingThisFrame = false;

  private searchDrone: PursuitDrone | null = null;
  private interceptors: PursuitDrone[] = [];
  private tracker: TrackerUnit | null = null;
  private roadblocks: RoadblockUnit[] = [];
  private elite: EliteUnit | null = null;

  private readonly tmp = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private e: GameEngine) {
    this.lastKnown.copy(e.bikePos);
  }

  /** Called from StealthAI while a bot (or later, a named AI state) has LOS. */
  reportSighting(weight = 1) {
    if (weight > this.frameSight) this.frameSight = weight;
  }

  /** Escort-out is a catch — bump heat, don't skip levels in one hit. */
  reportCaught() {
    this.addHeat(CHAOS.caughtProgressBump);
    this.rememberPlayer();
    this.flushState();
    this.e.requestAutosave();
  }

  reportDisguiseChange(next: string) {
    if (this.disguiseCooldown > 0) return;
    const drop = next === 'agent_suit' ? CHAOS.agentSuitProgressDrop : CHAOS.disguiseProgressDrop;
    this.addHeat(-drop);
    this.disguiseCooldown = CHAOS.disguiseCooldownSec;
    this.flushState();
    this.e.requestAutosave();
    if (drop >= CHAOS.disguiseProgressDrop) {
      this.e.setNotification('Disguise change scrambled the CHAOS trace!');
    }
  }

  clear() {
    this.heat = 0;
    this.e.state.chaosAlertLevel = 0;
    this.hideTimer = 0;
    this.safeTimer = 0;
    this.frameSight = 0;
    this.syncSpawns();
    this.flushState();
    this.e.requestAutosave();
  }

  /** Debug / restore: snap to a level and respawn matching units. */
  setLevel(level: number, opts?: { announce?: boolean }) {
    const n = THREE.MathUtils.clamp(Math.round(level), 0, CHAOS.maxLevel);
    this.e.state.chaosAlertLevel = n;
    this.heat = n === 0 ? 0 : 40;
    this.rememberPlayer();
    this.syncSpawns();
    this.flushState();
    if (opts?.announce) this.announce(n);
    this.e.requestAutosave();
  }

  /** After save-apply: trust state.level/progress and spawn to match. */
  syncToState() {
    this.heat = THREE.MathUtils.clamp(this.e.state.chaosAlertProgress, 0, 100);
    this.e.state.chaosAlertLevel = THREE.MathUtils.clamp(
      Math.round(this.e.state.chaosAlertLevel),
      0,
      CHAOS.maxLevel
    );
    this.rememberPlayer();
    this.syncSpawns();
    this.flushState();
  }

  applyQualityTrim() {
    this.syncSpawns();
  }

  applyEMPRadius(pos: THREE.Vector3, radius: number) {
    const now = Date.now();
    const until = now + CHAOS.empDisableMs;
    let hitTracker = false;

    for (const cam of this.e.world.cameras) {
      this.tmp.set(cam.position[0], cam.position[1], cam.position[2]);
      if (this.tmp.distanceTo(pos) < radius) {
        cam.disabledUntil = until;
        cam.disabled = true;
        cam.cone.visible = false;
      }
    }

    if (this.searchDrone && this.searchDrone.group.position.distanceTo(pos) < radius) {
      this.searchDrone.disabledUntil = until;
    }
    for (const d of this.interceptors) {
      if (d.group.position.distanceTo(pos) < radius) d.disabledUntil = until;
    }
    if (this.tracker && this.tracker.group.visible && this.tracker.group.position.distanceTo(pos) < radius) {
      this.tracker.disabledUntil = until;
      hitTracker = true;
    }
    if (this.elite && this.elite.group.position.distanceTo(pos) < radius) {
      this.elite.disabledUntil = until;
    }

    if (hitTracker && this.e.state.chaosAlertLevel >= 4) {
      this.e.setNotification('Tracker disabled! CHAOS heat dropping.');
      this.dropLevels(CHAOS.trackerEmpLevelDrop);
      this.flushState();
      this.e.requestAutosave();
    }
  }

  update(dt: number) {
    const e = this.e;
    const player = e.state.isRiding ? e.bikePos : e.playerPos;
    this.disguiseCooldown = Math.max(0, this.disguiseCooldown - dt);

    this.updateCameras(dt, player);
    this.updateUnits(dt, player);
    this.updateRoadblockBump();

    const seen = this.frameSight > 0;
    this.escalatingThisFrame = seen;
    if (seen) {
      this.rememberPlayer();
      this.hideTimer = 0;
      this.safeTimer = 0;
      this.addHeat(CHAOS.sightRisePerSec * this.frameSight * dt);
      this.decayingThisFrame = false;
    } else {
      this.tickDecay(dt, player);
    }

    this.frameSight = 0;
    this.flushState();
  }

  collectRadar(entities: RadarEntity[]) {
    const push = (id: string, obj: THREE.Object3D, label: string, alert = 1) => {
      if (!obj.visible) return;
      entities.push({
        id,
        type: 'chaos',
        x: obj.position.x,
        z: obj.position.z,
        rot: obj.rotation.y,
        label,
        alert,
      });
    };
    if (this.searchDrone) push('chaos_search', this.searchDrone.group, 'Search Drone', 0.6);
    this.interceptors.forEach((d, i) => push(`chaos_int_${i}`, d.group, 'Interceptor', 0.85));
    if (this.tracker) push('chaos_tracker', this.tracker.group, 'Tracker', 0.7);
    this.roadblocks.forEach((r, i) => push(`chaos_rb_${i}`, r.group, 'Roadblock', 0.4));
    if (this.elite) push('chaos_elite', this.elite.group, 'Elite Robot', 1);
  }

  // ---------------------------------------------------------------------------

  private tickDecay(dt: number, player: THREE.Vector3) {
    const e = this.e;
    if (e.state.chaosAlertLevel <= 0 && this.heat <= 0) {
      this.decayingThisFrame = false;
      this.hideTimer = 0;
      this.safeTimer = 0;
      return;
    }

    const hiding = this.isHiding();
    const underground = this.inUnderground(player);
    const distKnown = player.distanceTo(this.lastKnown);
    const escaped = distKnown > CHAOS.escapeRadius;
    const inSafe = player.distanceTo(this.tmp.set(...CHAOS.safeCenter)) < CHAOS.safeRadius;

    this.hideTimer = hiding || underground ? this.hideTimer + dt : 0;
    this.safeTimer = inSafe ? this.safeTimer + dt : 0;

    let rate: number = CHAOS.naturalDecayPerSec;
    if (this.safeTimer >= CHAOS.safeWarmupSec) rate = Math.max(rate, CHAOS.safeDecayPerSec);
    else if (underground) rate = Math.max(rate, CHAOS.undergroundDecayPerSec);
    else if (escaped) rate = Math.max(rate, CHAOS.escapeDecayPerSec);
    else if (this.hideTimer >= CHAOS.hideWarmupSec) rate = Math.max(rate, CHAOS.hideDecayPerSec);

    this.decayingThisFrame = rate > CHAOS.naturalDecayPerSec || this.heat > 0 || e.state.chaosAlertLevel > 0;
    this.addHeat(-rate * dt);
  }

  private isHiding(): boolean {
    const e = this.e;
    if (e.state.isRiding) return e.state.isSilentMode;
    return e.isCrouching && e.state.stealthNoise <= 10;
  }

  private inUnderground(player: THREE.Vector3): boolean {
    const z = this.e.world.undergroundZone;
    return player.x >= z.minX && player.x <= z.maxX && player.z >= z.minZ && player.z <= z.maxZ;
  }

  private addHeat(delta: number) {
    const e = this.e;
    this.heat += delta;
    while (this.heat >= 100 && e.state.chaosAlertLevel < CHAOS.maxLevel) {
      this.heat = CHAOS.progressAfterLevelUp;
      e.state.chaosAlertLevel += 1;
      this.syncSpawns();
      this.announce(e.state.chaosAlertLevel);
      e.requestAutosave();
    }
    while (this.heat < 0 && e.state.chaosAlertLevel > 0) {
      e.state.chaosAlertLevel -= 1;
      this.heat += CHAOS.progressAfterLevelDown;
      this.syncSpawns();
      this.announce(e.state.chaosAlertLevel);
      e.requestAutosave();
    }
    if (e.state.chaosAlertLevel === 0 && this.heat < 0) this.heat = 0;
    if (e.state.chaosAlertLevel === CHAOS.maxLevel && this.heat > 100) this.heat = 100;
  }

  private dropLevels(n: number) {
    const e = this.e;
    const next = Math.max(0, e.state.chaosAlertLevel - n);
    if (next === e.state.chaosAlertLevel) {
      this.heat = Math.max(0, this.heat - 40);
      return;
    }
    e.state.chaosAlertLevel = next;
    this.heat = next === 0 ? 0 : CHAOS.progressAfterLevelDown;
    this.syncSpawns();
    this.announce(next);
  }

  private flushState() {
    const e = this.e;
    e.state.chaosAlertProgress = Math.round(THREE.MathUtils.clamp(this.heat, 0, 100));
    const active = e.state.chaosAlertLevel > 0 || e.state.chaosAlertProgress > 0;
    e.state.chaosPhase = this.escalatingThisFrame
      ? 'escalating'
      : active && this.decayingThisFrame
        ? 'cooling'
        : 'idle';
  }

  private rememberPlayer() {
    const e = this.e;
    this.lastKnown.copy(e.state.isRiding ? e.bikePos : e.playerPos);
  }

  private announce(level: number) {
    const name = CHAOS.levelNames[level] ?? 'Clear';
    soundEngine.playAlert();
    const line = LEVEL_VOICES[level] ?? LEVEL_VOICES[0];
    soundEngine.speak(line, 'kira');
    if (level === 0) this.e.setNotification('CHAOS alert cleared.');
    else this.e.setNotification(`CHAOS ALERT ${level}: ${name}`);
  }

  // ----- cameras (perception stop-gap until C4) --------------------------------

  private updateCameras(_dt: number, player: THREE.Vector3) {
    const e = this.e;
    const enhanced = e.state.chaosAlertLevel >= 2;
    const rangeMult = enhanced ? CHAOS.cameraEnhanceRangeMult : 1;
    const sweepMult = enhanced ? CHAOS.cameraEnhanceSweepMult : 1;
    const now = Date.now();
    const t = e.timer.getElapsed();

    for (const cam of e.world.cameras) {
      if (now < cam.disabledUntil) {
        cam.disabled = true;
        cam.cone.visible = false;
        continue;
      }
      cam.disabled = false;
      cam.cone.visible = true;
      const mat = cam.cone.material as THREE.MeshBasicMaterial;
      mat.opacity = enhanced ? CHAOS.cameraEnhanceConeOpacity : 0.14;
      mat.color.set(enhanced ? '#ef4444' : '#f59e0b');

      const sweep = Math.sin(t * CHAOS.cameraSweepSpeed * sweepMult) * cam.sweepAngle;
      cam.obj.rotation.y = cam.sweepCenter + sweep;

      const range = CHAOS.cameraViewDistance * rangeMult;
      const dist = player.distanceTo(this.tmp.set(cam.position[0], player.y, cam.position[2]));
      if (dist >= range) continue;

      this.fwd.set(0, 0, 1).applyAxisAngle(this.up, cam.obj.rotation.y);
      this.tmp.copy(player).sub(cam.obj.position).setY(0).normalize();
      const angle = this.fwd.angleTo(this.tmp);
      if (angle < THREE.MathUtils.degToRad(cam.viewAngle / 2)) {
        this.reportSighting(enhanced ? 1.1 : 0.75);
        mat.opacity = 0.45;
        mat.color.set('#ef4444');
      }
    }
  }

  // ----- pursuit units ---------------------------------------------------------

  private updateUnits(dt: number, player: THREE.Vector3) {
    const t = this.e.timer.getElapsed();
    const now = Date.now();

    if (this.searchDrone) {
      const d = this.searchDrone;
      d.rotors.forEach((r, i) => {
        r.rotation.y = t * 22 + i;
      });
      const stunned = now < d.disabledUntil;
      d.cone.visible = d.group.visible && !stunned;
      if (d.group.visible && !stunned) {
        d.orbitAngle += dt * CHAOS.searchOrbitSpeed;
        d.group.position.set(
          this.lastKnown.x + Math.cos(d.orbitAngle) * CHAOS.searchOrbitRadius,
          CHAOS.searchOrbitHeight,
          this.lastKnown.z + Math.sin(d.orbitAngle) * CHAOS.searchOrbitRadius
        );
        d.group.rotation.y = Math.atan2(
          this.lastKnown.x - d.group.position.x,
          this.lastKnown.z - d.group.position.z
        );
        if (this.unitSees(d.group, player, CHAOS.searchViewDistance, CHAOS.searchViewAngle)) {
          this.reportSighting(0.85);
        }
      }
    }

    for (const d of this.interceptors) {
      d.rotors.forEach((r, i) => {
        r.rotation.y = t * 26 + i;
      });
      const stunned = now < d.disabledUntil;
      d.cone.visible = d.group.visible && !stunned;
      if (!d.group.visible || stunned) continue;

      this.tmp.copy(player);
      this.tmp.y = CHAOS.interceptorHeight;
      const to = this.tmp.sub(d.group.position);
      const dist = to.length();
      if (dist > 0.05) {
        to.multiplyScalar(1 / dist);
        const step = Math.min(dist, CHAOS.interceptorSpeed * dt);
        // Hold a standoff so they don't rubber-band onto the bike.
        if (dist > CHAOS.interceptorStandoff) {
          d.group.position.addScaledVector(to, step);
        } else {
          d.group.position.addScaledVector(to, step * 0.15);
        }
        d.group.rotation.y = Math.atan2(to.x, to.z);
      }
      if (this.unitSees(d.group, player, CHAOS.interceptorViewDistance, 50)) {
        this.reportSighting(1.15);
      }
    }

    if (this.tracker) {
      const tr = this.tracker;
      const stunned = now < tr.disabledUntil;
      tr.group.visible = this.e.state.chaosAlertLevel >= 4 && !stunned;
      if (tr.group.visible) {
        tr.pulse.rotation.z += dt * 3;
        this.tmp.copy(player);
        this.tmp.y = CHAOS.trackerHeight;
        tr.group.position.lerp(this.tmp, 1 - Math.exp(-CHAOS.trackerFollowLerp * dt));
      }
    }

    if (this.elite) {
      const el = this.elite;
      const stunned = now < el.disabledUntil;
      el.cone.visible = el.group.visible && !stunned;
      if (el.group.visible && !stunned) {
        el.group.position.y = 0;
        const dx = player.x - el.group.position.x;
        const dz = player.z - el.group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.2) {
          const step = CHAOS.eliteSpeed * dt;
          el.group.position.x += (dx / dist) * step;
          el.group.position.z += (dz / dist) * step;
          el.group.rotation.y = Math.atan2(dx, dz);
        }
        if (dist < CHAOS.eliteCatchDist && !this.e.isEscortingOut) {
          this.e.stealthAI.triggerEscortOut('CHAOS Elite Pursuit');
        } else if (this.unitSees(el.group, player, 12, 70)) {
          this.reportSighting(1.25);
        }
      }
    }
  }

  private unitSees(
    obj: THREE.Object3D,
    player: THREE.Vector3,
    range: number,
    viewAngleDeg: number
  ): boolean {
    this.tmp.set(obj.position.x, player.y, obj.position.z);
    const dist = this.tmp.distanceTo(player);
    if (dist >= range) return false;
    this.fwd.set(0, 0, 1).applyAxisAngle(this.up, obj.rotation.y);
    this.tmp.copy(player).sub(obj.position).setY(0);
    if (this.tmp.lengthSq() < 1e-6) return true;
    this.tmp.normalize();
    return this.fwd.angleTo(this.tmp) < THREE.MathUtils.degToRad(viewAngleDeg / 2);
  }

  private updateRoadblockBump() {
    if (!this.e.state.isRiding || this.roadblocks.length === 0) return;
    const pos = this.e.bikePos;
    for (const rb of this.roadblocks) {
      if (!rb.group.visible) continue;
      if (rb.box.distanceToPoint(pos) < 1.2) {
        if (this.e.bikeSpeed > CHAOS.roadblockBumpMaxSpeed) {
          this.e.bikeSpeed = CHAOS.roadblockBumpMaxSpeed;
        }
      }
    }
  }

  private syncSpawns() {
    const L = this.e.state.chaosAlertLevel;
    const q = this.e.currentQuality;

    if (L >= 1) this.ensureSearch();
    if (this.searchDrone) this.searchDrone.group.visible = L >= 1;

    const wantInt = L >= 3 ? q.chaosInterceptorCount : 0;
    this.ensureInterceptors(Math.max(wantInt, 1));
    this.interceptors.forEach((d, i) => {
      d.group.visible = i < wantInt;
    });

    const wantRb = L >= 4 ? q.chaosRoadblockCount : 0;
    this.ensureRoadblocks();
    this.roadblocks.forEach((r, i) => {
      r.group.visible = i < wantRb;
    });

    if (L >= 4) this.ensureTracker();
    if (this.tracker) this.tracker.group.visible = L >= 4 && Date.now() >= this.tracker.disabledUntil;

    if (L >= 5) this.ensureElite();
    if (this.elite) this.elite.group.visible = L >= 5;
  }

  private ensureSearch() {
    if (this.searchDrone) return;
    const mesh = createChaosPursuitDrone('search');
    mesh.group.visible = false;
    this.e.scene.add(mesh.group);
    this.searchDrone = {
      kind: 'search',
      group: mesh.group,
      rotors: mesh.rotors,
      cone: mesh.coneMesh,
      disabledUntil: 0,
      orbitAngle: 0,
    };
    this.searchDrone.group.position.set(
      this.lastKnown.x + CHAOS.searchOrbitRadius,
      CHAOS.searchOrbitHeight,
      this.lastKnown.z
    );
  }

  private ensureInterceptors(count: number) {
    while (this.interceptors.length < count) {
      const mesh = createChaosPursuitDrone('interceptor');
      mesh.group.visible = false;
      const i = this.interceptors.length;
      const ang = (i / Math.max(count, 1)) * Math.PI * 2;
      mesh.group.position.set(
        this.lastKnown.x + Math.cos(ang) * 18,
        CHAOS.interceptorHeight,
        this.lastKnown.z + Math.sin(ang) * 18
      );
      this.e.scene.add(mesh.group);
      this.interceptors.push({
        kind: 'interceptor',
        group: mesh.group,
        rotors: mesh.rotors,
        cone: mesh.coneMesh,
        disabledUntil: 0,
        orbitAngle: ang,
      });
    }
  }

  private ensureTracker() {
    if (this.tracker) return;
    const mesh = createChaosTracker();
    mesh.group.visible = false;
    mesh.group.position.copy(this.lastKnown);
    mesh.group.position.y = CHAOS.trackerHeight;
    this.e.scene.add(mesh.group);
    this.tracker = { group: mesh.group, pulse: mesh.pulse, disabledUntil: 0 };
  }

  private ensureRoadblocks() {
    const slots = CHAOS.roadblockSlots;
    while (this.roadblocks.length < slots.length) {
      const slot = slots[this.roadblocks.length];
      const mesh = createChaosRoadblock();
      mesh.group.position.set(...slot.position);
      mesh.group.rotation.y = slot.yaw;
      mesh.group.visible = false;
      this.e.scene.add(mesh.group);
      const box = new THREE.Box3().setFromObject(mesh.group);
      this.roadblocks.push({ group: mesh.group, box });
    }
  }

  private ensureElite() {
    if (this.elite) return;
    const mesh = createElitePursuitRobot('Omega');
    mesh.group.visible = false;
    const spawn = this.lastKnown;
    mesh.group.position.set(spawn.x + 12, 0, spawn.z + 12);
    this.e.scene.add(mesh.group);
    this.elite = { group: mesh.group, cone: mesh.coneMesh, disabledUntil: 0 };
  }
}
