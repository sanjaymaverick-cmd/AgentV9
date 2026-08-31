import * as THREE from 'three';
import { DisguiseType, GuardState, RestrictedZone } from '../types/game';
import type { GameEngine } from './gameEngine';
import { CHAOS, STEALTH } from './tunables';

export type SoundKind = 'footstep' | 'horn' | 'gadget' | 'decoy' | 'engine';

export interface SoundEvent {
  x: number;
  z: number;
  radius: number;
  kind: SoundKind;
}

export class SoundBus {
  private queue: SoundEvent[] = [];
  emit(ev: SoundEvent) {
    this.queue.push(ev);
  }
  drain(): SoundEvent[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}

interface Brain {
  state: GuardState;
  timer: number;
  lastKnown: THREE.Vector3;
  searchYaw: number;
  holdInCone: number;
}

/** XZ vision test shared by bots and cameras. Yaw 0 looks down +Z (Three default). */
export function pointInViewCone(
  ox: number,
  oz: number,
  yaw: number,
  px: number,
  pz: number,
  range: number,
  viewAngleDeg: number,
): boolean {
  const dx = px - ox;
  const dz = pz - oz;
  const dist = Math.hypot(dx, dz);
  if (dist >= range) return false;
  if (dist < 1e-6) return true;
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);
  const dot = (fwdX * dx + fwdZ * dz) / dist;
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
  return angle < THREE.MathUtils.degToRad(viewAngleDeg / 2);
}

const CONE: Record<GuardState, { color: string; opacity: number; alert: number }> = {
  unaware: { color: '#38bdf8', opacity: 0.15, alert: 0 },
  curious: { color: '#facc15', opacity: 0.28, alert: 0.22 },
  investigating: { color: '#fb923c', opacity: 0.36, alert: 0.48 },
  searching: { color: '#f97316', opacity: 0.32, alert: 0.58 },
  alert: { color: '#ef4444', opacity: 0.45, alert: 0.7 },
};

/**
 * Per-bot awareness machine (spec §11) + a tiny waypoint graph so patrols and
 * investigations hop nodes instead of lerping through walls.
 */
export class GuardAI {
  private graph = new WaypointGraph();
  private brains = new Map<string, Brain>();
  private readonly fwd = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly scratch = new THREE.Vector3();
  private graphReady = false;

  constructor(private e: GameEngine) {}

  resetAll() {
    this.brains.clear();
    this.e.world.bots.forEach((b) => {
      b.data.alertLevel = 0;
    });
    this.e.world.cameras.forEach((c) => {
      c.alertLevel = 0;
    });
  }

  tick(dt: number, sounds: SoundEvent[]) {
    const e = this.e;
    if (!this.graphReady) {
      this.graph.build(this.collectNodes(), STEALTH.navLinkDist);
      this.graphReady = true;
    }

    const player = e.state.isRiding ? e.bikePos : e.playerPos;
    const silent = e.state.isRiding && e.state.isSilentMode;
    const disguise = e.state.currentDisguise;

    for (const bot of e.world.bots) {
      if (Date.now() < bot.data.disabledUntil) {
        bot.cone.visible = false;
        continue;
      }
      bot.cone.visible = true;
      const brain = this.brain(bot.data.id);
      const heard = this.pickSound(bot.obj.position, sounds);
      const seen = this.canSee(bot, player, silent, disguise);

      if (heard) {
        brain.lastKnown.set(heard.x, 0, heard.z);
        if (brain.state === 'unaware') {
          const d = Math.hypot(bot.obj.position.x - heard.x, bot.obj.position.z - heard.z);
          this.setState(brain, d < STEALTH.hearInvestigateDist ? 'investigating' : 'curious');
        } else if (brain.state === 'curious') {
          this.setState(brain, 'investigating');
        } else if (brain.state === 'searching' || brain.state === 'investigating') {
          brain.timer = 0;
        }
      }

      if (seen) {
        brain.lastKnown.copy(player);
        brain.lastKnown.y = 0;
        brain.holdInCone += dt;
        if (brain.state === 'unaware') this.setState(brain, 'curious');
        else if (brain.state === 'curious' && brain.holdInCone >= STEALTH.curiousToInvestigateSec) {
          this.setState(brain, 'investigating');
        } else if (brain.state === 'investigating' && brain.holdInCone >= STEALTH.investigateToAlertSec) {
          this.setState(brain, 'alert');
        } else if (brain.state === 'searching') this.setState(brain, 'alert');
      } else {
        brain.holdInCone = 0;
      }

      this.stepState(bot, brain, player, seen, dt);
      this.paint(bot, brain);
      if (brain.state === 'alert' || brain.state === 'investigating') {
        e.chaosAlertManager.reportSighting(brain.state === 'alert' ? 1 : 0.55);
      }
    }

    this.tickCameras(dt, player, silent, disguise);

    let vis = 0;
    for (const b of e.world.bots) vis = Math.max(vis, b.data.alertLevel);
    for (const c of e.world.cameras) vis = Math.max(vis, c.alertLevel);
    e.state.stealthVisibility = Math.round(vis * 100);
  }

  // ---------------------------------------------------------------------------

  private stepState(
    bot: GameEngine['world']['bots'][0],
    brain: Brain,
    player: THREE.Vector3,
    seen: boolean,
    dt: number
  ) {
    brain.timer += dt;
    const pos = bot.obj.position;

    switch (brain.state) {
      case 'unaware': {
        this.patrol(bot, dt);
        bot.data.alertLevel = CONE.unaware.alert;
        break;
      }
      case 'curious': {
        this.faceToward(bot, brain.lastKnown);
        bot.data.alertLevel = CONE.curious.alert;
        if (brain.timer >= STEALTH.curiousDurationSec && !seen) this.setState(brain, 'unaware');
        break;
      }
      case 'investigating': {
        const arrived = this.moveTo(bot, brain.lastKnown, STEALTH.investigateSpeed, dt);
        bot.data.alertLevel = CONE.investigating.alert;
        if (arrived && !seen) this.setState(brain, 'searching');
        if (brain.timer > 8 && !seen) this.setState(brain, 'searching');
        break;
      }
      case 'alert': {
        this.moveTo(bot, seen ? player : brain.lastKnown, STEALTH.alertSpeed, dt);
        bot.data.alertLevel = Math.min(1, bot.data.alertLevel + dt * STEALTH.alertRisePerSec);
        if (bot.data.alertLevel >= 1 && !this.e.isEscortingOut) {
          this.e.stealthAI.triggerEscortOut(bot.data.name);
        }
        if (!seen && brain.timer > 1.2) this.setState(brain, 'searching');
        break;
      }
      case 'searching': {
        brain.searchYaw += dt * 1.4;
        const orbit = this.scratch
          .copy(brain.lastKnown)
          .add(this.fwd.set(Math.cos(brain.searchYaw) * 4.5, 0, Math.sin(brain.searchYaw) * 4.5));
        this.moveTo(bot, orbit, STEALTH.searchSpeed, dt);
        bot.obj.rotation.y = Math.atan2(
          brain.lastKnown.x - pos.x,
          brain.lastKnown.z - pos.z
        ) + Math.sin(brain.searchYaw) * 0.6;
        bot.data.alertLevel = Math.max(CONE.searching.alert, bot.data.alertLevel - dt * STEALTH.alertDecayPerSec);
        if (brain.timer >= STEALTH.searchDurationSec) this.setState(brain, 'unaware');
        break;
      }
    }
  }

  private setState(brain: Brain, state: GuardState) {
    if (brain.state === state) return;
    brain.state = state;
    brain.timer = 0;
    brain.holdInCone = 0;
    if (state === 'searching') brain.searchYaw = 0;
  }

  private canSee(
    bot: GameEngine['world']['bots'][0],
    player: THREE.Vector3,
    silent: boolean,
    disguise: DisguiseType
  ): boolean {
    if (this.isExempt(bot.data.zoneId, disguise)) return false;
    const detect = silent ? bot.data.viewDistance * STEALTH.silentDetectMult : bot.data.viewDistance;
    const dist = bot.obj.position.distanceTo(player);
    if (dist >= detect) return false;
    this.fwd.set(0, 0, 1).applyAxisAngle(this.up, bot.obj.rotation.y);
    this.scratch.copy(player).sub(bot.obj.position).setY(0);
    if (this.scratch.lengthSq() < 1e-6) return true;
    this.scratch.normalize();
    return this.fwd.angleTo(this.scratch) < THREE.MathUtils.degToRad(bot.data.viewAngle / 2);
  }

  private isExempt(zoneId: string | undefined, disguise: DisguiseType): boolean {
    if (!zoneId) return false;
    const zone = this.e.world.restrictedZones.find((z) => z.id === zoneId);
    if (!zone) return false;
    return zone.allowedDisguises.includes(disguise);
  }

  private pickSound(pos: THREE.Vector3, sounds: SoundEvent[]): SoundEvent | null {
    let best: SoundEvent | null = null;
    let bestD = Infinity;
    for (const s of sounds) {
      const d = Math.hypot(pos.x - s.x, pos.z - s.z);
      if (d <= s.radius && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  private patrol(bot: GameEngine['world']['bots'][0], dt: number) {
    const pts = bot.data.patrolPoints;
    if (!pts || pts.length < 2) return;
    const i = bot.data.currentPatrolIndex || 0;
    const dest = this.scratch.set(...pts[i]);
    if (this.moveTo(bot, dest, STEALTH.patrolSpeed, dt)) {
      bot.data.currentPatrolIndex = (i + 1) % pts.length;
    }
  }

  /** Walk toward `dest` via the waypoint graph. Returns true on arrival. */
  private moveTo(bot: GameEngine['world']['bots'][0], dest: THREE.Vector3, speed: number, dt: number): boolean {
    const pos = bot.obj.position;
    const goalDist = Math.hypot(pos.x - dest.x, pos.z - dest.z);
    if (goalDist < STEALTH.patrolArriveDist) return true;
    const hop = this.graph.nextHop(pos.x, pos.z, dest.x, dest.z);
    const tx = hop ? hop.x : dest.x;
    const tz = hop ? hop.z : dest.z;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return false;
    const step = Math.min(len, speed * dt);
    pos.x += (dx / len) * step;
    pos.z += (dz / len) * step;
    bot.obj.rotation.y = Math.atan2(dx, dz);
    return false;
  }

  private faceToward(bot: GameEngine['world']['bots'][0], dest: THREE.Vector3) {
    bot.obj.rotation.y = Math.atan2(dest.x - bot.obj.position.x, dest.z - bot.obj.position.z);
  }

  private paint(bot: GameEngine['world']['bots'][0], brain: Brain) {
    const look = CONE[brain.state];
    const mat = bot.cone.material as THREE.MeshBasicMaterial;
    mat.color.set(look.color);
    mat.opacity = look.opacity;
    if (brain.state !== 'alert') bot.data.alertLevel = look.alert;
  }

  // ---------------------------------------------------------------------------
  // Cameras (spec §12) — same awareness states, no locomotion, no escort-out.
  // ---------------------------------------------------------------------------

  private tickCameras(dt: number, player: THREE.Vector3, silent: boolean, disguise: DisguiseType) {
    const e = this.e;
    const enhanced = e.state.chaosAlertLevel >= 2;
    const rangeMult = enhanced ? CHAOS.cameraEnhanceRangeMult : 1;
    const sweepMult = enhanced ? CHAOS.cameraEnhanceSweepMult : 1;
    const t = e.timer.getElapsed();
    const now = Date.now();

    for (const cam of e.world.cameras) {
      if (now < cam.disabledUntil) {
        cam.disabled = true;
        cam.cone.visible = false;
        cam.alertLevel = 0;
        continue;
      }
      cam.disabled = false;
      cam.cone.visible = true;
      const brain = this.brain(`cam:${cam.id}`);
      const range = cam.viewDistance * rangeMult * (silent ? STEALTH.silentDetectMult : 1);
      const seen = this.camCanSee(cam, player, disguise, range);

      if (seen) {
        brain.lastKnown.set(player.x, 0, player.z);
        brain.holdInCone += dt;
        if (brain.state === 'unaware') this.setState(brain, 'curious');
        else if (brain.state === 'curious' && brain.holdInCone >= STEALTH.curiousToInvestigateSec) {
          this.setState(brain, 'investigating');
        } else if (brain.state === 'investigating' && brain.holdInCone >= STEALTH.investigateToAlertSec) {
          this.setState(brain, 'alert');
          this.alarmNearbyGuards(brain.lastKnown);
        } else if (brain.state === 'searching') this.setState(brain, 'alert');
      } else {
        brain.holdInCone = 0;
      }

      brain.timer += dt;
      if (brain.state === 'curious' && brain.timer >= STEALTH.curiousDurationSec && !seen) {
        this.setState(brain, 'unaware');
      } else if (brain.state === 'investigating' && brain.timer > 8 && !seen) {
        this.setState(brain, 'searching');
      } else if (brain.state === 'alert' && !seen && brain.timer > 1.2) {
        this.setState(brain, 'searching');
      } else if (brain.state === 'searching' && brain.timer >= STEALTH.searchDurationSec) {
        this.setState(brain, 'unaware');
      }

      if (brain.state === 'unaware') {
        cam.obj.rotation.y = cam.sweepCenter + Math.sin(t * CHAOS.cameraSweepSpeed * sweepMult) * cam.sweepAngle;
      } else if (brain.state === 'searching') {
        brain.searchYaw += dt * 1.2;
        cam.obj.rotation.y = cam.sweepCenter + Math.sin(brain.searchYaw) * (cam.sweepAngle + 0.35);
      } else {
        cam.obj.rotation.y = Math.atan2(
          brain.lastKnown.x - cam.obj.position.x,
          brain.lastKnown.z - cam.obj.position.z,
        );
      }

      const look = CONE[brain.state];
      const mat = cam.cone.material as THREE.MeshBasicMaterial;
      mat.color.set(look.color);
      mat.opacity = brain.state === 'unaware' && enhanced ? CHAOS.cameraEnhanceConeOpacity : look.opacity;
      cam.alertLevel = look.alert;

      if (brain.state === 'alert' || brain.state === 'investigating') {
        e.chaosAlertManager.reportSighting(
          brain.state === 'alert' ? (enhanced ? 1.1 : 0.75) : 0.4,
        );
      }
    }
  }

  private camCanSee(
    cam: GameEngine['world']['cameras'][0],
    player: THREE.Vector3,
    disguise: DisguiseType,
    range: number,
  ): boolean {
    if (this.isExempt(cam.zoneId, disguise)) return false;
    return pointInViewCone(
      cam.obj.position.x,
      cam.obj.position.z,
      cam.obj.rotation.y,
      player.x,
      player.z,
      range,
      cam.viewAngle,
    );
  }

  private alarmNearbyGuards(at: THREE.Vector3) {
    for (const bot of this.e.world.bots) {
      if (Date.now() < bot.data.disabledUntil) continue;
      const d = Math.hypot(bot.obj.position.x - at.x, bot.obj.position.z - at.z);
      if (d > STEALTH.cameraAlarmRadius) continue;
      const brain = this.brain(bot.data.id);
      brain.lastKnown.copy(at);
      if (brain.state === 'unaware' || brain.state === 'curious') {
        this.setState(brain, 'investigating');
      }
    }
  }

  private brain(id: string): Brain {
    let b = this.brains.get(id);
    if (!b) {
      b = { state: 'unaware', timer: 0, lastKnown: new THREE.Vector3(), searchYaw: 0, holdInCone: 0 };
      this.brains.set(id, b);
    }
    return b;
  }

  private collectNodes(): [number, number, number][] {
    const pts: [number, number, number][] = [];
    const seen = new Set<string>();
    const add = (p: [number, number, number]) => {
      const k = `${Math.round(p[0])},${Math.round(p[2])}`;
      if (seen.has(k)) return;
      seen.add(k);
      pts.push(p);
    };
    for (const b of this.e.world.bots) {
      (b.data.patrolPoints || []).forEach(add);
    }
    (this.e.world.navWaypoints || []).forEach(add);
    return pts;
  }
}

class WaypointGraph {
  nodes: THREE.Vector3[] = [];
  adj: number[][] = [];

  build(points: [number, number, number][], linkDist: number) {
    this.nodes = points.map((p) => new THREE.Vector3(...p));
    this.adj = this.nodes.map(() => []);
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const d = Math.hypot(this.nodes[i].x - this.nodes[j].x, this.nodes[i].z - this.nodes[j].z);
        if (d > 0.5 && d <= linkDist) {
          this.adj[i].push(j);
          this.adj[j].push(i);
        }
      }
    }
  }

  nearest(x: number, z: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = Math.hypot(this.nodes[i].x - x, this.nodes[i].z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** First hop toward the goal, or null to walk straight. */
  nextHop(fromX: number, fromZ: number, toX: number, toZ: number): THREE.Vector3 | null {
    if (this.nodes.length < 2) return null;
    const straight = Math.hypot(toX - fromX, toZ - fromZ);
    if (straight < 7) return null;
    const start = this.nearest(fromX, fromZ);
    const goal = this.nearest(toX, toZ);
    if (start === goal) return null;
    const path = this.bfs(start, goal);
    if (!path || path.length < 2) return null;
    const hop = this.nodes[path[1]];
    const hopD = Math.hypot(hop.x - fromX, hop.z - fromZ);
    if (straight < hopD * 0.85) return null;
    return hop;
  }

  private bfs(start: number, goal: number): number[] | null {
    const prev = new Array<number>(this.nodes.length).fill(-1);
    const seen = new Array<boolean>(this.nodes.length).fill(false);
    const q = [start];
    seen[start] = true;
    for (let qi = 0; qi < q.length; qi++) {
      const n = q[qi];
      if (n === goal) break;
      for (const m of this.adj[n]) {
        if (seen[m]) continue;
        seen[m] = true;
        prev[m] = n;
        q.push(m);
      }
    }
    if (!seen[goal]) return null;
    const path: number[] = [];
    for (let n = goal; n !== -1; n = prev[n]) path.push(n);
    path.reverse();
    return path;
  }
}

export function playerInZone(zone: RestrictedZone, x: number, z: number): boolean {
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}
