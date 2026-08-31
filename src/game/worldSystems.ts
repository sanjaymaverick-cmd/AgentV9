import * as THREE from 'three';
import { NPCLocal } from '../types/game';
import type { GameEngine } from './gameEngine';
import type { WorldObjects } from './world';
import { soundEngine } from './audio';

/**
 * The per-frame "everything else in the world" bundle:
 *   - on-foot agent movement + mini-drone flight
 *   - autonomous traffic vehicles
 *   - collectibles, stunt rings, pedestrian NPCs, GPS-route progress
 *   - fuel-station proximity + refuelling and its plasma particles
 *   - EMP/foam projectile motion
 *
 * Moved verbatim from GameEngine; only `this.` -> `this.e.`.
 */
export class WorldSystems {
  constructor(private e: GameEngine) {}

  updateAgentOnFoot(dt: number) {
    const e = this.e;
    const moveSpeed = e.isSprinting ? 11 : e.isCrouching ? 3.5 : 6.5;
    const moveDir = new THREE.Vector3();

    if (e.input.forward || e.input.analogThrottle > 0.2) moveDir.z -= (e.input.forward ? 1 : e.input.analogThrottle);
    if (e.input.backward || e.input.analogThrottle < -0.2) moveDir.z += (e.input.backward ? 1 : -e.input.analogThrottle);
    if (e.input.left || e.input.analogSteer < -0.2) moveDir.x -= (e.input.left ? 1 : -e.input.analogSteer);
    if (e.input.right || e.input.analogSteer > 0.2) moveDir.x += (e.input.right ? 1 : e.input.analogSteer);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Rotate moveDir to camera orientation
      const camAngle = Math.atan2(e.camera.position.x - e.playerPos.x, e.camera.position.z - e.playerPos.z);
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);

      e.playerPos.x += moveDir.x * moveSpeed * dt;
      e.playerPos.z += moveDir.z * moveSpeed * dt;

      const targetAngle = Math.atan2(-moveDir.x, -moveDir.z);
      e.playerRot = THREE.MathUtils.lerp(e.playerRot, targetAngle, dt * 12);

      // Walking leg animation
      const walkTime = e.timer.getElapsed() * (moveSpeed * 1.5);
      e.agentChar.leftLeg.rotation.x = Math.sin(walkTime) * 0.6;
      e.agentChar.rightLeg.rotation.x = -Math.sin(walkTime) * 0.6;
      e.agentChar.leftArm.rotation.x = -Math.sin(walkTime) * 0.5;
      e.agentChar.rightArm.rotation.x = Math.sin(walkTime) * 0.5;

      // Noise generator
      e.state.stealthNoise = e.isCrouching ? 5 : e.isSprinting ? 75 : 30;
    } else {
      e.agentChar.leftLeg.rotation.x = 0;
      e.agentChar.rightLeg.rotation.x = 0;
      e.agentChar.leftArm.rotation.x = 0;
      e.agentChar.rightArm.rotation.x = 0;
      e.state.stealthNoise = 0;
    }

    // Agent Gravity
    if (!e.isGrounded) {
      e.playerVel.y -= 20 * dt;
      e.playerPos.y += e.playerVel.y * dt;
      if (e.playerPos.y <= 0) {
        e.playerPos.y = 0;
        e.playerVel.y = 0;
        e.isGrounded = true;
      }
    }

    e.agentChar.group.position.copy(e.playerPos);
    e.agentChar.group.rotation.y = e.playerRot;
    e.agentChar.group.scale.y = e.isCrouching ? 0.7 : 1;
  }

  updateMiniDrone(dt: number) {
    const e = this.e;
    const droneSpeed = 16;
    if (e.input.forward || e.input.analogThrottle > 0.2) {
      e.dronePos.x -= Math.sin(e.droneRot) * droneSpeed * dt;
      e.dronePos.z -= Math.cos(e.droneRot) * droneSpeed * dt;
    }
    if (e.input.backward || e.input.analogThrottle < -0.2) {
      e.dronePos.x += Math.sin(e.droneRot) * droneSpeed * dt;
      e.dronePos.z += Math.cos(e.droneRot) * droneSpeed * dt;
    }
    if (e.input.left || e.input.analogSteer < -0.2) e.droneRot += 2.8 * dt;
    if (e.input.right || e.input.analogSteer > 0.2) e.droneRot -= 2.8 * dt;
    if (e.input.jump) e.dronePos.y = Math.min(35, e.dronePos.y + 12 * dt);
    if (e.input.sneak) e.dronePos.y = Math.max(1, e.dronePos.y - 12 * dt);

    e.miniDrone.group.position.copy(e.dronePos);
    e.miniDrone.group.rotation.y = e.droneRot;

    // Spin drone propellers
    e.miniDrone.rotors.forEach((r) => (r.rotation.y += 0.8));
  }

  updateTrafficVehicles(dt: number) {
    const e = this.e;
    if (!e.world || !e.world.trafficVehicles) return;

    e.world.trafficVehicles.forEach((veh) => {
      if (veh.route.length < 2) return;

      const p1 = veh.route[veh.routeIndex];
      const nextIdx = (veh.routeIndex + 1) % veh.route.length;
      const p2 = veh.route[nextIdx];

      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const segDist = Math.hypot(dx, dz) || 1;

      // Advance along path
      veh.progress += (veh.speed * dt) / segDist;
      if (veh.progress >= 1.0) {
        veh.progress -= 1.0;
        veh.routeIndex = nextIdx;
      }

      // Interpolate position
      const curX = THREE.MathUtils.lerp(p1[0], p2[0], veh.progress);
      const curZ = THREE.MathUtils.lerp(p1[1], p2[1], veh.progress);
      veh.obj.position.x = curX;
      veh.obj.position.z = curZ;

      // Realistic Heading Direction
      const targetAngle = Math.atan2(dx, dz) + Math.PI;
      let rotDiff = targetAngle - veh.obj.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      veh.obj.rotation.y += rotDiff * Math.min(1, dt * 6);

      // Spin Wheels
      veh.wheels.forEach((w) => {
        w.rotation.x += veh.speed * dt * 2.4;
      });

      // Player Collision / Proximity Check
      const activePlayerPos = e.state.isRiding ? e.bikePos : e.playerPos;
      const distToPlayer = veh.obj.position.distanceTo(activePlayerPos);
      if (distToPlayer < 3.2) {
        // Subtle deflection feedback
        const pushDir = activePlayerPos.clone().sub(veh.obj.position).normalize();
        pushDir.y = 0;
        if (e.state.isRiding) {
          e.bikePos.add(pushDir.multiplyScalar(dt * 8));
          e.bikeSpeed *= 0.85;
        }
      }
    });
  }

  updateProjectiles(dt: number) {
    const e = this.e;
    for (let i = e.projectiles.length - 1; i >= 0; i--) {
      const p = e.projectiles[i];
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.life -= dt;

      if (p.life <= 0) {
        e.scene.remove(p.mesh);
        e.projectiles.splice(i, 1);
      }
    }
  }

  updateWorldInteractions(dt: number) {
    const e = this.e;
    const playerTarget = e.state.isRiding ? e.bikePos : e.playerPos;

    // 1. Collectibles (Spy Drives)
    e.world.collectibles.forEach((c) => {
      if (!c.collected && playerTarget.distanceTo(new THREE.Vector3(...c.position)) < 3.2) {
        c.collected = true;
        e.state.stats.secretsFound++;
        soundEngine.playCollectible();
        e.addXP(100, `Found Secret: ${c.name}`);
        e.setNotification(`Secret Found: ${c.name}! (${e.state.stats.secretsFound}/6)`);
        e.requestAutosave();
        // Remove 3D mesh
        const mesh = e.scene.getObjectByName(c.id);
        if (mesh) e.scene.remove(mesh);
      }
    });

    // 2. Stunt Rings
    e.world.stuntRings.forEach((r) => {
      r.mesh.rotation.y += 1.5 * dt;
      if (!r.collected && e.state.isRiding && e.bikePos.distanceTo(new THREE.Vector3(...r.position)) < 4.5) {
        r.collected = true;
        soundEngine.playMissionComplete();
        e.addStuntScore(200, 'HOOP STUNT MASTER');
        e.state.nitroLevel = 100;
        e.state.fuelLevel = Math.min(100, e.state.fuelLevel + 25);
        e.setNotification('STUNT RING CLEARED! Full Nitro + 25% Energy Refill!');
        (r.mesh.material as THREE.MeshBasicMaterial).color.set('#22c55e');
        e.requestAutosave();
      }
    });

    // 3. NPC Locals and Pedestrians
    let nearestNPCNearby: NPCLocal | null = null;
    let minNPCDist = 4.2;

    if (e.world.npcLocals) {
      e.world.npcLocals.forEach((npc) => {
        const dist = playerTarget.distanceTo(npc.obj.position);

        // Check proximity for interaction prompt
        if (dist < minNPCDist) {
          minNPCDist = dist;
          nearestNPCNearby = npc.data;
        }

        // Animate quest marker floating
        if (npc.questIcon) {
          npc.questIcon.rotation.y += 2.5 * dt;
          npc.questIcon.position.y = 2.4 + Math.sin(e.timer.getElapsed() * 4) * 0.15;
        }

        // Animate pedestrians walking along sidewalk routes
        if (npc.isPedestrian && npc.patrolRoute && npc.patrolRoute.length > 1) {
          const pRoute = npc.patrolRoute;
          const curIdx = npc.patrolIndex || 0;
          const nextIdx = (curIdx + 1) % pRoute.length;
          const targetPt = pRoute[nextIdx];
          const tVec = new THREE.Vector3(targetPt[0], 0.22, targetPt[1]);

          const pDist = npc.obj.position.distanceTo(tVec);
          if (pDist < 0.6) {
            npc.patrolIndex = nextIdx;
          } else {
            const pDir = tVec.clone().sub(npc.obj.position).normalize();
            npc.obj.position.add(pDir.multiplyScalar(2.0 * dt));
            npc.obj.rotation.y = Math.atan2(pDir.x, pDir.z);

            // Procedural walking limb animation
            const walkCycle = e.timer.getElapsed() * 7;
            npc.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
            npc.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
            npc.leftArm.rotation.x = -Math.sin(walkCycle) * 0.4;
            npc.rightArm.rotation.x = Math.sin(walkCycle) * 0.4;
          }
        }
      });
    }

    if (nearestNPCNearby) {
      if (e.state.nearInteraction !== 'talk') {
        e.state.nearInteraction = 'talk';
      }
    } else if (e.state.nearInteraction === 'talk') {
      e.state.nearInteraction = null;
    }

    // 4. Update GPS Route Progress & Distance
    if (e.state.activeGPSRoute) {
      const destVec = new THREE.Vector3(...e.state.activeGPSRoute.targetPos);
      const distToDest = playerTarget.distanceTo(destVec);
      e.state.activeGPSRoute.totalDistance = Math.round(distToDest);
      e.state.activeGPSRoute.etaSeconds = Math.max(2, Math.round(distToDest / (e.state.isRiding ? 22 : 6)));
      e.state.activeGPSRoute.nextTurnInstruction = e.gpsNavigator.nextTurnInstruction(playerTarget, e.state.activeGPSRoute.waypoints);

      if (distToDest < 6.0) {
        soundEngine.playWaypoint();
        e.setNotification(`🎯 Arrived at GPS Destination: ${e.state.activeGPSRoute.destinationName}`);
        e.clearGPSRoute();
      }
    }
  }

  updateFuelStationsAndRefueling(dt: number) {
    const e = this.e;
    const time = e.timer.getElapsed();
    const playerTarget = e.state.isRiding ? e.bikePos : e.playerPos;

    let nearestStation: { name: string; distance: number; position: [number, number, number] } | null = null;
    let minDistance = Infinity;
    let inStationRange = false;
    let activeStationObj: WorldObjects['fuelStations'][0] | null = null;

    if (e.world.fuelStations) {
      e.world.fuelStations.forEach((station) => {
        // 1. Animate Station Holographic Fuel Icon & Pulse Rings
        if (station.holoIcon) {
          station.holoIcon.rotation.y += 2.0 * dt;
          station.holoIcon.position.y = 5.4 + Math.sin(time * 2.6) * 0.25;
        }

        if (station.pulseRing) {
          const ringScale = 1.0 + (Math.sin(time * 3.5) + 1.0) * 0.12;
          station.pulseRing.scale.set(ringScale, ringScale, ringScale);
        }

        // 2. Distance checks
        const sPos = new THREE.Vector3(...station.position);
        const dist = playerTarget.distanceTo(sPos);

        if (dist < minDistance) {
          minDistance = dist;
          nearestStation = {
            name: station.name,
            distance: Math.round(dist),
            position: station.position,
          };
        }

        // Check proximity to recharge pad (radius ~6.8m)
        if (dist < 6.8) {
          inStationRange = true;
          activeStationObj = station;
        }
      });
    }

    e.state.nearestFuelStation = nearestStation;

    // 3. Handle Refueling on Station Pad
    if (inStationRange && activeStationObj) {
      if (e.state.fuelLevel < 100) {
        e.state.nearInteraction = 'refuel';

        // Auto-refuel when slow/stopped or holding interact
        const isStationaryOrManual = Math.abs(e.bikeSpeed) < 12 || e.input.interact || !e.state.isRiding;

        if (isStationaryOrManual) {
          e.state.isRefueling = true;
          e.state.fuelLevel = Math.min(100, e.state.fuelLevel + dt * 32); // Fast full recharge in ~3.1s
          e.state.refuelProgress = Math.round(e.state.fuelLevel);
          e.hasWarnedZeroFuel = false;

          // Sound effect
          e.refuelSoundTimer += dt;
          if (e.refuelSoundTimer > 0.08) {
            soundEngine.playRefuelHum(e.state.fuelLevel);
            e.refuelSoundTimer = 0;
          }

          // Spawn visual plasma charging particles flowing from station dispenser to bike
          this.spawnRefuelParticle(activeStationObj.position, e.bikePos);

          if (e.state.fuelLevel >= 100) {
            e.state.fuelLevel = 100;
            e.state.isRefueling = false;
            soundEngine.playRefuelComplete();
            e.addXP(25, 'V9 Plasma Fast-Charge');
            e.setNotification('⚡ V9 Energy Cells 100% Fully Charged! (+25 XP)');
            soundEngine.speak('V9 energy cells fully restored and stabilized!', 'kira');
          }
        } else {
          e.state.isRefueling = false;
        }
      } else {
        if (e.state.isRefueling) e.state.isRefueling = false;
      }
    } else {
      if (e.state.isRefueling) e.state.isRefueling = false;
      if (e.state.nearInteraction === 'refuel') {
        e.state.nearInteraction = null;
      }
    }

    // 4. Update Plasma Refuel Particles
    this.updateRefuelParticles(dt);
  }

  spawnRefuelParticle(fromPos: [number, number, number], toPos: THREE.Vector3) {
    const e = this.e;
    if (e.refuelParticles.length > 25) return;
    const geo = new THREE.SphereGeometry(0.14, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.6 ? '#10b981' : '#00f2fe',
      transparent: true,
      opacity: 0.9,
    });
    const p = new THREE.Mesh(geo, mat);

    // Start from station dispenser / pump
    const pumpSource = new THREE.Vector3(fromPos[0], fromPos[1] + 2.2, fromPos[2] - 1.4);
    p.position.copy(pumpSource);

    // Direct velocity towards motorcycle fuel port
    const target = toPos.clone().add(new THREE.Vector3(0, 0.75, 0));
    const vel = target.sub(pumpSource).multiplyScalar(3.5);

    e.scene.add(p);
    e.refuelParticles.push({ mesh: p, vel, life: 0.35 });
  }

  updateRefuelParticles(dt: number) {
    const e = this.e;
    for (let i = e.refuelParticles.length - 1; i >= 0; i--) {
      const p = e.refuelParticles[i];
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.life -= dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / 0.35);

      if (p.life <= 0) {
        e.scene.remove(p.mesh);
        e.refuelParticles.splice(i, 1);
      }
    }
  }
}
