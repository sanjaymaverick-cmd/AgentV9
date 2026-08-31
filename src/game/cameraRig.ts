import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { CameraMode } from '../types/game';
import { soundEngine } from './audio';
import { CAMERA } from './tunables';

/**
 * Camera system (spec §8) — four modes (chase / action / FPV / tactical) with
 * speed-sensitive framing, plus the drag-to-orbit pointer handling.
 *
 * Moved verbatim from GameEngine; `this.` -> `this.e.`, feel scalars -> `CAMERA.*`.
 * The per-mode dist/height/lookHeight table is left inline as a single readable block.
 */
export class CameraRig {
  constructor(private e: GameEngine) {}

  /** Drag anywhere on the canvas (not on UI) to look around. */
  attachPointerControls() {
    const e = this.e;
    const dom = e.container;

    const onPointerDown = (ev: PointerEvent) => {
      // Ignore if clicking on UI buttons
      if ((ev.target as HTMLElement)?.closest('button, input, select, a, .pointer-events-auto')) {
        return;
      }
      e.isPointerDragging = true;
      e.lastPointerX = ev.clientX;
      e.lastPointerY = ev.clientY;
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!e.isPointerDragging) return;
      const dx = ev.clientX - e.lastPointerX;
      const dy = ev.clientY - e.lastPointerY;
      e.lastPointerX = ev.clientX;
      e.lastPointerY = ev.clientY;

      e.orbitYawOffset -= dx * CAMERA.dragYawSensitivity;
      e.orbitPitchOffset = THREE.MathUtils.clamp(
        e.orbitPitchOffset + dy * CAMERA.dragPitchSensitivity,
        CAMERA.pitchOffsetMin,
        CAMERA.pitchOffsetMax
      );
    };

    const onPointerUp = () => {
      e.isPointerDragging = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  setMode(mode: CameraMode) {
    const e = this.e;
    e.state.cameraMode = mode;
    e.orbitYawOffset = 0;
    e.orbitPitchOffset = 0;
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

    const baseRot = e.state.isMiniDroneActive
      ? e.droneRot
      : e.state.isRiding
      ? e.bikeRot
      : e.playerRot;

    // Auto-recenter orbit view smoothly while actively moving
    const isMoving = e.input.forward || e.input.backward || Math.abs(e.input.analogThrottle) > 0.2 || Math.abs(e.bikeSpeed) > CAMERA.recenterMinBikeSpeed;
    if (isMoving && !e.isPointerDragging) {
      e.orbitYawOffset = THREE.MathUtils.lerp(e.orbitYawOffset, 0, dt * CAMERA.recenterLerpPerSec);
      e.orbitPitchOffset = THREE.MathUtils.lerp(e.orbitPitchOffset, 0, dt * CAMERA.recenterLerpPerSec);
    }

    const effectiveRot = baseRot + e.orbitYawOffset;
    const mode = e.state.cameraMode;

    let dist = 7.5;
    let height = 3.0;
    let lookHeight = 1.3;

    if (e.state.isMiniDroneActive) {
      dist = 4.5;
      height = 1.8;
      lookHeight = 0.5;
    } else if (mode === 'action') {
      // Low, cinematic action angle showing bike suspension and flames
      dist = 4.8;
      height = 1.6;
      lookHeight = 1.1;
    } else if (mode === 'fpv') {
      // Cockpit / Handlebars First Person Perspective
      dist = -0.3;
      height = e.state.isRiding ? 1.38 : 1.7;
      lookHeight = 1.35;
    } else if (mode === 'tactical') {
      // Overhead Bird's-Eye Tactical Map view
      dist = 28.0;
      height = 36.0;
      lookHeight = 0.0;
    } else {
      // Default 'chase' view
      dist = e.state.isRiding ? 7.6 : 5.4;
      height = e.state.isRiding ? 3.0 : 2.4;
      lookHeight = 1.3;
    }

    const pitchBonus = mode === 'tactical' ? 0 : e.orbitPitchOffset * 5.0;
    const targetCamX = target.x + Math.sin(effectiveRot) * dist;
    const targetCamZ = target.z + Math.cos(effectiveRot) * dist;
    const targetCamY = Math.max(0.6, target.y + height + pitchBonus);

    // Vibration at high speed for FPV mode
    let vibX = 0;
    let vibY = 0;
    if (mode === 'fpv' && Math.abs(e.bikeSpeed) > CAMERA.fpvVibMinSpeed) {
      vibX = (Math.random() - 0.5) * 0.04;
      vibY = (Math.random() - 0.5) * 0.04;
    }

    const targetPos = new THREE.Vector3(targetCamX + vibX, targetCamY + vibY, targetCamZ);
    const lerpSpeed = mode === 'fpv' ? CAMERA.posLerpFPV : CAMERA.posLerpDefault;
    e.camera.position.lerp(targetPos, dt * lerpSpeed);

    if (mode === 'fpv') {
      // Look straight ahead in direction of vehicle
      const lookTargetX = target.x - Math.sin(effectiveRot) * 20;
      const lookTargetZ = target.z - Math.cos(effectiveRot) * 20;
      e.camera.lookAt(lookTargetX, target.y + lookHeight, lookTargetZ);
    } else {
      e.camera.lookAt(target.x, target.y + lookHeight, target.z);
    }

    // Dynamic FOV on boost / speed
    const baseFOV = mode === 'action' ? CAMERA.fovBaseAction : mode === 'fpv' ? CAMERA.fovBaseFPV : CAMERA.fovBaseChase;
    const boostFOVBonus = e.state.isBoosting ? CAMERA.fovBoostBonus : Math.min(CAMERA.fovSpeedBonusMax, Math.abs(e.bikeSpeed) / 4);
    const targetFOV = baseFOV + boostFOVBonus;
    e.camera.fov = THREE.MathUtils.lerp(e.camera.fov, targetFOV, dt * CAMERA.fovLerpPerSec);
    e.camera.updateProjectionMatrix();
  }
}
