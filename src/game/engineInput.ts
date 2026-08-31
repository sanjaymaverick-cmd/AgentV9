import type { GameEngine } from './gameEngine';

/**
 * Keyboard + window-resize wiring (spec §6). Translates key events into the shared
 * `engine.input` struct and fires the one-shot action methods. Touch and (future)
 * gamepad write into the same `EngineInputState`, so nothing here is input-source
 * specific beyond the key map.
 *
 * Moved verbatim from GameEngine.setupEventListeners; only `this.` -> `this.e.`.
 */
export class EngineInput {
  constructor(private e: GameEngine) {}

  attach() {
    const e = this.e;

    const onKeyDown = (ev: KeyboardEvent) => {
      // Don't trigger game hotkeys if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((ev.target as HTMLElement)?.tagName)) return;

      switch (ev.code) {
        case 'KeyW':
        case 'ArrowUp':
          e.input.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          e.input.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          e.input.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          e.input.right = true;
          break;
        case 'Space':
          e.input.jump = true;
          e.handleJumpOrBrake();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          e.input.boost = true;
          break;
        case 'KeyE':
          e.handleInteractAction();
          break;
        case 'KeyF':
          e.fireGadget();
          break;
        case 'KeyC':
          e.toggleSilentOrCrouch();
          break;
        case 'KeyV':
          e.cycleCameraMode();
          break;
        case 'KeyR':
          e.resetVehicle();
          break;
        case 'KeyH':
          e.honkHorn();
          break;
        case 'KeyQ':
          e.input.drift = true;
          break;
        case 'Digit1':
          e.switchGadget('emp');
          break;
        case 'Digit2':
          e.switchGadget('foam');
          break;
        case 'Digit3':
          e.switchGadget('drone');
          break;
        case 'Digit4':
          e.switchGadget('hologram');
          break;
        case 'Digit5':
          e.switchGadget('remote_v9');
          break;
      }
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      switch (ev.code) {
        case 'KeyW':
        case 'ArrowUp':
          e.input.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          e.input.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          e.input.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          e.input.right = false;
          break;
        case 'Space':
          e.input.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          e.input.boost = false;
          break;
        case 'KeyQ':
          e.input.drift = false;
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Resize handler
    const onResize = () => {
      if (!e.container) return;
      e.camera.aspect = e.container.clientWidth / e.container.clientHeight;
      e.camera.updateProjectionMatrix();
      e.renderer.setSize(e.container.clientWidth, e.container.clientHeight);
    };
    window.addEventListener('resize', onResize);
  }
}
