import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { CameraMode } from '../types/game';
import { soundEngine } from './audio';
import { CAMERA } from './tunables';

/**
 * Camera system (spec §8) — four modes (chase / action / FPV / tactical) with
 * speed-sensitive framing, plus drag/swipe look.
 *
 * Camera heading (`cameraYaw`) is world-space and independent of the agent facing.
 * Looking around while standing still does not snap back; recentering only happens
 * when the followed subject is actually moving.
 */
export class CameraRig {
  private readonly targetPos = new THREE.Vector3();

  constructor(private e: GameEngine) {}

  /** Drag / swipe on the canvas (not on UI) to look around. */
  attachPointerControls() {
    const e = this.e;
    const dom = e.container;
    dom.style.touchAction = 'none';

    const onPointerDown = (ev: PointerEvent) => {
      if ((ev.target as HTMLElement)?.closest('button, input, select, a, .pointer-events-auto')) {
        return;
      }
      e.isPointerDragging = true;
      e.lastPointerX = ev.clientX;
      e.lastPointerY = ev.clientY;
      try {
        dom.setPointerCapture(ev.pointerId);
      } catch {
        /* capture not required */
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!e.isPointerDragging) return;
      const dx = ev.clientX - e.lastPointerX;
      const dy = ev.clientY - e.lastPointerY;
      e.lastPointerX = ev.clientX;
      e.lastPointerY = ev.clientY;

      e.cameraYaw -= dx * CAMERA.dragYawSensitivity;
      e.orbitPitchOffset = THREE.MathUtils.clamp(
        e.orbitPitchOffset + dy * CAMERA.dragPitchSensitivity,
        CAMERA.pitchOffsetMin,
        CAMERA.pitchOffsetMax
      );
    };

    const onPointerUp = (ev: PointerEvent) => {
      e.isPointerDragging = false;
      try {
        if (dom.hasPointerCapture(ev.pointerId)) dom.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  facingYaw(): number {
    const e = this.e;
    if (e.state.isMiniDroneActive) return e.droneRot;
    if (e.state.isRiding) return e.bikeRot;
    return e.playerRot;
  }

  /** Snap look back behind the subject (mode switch, reset, teleport). */
  resetLook() {
    const e = this.e;
    e.cameraYaw = this.facingYaw();
    e.orbitYawOffset = 0;
    e.orbitPitchOffset = 0;
  }

  setMode(mode: CameraMode) {
    const e = this.e;
    e.state.cameraMode = mode;
    this.resetLook();
    soundEngine.playCameraSwitch();
    const modeNames: Record<CameraMode, string> = {
      chase: 'Chase Cam (Dynamic 3rd Person)',
      action: 'Action Cam (Low Cinematic)',
      fpv: 'Cockpit Cam (FPV Handlebars)',
      tactical: 'Tactical Cam (Overhead Map View)',
    };
    e.setNotification(`Camera Mode: ${modeNames[mode]}`);
    e.notifyState();
  }

  cycleMode() {
    const modes: CameraMode[] = ['chase', 'action', 'fpv', 'tactical'];
    const currentIndex = modes.indexOf(this.e.state.cameraMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.setMode(nextMode);
  }

  update(dt: number) {
    const e = this.e;
    const target = e.state.isMiniDroneActive
      ? e.dronePos
      : e.state.isRiding
      ? e.bikePos
      : e.playerPos;

    const facing = this.facingYaw();
    if (!Number.isFinite(e.cameraYaw)) e.cameraYaw = facing;

    // Recenter only while the *followed* subject is moving — leftover bikeSpeed
    // after a dismount used to yank look-around back to the agent's face.
    if (this.isSubjectMoving() && !e.isPointerDragging) {
      e.cameraYaw = lerpAngle(e.cameraYaw, facing, Math.min(1, dt * CAMERA.recenterLerpPerSec));
      e.orbitPitchOffset = THREE.MathUtils.lerp(e.orbitPitchOffset, 0, dt * CAMERA.recenterLerpPerSec);
    }
    e.orbitYawOffset = wrapAngle(e.cameraYaw - facing);

    const effectiveRot = e.cameraYaw;
    const mode = e.state.cameraMode;

    let dist = 7.5;
    let height = 3.0;
    let lookHeight = 1.3;

    if (e.state.isMiniDroneActive) {
      dist = 4.5;
      height = 1.8;
      lookHeight = 0.5;
    } else if (mode === 'action') {
      dist = 4.8;
      height = 1.6;
      lookHeight = 1.1;
    } else if (mode === 'fpv') {
      dist = -0.3;
      height = e.state.isRiding ? 1.38 : 1.7;
      lookHeight = 1.35;
    } else if (mode === 'tactical') {
      dist = 28.0;
      height = 36.0;
      lookHeight = 0.0;
    } else {
      dist = e.state.isRiding ? 7.6 : 5.4;
      height = e.state.isRiding ? 3.0 : 2.4;
      lookHeight = 1.3;
    }

    const pitchBonus = mode === 'tactical' ? 0 : e.orbitPitchOffset * 5.0;
    const targetCamX = target.x + Math.sin(effectiveRot) * dist;
    const targetCamZ = target.z + Math.cos(effectiveRot) * dist;
    const targetCamY = Math.max(0.6, target.y + height + pitchBonus);

    let vibX = 0;
    let vibY = 0;
    if (mode === 'fpv' && Math.abs(e.bikeSpeed) > CAMERA.fpvVibMinSpeed) {
      vibX = (Math.random() - 0.5) * 0.04;
      vibY = (Math.random() - 0.5) * 0.04;
    }

    const targetPos = this.targetPos.set(targetCamX + vibX, targetCamY + vibY, targetCamZ);
    const lerpSpeed = e.isPointerDragging
      ? CAMERA.posLerpLook
      : mode === 'fpv'
      ? CAMERA.posLerpFPV
      : CAMERA.posLerpDefault;
    e.camera.position.lerp(targetPos, Math.min(1, dt * lerpSpeed));

    if (mode === 'fpv') {
      const lookTargetX = target.x - Math.sin(effectiveRot) * 20;
      const lookTargetZ = target.z - Math.cos(effectiveRot) * 20;
      e.camera.lookAt(lookTargetX, target.y + lookHeight, lookTargetZ);
    } else {
      e.camera.lookAt(target.x, target.y + lookHeight, target.z);
    }

    const baseFOV = mode === 'action' ? CAMERA.fovBaseAction : mode === 'fpv' ? CAMERA.fovBaseFPV : CAMERA.fovBaseChase;
    const boostFOVBonus = e.state.isBoosting ? CAMERA.fovBoostBonus : Math.min(CAMERA.fovSpeedBonusMax, Math.abs(e.bikeSpeed) / 4);
    const targetFOV = baseFOV + boostFOVBonus;
    e.camera.fov = THREE.MathUtils.lerp(e.camera.fov, targetFOV, dt * CAMERA.fovLerpPerSec);
    e.camera.updateProjectionMatrix();
  }

  private isSubjectMoving(): boolean {
    const e = this.e;
    const stick =
      Math.abs(e.input.analogThrottle) > CAMERA.moveDeadzone ||
      Math.abs(e.input.analogSteer) > CAMERA.moveDeadzone;
    const keys = e.input.forward || e.input.backward || e.input.left || e.input.right;
    if (e.state.isMiniDroneActive) return keys || stick;
    if (e.state.isRiding) {
      return keys || stick || Math.abs(e.bikeSpeed) > CAMERA.recenterMinBikeSpeed;
    }
    return keys || stick;
  }
}

export function wrapAngle(a: number): number {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerpAngle(from: number, to: number, t: number): number {
  return from + wrapAngle(to - from) * t;
}
