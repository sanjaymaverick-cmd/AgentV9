import * as THREE from 'three';
import confetti from 'canvas-confetti';
import type { GameEngine } from './gameEngine';
import { Mission, MissionPathChoice, RadarEntity } from '../types/game';
import { soundEngine } from './audio';
import { DRONE_TAG, ROGUE_DRONE_FLIGHTS } from './tunables';
import { SIDE_MISSIONS, STORY_MISSION_MIDNIGHT_PROTOTYPE } from './missionEngine';
import { createRogueDeliveryDrone } from './models';

interface RogueDrone {
  group: THREE.Group;
  rotors: THREE.Mesh[];
  tagged: boolean;
  falling: number;
  flight: (typeof ROGUE_DRONE_FLIGHTS)[number];
}

/** XZ radius plus extra vertical slack so ramp jumps can still tag high fliers. */
export function inTagRange(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  radius: number,
  heightSlack = DRONE_TAG.heightSlack,
): boolean {
  if (Math.hypot(ax - bx, az - bz) > radius) return false;
  return Math.abs(ay - by) < radius + heightSlack;
}

/**
 * Officer Jax's plaza tagger (spec §20 side chase). Four courier drones orbit
 * downtown; EMP, foam, or a close recon-drone pass tags them. Story is stashed
 * like the checkpoint sprint so accepting the quest doesn't wipe Midnight Prototype.
 */
export class DroneTagManager {
  private drones: RogueDrone[] = [];
  private active = false;
  private winHold = 0;
  private done = false;

  constructor(private e: GameEngine) {}

  start() {
    const e = this.e;
    const def = SIDE_MISSIONS.find((m) => m.id === DRONE_TAG.id);
    if (!def) return;

    this.stashStory();
    e.state.activeMission = JSON.parse(JSON.stringify(def)) as Mission;
    e.state.activeMission.active = true;
    e.state.activeMission.completed = false;
    e.clearGPSRoute();
    e.setGPSDestination([0, 8, 0], 'Rogue Drones');

    this.ensureDrones();
    for (const d of this.drones) {
      d.tagged = false;
      d.falling = 0;
      d.group.visible = true;
      const mat = (d.group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat.color) mat.color.set('#9a3412');
    }

    this.active = true;
    this.done = false;
    this.winHold = 0;
    e.state.droneTagActive = true;
    e.state.droneTagTagged = 0;
    e.state.droneTagTotal = DRONE_TAG.count;
    this.syncStepText();
    e.setNotification('Tag 4 rogue delivery drones over the plaza!');
    soundEngine.speak('Four rogue drones over the plaza. EMP, foam, or your mini drone can tag them.', 'kira');
    e.notifyState();
  }

  onMissionRestored() {
    const m = this.e.state.activeMission;
    if (m.id === DRONE_TAG.id && !m.completed) this.start();
    else if (!this.active) this.hideAll();
  }

  update(dt: number) {
    const e = this.e;
    if (!this.active && this.drones.length === 0) return;

    if (this.done) {
      this.winHold -= dt;
      this.spinTagged(dt);
      if (this.winHold <= 0) this.restoreStory();
      return;
    }

    if (!this.active) {
      this.hideAll();
      return;
    }

    const t = e.timer.getElapsed();
    for (const d of this.drones) {
      if (d.tagged) {
        d.falling += dt;
        d.group.position.y = Math.max(1.2, d.group.position.y - dt * 6);
        d.rotors.forEach((r) => {
          r.rotation.y += dt * 4;
        });
        continue;
      }
      const f = d.flight;
      const a = t * f.speed + f.phase;
      d.group.position.set(f.cx + Math.cos(a) * f.radius, f.height, f.cz + Math.sin(a) * f.radius);
      d.group.rotation.y = a + Math.PI / 2;
      d.rotors.forEach((r) => {
        r.rotation.y += dt * 28;
      });
    }

    if (e.state.isMiniDroneActive) {
      this.applyTag(e.dronePos, DRONE_TAG.smartsHackDist, 'smarts');
    }
  }

  applyEmp(pos: THREE.Vector3) {
    const path: MissionPathChoice = this.e.state.isMiniDroneActive
      ? 'smarts'
      : this.e.state.isRiding
      ? 'speed'
      : 'speed';
    this.applyTag(pos, DRONE_TAG.empRadius, path);
  }

  applyFoam(pos: THREE.Vector3) {
    this.applyTag(pos, DRONE_TAG.foamRadius, 'stealth');
  }

  applyTag(pos: THREE.Vector3, radius: number, path: MissionPathChoice) {
    if (!this.active || this.done) return;
    let hit = false;
    for (const d of this.drones) {
      if (d.tagged) continue;
      if (!inTagRange(pos.x, pos.y, pos.z, d.group.position.x, d.group.position.y, d.group.position.z, radius)) {
        continue;
      }
      this.tagOne(d, path);
      hit = true;
    }
    if (hit) this.e.notifyState();
  }

  private tagOne(d: RogueDrone, path: MissionPathChoice) {
    const e = this.e;
    d.tagged = true;
    const mat = (d.group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    if (mat.color) mat.color.set('#22c55e');
    const tagged = this.drones.filter((x) => x.tagged).length;
    e.state.droneTagTagged = tagged;
    this.syncStepText();
    soundEngine.playWaypoint();
    e.setNotification(`Drone tagged ${tagged}/${DRONE_TAG.count} (${path})`);
    if (tagged >= DRONE_TAG.count) this.win(path);
  }

  private win(path: MissionPathChoice) {
    const e = this.e;
    this.done = true;
    this.winHold = DRONE_TAG.winHoldSec;
    const mission = e.state.activeMission;
    mission.completed = true;
    mission.chosenPath = path;
    mission.steps.forEach((s) => {
      s.completed = true;
    });
    mission.currentStepIndex = mission.steps.length;

    const first = !e.state.stats.missionsCompleted.includes(DRONE_TAG.id);
    if (first) {
      e.state.stats.missionsCompleted.push(DRONE_TAG.id);
      e.addXP(mission.rewardXP, 'Drone Tagger Challenge');
      e.state.stats.credits += mission.rewardCredits;
      if (!e.state.stats.unlockedUpgrades.includes('foam_capacity')) {
        e.state.stats.unlockedUpgrades.push('foam_capacity');
      }
    }
    e.state.droneTagActive = false;
    e.setNotification(first ? 'All four drones tagged! Foam capacity upgraded.' : 'All four drones tagged!');
    soundEngine.playMissionComplete();
    soundEngine.speak('All rogue drones tagged. Nice work agent.', 'kira');
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.55 } });
    e.requestAutosave();
  }

  collectRadar(entities: RadarEntity[]) {
    if (!this.active) return;
    this.drones.forEach((d, i) => {
      if (d.tagged || !d.group.visible) return;
      entities.push({
        id: `rogue_drone_${i}`,
        type: 'drone',
        x: d.group.position.x,
        z: d.group.position.z,
        rot: d.group.rotation.y,
        label: 'Rogue Drone',
      });
    });
  }

  private syncStepText() {
    const step = this.e.state.activeMission.steps[0];
    if (!step) return;
    const left = DRONE_TAG.count - this.e.state.droneTagTagged;
    step.instruction = left === 0
      ? 'All drones tagged!'
      : `Tag ${left} rogue drone${left === 1 ? '' : 's'} over the plaza (EMP, foam, or mini drone).`;
  }

  private ensureDrones() {
    if (this.drones.length) return;
    for (const flight of ROGUE_DRONE_FLIGHTS) {
      const mesh = createRogueDeliveryDrone();
      mesh.group.visible = false;
      this.e.scene.add(mesh.group);
      this.drones.push({
        group: mesh.group,
        rotors: mesh.rotors,
        tagged: false,
        falling: 0,
        flight,
      });
    }
  }

  private hideAll() {
    for (const d of this.drones) d.group.visible = false;
    this.e.state.droneTagActive = false;
    this.e.state.droneTagTagged = 0;
  }

  private stashStory() {
    const e = this.e;
    const m = e.state.activeMission;
    if (m.id === STORY_MISSION_MIDNIGHT_PROTOTYPE.id && !e.stashedStoryMission) {
      e.stashedStoryMission = JSON.parse(JSON.stringify(m)) as Mission;
    }
  }

  private restoreStory() {
    const e = this.e;
    this.active = false;
    this.done = false;
    this.hideAll();
    if (e.stashedStoryMission) {
      e.state.activeMission = e.stashedStoryMission;
      e.stashedStoryMission = null;
      e.setNotification('Back on the story — check your objective.');
      e.requestAutosave();
    }
    e.notifyState();
  }

  private spinTagged(dt: number) {
    for (const d of this.drones) {
      if (!d.tagged) continue;
      d.group.position.y = Math.max(1.2, d.group.position.y - dt * 6);
    }
  }
}
