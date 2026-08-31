import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { MissionPathChoice, RadarEntity } from '../types/game';
import { soundEngine } from './audio';
import { CHASE } from './tunables';
import { STORY_MISSION_MIDNIGHT_PROTOTYPE } from './missionEngine';
import { createChaosTransportDrone } from './models';

export type ChasePhase = 'idle' | 'running' | 'recovering' | 'won';

/**
 * Reusable motorcycle chase (spec §18).
 *
 * The target follows a waypoint path. Speed rises only when the player is inside
 * `minBand` (it pulls away). It never slows to wait — no unfair rubber-band.
 * Falling outside `loseRadius` fills a fail meter; a full meter restarts the
 * drone from the last checkpoint instead of ending the story. Being close at
 * the last waypoint wins.
 */
export class ChaseController {
  private group: THREE.Group;
  private rotors: THREE.Mesh[];
  private pos = new THREE.Vector3();
  private seg = 0;
  private t = 0; // 0..1 along current segment
  private empLeft = 0;
  private recoverLeft = 0;
  private recoveries = 0;
  private usedEmp = false;
  private usedBoost = false;
  private usedSilent = false;
  private obstacles: { mesh: THREE.Mesh; box: THREE.Box3 }[] = [];

  constructor(private e: GameEngine) {
    const mesh = createChaosTransportDrone();
    this.group = mesh.group;
    this.rotors = mesh.rotors;
    this.group.visible = false;
    e.scene.add(this.group);
    this.flushIdle();
  }

  begin() {
    const e = this.e;
    this.seg = 0;
    this.t = 0;
    this.empLeft = 0;
    this.recoverLeft = 0;
    this.recoveries = 0;
    this.usedEmp = false;
    this.usedBoost = false;
    this.usedSilent = false;
    this.placeAt(0, 0);
    this.group.visible = true;
    this.spawnObstacles();
    e.state.chaseActive = true;
    e.state.chasePhase = 'running';
    e.state.chaseFailMeter = 0;
    e.state.chaseCheckpoint = 0;
    e.state.chaseCheckpointTotal = CHASE.path.length;
    this.pointObjective();
    e.setNotification('Stay with the transport drone! Lose the signal and it will loop.');
    e.notifyState();
  }

  stop() {
    this.despawnObstacles();
    this.group.visible = false;
    this.flushIdle();
  }

  /** Debug / save: start the chase if the story is on step 3, otherwise hide it. */
  syncToMission() {
    const m = this.e.state.activeMission;
    const onChase =
      m.id === STORY_MISSION_MIDNIGHT_PROTOTYPE.id &&
      !m.completed &&
      m.currentStepIndex === CHASE.storyStepIndex;
    if (onChase) this.begin();
    else this.stop();
  }

  onJumpToStep(index: number) {
    if (index === CHASE.storyStepIndex) this.begin();
    else this.stop();
  }

  applyEMPRadius(pos: THREE.Vector3, radius: number) {
    if (this.e.state.chasePhase !== 'running' && this.e.state.chasePhase !== 'recovering') return;
    if (this.pos.distanceTo(pos) < radius) {
      this.empLeft = CHASE.empSlowSec;
      this.usedEmp = true;
      this.e.setNotification('EMP tagged the transport! It slowed down.');
      soundEngine.playWaypoint();
    }
  }

  collectRadar(entities: RadarEntity[]) {
    if (!this.group.visible) return;
    entities.push({
      id: 'chaos_transport',
      type: 'chaos',
      x: this.pos.x,
      z: this.pos.z,
      rot: this.group.rotation.y,
      label: 'Transport Drone',
      alert: 0.9,
    });
  }

  update(dt: number) {
    const e = this.e;
    const m = e.state.activeMission;
    const onStep =
      m.id === STORY_MISSION_MIDNIGHT_PROTOTYPE.id && m.currentStepIndex === CHASE.storyStepIndex;

    if (!onStep) {
      if (e.state.chasePhase !== 'idle' && e.state.chasePhase !== 'won') this.stop();
      return;
    }
    if (e.state.chasePhase === 'idle' || e.state.chasePhase === 'won') {
      this.begin();
    }

    this.rotors.forEach((r, i) => {
      r.rotation.y = e.timer.getElapsed() * 18 + i;
    });
    this.empLeft = Math.max(0, this.empLeft - dt);
    this.bumpObstacles();

    if (e.state.isBoosting) this.usedBoost = true;
    if (e.state.isSilentMode) this.usedSilent = true;

    if (e.state.chasePhase === 'recovering') {
      this.recoverLeft -= dt;
      this.pointObjective();
      this.flushDist();
      if (this.recoverLeft <= 0) e.state.chasePhase = 'running';
      return;
    }
    if (e.state.chasePhase !== 'running') return;

    this.fly(dt);
    this.flushDist();
    this.tickFail(dt);

    const last = CHASE.path.length - 1;
    if (this.seg >= last && this.t >= 1) {
      if (e.state.chaseDistance <= CHASE.winRadius) this.win();
      else {
        this.seg = Math.max(0, last - 2);
        this.t = 0;
        this.recover('You lost the drone at the station! Catch it on the inbound.');
      }
    }
  }

  // ---------------------------------------------------------------------------

  private fly(dt: number) {
    const path = CHASE.path;
    const last = path.length - 1;
    if (this.seg >= last) {
      this.t = 1;
      this.placeAt(last, 1);
      return;
    }

    const dist = this.xzDist();
    let speed = CHASE.cruiseSpeed;
    if (dist < CHASE.minBand) speed *= CHASE.closeSpeedMult;
    if (this.empLeft > 0) speed *= CHASE.empSlowMult;

    let remain = speed * dt;
    while (remain > 0 && this.seg < last) {
      const a = path[this.seg];
      const b = path[this.seg + 1];
      const len = Math.max(0.01, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
      const left = (1 - this.t) * len;
      if (remain < left) {
        this.t += remain / len;
        remain = 0;
      } else {
        remain -= left;
        this.t = 0;
        this.seg += 1;
        this.lockCheckpoint(last);
      }
    }
    this.placeAt(Math.min(this.seg, last), Math.min(this.t, 1));
    const i = Math.min(this.seg, last - 1);
    const p0 = path[i];
    const p1 = path[Math.min(i + 1, last)];
    this.group.rotation.y = Math.atan2(p1[0] - p0[0], p1[2] - p0[2]);
  }

  private lockCheckpoint(last: number) {
    const e = this.e;
    e.state.chaseCheckpoint = this.seg;
    this.pointObjective();
    if (this.seg > 0 && this.seg < last) {
      e.setNotification(`Signal lock ${this.seg}/${last}`);
      soundEngine.playWaypoint();
    }
  }

  private tickFail(dt: number) {
    const e = this.e;
    const dist = e.state.chaseDistance;
    let meter = e.state.chaseFailMeter;
    if (dist > CHASE.loseRadius) meter += CHASE.failFillPerSec * dt;
    else meter -= CHASE.failDrainPerSec * dt;
    meter = THREE.MathUtils.clamp(meter, 0, 100);
    e.state.chaseFailMeter = meter;
    if (meter >= 100) this.recover('Signal fading — drone looping from the last lock.');
  }

  private recover(message: string) {
    const e = this.e;
    this.recoveries += 1;
    e.state.chaseFailMeter = 0;
    if (this.recoveries >= CHASE.maxRecoveries) {
      this.seg = 0;
      this.t = 0;
      this.recoveries = 0;
      message = 'The drone looped the whole escape route. Stay closer this time!';
    }
    this.placeAt(this.seg, 0);
    this.pointObjective();
    e.state.chasePhase = 'recovering';
    this.recoverLeft = CHASE.recoverHoldSec;
    e.setNotification(message);
    soundEngine.playAlert();
    soundEngine.speak('Keep up, agent. Stay on the transport.', 'kira');
    e.notifyState();
  }

  private win() {
    const e = this.e;
    e.state.chasePhase = 'won';
    e.state.chaseActive = false;
    e.state.chaseFailMeter = 0;
    this.despawnObstacles();
    // Leave the drone hovering at the station so the next step still has a visual.
    const path = this.usedEmp ? 'smarts' : this.usedSilent ? 'stealth' : 'speed';
    e.missionRunner.checkStep('step_3_chase_drone', path as MissionPathChoice);
    e.state.radioMessage = {
      sender: 'Agent Kira (HQ)',
      text: 'You tracked it to the Cargo Station! Infiltrate with SPEED (ramp), STEALTH (disguise), or SMARTS (hack the crane)!',
      time: Date.now(),
    };
    soundEngine.speak('Cargo station ahead. Infiltrate using speed, stealth, or smarts.', 'kira');
    e.setNotification('Transport tracked to the cargo station!');
    this.flushIdle();
    this.group.visible = false;
  }

  private placeAt(seg: number, t: number) {
    const path = CHASE.path;
    const i = Math.min(seg, path.length - 1);
    const a = path[i];
    const b = path[Math.min(i + 1, path.length - 1)];
    this.pos.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    this.group.position.copy(this.pos);
  }

  private xzDist(): number {
    const p = this.e.state.isRiding ? this.e.bikePos : this.e.playerPos;
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  private flushDist() {
    const e = this.e;
    e.state.chaseDistance = Math.round(this.xzDist());
    e.state.chaseCheckpoint = this.seg;
    e.state.chaseCheckpointTotal = CHASE.path.length;
    this.pointObjective();
  }

  private pointObjective() {
    const e = this.e;
    const step = e.state.activeMission.steps[CHASE.storyStepIndex];
    if (step) step.targetPosition = [this.pos.x, 0, this.pos.z];
    e.state.activeTargetPos = [this.pos.x, this.pos.y, this.pos.z];
  }

  private spawnObstacles() {
    this.despawnObstacles();
    const mat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.4, roughness: 0.4 });
    const stripe = new THREE.MeshBasicMaterial({ color: '#111827' });
    for (const [x, y, z] of CHASE.obstacles) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), mat);
      mesh.position.set(x, y + 0.7, z);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.25, 1.85), stripe);
      band.position.y = 0.15;
      mesh.add(band);
      this.e.scene.add(mesh);
      const box = new THREE.Box3().setFromObject(mesh);
      this.obstacles.push({ mesh, box });
    }
  }

  private despawnObstacles() {
    for (const o of this.obstacles) this.e.scene.remove(o.mesh);
    this.obstacles.length = 0;
  }

  private bumpObstacles() {
    if (!this.e.state.isRiding || this.obstacles.length === 0) return;
    const p = this.e.bikePos;
    for (const o of this.obstacles) {
      if (o.box.distanceToPoint(p) < 1.1 && this.e.bikeSpeed > CHASE.obstacleBumpMaxSpeed) {
        this.e.bikeSpeed = CHASE.obstacleBumpMaxSpeed;
      }
    }
  }

  private flushIdle() {
    const e = this.e;
    e.state.chaseActive = false;
    e.state.chasePhase = 'idle';
    e.state.chaseDistance = 0;
    e.state.chaseFailMeter = 0;
    e.state.chaseCheckpoint = 0;
    e.state.chaseCheckpointTotal = CHASE.path.length;
  }
}
