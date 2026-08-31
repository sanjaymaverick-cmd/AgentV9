import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { MissionPathChoice } from '../types/game';
import type { GameEngine } from './gameEngine';
import { soundEngine } from './audio';
import { MISSION } from './tunables';
import { STORY_MISSION_MIDNIGHT_PROTOTYPE } from './missionEngine';

/**
 * Story mission runner (spec §10, §18) — advances "The Midnight Prototype" by checking
 * proximity + world flags each frame, drives the holographic waypoint beacon and the
 * objective compass, and owns step-completion + the finale.
 *
 * Moved verbatim from GameEngine; `this.` -> `this.e.`, step radii -> `MISSION.*`.
 * TODO(spec §18): step 3 is still a bare proximity check, not a real chase controller.
 */
export class MissionRunner {
  constructor(private e: GameEngine) {}

  update(dt: number) {
    const e = this.e;
    const mission = e.state.activeMission;
    if (mission.completed) {
      if (e.waypointGroup) e.waypointGroup.visible = false;
      return;
    }

    const currentStep = mission.steps[mission.currentStepIndex];
    if (!currentStep) {
      if (e.waypointGroup) e.waypointGroup.visible = false;
      return;
    }

    const target = new THREE.Vector3(...currentStep.targetPosition);
    const pPos = e.state.isMiniDroneActive ? e.dronePos : e.state.isRiding ? e.bikePos : e.playerPos;
    const pRot = e.state.isMiniDroneActive ? e.droneRot : e.state.isRiding ? e.bikeRot : e.playerRot;
    const distToObjective = pPos.distanceTo(target);

    // Update HUD Compass & Distance metrics
    e.state.objectiveDistance = Math.round(distToObjective);

    // Calculate relative heading angle to objective (-180 to +180 deg)
    const toTarget = target.clone().sub(pPos);
    const targetAngle = Math.atan2(-toTarget.x, -toTarget.z);
    let diffAngle = targetAngle - pRot;
    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
    e.state.objectiveAngleDeg = Math.round(THREE.MathUtils.radToDeg(diffAngle));

    // Update 3D Holographic Waypoint Beacon
    if (e.waypointGroup) {
      e.waypointGroup.visible = true;
      e.waypointGroup.position.x = target.x;
      e.waypointGroup.position.z = target.z;
      e.waypointGroup.position.y = 0;

      const time = e.timer.getElapsed();
      const diamond = e.waypointGroup.getObjectByName('waypoint_diamond');
      if (diamond) {
        diamond.rotation.y = time * 2.2;
        diamond.position.y = 4.2 + Math.sin(time * 3) * 0.6;
      }

      const ring = e.waypointGroup.getObjectByName('waypoint_ring');
      if (ring) {
        const ringScale = 1 + (Math.sin(time * 4) + 1) * 0.2;
        ring.scale.set(ringScale, ringScale, ringScale);
      }
    }

    // Story-only step gates. Side missions (races, drone tag) have their own managers.
    if (mission.id !== STORY_MISSION_MIDNIGHT_PROTOTYPE.id) return;

    // Step 1: Reach Museum
    if (mission.currentStepIndex === 0 && distToObjective < MISSION.step1ReachDist) {
      this.checkStep('step_1_travel', 'speed');
      e.state.radioMessage = {
        sender: 'Agent Kira (HQ)',
        text: 'You reached the Museum! Scan the rear loading dock for clues about how CHAOS escaped.',
        time: Date.now(),
      };
      soundEngine.speak('You reached the museum. Scan the rear loading dock.', 'kira');
    }

    // Step 2: Scan Loading Dock
    if (mission.currentStepIndex === 1 && distToObjective < MISSION.step2ScanDist) {
      this.checkStep('step_2_scan_dock', 'stealth');
      e.state.radioMessage = {
        sender: 'Agent Kira (HQ)',
        text: 'Signal locked! A CHAOS transport drone just took off heading toward the Monorail Station! Pursue it!',
        time: Date.now(),
      };
      soundEngine.speak('Signal locked! CHAOS transport drone escaping towards the monorail station.', 'kira');
    }

    // Step 3: Follow Drone to Station
    if (mission.currentStepIndex === 2 && distToObjective < MISSION.step3FollowDist) {
      this.checkStep('step_3_chase_drone', 'speed');
      e.state.radioMessage = {
        sender: 'Agent Kira (HQ)',
        text: 'You reached the Cargo Station! Choose your infiltration path: SPEED (ramp jump), STEALTH (disguise/vent), or SMARTS (hack crane)!',
        time: Date.now(),
      };
      soundEngine.speak('Cargo station ahead. Infiltrate using speed, stealth, or smarts.', 'kira');
    }

    // Step 4: Infiltrate Station
    if (mission.currentStepIndex === 3) {
      // Speed path: jumped monorail ramp and entered track
      if (e.state.isRiding && e.bikePos.y > MISSION.step4SpeedPathMinY && e.bikePos.distanceTo(new THREE.Vector3(85, 8, 20)) < MISSION.step4SpeedPathDist) {
        this.checkStep('step_4_infiltrate_station', 'speed');
      }
      // Stealth path: wearing maintenance disguise near station interior
      else if (e.state.currentDisguise === 'maintenance_tech' && distToObjective < MISSION.step4StealthDist) {
        this.checkStep('step_4_infiltrate_station', 'stealth');
      }
    }

    // Step 5: Boss Cargo Drone
    if (mission.currentStepIndex === 4) {
      e.bossDrone.group.visible = true;
      // Animate giant cargo drone flying slowly along highway
      e.bossDrone.group.position.x = 40 + Math.sin(e.timer.getElapsed() * 0.4) * 20;
      e.bossDrone.group.position.z = 40 + (e.timer.getElapsed() % 60) * 1.5;
      e.bossDrone.rotors.forEach((r) => (r.rotation.y += 0.4));
    }
  }

  checkStep(stepId: string, path: MissionPathChoice) {
    const e = this.e;
    const step = e.state.activeMission.steps.find((s) => s.id === stepId);
    if (step && !step.completed) {
      step.completed = true;
      e.state.activeMission.chosenPath = path;
      e.state.activeMission.currentStepIndex++;
      soundEngine.playMissionComplete();
      e.addXP(MISSION.objectiveXP, `Objective Complete: ${step.title} (${path.toUpperCase()})`);
      e.setNotification(`Objective Complete via ${path.toUpperCase()} approach!`);
      e.requestAutosave();

      // Trigger Boss Step
      if (e.state.activeMission.currentStepIndex === MISSION.bossStepIndex) {
        e.bossDrone.group.visible = true;
        e.state.radioMessage = {
          sender: 'Agent Kira (HQ)',
          text: 'ALERT! CHAOS launched the Giant Cargo Drone with the energy core! Match its speed on V9 and fire EMP taggers at all 3 relays!',
          time: Date.now(),
        };
        soundEngine.speak('Alert! Giant cargo drone launched. Race underneath and disable all three EMP relays.', 'kira');
      }

      e.notifyState();
    }
  }

  completeStoryMission() {
    const e = this.e;
    e.state.activeMission.completed = true;
    soundEngine.playMissionComplete();
    e.addXP(e.state.activeMission.rewardXP, 'Story Mission Victory: The Midnight Prototype');
    e.state.stats.credits += e.state.activeMission.rewardCredits;
    e.state.stats.missionsCompleted.push(e.state.activeMission.id);

    e.state.radioMessage = {
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

    e.setNotification('MISSION COMPLETE! Unlocked Holographic Cyber Paint & Super Jump Upgrade!');
    e.requestAutosave();
    e.notifyState();
  }
}
