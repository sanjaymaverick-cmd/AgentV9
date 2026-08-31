import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { soundEngine } from './audio';
import { BIKE } from './tunables';
import { resolveCircleAabbs } from './collision';
import { gatherCollisionBoxes } from './world';
import { stepMotorcycleArcade } from './motorcycleArcade';

/**
 * V9 motorcycle arcade physics (spec §5).
 *
 * Numeric throttle / fuel / nitro / steering live in `motorcycleArcade.ts` so they can
 * be unit-tested. This class copies engine fields through that step, then owns ramps,
 * interior collision, mesh pose and the drift-spark particles.
 */
export class MotorcyclePhysics {
  constructor(private e: GameEngine) {}

  update(dt: number) {
    const e = this.e;
    const isControlActive = e.state.isRiding || e.state.isRemoteV9Active;
    const prevNitro = e.state.nitroLevel;

    const sim = {
      bikeSpeed: e.bikeSpeed,
      bikeRot: e.bikeRot,
      bikeLean: e.bikeLean,
      bikeX: e.bikePos.x,
      bikeY: e.bikePos.y,
      bikeZ: e.bikePos.z,
      bikeVerticalVel: e.bikeVerticalVel,
      isBikeGrounded: e.isBikeGrounded,
      isDrifting: e.isDrifting,
      fuelLevel: e.state.fuelLevel,
      nitroLevel: e.state.nitroLevel,
      steerAngleDeg: e.state.steerAngleDeg,
    };

    stepMotorcycleArcade(sim, {
      isControlActive,
      isBoosting: e.state.isBoosting,
      isRefueling: e.state.isRefueling,
      isSilentMode: e.state.isSilentMode,
      steeringAssist: e.settings.steeringAssist,
      input: e.input,
    }, dt);

    e.bikeSpeed = sim.bikeSpeed;
    e.bikeRot = sim.bikeRot;
    e.bikeLean = sim.bikeLean;
    e.bikePos.x = sim.bikeX;
    e.bikePos.y = sim.bikeY;
    e.bikePos.z = sim.bikeZ;
    e.bikeVerticalVel = sim.bikeVerticalVel;
    e.isBikeGrounded = sim.isBikeGrounded;
    e.isDrifting = sim.isDrifting;
    e.state.isDrifting = sim.isDrifting;
    e.state.fuelLevel = sim.fuelLevel;
    e.state.nitroLevel = sim.nitroLevel;
    e.state.steerAngleDeg = sim.steerAngleDeg;

    if (sim.nitroLevel < prevNitro && Math.random() < 0.3) {
      soundEngine.playNitro();
    }

    if (isControlActive && Math.abs(e.bikeSpeed) > 0.4 && !e.state.isRefueling) {
      if (e.state.fuelLevel <= 20 && e.state.fuelLevel > 0) {
        const now = Date.now();
        if (now - e.lastLowFuelAlertTime > BIKE.lowFuelAlertCooldownMs) {
          e.lastLowFuelAlertTime = now;
          soundEngine.playLowFuelBeep();
          if (e.state.fuelLevel <= 15) {
            soundEngine.speak('Caution Agent. Energy cell low. Check radar for nearest fuel station.', 'kira');
            e.setNotification('⚠️ V9 Energy Cells Critical (<20%)! Locate a Cyber Fuel Station.');
          }
        }
      } else if (e.state.fuelLevel <= 0 && !e.hasWarnedZeroFuel) {
        e.hasWarnedZeroFuel = true;
        soundEngine.speak('V9 Energy Cells depleted! Auxiliary solar crawl mode engaged.', 'kira');
        e.setNotification('⚠️ V9 Fuel Empty! Emergency Solar Crawl Active (13 MPH Max).');
      }
    }

    if (e.isDrifting) {
      if (Math.random() < 0.25) {
        soundEngine.playDrift();
        this.spawnDriftParticle();
      }
      e.addStuntScore(Math.round(dt * BIKE.driftScorePerSec), 'CYBER DRIFT');
    }

    resolveCircleAabbs(e.bikePos, 1.15, gatherCollisionBoxes(e.world, e.stealthAI.foamBoxes()));

    // Check Stunt Ramps Collision
    const bikeBox = new THREE.Box3().setFromCenterAndSize(e.bikePos, new THREE.Vector3(1.5, 1.5, 2.5));
    for (const ramp of e.world.stuntRamps) {
      if (ramp.box.intersectsBox(bikeBox) && e.bikeSpeed > BIKE.rampMinSpeed) {
        e.bikeVerticalVel = BIKE.rampLaunchImpulse * ramp.boostForce;
        e.isBikeGrounded = false;
        soundEngine.playJump();
        e.addStuntScore(BIKE.rampScore, 'MEGA RAMP LAUNCH');
      }
    }

    // Boundary limits
    e.bikePos.x = THREE.MathUtils.clamp(e.bikePos.x, -BIKE.worldBound, BIKE.worldBound);
    e.bikePos.z = THREE.MathUtils.clamp(e.bikePos.z, -BIKE.worldBound, BIKE.worldBound);

    // Apply to 3D Motorcycle Object
    e.motorcycle.group.position.copy(e.bikePos);
    e.motorcycle.group.rotation.y = e.bikeRot;
    e.motorcycle.group.rotation.z = e.bikeLean;

    // Spin wheels
    const spin = (e.bikeSpeed * dt) / BIKE.wheelRadius;
    e.motorcycle.frontWheel.rotation.x += spin;
    e.motorcycle.backWheel.rotation.x += spin;

    // Update drift particles
    this.updateDriftParticles(dt);
  }

  private spawnDriftParticle() {
    const e = this.e;
    if (e.driftParticles.length >= e.maxDriftParticles) return;
    const p = e.driftPool.acquire();
    (p.material as THREE.MeshBasicMaterial).color.set(Math.random() < 0.5 ? '#38bdf8' : '#00f2fe');
    p.position.set(
      e.bikePos.x + Math.sin(e.bikeRot) * 1.2,
      e.bikePos.y + 0.15,
      e.bikePos.z + Math.cos(e.bikeRot) * 1.2
    );
    e.driftParticles.push({
      mesh: p,
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3),
      life: 0.4,
    });
  }

  private updateDriftParticles(dt: number) {
    const e = this.e;
    for (let i = e.driftParticles.length - 1; i >= 0; i--) {
      const part = e.driftParticles[i];
      part.mesh.position.x += part.vel.x * dt;
      part.mesh.position.y += part.vel.y * dt;
      part.mesh.position.z += part.vel.z * dt;
      part.life -= dt;
      if (part.life <= 0) {
        e.driftPool.release(part.mesh);
        e.driftParticles.splice(i, 1);
      }
    }
  }
}
