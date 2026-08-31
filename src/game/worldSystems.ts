import * as THREE from 'three';
import { NPCLocal } from '../types/game';
import type { GameEngine } from './gameEngine';
import { gatherCollisionBoxes, type WorldObjects } from './world';
import { resolveCircleAabbs } from './collision';
import { soundEngine } from './audio';
import { LOD } from './tunables';

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
  private readonly moveDir = new THREE.Vector3();
  private readonly tVec = new THREE.Vector3();
  private readonly destVec = new THREE.Vector3();
  private readonly sPos = new THREE.Vector3();
  private readonly pushDir = new THREE.Vector3();
  private readonly pDir = new THREE.Vector3();
  private readonly tmpVel = new THREE.Vector3();

  constructor(private e: GameEngine) {}

  updateAgentOnFoot(dt: number) {
    const e = this.e;
    const moveSpeed = e.isSprinting ? 11 : e.isCrouching ? 3.5 : 6.5;
    const moveDir = this.moveDir.set(0, 0, 0);

    if (e.input.forward || e.input.analogThrottle > 0.2) moveDir.z -= (e.input.forward ? 1 : e.input.analogThrottle);
    if (e.input.backward || e.input.analogThrottle < -0.2) moveDir.z += (e.input.backward ? 1 : -e.input.analogThrottle);
    if (e.input.left || e.input.analogSteer < -0.2) moveDir.x -= (e.input.left ? 1 : -e.input.analogSteer);
    if (e.input.right || e.input.analogSteer > 0.2) moveDir.x += (e.input.right ? 1 : e.input.analogSteer);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Camera-relative walk using the intended look yaw — not the lerped camera
      // position, which used to fight look-around and shake the walk cycle.
      const yaw = e.cameraYaw;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const mx = moveDir.x * cos + moveDir.z * sin;
      const mz = -moveDir.x * sin + moveDir.z * cos;
      moveDir.set(mx, 0, mz);

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

    resolveCircleAabbs(e.playerPos, 0.55, gatherCollisionBoxes(e.world, e.stealthAI.foamBoxes()));

    e.agentChar.group.position.copy(e.playerPos);
    e.agentChar.group.rotation.y = e.playerRot;
    e.agentChar.group.scale.y = e.isCrouching ? 0.7 : 1;
  }

  updateMuseumAccess() {
    const e = this.e;
    const door = e.world.museumStaffDoor;
    if (!door) return;
    const zone = e.world.restrictedZones.find((z) => z.id === 'museum_dock');
    const allowed = !!zone && zone.allowedDisguises.includes(e.state.currentDisguise);
    const hacked = e.world.terminals.some((t) => t.id === 'term_museum_dock' && t.hacked);
    door.open = allowed || hacked;
    door.mesh.visible = !door.open;
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

    const player = e.state.isRiding ? e.bikePos : e.playerPos;
    const agentR2 = (e.currentQuality.drawDistance * LOD.agentRange) ** 2;

    e.world.trafficVehicles.forEach((veh, i) => {
      if (veh.route.length < 2) return;

      const p1 = veh.route[veh.routeIndex];
      const nextIdx = (veh.routeIndex + 1) % veh.route.length;
      const p2 = veh.route[nextIdx];

      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const segDist = Math.hypot(dx, dz) || 1;

      veh.progress += (veh.speed * dt) / segDist;
      if (veh.progress >= 1.0) {
        veh.progress -= 1.0;
        veh.routeIndex = nextIdx;
      }

      const curX = THREE.MathUtils.lerp(p1[0], p2[0], veh.progress);
      const curZ = THREE.MathUtils.lerp(p1[1], p2[1], veh.progress);
      veh.obj.position.x = curX;
      veh.obj.position.z = curZ;

      const overBudget = i >= e.currentQuality.trafficCount;
      const d2 = (curX - player.x) ** 2 + (curZ - player.z) ** 2;
      if (overBudget || d2 > agentR2) {
        veh.obj.visible = false;
        return;
      }
      veh.obj.visible = true;

      const targetAngle = Math.atan2(dx, dz) + Math.PI;
      let rotDiff = targetAngle - veh.obj.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      veh.obj.rotation.y += rotDiff * Math.min(1, dt * 6);

      veh.wheels.forEach((w) => {
        w.rotation.x += veh.speed * dt * 2.4;
      });

      const activePlayerPos = e.state.isRiding ? e.bikePos : e.playerPos;
      const distToPlayer = veh.obj.position.distanceTo(activePlayerPos);
      if (distToPlayer < 3.2) {
        const pushDir = this.pushDir.copy(activePlayerPos).sub(veh.obj.position).normalize();
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
      p.mesh.position.add(this.tmpVel.copy(p.vel).multiplyScalar(dt));
      p.life -= dt;
      if (p.type === 'emp') {
        e.stealthAI.tripBreakers(p.mesh.position, 3.4);
        e.droneTagManager.applyEmp(p.mesh.position);
      }
      if (p.type === 'foam') {
        const trapped = e.stealthAI.tryTrapBotsWithFoam(p.mesh.position);
        e.droneTagManager.applyFoam(p.mesh.position);
        if (trapped) p.life = 0;
      }

      if (p.life <= 0) {
        if (p.type === 'foam') e.stealthAI.spawnFoamBlob(p.mesh.position);
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
      if (!c.collected && playerTarget.distanceTo(this.tVec.set(...c.position)) < 3.2) {
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
      if (!r.collected && e.state.isRiding && e.bikePos.distanceTo(this.tVec.set(...r.position)) < 4.5) {
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
      let pedsShown = 0;
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
          const tVec = this.tVec.set(targetPt[0], 0.22, targetPt[1]);

          const pDist = npc.obj.position.distanceTo(tVec);
          if (pDist < 0.6) {
            npc.patrolIndex = nextIdx;
          } else {
            const pDir = this.pDir.copy(tVec).sub(npc.obj.position).normalize();
            npc.obj.position.add(pDir.multiplyScalar(2.0 * dt));
            npc.obj.rotation.y = Math.atan2(pDir.x, pDir.z);

            const walkCycle = e.timer.getElapsed() * 7;
            npc.leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
            npc.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
            npc.leftArm.rotation.x = -Math.sin(walkCycle) * 0.4;
            npc.rightArm.rotation.x = Math.sin(walkCycle) * 0.4;
          }

          const overBudget = pedsShown >= e.currentQuality.pedestrianCount;
          pedsShown++;
          const agentR2 = (e.currentQuality.drawDistance * LOD.agentRange) ** 2;
          const d2 = (npc.obj.position.x - playerTarget.x) ** 2 + (npc.obj.position.z - playerTarget.z) ** 2;
          npc.obj.visible = !overBudget && d2 <= agentR2;
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
      const destVec = this.destVec.set(...e.state.activeGPSRoute.targetPos);
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
        const sPos = this.sPos.set(...station.position);
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
    if (e.refuelParticles.length >= e.maxRefuelParticles) return;
    const p = e.refuelPool.acquire();
    const mat = p.material as THREE.MeshBasicMaterial;
    mat.color.set(Math.random() < 0.6 ? '#10b981' : '#00f2fe');
    mat.opacity = 0.9;
    p.position.set(fromPos[0], fromPos[1] + 2.2, fromPos[2] - 1.4);
    const vel = new THREE.Vector3(
      (toPos.x - p.position.x) * 3.5,
      (toPos.y + 0.75 - p.position.y) * 3.5,
      (toPos.z - p.position.z) * 3.5
    );
    e.refuelParticles.push({ mesh: p, vel, life: 0.35 });
  }

  updateRefuelParticles(dt: number) {
    const e = this.e;
    for (let i = e.refuelParticles.length - 1; i >= 0; i--) {
      const p = e.refuelParticles[i];
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;
      p.life -= dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / 0.35);

      if (p.life <= 0) {
        e.refuelPool.release(p.mesh);
        e.refuelParticles.splice(i, 1);
      }
    }
  }

  /** Distance activation + tree LOD (spec §25). */
  updateLod() {
    const e = this.e;
    const p = e.state.isRiding ? e.bikePos : e.playerPos;
    const far = e.currentQuality.drawDistance;
    const lightR2 = (far * LOD.lightRange) ** 2;
    const propR2 = (far * LOD.propRange) ** 2;
    const lod1R2 = propR2 * 0.4;

    if (e.world.streetLights) {
      const lightsOn = e.currentQuality.streetLights;
      for (const sl of e.world.streetLights) {
        if (!lightsOn) {
          sl.light.visible = false;
          sl.light.intensity = 0;
          continue;
        }
        const d2 = (sl.group.position.x - p.x) ** 2 + (sl.group.position.z - p.z) ** 2;
        const on = d2 <= lightR2;
        sl.light.visible = on;
        sl.light.intensity = on ? 2.4 : 0;
      }
    }
    if (e.world.trees) {
      for (const t of e.world.trees) {
        const d2 = (t.position.x - p.x) ** 2 + (t.position.z - p.z) ** 2;
        t.visible = d2 <= propR2;
        if (!t.visible) continue;
        const near = d2 <= lod1R2;
        const lod1 = t.userData.lod1 as THREE.Object3D | undefined;
        if (lod1) {
          lod1.visible = near;
        } else {
          t.traverse((c) => {
            if (c.name === 'lod1') {
              t.userData.lod1 = c;
              c.visible = near;
            }
          });
        }
      }
    }
  }
}
