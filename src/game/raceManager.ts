import * as THREE from 'three';
import confetti from 'canvas-confetti';
import type { GameEngine } from './gameEngine';
import { Mission } from '../types/game';
import { soundEngine } from './audio';
import { RACE } from './tunables';
import { SIDE_MISSIONS, STORY_MISSION_MIDNIGHT_PROTOTYPE } from './missionEngine';

export type RacePhase = 'idle' | 'countdown' | 'racing' | 'won' | 'failed';

/**
 * Checkpoint sprint (spec §19). Ordered gates, wrong-gate detection, race clock,
 * par-time DNF, and best-time persistence via `stats.bestRaceTimes`.
 *
 * The downtown circuit is the first (and currently only) course. Extra courses
 * can register the same way: id + world.raceCheckpoints.
 */
export class RaceManager {
  private countdownLeft = 0;
  private wrongCooldown = 0;
  private winHold = 0;
  private lastAnnouncedCount = -1;

  constructor(private e: GameEngine) {
    this.flushIdle();
  }

  /** Maya / debug / save-restore. Stashes the story so a side sprint doesn't wipe it. */
  start(raceId: string = RACE.downtownId) {
    const e = this.e;
    const def = SIDE_MISSIONS.find((m) => m.id === raceId);
    if (!def) return;

    this.stashStory();
    if (e.state.activeMission.id !== raceId) {
      e.state.activeMission = JSON.parse(JSON.stringify(def)) as Mission;
      e.state.activeMission.active = true;
      e.state.activeMission.completed = false;
    }

    e.clearGPSRoute();
    e.state.raceGateTotal = e.world.raceCheckpoints.length;
    e.state.raceGateIndex = 0;
    e.state.raceTimeSec = 0;
    e.state.raceParSec = RACE.parTimeSec;
    e.state.raceBestTimeSec = e.state.stats.bestRaceTimes[raceId] ?? null;
    e.state.raceWrongGate = false;
    e.state.raceId = raceId;

    this.countdownLeft = RACE.countdownSec;
    this.lastAnnouncedCount = -1;
    this.wrongCooldown = 0;
    this.winHold = 0;
    e.state.racePhase = 'countdown';
    e.state.raceActive = true;
    this.pointObjectiveAt(0);
    e.setNotification('Checkpoint Sprint — get ready!');
    soundEngine.speak('Checkpoint sprint. Hit every gate in order before time runs out.', 'kira');
    e.notifyState();
  }

  /** If a side-race mission was restored mid-run, pick up with a fresh countdown. */
  onMissionRestored() {
    const m = this.e.state.activeMission;
    if (m.id === RACE.downtownId && !m.completed) this.start(m.id);
    else this.flushIdle();
  }

  update(dt: number) {
    const e = this.e;
    this.paintGates(e.timer.getElapsed());
    if (e.state.racePhase === 'idle') return;

    this.wrongCooldown = Math.max(0, this.wrongCooldown - dt);
    if (e.state.raceWrongGate && this.wrongCooldown <= 0) e.state.raceWrongGate = false;

    if (e.state.racePhase === 'countdown') {
      this.tickCountdown(dt);
      return;
    }
    if (e.state.racePhase === 'won') {
      this.winHold -= dt;
      if (this.winHold <= 0) this.restoreStory();
      return;
    }
    if (e.state.racePhase === 'failed') {
      this.tickRetryGate();
      return;
    }
    if (e.state.racePhase !== 'racing') return;

    e.state.raceTimeSec += dt;
    if (e.state.raceTimeSec >= e.state.raceParSec) {
      this.fail();
      return;
    }

    if (!e.state.isRiding) return;
    this.tickGates();
  }

  // ---------------------------------------------------------------------------

  private tickCountdown(dt: number) {
    const e = this.e;
    this.countdownLeft -= dt;
    const shown = Math.max(0, Math.ceil(this.countdownLeft));
    e.state.raceCountdownSec = shown;
    if (shown !== this.lastAnnouncedCount && shown > 0) {
      this.lastAnnouncedCount = shown;
      e.setNotification(`${shown}…`);
      soundEngine.playAlert();
    }
    if (this.countdownLeft <= 0) {
      e.state.racePhase = 'racing';
      e.state.raceCountdownSec = 0;
      e.state.raceTimeSec = 0;
      e.setNotification('GO!');
      soundEngine.playWaypoint();
      e.notifyState();
    }
  }

  private tickGates() {
    const e = this.e;
    const bike = e.bikePos;
    const next = e.state.raceGateIndex;
    const gates = e.world.raceCheckpoints;
    if (!gates.length) return;

    for (const g of gates) {
      const dist = Math.hypot(bike.x - g.position[0], bike.z - g.position[2]);
      if (dist > RACE.passRadius) continue;

      if (g.index === next) {
        this.passGate(g.index);
        return;
      }
      if (g.index > next && this.wrongCooldown <= 0) {
        e.state.raceWrongGate = true;
        this.wrongCooldown = RACE.wrongGateCooldownSec;
        e.setNotification(`Wrong gate! Hit checkpoint ${next + 1} first.`);
        soundEngine.playAlert();
      }
    }
  }

  private tickRetryGate() {
    const e = this.e;
    if (!e.state.isRiding) return;
    const start = e.world.raceCheckpoints[0];
    if (!start) return;
    const dist = Math.hypot(e.bikePos.x - start.position[0], e.bikePos.z - start.position[2]);
    if (dist < RACE.passRadius) this.start(e.state.raceId || RACE.downtownId);
  }

  private passGate(index: number) {
    const e = this.e;
    soundEngine.playWaypoint();
    const last = e.state.raceGateTotal - 1;
    if (index >= last) {
      this.win();
      return;
    }
    e.state.raceGateIndex = index + 1;
    this.pointObjectiveAt(index + 1);
    e.setNotification(`Gate ${index + 1}/${e.state.raceGateTotal}!`);
  }

  private win() {
    const e = this.e;
    const id = e.state.raceId || RACE.downtownId;
    const time = e.state.raceTimeSec;
    const prev = e.state.stats.bestRaceTimes[id];
    const isPB = prev == null || time < prev;
    if (isPB) {
      e.state.stats.bestRaceTimes[id] = time;
      e.state.raceBestTimeSec = time;
    }

    e.state.racePhase = 'won';
    e.state.raceActive = false;
    e.state.raceGateIndex = e.state.raceGateTotal;
    this.winHold = RACE.winHoldSec;

    const mission = e.state.activeMission;
    mission.completed = true;
    mission.steps.forEach((s) => {
      s.completed = true;
    });
    mission.currentStepIndex = mission.steps.length;

    const firstWin = !e.state.stats.missionsCompleted.includes(id);
    if (firstWin) {
      e.state.stats.missionsCompleted.push(id);
      e.addXP(mission.rewardXP, 'Checkpoint Sprint');
      e.state.stats.credits += mission.rewardCredits;
    }

    const t = time.toFixed(2);
    const best = (e.state.stats.bestRaceTimes[id] ?? time).toFixed(2);
    e.setNotification(
      isPB
        ? `NEW BEST ${t}s! ${firstWin ? `+${mission.rewardXP} XP` : 'Personal best'}`
        : `Finished in ${t}s — best ${best}s`
    );
    soundEngine.playMissionComplete();
    soundEngine.speak(isPB ? `New best time, ${t} seconds!` : `Finished in ${t} seconds.`, 'kira');
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 } });
    e.requestAutosave();
    e.notifyState();
  }

  private fail() {
    const e = this.e;
    e.state.racePhase = 'failed';
    e.state.raceActive = false;
    e.state.raceTimeSec = e.state.raceParSec;
    e.setNotification("Time's up! Ride the START gate to retry.");
    soundEngine.playAlert();
    soundEngine.speak('Time up. Ride through the start gate to try again.', 'kira');
    e.notifyState();
  }

  private pointObjectiveAt(index: number) {
    const e = this.e;
    const g = e.world.raceCheckpoints[index];
    if (!g) return;
    const step = e.state.activeMission.steps[0];
    if (step) step.targetPosition = [...g.position];
    e.state.activeTargetPos = [...g.position];
  }

  private paintGates(time: number) {
    const e = this.e;
    const next = e.state.raceGateIndex;
    const racing = e.state.racePhase === 'racing' || e.state.racePhase === 'countdown';
    for (const g of e.world.raceCheckpoints) {
      const mat = g.ring.material as THREE.MeshBasicMaterial;
      if (!racing) {
        mat.color.set('#38bdf8');
        mat.opacity = 0.45;
        g.ring.rotation.y = time * 0.6;
        continue;
      }
      if (g.index < next) {
        mat.color.set('#22c55e');
        mat.opacity = 0.55;
      } else if (g.index === next) {
        mat.color.set(e.state.raceWrongGate ? '#ef4444' : '#f59e0b');
        mat.opacity = 0.95;
        g.ring.scale.setScalar(1 + Math.sin(time * 6) * 0.08);
      } else {
        mat.color.set('#38bdf8');
        mat.opacity = 0.35;
        g.ring.scale.setScalar(1);
      }
      g.ring.rotation.y = time * (g.index === next ? 2.4 : 0.8);
    }
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
    this.flushIdle();
    if (e.stashedStoryMission) {
      e.state.activeMission = e.stashedStoryMission;
      e.stashedStoryMission = null;
      e.setNotification('Back on the story — check your objective.');
      e.requestAutosave();
    }
    e.notifyState();
  }

  private flushIdle() {
    const e = this.e;
    e.state.raceActive = false;
    e.state.racePhase = 'idle';
    e.state.raceTimeSec = 0;
    e.state.raceParSec = RACE.parTimeSec;
    e.state.raceGateIndex = 0;
    e.state.raceGateTotal = e.world?.raceCheckpoints?.length ?? DOWNTOWN_LEN;
    e.state.raceCountdownSec = 0;
    e.state.raceWrongGate = false;
    e.state.raceId = '';
    const best = e.state.stats.bestRaceTimes[RACE.downtownId];
    e.state.raceBestTimeSec = best ?? null;
  }
}

const DOWNTOWN_LEN = 8;
