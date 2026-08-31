import * as THREE from 'three';
import { DisguiseType, GadgetType } from '../types/game';
import type { GameEngine } from './gameEngine';
import type { WorldObjects } from './world';
import { soundEngine } from './audio';

/**
 * One-shot player actions triggered by input (keyboard, touch buttons, gamepad-to-come):
 * mount/dismount + context interact, horn, reset, jump/brake, silent/crouch, gadget
 * switching, EMP/foam/hologram fire, disguise equip, terminal hack.
 *
 * Moved verbatim from GameEngine; only `this.` -> `this.e.`. GameEngine keeps thin
 * public delegators so App / TouchControls / EngineInput / debug callers are unchanged.
 */
export class PlayerActions {
  constructor(private e: GameEngine) {}

  honkHorn() {
    const e = this.e;
    if (!e.state.isRiding) {
      e.setNotification('Agent V9 acoustic chirp!');
    } else {
      e.setNotification('V9 Dual-Tone Spy Siren!');
    }
    soundEngine.playHorn();
  }

  resetVehicle() {
    const e = this.e;
    soundEngine.playReset();
    if (e.state.isRiding) {
      // Right the motorcycle upright and place safely
      e.bikeLean = 0;
      e.bikePitch = 0;
      e.bikeSpeed = 0;
      e.bikeVerticalVel = 0;
      e.isBikeGrounded = true;
      e.bikePos.y = 0;
      e.setNotification('Vehicle Righted & Stabilized!');
    } else {
      e.playerVel.set(0, 0, 0);
      e.playerPos.y = 0;
      e.isGrounded = true;
      e.setNotification('Agent Position Stabilized!');
    }
    e.orbitYawOffset = 0;
    e.orbitPitchOffset = 0;
    e.notifyState();
  }

  handleInteractAction() {
    const e = this.e;
    if (e.isEscortingOut) return;

    // 0. Advance NPC Dialogue if active
    if (e.state.activeNPCDialogue) {
      e.advanceNPCDialogue();
      return;
    }

    // 0.1 Check for Nearby NPC to talk
    const pTarget = e.state.isRiding ? e.bikePos : e.playerPos;
    if (e.world.npcLocals) {
      for (const npc of e.world.npcLocals) {
        if (pTarget.distanceTo(npc.obj.position) < 4.2) {
          e.talkToNPC(npc.data.id);
          return;
        }
      }
    }

    // 1. Mount / Dismount V9
    const distToBike = e.playerPos.distanceTo(e.bikePos);
    if (!e.state.isRiding && distToBike < 4.2 && !e.state.isMiniDroneActive) {
      // Mount
      e.state.isRiding = true;
      e.agentChar.group.visible = false;
      e.motorcycle.riderMesh.visible = true;
      e.setNotification('Mounted V9! Press [W] to Accelerate, [Shift] for Nitro Boost');
      soundEngine.speak('V9 systems online.', 'v9');
      e.requestAutosave();
      e.notifyState();
      return;
    } else if (e.state.isRiding && Math.abs(e.bikeSpeed) < 8) {
      // Dismount
      e.state.isRiding = false;
      e.playerPos.copy(e.bikePos).add(new THREE.Vector3(-1.4, 0, 0));
      e.playerRot = e.bikeRot;
      e.agentChar.group.position.copy(e.playerPos);
      e.agentChar.group.visible = true;
      e.motorcycle.riderMesh.visible = false;
      e.bikeSpeed = 0;
      e.setNotification('Dismounted V9. Ready for on-foot infiltration!');
      e.requestAutosave();
      e.notifyState();
      return;
    }

    // 2. Disguise Lockers
    for (const locker of e.world.lockers) {
      const p = e.state.isRiding ? e.bikePos : e.playerPos;
      if (p.distanceTo(new THREE.Vector3(...locker.position)) < 3.2) {
        this.equipDisguise(locker.disguise as DisguiseType);
        return;
      }
    }

    // 3. Security Terminals (Hacking / Smarts Route)
    for (const term of e.world.terminals) {
      const p = e.state.isRiding ? e.bikePos : e.playerPos;
      if (p.distanceTo(new THREE.Vector3(...term.position)) < 3.5 && !term.hacked) {
        this.hackTerminal(term);
        return;
      }
    }

    // 4. Manual Refueling Trigger at Station
    if (e.state.fuelLevel < 100 && e.world.fuelStations) {
      const p = e.state.isRiding ? e.bikePos : e.playerPos;
      for (const st of e.world.fuelStations) {
        if (p.distanceTo(new THREE.Vector3(...st.position)) < 7.0) {
          e.state.isRefueling = true;
          e.state.fuelLevel = Math.min(100, e.state.fuelLevel + 25);
          soundEngine.playRefuelHum(e.state.fuelLevel);
          e.worldSystems.spawnRefuelParticle(st.position, e.bikePos);
          e.setNotification('⚡ Plasma Refuel Charged +25%');
          e.notifyState();
          return;
        }
      }
    }
  }

  toggleSilentOrCrouch() {
    const e = this.e;
    if (e.state.isRiding) {
      e.state.isSilentMode = !e.state.isSilentMode;
      e.setNotification(e.state.isSilentMode ? 'Silent Electric Mode: ON (Stealth)' : 'Silent Electric Mode: OFF (Turbo)');
      soundEngine.playJump();
    } else {
      e.isCrouching = !e.isCrouching;
      e.setNotification(e.isCrouching ? 'Crouching / Sneaking' : 'Standing');
    }
    e.notifyState();
  }

  handleJumpOrBrake() {
    const e = this.e;
    if (e.state.isRiding) {
      if (e.isBikeGrounded) {
        e.bikeVerticalVel = 9.5;
        e.isBikeGrounded = false;
        soundEngine.playJump();
        e.addStuntScore(50, 'SUPER JUMP');
      }
    } else {
      if (e.isGrounded) {
        e.playerVel.y = 7.2;
        e.isGrounded = false;
        soundEngine.playJump();
      }
    }
  }

  switchGadget(gadget: GadgetType) {
    const e = this.e;
    if (gadget === 'drone') {
      this.toggleMiniDrone();
      return;
    }
    if (gadget === 'remote_v9') {
      this.toggleRemoteV9();
      return;
    }
    e.state.currentGadget = gadget;
    e.setNotification(`Equipped Gadget: ${gadget.toUpperCase()}`);
    soundEngine.playJump();
    e.requestAutosave();
    e.notifyState();
  }

  toggleMiniDrone() {
    const e = this.e;
    e.state.isMiniDroneActive = !e.state.isMiniDroneActive;
    e.miniDrone.group.visible = e.state.isMiniDroneActive;
    if (e.state.isMiniDroneActive) {
      const basePos = e.state.isRiding ? e.bikePos : e.playerPos;
      e.dronePos.set(basePos.x, basePos.y + 3, basePos.z);
      e.droneRot = e.state.isRiding ? e.bikeRot : e.playerRot;
      e.setNotification('Mini Recon Drone deployed! Scan clues & hack relays from above.');
      soundEngine.speak('Mini drone airborne.', 'v9');
    } else {
      e.setNotification('Mini Drone recalled.');
    }
    e.notifyState();
  }

  toggleRemoteV9() {
    const e = this.e;
    if (e.state.isRiding) {
      e.setNotification('Must dismount V9 to drive remotely!');
      return;
    }
    e.state.isRemoteV9Active = !e.state.isRemoteV9Active;
    e.setNotification(e.state.isRemoteV9Active ? 'Remote V9 Control: ON (Decoy Mode)' : 'Remote V9 Control: OFF');
    soundEngine.speak(e.state.isRemoteV9Active ? 'Remote control engaged.' : 'Remote control offline.', 'v9');
    e.notifyState();
  }

  fireGadget() {
    const e = this.e;
    const origin = e.state.isMiniDroneActive
      ? e.dronePos.clone()
      : e.state.isRiding
      ? e.bikePos.clone().add(new THREE.Vector3(0, 0.8, 0))
      : e.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));

    const rot = e.state.isMiniDroneActive
      ? e.droneRot
      : e.state.isRiding
      ? e.bikeRot
      : e.playerRot;

    const dir = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot)).normalize();

    if (e.state.currentGadget === 'emp') {
      soundEngine.playEMP();
      e.setNotification('EMP Shockwave Fired!');

      // Spawn EMP beam mesh
      const empGeo = new THREE.SphereGeometry(0.5, 12, 12);
      const empMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
      const empMesh = new THREE.Mesh(empGeo, empMat);
      empMesh.position.copy(origin);
      e.scene.add(empMesh);
      e.projectiles.push({ mesh: empMesh, vel: dir.clone().multiplyScalar(40), type: 'emp', life: 1.5 });

      // Check immediate EMP disable in radius
      e.stealthAI.applyEMPRadius(origin, 12);
    } else if (e.state.currentGadget === 'foam') {
      soundEngine.playFoam();
      e.setNotification('Foam Blaster Fired! (Traps bots & blocks doors)');

      const foamGeo = new THREE.DodecahedronGeometry(0.6, 1);
      const foamMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.9 });
      const foamMesh = new THREE.Mesh(foamGeo, foamMat);
      foamMesh.position.copy(origin);
      e.scene.add(foamMesh);
      e.projectiles.push({ mesh: foamMesh, vel: dir.clone().multiplyScalar(30), type: 'foam', life: 2 });
    } else if (e.state.currentGadget === 'hologram') {
      e.stealthAI.deployHologramDecoy(origin);
    }
  }

  equipDisguise(disguise: DisguiseType) {
    const e = this.e;
    e.state.currentDisguise = disguise;
    e.updateCustomization(e.customization);
    const disguiseNames: Record<DisguiseType, string> = {
      agent_suit: 'Agent Stealth Suit',
      delivery_worker: 'Velocity Courier Uniform',
      maintenance_tech: 'Technician Safety Outfit',
      lab_scientist: 'Research Lab Coat',
      race_crew: 'Velocity Grand Prix Crew',
    };
    e.setNotification(`Equipped Disguise: ${disguiseNames[disguise]}! Guards in designated zones won't suspect you.`);
    soundEngine.playCollectible();
    e.requestAutosave();
    e.notifyState();
  }

  hackTerminal(term: WorldObjects['terminals'][0]) {
    const e = this.e;
    term.hacked = true;
    (term.mesh.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: '#22c55e' });
    soundEngine.playMissionComplete();
    e.addXP(150, 'Security Terminal Hack (Smarts)');

    if (term.id === 'term_museum_dock') {
      e.world.museumLaserGate.visible = false;
      e.setNotification('Museum Security Laser Gate Deactivated! Loading dock unlocked.');
      e.checkMissionStepComplete('step_2_scan_dock', 'smarts');
    } else if (term.id === 'term_station_crane') {
      e.world.stationCraneGate.position.y += 6;
      e.setNotification('Station Gantry Crane Raised! Warehouse entrance open.');
      e.checkMissionStepComplete('step_4_infiltrate_station', 'smarts');
    } else {
      e.setNotification('Plaza Hologram Node activated! CHAOS alerts cleared.');
      e.state.chaosAlertLevel = 0;
      e.state.chaosAlertProgress = 0;
    }
    e.requestAutosave();
    e.notifyState();
  }
}
