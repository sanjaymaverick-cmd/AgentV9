import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { soundEngine } from './audio';
import { BIKE } from './tunables';
import { resolveCircleAabbs } from './collision';
import { gatherInteriorBoxes } from './world';

/**
 * V9 motorcycle arcade physics (spec §5).
 *
 * Owns throttle/brake, nitro + fuel burn, speed-scaled steering, lean, drift, ramp
 * launches, airborne gravity and the drift-spark particles. Reads `engine.input` and
 * mutates the engine's `bike*` transform fields plus the shared `GameState`.
 *
 * Bodies were moved verbatim from GameEngine; the only edits are `this.` -> `this.e.`
 * and inline magic numbers swapped for named `BIKE.*` tunables of identical value.
 */
export class MotorcyclePhysics {
  constructor(private e: GameEngine) {}

  update(dt: number) {
    const e = this.e;
    const isControlActive = e.state.isRiding || e.state.isRemoteV9Active;
    const isOutOfFuel = e.state.fuelLevel <= 0;

    // Acceleration & Speed limits based on fuel and boost
    const accel = isOutOfFuel ? BIKE.accelOutOfFuel : e.state.isBoosting ? BIKE.accelBoost : BIKE.accelNormal;
    const maxSpeed = isOutOfFuel ? BIKE.maxSpeedOutOfFuel : e.state.isBoosting ? BIKE.maxSpeedBoost : BIKE.maxSpeedNormal;
    const reverseMax = isOutOfFuel ? BIKE.reverseMaxOutOfFuel : BIKE.reverseMaxNormal;

    // Nitro consumption/recharge (only if has fuel)
    if (e.input.boost && isControlActive && e.state.nitroLevel > 0 && !isOutOfFuel) {
      e.state.nitroLevel = Math.max(0, e.state.nitroLevel - dt * BIKE.nitroDrainPerSec);
      if (Math.random() < 0.3) soundEngine.playNitro();
    } else {
      e.state.nitroLevel = Math.min(100, e.state.nitroLevel + dt * BIKE.nitroRegenPerSec);
    }

    // Fuel Consumption Calculation
    if (isControlActive && Math.abs(e.bikeSpeed) > 0.4 && !e.state.isRefueling) {
      let fuelBurnRate = BIKE.fuelBurnBase + (Math.abs(e.bikeSpeed) / BIKE.maxSpeedNormal) * BIKE.fuelBurnSpeedScale;
      if (e.state.isBoosting) {
        fuelBurnRate += BIKE.fuelBurnBoostBonus;
      }
      if (e.state.isSilentMode) {
        fuelBurnRate *= BIKE.fuelBurnSilentMult; // Silent electric eco mode
      }
      if (e.isDrifting) {
        fuelBurnRate += BIKE.fuelBurnDriftBonus;
      }

      e.state.fuelLevel = Math.max(0, e.state.fuelLevel - fuelBurnRate * dt);

      // Low fuel warning beep & Kira audio
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

    // Acceleration & Braking (Supports Keyboard & Virtual Joystick Analog Input)
    if (isControlActive) {
      const throttleInput = e.input.analogThrottle !== 0
        ? e.input.analogThrottle
        : e.input.forward ? 1 : e.input.backward ? -1 : 0;

      if (throttleInput > 0) {
        e.bikeSpeed = Math.min(maxSpeed, e.bikeSpeed + accel * throttleInput * dt);
      } else if (throttleInput < 0) {
        if (e.bikeSpeed > 0) {
          e.bikeSpeed = Math.max(0, e.bikeSpeed - BIKE.brakeDecel * Math.abs(throttleInput) * dt); // Brake
        } else {
          e.bikeSpeed = Math.max(reverseMax, e.bikeSpeed - BIKE.reverseAccel * Math.abs(throttleInput) * dt); // Reverse
        }
      } else {
        // Natural friction drag
        e.bikeSpeed *= Math.pow(BIKE.frictionPerFrame, dt * 60);
      }

      // Drift / Powerslide Mechanic
      const isDriftAction = e.input.drift || (e.input.jump && (e.input.left || e.input.right || Math.abs(e.input.analogSteer) > 0.2));
      e.isDrifting = isDriftAction && Math.abs(e.bikeSpeed) > BIKE.driftMinSpeed;
      e.state.isDrifting = e.isDrifting;

      if (e.isDrifting) {
        if (Math.random() < 0.25) {
          soundEngine.playDrift();
          this.spawnDriftParticle();
        }
        e.addStuntScore(Math.round(dt * BIKE.driftScorePerSec), 'CYBER DRIFT');
      }

      // Steering (Keyboard + Analog Joystick)
      let steerVal = 0;
      if (e.input.analogSteer !== 0) {
        steerVal = -e.input.analogSteer;
      } else if (e.input.left) {
        steerVal = 1;
      } else if (e.input.right) {
        steerVal = -1;
      }

      let steerSpeed = (BIKE.steerBase * (1 + e.settings.steeringAssist * BIKE.steerAssistFactor)) * Math.sign(e.bikeSpeed || 1);
      if (e.isDrifting) {
        steerSpeed *= BIKE.steerDriftMult;
      }

      if (steerVal !== 0) {
        const speedFactor = Math.min(1, Math.abs(e.bikeSpeed) / 5);
        e.bikeRot += steerSpeed * steerVal * dt * speedFactor;
        const targetLean = e.isDrifting ? steerVal * BIKE.leanDrift : steerVal * BIKE.leanNormal;
        e.bikeLean = THREE.MathUtils.lerp(e.bikeLean, targetLean, dt * (e.isDrifting ? BIKE.leanLerpDrift : BIKE.leanLerpNormal));
      } else {
        e.bikeLean = THREE.MathUtils.lerp(e.bikeLean, 0, dt * BIKE.leanReturnLerp);
      }
    } else {
      e.bikeSpeed *= BIKE.idleDecayControlled;
      e.isDrifting = false;
      e.state.isDrifting = false;
    }

    e.state.steerAngleDeg = Math.round(e.bikeLean * BIKE.steerAngleDegScale);

    // Gravity & Super Jump
    if (!e.isBikeGrounded) {
      e.bikeVerticalVel -= BIKE.gravity * dt;
      e.bikePos.y += e.bikeVerticalVel * dt;
      if (e.bikePos.y <= 0) {
        e.bikePos.y = 0;
        e.bikeVerticalVel = 0;
        e.isBikeGrounded = true;
      }
    }

    // Position displacement
    const forwardX = -Math.sin(e.bikeRot) * e.bikeSpeed * dt;
    const forwardZ = -Math.cos(e.bikeRot) * e.bikeSpeed * dt;
    e.bikePos.x += forwardX;
    e.bikePos.z += forwardZ;

    resolveCircleAabbs(e.bikePos, 1.15, gatherInteriorBoxes(e.world));

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
